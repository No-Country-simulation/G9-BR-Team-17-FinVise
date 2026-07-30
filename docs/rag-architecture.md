# Arquitetura RAG & Inteligência Vetorial (`pgvector`)

> Documentação técnica detalhada da implementação de **Retrieval-Augmented Generation (RAG)**, banco de dados vetorial PostgreSQL (`pgvector`), geração de embeddings otimizada e comunicação streaming no **FinVise**.

---

## 📌 Visão Geral da Solução RAG

O Agente Financeiro do **FinVise** utiliza um pipeline **Strict RAG (Grounding RAG)**. Isso significa que o agente conversacional só responde perguntas sobre transações e saldos baseando-se estritamente em trechos financeiros recuperados do banco de dados do usuário.

Caso o usuário pergunte algo fora dos dados financeiros recuperados, o agente é instruído via prompt estrito a informar cordialmente que a informação não foi encontrada em seus registros.

---

## 🏗️ Fluxo de Ingestão e Vetorização

```text
  ┌─────────────────────────────────────────────────────────────┐
  │ 1. Ingestão (CSV Import / Open Finance Sync)   [Java]      │
  │    Salva chunks na tabela rag_documents (sem embedding)     │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 2. Trigger: POST /internal/v1/rag/index        [Java→Py]   │
  │    Backend chama ai-service para indexar embeddings         │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 3. Batch Embeddings (OpenAI text-embedding-3-small) [Py]   │
  │    Processa em batches de 100 textos (1536 dimensões)       │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 4. Persistência em PostgreSQL 16 (Tabela rag_documents)    │
  │    Coluna: embedding vector(1536) com Índice HNSW (V15)    │
  └─────────────────────────────────────────────────────────────┘
```

### 1. Estrutura da Tabela `rag_documents` (`Flyway V13, V14 & V15`)

- **Tabela**: `rag_documents`
- **Coluna Vetorial**: `embedding vector(1536)` (adicionada em V14, índice HNSW em V15)
- **Metadados JSONB**: `metadata jsonb` (armazena `transactionId`, `source`, `type`, `amount`, `category`, `date`, `description`)
- **Texto Chave**: `document_chunk text` (representação textual formatada da transação)

### 2. Busca por Similaridade de Cosseno

A recuperação de contexto relevante utiliza a distância de cosseno nativa da extensão `pgvector`:

$$\text{Similaridade} = 1 - (\mathbf{u} \cdot \mathbf{v})$$

Query executada no banco PostgreSQL:

```sql
SELECT id, document_chunk, metadata, 1 - (embedding <=> :queryEmbedding) AS similarity
FROM rag_documents
WHERE user_id = :userId
  AND embedding IS NOT NULL
ORDER BY embedding <=> :queryEmbedding ASC
LIMIT :topK;
```

---

## ⚡ Otimizações de Desempenho e Custo

### 1. Batching de Embeddings (Otimização de API)

Em vez de enviar chamadas individuais via HTTP para a OpenAI para cada transação (o que gera overhead de rede e alto tempo de resposta), o `RAGService` agrupa até **100 transações em uma única requisição HTTP**:

```python
# ai-service/app/services/rag_service.py
response = await self.client.embeddings.create(
    model="text-embedding-3-small",
    input=texts  # List[str] contendo múltiplos conteúdos
)
return [data.embedding for data in response.data]
```

- **Economia de Tokens e Latência**: Redução de ~50x na latência de rede durante importação de planilhas.
- **Fallback Determinístico**: Em ambientes sem chave da OpenAI (`OPENAI_API_KEY`), o sistema gera embeddings pseudo-determinísticos de 1536 dimensões sem quebrar a aplicação.

---

## 🌊 Comunicação em Tempo Real (SSE Streaming)

O chat do Agente IA utiliza **Server-Sent Events (SSE)** para transmitir a resposta token por token através de todas as camadas:

- **Endpoint público Spring Boot**: `/api/v1/agent/conversations/{conversationId}/messages/stream`
- **Endpoint FastAPI**: `/internal/v1/agent/respond/stream`
- **MediaType**: `text/event-stream`
- **Formato**:
  ```text
  event: tools
  data: {"tools":["get_financial_profile"]}

  event: token
  data: {"token":"Olá! "}

  event: done
  data: {"conversationId":"...","message":{"id":"...","content":"Olá! "}}
  ```

O backend autentica a requisição, persiste a mensagem do usuário, encaminha o stream
do FastAPI e salva a resposta completa do assistente. No frontend (`AgentPage.tsx`),
os eventos de uma requisição `fetch` POST são processados com `ReadableStream`.

---

## 🎨 Interface & Badges Sem Emojis Brutos

Todas as chamadas de ferramentas do agente (*Tool Calls*) exibem badges minimalistas no Frontend usando ícones SVG do **Lucide React**:

| Ferramenta | Ícone Lucide | Função |
| :--- | :--- | :--- |
| `classify_transaction` | `<Tag />` | Classifica a categoria da transação |
| `query_database` | `<BarChart3 />` | Executa consultas agregadas de gastos |
| `generate_recommendations` | `<Lightbulb />` | Produz dicas financeiras acionáveis |
| `search_rag` | `<Search />` | Busca contextual vetorial no `pgvector` |

---

## 🔒 Segurança e Isolamento

- **Controle de Acesso por Tenant**: Todas as consultas vetoriais exigem e filtram obrigatoriamente `user_id`. Um usuário nunca tem acesso a trechos de documentos de terceiros.
- **Proteção de Chaves**: A `OPENAI_API_KEY` reside exclusivamente no container interno `ai-service` e nunca é exposta no frontend.
