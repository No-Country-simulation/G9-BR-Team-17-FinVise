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
| Backend Spring Boot | Constrói fatos/chunks, mantém a fila durável, executa o worker e expõe status |
| AI Service FastAPI | Gera embeddings, atualiza estado de índice e executa recuperação vetorial/full-text |
| PostgreSQL | Persiste chunks, jobs, metadados, vetores, status e snapshots financeiros |
| Frontend | Define origem, `sourceIds` e profundidade (`topK`); exibe tools, fontes e tokens SSE |

O AI Service possui acesso SQL direto a `rag_documents`. Ele não cria schema: `_ensure_embedding_column` é somente uma verificação de capacidade, e alterações pertencem às migrações Flyway.

## Fluxo de ingestão e indexação

```text
1. CSV importado ou item Pluggy sincronizado
   └── backend persiste transações
       ├── reconstrói financial_fact_snapshots
       ├── cria/atualiza rag_documents
       └── cria/atualiza rag_index_jobs na mesma transação

2. Worker do backend
   ├── reivindica um job elegível com FOR UPDATE SKIP LOCKED
   ├── atribui lock_token e renova heartbeat_at durante o processamento
   ├── chama POST /internal/v1/rag/index com background=false
   └── repete os lotes até drenar os pendentes ou alcançar o limite do ciclo

3. AI Service
   ├── obtém advisory lock por user_id
   ├── seleciona chunks PENDING/desatualizados com FOR UPDATE SKIP LOCKED
   ├── marca PROCESSING
   ├── gera embeddings em lote
   └── grava vetor, modelo, timestamp e INDEXED ou FAILED

4. Finalização do job
   ├── sucesso: COMPLETED, ou PENDING se chegou nova ingestão durante o processamento
   ├── falha: PENDING com backoff exponencial
   └── limite de tentativas: DEAD_LETTER até reprocessamento manual
```

A fila mantém no máximo um job por usuário e agrupa novas solicitações. Um job `PROCESSING` recebe `rerun_requested=true` quando chegam novos chunks. Jobs em `DEAD_LETTER` não são reativados implicitamente por uma nova ingestão: a recuperação exige `POST /api/v1/rag/reprocess`. Locks cujo heartbeat expirou podem ser reivindicados por outra réplica; o `lock_token` impede que o resultado atrasado do worker anterior sobrescreva o novo processamento. O estado dos chunks deve ser acompanhado por `GET /api/v1/rag/status`, e o estado do job por `GET /api/v1/rag/queue`. A rota pública `POST /api/v1/rag/index-step` continua executando uma chamada síncrona manual.

### Idempotência

- Transações são deduplicadas no RAG pelo índice parcial único `(user_id, source_type, source_id, transaction_id)`.
- Todo chunk possui `chunk_key` estável e `schema_version`; a unicidade é garantida por `(user_id, source_type, source_id, chunk_key)`.
- O backend reconcilia o conjunto desejado com o persistido: mantém chunks idênticos, atualiza os alterados e remove somente os que deixaram de existir.
- Uma alteração de conteúdo invalida `embedding_model`, muda o status para `PENDING` e reenfileira o usuário. Alterações somente de metadados preservam o embedding.
- Importação CSV, sincronização Open Finance e reclassificação passam por `FinancialSourceConsistencyService`, que reconstrói o snapshot antes de reconciliar os chunks na mesma transação.
- A exclusão de uma fonte remove transações, snapshot e documentos RAG. As análises históricas são preservadas como registros do resultado produzido no momento da análise.
- A indexação recalcula documentos quando `embedding` é nulo ou `embedding_model` difere do modelo efetivo.
- `SKIP LOCKED` distribui jobs entre réplicas e um advisory lock por `user_id` protege a etapa no AI Service.

## Schema RAG

As migrações relevantes são `V13`, `V14`, `V15`, `V17`, `V18`, `V19`, `V20`, `V21`, `V22`, `V23`, `V24` e `V26`.

### `rag_index_jobs`

| Coluna | Uso |
| --- | --- |
| `user_id UUID` | chave única que agrupa indexações do usuário |
| `status VARCHAR(20)` | `PENDING`, `PROCESSING`, `COMPLETED` ou `DEAD_LETTER` |
| `rerun_requested BOOLEAN` | preserva ingestão recebida durante processamento |
| `attempts INTEGER` | falhas consecutivas do job |
| `next_attempt_at` | instante elegível após o backoff |
| `locked_at`, `heartbeat_at`, `lock_token` | lease renovável e proteção contra resultado atrasado |
| `last_error TEXT` | última falha observada pelo worker |
| `dead_lettered_at` | instante em que o limite de tentativas foi alcançado |
| `manual_reprocess_count` | quantidade de recuperações manuais solicitadas |

Padrões operacionais: polling a cada `1000 ms`, heartbeat a cada `30000 ms`, lock de `120000 ms`, até `100` lotes por ciclo, cinco tentativas e backoff de `2000 ms` até `60000 ms`. O heartbeat deve ser menor que o timeout do lock. Todos são configuráveis pelas variáveis `RAG_INDEX_QUEUE_*` documentadas no `.env.example`.

### `rag_documents`

| Coluna | Uso |
| --- | --- |
| `id UUID` | identificador do chunk |
| `user_id UUID` | isolamento obrigatório do usuário |
| `source_type VARCHAR(50)` | `CSV_IMPORT` ou `OPEN_FINANCE` na implementação atual |
| `source_id VARCHAR(255)` | UUID da importação/conexão representado como texto |
| `transaction_id UUID` | vínculo opcional de chunk transacional |
| `chunk_type VARCHAR(40)` | tipo de evidência |
| `chunk_key VARCHAR(200)` | identidade estável usada na reconciliação incremental |
| `schema_version VARCHAR(20)` | versão do contrato de construção do chunk |
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
  AND index_status = 'INDEXED'
  AND embedding_model = :embedding_model
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

Após uma importação CSV, o frontend consulta esse endpoint a cada segundo, restrito ao `sourceId` recém-criado. A barra usa `indexedDocuments / totalDocuments` para exibir o avanço real da vetorização e só solicita a análise financeira depois de `COMPLETE` ou `EMPTY`. Se os documentos estiverem em `FAILED`, consulta também `/api/v1/rag/queue`: retries permanecem visíveis como processamento e `DEAD_LETTER` interrompe o fluxo com uma mensagem de recuperação.

O job durável possui estado próprio:

```http
GET /api/v1/rag/queue
Authorization: Bearer <jwt>
```

```json
{
  "status": "DEAD_LETTER",
  "attempts": 5,
  "rerunRequested": false,
  "nextAttemptAt": "2026-08-03T12:00:00Z",
  "heartbeatAt": null,
  "deadLetteredAt": "2026-08-03T12:00:00Z",
  "lastError": "Falha ao gerar embeddings",
  "manualReprocessCount": 0,
  "updatedAt": "2026-08-03T12:00:00Z"
}
```

A recuperação manual usa `POST /api/v1/rag/reprocess`. Por padrão, reinicia documentos pendentes, em processamento órfão, com falha ou sem embedding. Com `{"force":true}`, invalida e recria todos os embeddings do usuário. A operação retorna `409 RAG_QUEUE_CONFLICT` enquanto o job está `PROCESSING` e `202 Accepted` quando o reprocessamento foi enfileirado.

### Métricas da fila

As métricas estão disponíveis no Actuator autenticado (`/actuator/metrics`):

| Métrica | Tipo | Uso |
| --- | --- | --- |
| `finvise.rag.queue.jobs{status=...}` | gauge | profundidade por `pending`, `processing`, `completed` e `dead_letter` |
| `finvise.rag.queue.jobs.processed{outcome=...}` | counter | claims, sucessos, retries, dead-letter, limite de drenagem, perda de lock e reprocessamento manual |
| `finvise.rag.queue.batches` | counter | lotes enviados ao AI Service |
| `finvise.rag.queue.documents.indexed` | counter | documentos indexados informados pelo AI Service |
| `finvise.rag.queue.processing.duration` | timer | duração completa de cada job reivindicado |

## Segurança e isolamento

- Todas as consultas e contagens incluem `user_id`.
- `source_type` e `source_ids` restringem ainda mais o escopo.
- O backend obtém o usuário do JWT; o frontend não envia `user_id` ao endpoint público.
- O backend autentica a chamada interna com `AI_SERVICE_TOKEN` e envia o UUID em `X-FinVise-User-Id`.
- O AI Service rejeita `user_id` no payload e só usa a identidade do cabeçalho após validar o token de serviço.
- `/internal/` é bloqueado no Nginx e o AI Service não publica porta no Compose.
- `LLM_API_KEY` permanece no AI Service.
- Apenas trechos recuperados e resultados de ferramentas são enviados ao provider de LLM; ainda assim, podem conter dados financeiros do usuário e exigem avaliação de privacidade antes de habilitar um provedor remoto.

## Limitações conhecidas

- O índice HNSW e a coluna vetorial são opcionais em ambientes sem `pgvector`.
- O fallback local é lexical por hashing, não um embedding semântico treinado.
- Chamadas internas diretas com `background=true` ainda usam `BackgroundTasks`; o fluxo automático do backend usa exclusivamente a fila PostgreSQL com `background=false`.
- O limite de 1536 dimensões é fixo no schema e no serviço.
- O token estático de serviço exige rotação coordenada entre backend e AI Service.
- O frontend possui rótulos específicos apenas para alguns `chunk_type`; novos tipos continuam sendo exibidos, mas podem receber um rótulo genérico.
