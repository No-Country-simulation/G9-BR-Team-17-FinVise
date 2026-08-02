# Arquitetura RAG e recuperação vetorial (`pgvector`)

> Implementação atual de ingestão, fatos financeiros, embeddings, recuperação híbrida e comunicação streaming do agente FinVise.

## Visão geral

O agente combina duas fontes de evidência:

1. **Ferramentas determinísticas**, executadas sobre o `AgentContext` calculado pelo backend.
2. **RAG híbrido**, com chunks persistidos pelo backend e recuperados diretamente pelo AI Service no PostgreSQL.

O prompt orienta a resposta a não completar lacunas por suposição. Quando não há chunk relevante, fatos retornados pelas ferramentas ainda podem sustentar respostas numéricas; sem evidência de nenhum tipo, o agente deve declarar a limitação.

O RAG é isolado por `user_id`, `source_type` e, quando selecionados na conversa, `source_id`. CSV (`CSV_IMPORT`) e Open Finance (`OPEN_FINANCE`) não são misturados quando a conversa define uma origem.

## Responsabilidades

| Componente | Responsabilidade |
| --- | --- |
| Backend Spring Boot | Constrói fatos/chunks, mantém o schema Flyway, solicita indexação e expõe status |
| AI Service FastAPI | Gera embeddings, atualiza estado de índice e executa recuperação vetorial/full-text |
| PostgreSQL | Persiste chunks, metadados, vetores, status e snapshots financeiros |
| Frontend | Define origem, `sourceIds` e profundidade (`topK`); exibe tools, fontes e tokens SSE |

O AI Service possui acesso SQL direto a `rag_documents`. Ele não cria schema: `_ensure_embedding_column` é somente uma verificação de capacidade, e alterações pertencem às migrações Flyway.

## Fluxo de ingestão e indexação

```text
1. CSV importado ou item Pluggy sincronizado
   └── backend persiste transações
       ├── reconstrói financial_fact_snapshots
       ├── cria/atualiza rag_documents
       └── publica RagIndexRequestedEvent

2. Após o commit
   └── RagIndexEventListener chama POST /internal/v1/rag/index
       └── background=true

3. AI Service
   ├── obtém advisory lock por user_id
   ├── seleciona chunks PENDING/desatualizados com FOR UPDATE SKIP LOCKED
   ├── marca PROCESSING
   ├── gera embeddings em lote
   └── grava vetor, modelo, timestamp e INDEXED ou FAILED
```

O endpoint em background retorna imediatamente `status: queued` e `indexed_count: 0`. A contagem real deve ser acompanhada por `GET /api/v1/rag/status`. A rota pública `POST /api/v1/rag/index-step` executa uma chamada síncrona e retorna quantos documentos foram indexados naquela etapa.

### Idempotência

- Transações são deduplicadas no RAG pelo índice parcial único `(user_id, source_type, source_id, transaction_id)`.
- Chunks derivados têm `content_hash` e índice único por usuário/origem/tipo/hash.
- Antes de reconstruir resumos de uma fonte, o backend remove os chunks derivados anteriores e preserva chunks de transação já conhecidos.
- A indexação recalcula documentos quando `embedding` é nulo ou `embedding_model` difere do modelo efetivo.
- Um advisory lock por `user_id` evita dois indexadores simultâneos para o mesmo usuário.

## Schema RAG

As migrações relevantes são `V13`, `V14`, `V15`, `V17`, `V18`, `V19`, `V20` e `V21`.

### `rag_documents`

| Coluna | Uso |
| --- | --- |
| `id UUID` | identificador do chunk |
| `user_id UUID` | isolamento obrigatório do usuário |
| `source_type VARCHAR(50)` | `CSV_IMPORT` ou `OPEN_FINANCE` na implementação atual |
| `source_id VARCHAR(255)` | UUID da importação/conexão representado como texto |
| `transaction_id UUID` | vínculo opcional de chunk transacional |
| `chunk_type VARCHAR(40)` | tipo de evidência |
| `document_chunk TEXT` | conteúdo textual pesquisável |
| `metadata JSONB` | origem, datas, valores, categoria e metadados de fatos |
| `content_hash VARCHAR(64)` | idempotência dos chunks derivados |
| `embedding vector(1536)` | vetor opcional, criado quando `pgvector` está disponível |
| `embedding_model VARCHAR(120)` | modelo remoto ou `local-hash-v2` |
| `embedding_created_at TIMESTAMPTZ` | criação do vetor atual |
| `index_status VARCHAR(20)` | `PENDING`, `PROCESSING`, `INDEXED` ou `FAILED` |
| `index_error TEXT` | último erro de lote, truncado a 1.000 caracteres na aplicação |
| `index_attempted_at TIMESTAMPTZ` | última tentativa |
| `created_at TIMESTAMPTZ` | criação do chunk |

Índices incluem filtros por usuário/origem/status, GIN full-text em `to_tsvector('simple', document_chunk)` e HNSW com `vector_cosine_ops`, `m=16` e `ef_construction=64`.

As migrações de vetor são tolerantes à ausência da extensão. Nesse caso, a coluna/índice vetorial podem não existir, mas o restante do schema continua e a recuperação por palavras-chave permanece disponível.

### `financial_fact_snapshots`

Um snapshot JSONB é mantido por `(user_id, source_type, source_id)`, com período, versão do schema e:

- visão geral de contagens, totais, saldo, médias, medianas e recorrências;
- fatos mensais, inclusive meses sem transações dentro do intervalo;
- fatos por categoria;
- rankings mensais e de transações;
- indicadores de qualidade, como despesas sem categoria.

Esses snapshots alimentam chunks ricos em evidência e também tornam os cálculos auditáveis fora da LLM.

## Tipos de chunk

O backend produz:

| `chunk_type` | Conteúdo |
| --- | --- |
| `TRANSACTION` | descrição, valor, tipo, data, categoria e origem de uma transação |
| `MONTHLY_SUMMARY` | resumo mensal derivado das transações da fonte |
| `CATEGORY_SUMMARY` | resumo derivado por categoria |
| `FINANCIAL_OVERVIEW` | totais, saldo, médias, medianas, recorrências e qualidade |
| `MONTHLY_FACT` | contagens, receitas, despesas, saldo e variação de um mês |
| `CATEGORY_FACT` | total, participação, média, mínimo e máximo da categoria |
| `FINANCIAL_RANKING` | melhores/piores meses e maiores/menores receitas/despesas |

Os metadados variam por tipo, mas sempre preservam informações de origem; chunks de fatos incluem `factSnapshotId`, `factSchemaVersion`, `periodStart` e `periodEnd`.

## Geração de embeddings

### Embeddings remotos

São usados quando:

```text
RAG_ENABLE_REMOTE_EMBEDDINGS=true
e
LLM_API_KEY não está vazia
```

O cliente faz `POST {LLM_BASE_URL}/embeddings` com:

```json
{
  "model": "text-embedding-3-small",
  "input": ["primeiro chunk", "segundo chunk"]
}
```

O modelo é configurável por `RAG_EMBEDDING_MODEL`, mas o código exige que cada vetor retornado tenha 1536 dimensões, pois esse é o tipo da coluna. Portanto, um modelo com outra dimensão falha com status `FAILED`.

### Embeddings locais

Sem chave ou com embeddings remotos desabilitados, o serviço usa `local-hash-v2`:

- normaliza texto para tokens alfanuméricos;
- cria unigramas e bigramas;
- distribui os recursos em 1536 posições com SHA-256 e sinal determinístico;
- normaliza o vetor pela norma L2.

Esse fallback é determinístico e adequado à continuidade local; não equivale semanticamente a um modelo remoto.

### Lotes e limites

- `RAG_EMBEDDING_BATCH_SIZE`: padrão `200`, limitado em runtime a 1–500.
- `RAG_INDEX_MAX_BATCHES`: padrão `100`, limitado a 1–100.
- Máximo teórico de uma chamada de indexação: 50.000 chunks.
- Cada lote usa uma única chamada HTTP remota com uma lista de textos.
- Em falha de geração, o lote é marcado `FAILED` e a execução atual é interrompida.

Não há garantia de redução percentual fixa de custo/latência no código; o benefício é a eliminação de uma requisição HTTP por chunk.

## Recuperação híbrida

Parâmetros:

- `user_id`: obrigatório;
- consulta textual: última mensagem do usuário;
- `top_k`: padrão 5, limitado a 1–20;
- `source_type`: derivado da origem da conversa;
- `source_ids`: até 100 IDs distintos selecionados.

### Busca vetorial

Quando a coluna vetorial existe e a consulta não é vazia:

1. o serviço gera o embedding da consulta;
2. busca até `min(top_k * 4, 80)` candidatos por distância de cosseno;
3. calcula também `ts_rank_cd` com configuração `simple`;
4. descarta candidatos abaixo de `RAG_MIN_RELEVANCE` (padrão `0.18`) quando não há relevância lexical;
5. pontua por similaridade, com bônus lexical máximo de `0.1`.

Consulta conceitual simplificada:

```sql
SELECT id,
       document_chunk,
       embedding <=> :query_vector AS distance,
       ts_rank_cd(
           to_tsvector('simple', document_chunk),
           plainto_tsquery('simple', :query)
       ) AS keyword_rank
FROM rag_documents
WHERE user_id = :user_id
  AND source_type = :source_type
  AND source_id = ANY(:source_ids)
  AND embedding IS NOT NULL
ORDER BY embedding <=> :query_vector
LIMIT :candidate_limit;
```

Os filtros de origem/IDs só são incluídos quando fornecidos.

### Fallback full-text

Se a busca vetorial falha, não há coluna, a consulta está vazia ou nenhum candidato vetorial passa pelo filtro, o serviço usa `to_tsvector('simple') @@ plainto_tsquery('simple')`. Para consulta vazia, retorna os chunks mais recentes.

Quando duas ou mais fontes específicas foram selecionadas, o algoritmo tenta incluir primeiro uma evidência de cada fonte e depois completa o resultado até `top_k`.

## Agente e ferramentas

As ferramentas operam sobre o contexto calculado pelo backend, não fazem SQL direto:

- `get_financial_profile`;
- `get_financial_indicators`;
- `get_spending_summary`;
- `get_monthly_rankings`;
- `get_transaction_rankings`;
- `get_transactions`;
- `get_recommendations`;
- `compare_periods`;
- `get_recurring_expenses`;
- `simulate_savings_plan`.

A seleção de ferramentas é determinística por termos da última mensagem. Ferramentas e recuperação RAG são executadas em paralelo por um `ThreadPoolExecutor` com dois workers. Seus resultados são anexados ao prompt antes da chamada ao provider.

Com `ENABLE_LLM=true`, `LLM_PROVIDER=openai` e `LLM_API_KEY`, o provider chama `{LLM_BASE_URL}/chat/completions`. Caso contrário, usa `FallbackTemplateProvider`. O provider recebe `tools=None`: a aplicação já executou as ferramentas antes da geração de texto; não há tool-calling remoto nesta etapa.

## SSE ponta a ponta

Fluxo:

```text
Frontend fetch POST
  ◄── backend: conversation
  ◄── backend: tools        ◄── AI Service: tools
  ◄── backend: sources      ◄── AI Service: sources
  ◄── backend: token        ◄── AI Service: token
  ◄── backend: done         (persistido pelo backend)
```

Endpoints:

- público: `POST /api/v1/agent/conversations/{conversationId}/messages/stream`;
- interno: `POST /internal/v1/agent/respond/stream`.

O Nginx possui uma location específica que desabilita buffering, cache e gzip e usa `proxy_read_timeout 120s`. O backend também retorna `X-Accel-Buffering: no` e `Cache-Control: no-store`.

Eventos públicos: `conversation`, `tools`, `sources`, `token`, `done` e, em falha parcial, `error`. O backend persiste a mensagem do usuário antes da chamada e a mensagem do assistente somente após uma conclusão com texto.

## Status e operação

```http
GET /api/v1/rag/status?sourceIds=<id-1>&sourceIds=<id-2>
Authorization: Bearer <jwt>
```

```json
{
  "status": "PENDING",
  "totalDocuments": 120,
  "pendingDocuments": 20,
  "processingDocuments": 0,
  "indexedDocuments": 100,
  "failedDocuments": 0
}
```

Estados agregados:

- `EMPTY`: nenhum chunk;
- `PROCESSING`: ao menos um chunk em processamento;
- `PENDING`: ao menos um pendente ou contagens ainda não fechadas;
- `FAILED`: não há pendentes/processando e existe falha;
- `COMPLETE`: todos os chunks estão indexados.

Uma nova tentativa manual reprocessa documentos sem embedding ou cujo `embedding_model` mudou. Documentos `FAILED` com embedding nulo também entram nesse critério.

## Segurança e isolamento

- Todas as consultas e contagens incluem `user_id`.
- `source_type` e `source_ids` restringem ainda mais o escopo.
- O backend obtém o usuário do JWT; o frontend não envia `user_id` ao endpoint público.
- O endpoint interno recebe `user_id` do backend e não tem autenticação própria.
- `/internal/` é bloqueado no Nginx e o AI Service não publica porta no Compose.
- `LLM_API_KEY` permanece no AI Service.
- Apenas trechos recuperados e resultados de ferramentas são enviados ao provider de LLM; ainda assim, podem conter dados financeiros do usuário e exigem avaliação de privacidade antes de habilitar um provedor remoto.

## Limitações conhecidas

- O índice HNSW e a coluna vetorial são opcionais em ambientes sem `pgvector`.
- O fallback local é lexical por hashing, não um embedding semântico treinado.
- A indexação em background usa `BackgroundTasks` no processo FastAPI; não há fila durável externa.
- O limite de 1536 dimensões é fixo no schema e no serviço.
- As rotas internas confiam no isolamento de rede.
- O frontend possui rótulos específicos apenas para alguns `chunk_type`; novos tipos continuam sendo exibidos, mas podem receber um rótulo genérico.
