# API do FinVise

## Base URL

- Aplicação local via Nginx: `http://localhost:8080/api/v1`
- Produção: `https://<dominio>/api/v1` quando houver terminação TLS externa
- Backend direto em execução isolada: `http://localhost:8080/api/v1`
- AI Service direto em execução isolada: `http://localhost:8000`

## Autenticação

As rotas `/api/v1/auth/**`, `/actuator/health`, `/actuator/info` e a documentação OpenAPI são públicas no Spring Security. As demais rotas públicas do backend exigem:

```http
Authorization: Bearer <jwt-de-login>
```

O UUID do usuário é extraído do JWT. Endpoints sem `{userId}` não aceitam `userId` no corpo ou na query. Nos endpoints legados que mantêm `{userId}` no caminho, o valor deve ser igual ao UUID autenticado; outro UUID resulta em `403`.

O endpoint `/api/v1/auth/reset-password` também usa `Authorization: Bearer`, mas o valor é o `resetToken` emitido por `/validate-reset-code`, não o JWT de login.

## Convenções de resposta

A maior parte da API pública retorna o envelope:

```json
{
  "success": true,
  "data": {},
  "message": null,
  "timestamp": "2026-08-02T12:00:00Z"
}
```

Exceções que não usam esse envelope:

- `/api/v1/auth/forgot-password`, `/validate-reset-code` e `/reset-password`;
- `/api/v1/rag/index-step`, `/api/v1/rag/status`, `/api/v1/rag/queue` e `/api/v1/rag/reprocess`;
- `/api/v1/model-status`;
- `/actuator/**`;
- o stream SSE do agente;
- todos os endpoints internos do AI Service.

Datas são ISO 8601. Valores monetários são números JSON derivados de `BigDecimal`; IDs persistidos são UUIDs.

## Endpoints públicos

### Autenticação

| Método | Endpoint | Autenticação | Descrição |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Pública | Cria uma conta; retorna `201` |
| `POST` | `/api/v1/auth/login` | Pública | Valida credenciais e emite JWT |
| `POST` | `/api/v1/auth/forgot-password` | Pública | Invalida códigos anteriores e envia um código de seis dígitos |
| `POST` | `/api/v1/auth/validate-reset-code` | Pública | Valida e troca o código por um reset token |
| `POST` | `/api/v1/auth/reset-password` | Reset token | Altera a senha |

Cadastro:

```json
{
  "fullName": "Maria da Silva",
  "email": "maria@example.com",
  "password": "senha-com-8-ou-mais"
}
```

`fullName` aceita de 2 a 150 caracteres e `password`, de 8 a 100. Resposta `201`:

```json
{
  "success": true,
  "data": {
    "email": "maria@example.com",
    "isEmailVerified": false,
    "createdAt": "2026-08-02T12:00:00Z"
  },
  "message": null,
  "timestamp": "2026-08-02T12:00:00Z"
}
```

Login:

```json
{
  "email": "maria@example.com",
  "password": "senha-com-8-ou-mais"
}
```

```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "type": "Bearer",
    "userId": "b1e3b3b5-785f-4ee5-b3c8-257a62d03e75",
    "email": "maria@example.com",
    "expiresInMs": 86400000
  },
  "message": null,
  "timestamp": "2026-08-02T12:00:00Z"
}
```

O campo `expiresInMs` da resposta de login está fixado em `86400000` no controller atual. A expiração real do JWT usa `JWT_EXPIRATION_MS`; se esse valor for alterado, os dois podem divergir.

Fluxo de redefinição:

```http
POST /api/v1/auth/forgot-password
Content-Type: application/json

{"email":"maria@example.com"}
```

O endpoint sempre retorna uma mensagem genérica, inclusive quando o e-mail não existe:

```json
{"message":"Se o e-mail informado estiver cadastrado, você receberá um código de verificação em instantes."}
```

```http
POST /api/v1/auth/validate-reset-code
Content-Type: application/json

{"email":"maria@example.com","code":"123456"}
```

```json
{"resetToken":"<jwt-com-scope-password_reset>"}
```

```http
POST /api/v1/auth/reset-password
Authorization: Bearer <resetToken>
Content-Type: application/json

{"newPassword":"nova-senha-com-8-ou-mais"}
```

```json
{"message":"Senha atualizada com sucesso."}
```

O código e o reset token expiram em cinco minutos. Após cinco códigos inválidos, o registro fica bloqueado por 30 minutos.

### Análises financeiras

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `POST` | `/api/v1/financial-analyses` | Analisa o conjunto enviado no corpo |
| `POST` | `/api/v1/financial-analyses/from-transactions` | Analisa transações persistidas da origem selecionada |
| `GET` | `/api/v1/financial-analyses/models` | Lista `MACHINE_LEARNING` e `FINANCIAL_RULES` |
| `GET` | `/api/v1/financial-analyses?source=<source>` | Lista análises; `source` é opcional |
| `GET` | `/api/v1/financial-analyses/latest?source=<source>&importSourceId=<uuid>` | Última análise; ambos os filtros são opcionais |
| `GET` | `/api/v1/financial-analyses/{analysisId}` | Análise do usuário por UUID |

Criação com transações no corpo:

```json
{
  "monthlyIncome": 4500.00,
  "debtLevelPercentage": 25.00,
  "savingFrequency": "MEDIUM",
  "financialReserve": 3000.00,
  "transactions": [
    {
      "description": "Supermercado",
      "amount": 420.00,
      "date": "2026-07-01",
      "type": "EXPENSE",
      "paymentMethod": "CREDIT_CARD",
      "recurrent": false
    }
  ]
}
```

Regras do corpo:

- `monthlyIncome` e cada `amount` devem ser maiores que zero;
- `debtLevelPercentage` e `financialReserve` não podem ser negativos;
- `savingFrequency`: `LOW`, `MEDIUM` ou `HIGH`;
- `type`: `INCOME`, `EXPENSE` ou `TRANSFER`;
- `transactions` não pode estar vazia;
- `id`, `categoryCode`, `paymentMethod`, `recurrent` e `source` de cada transação são opcionais.

Análise de dados persistidos:

```json
{
  "model": "MACHINE_LEARNING",
  "source": "CSV_IMPORT",
  "importSourceId": "5e413a76-10af-4f67-9259-1e83e3a5c6fd",
  "startDate": "2026-01-01",
  "endDate": "2026-12-31"
}
```

`model` e `source` são obrigatórios. `source` aceita `CSV_IMPORT` ou `OPEN_FINANCE_PLUGGY`; as origens não são combinadas. `importSourceId`, `startDate` e `endDate` são opcionais. Sem `importSourceId`, todas as transações da origem entram no escopo. O período é inclusivo e `startDate > endDate` retorna `INVALID_PERIOD`.

Resposta de análise, dentro de `ApiResponse.data`:

```json
{
  "analysisId": "68edfa18-bde4-49af-990a-f11d9451edb4",
  "userId": "b1e3b3b5-785f-4ee5-b3c8-257a62d03e75",
  "financialProfile": {
    "classification": "EM_OBSERVACAO",
    "score": 62.00,
    "confidence": 0.82,
    "mainFactors": ["Nivel de endividamento moderado"]
  },
  "indicators": {
    "monthlyIncome": 4500.00,
    "totalExpenses": 760.00,
    "incomeCommitmentPercentage": 16.89,
    "debtLevelPercentage": 25.00,
    "estimatedSavingsRate": 8.00,
    "recurringExpensesCount": 1,
    "fixedExpensesPercentage": 10.00,
    "nonEssentialExpensesPercentage": 6.89,
    "reserveInMonths": 3.95
  },
  "spendingSummary": {
    "ALIMENTACAO": {"amount": 420.00, "percentage": 55.26}
  },
  "classifiedTransactions": [],
  "recommendations": [],
  "modelVersions": {
    "transactionClassifier": "FALLBACK",
    "profileClassifier": "FALLBACK"
  },
  "createdAt": "2026-08-02T12:00:00Z"
}
```

Valores calculados, classificação, listas e versões variam conforme a entrada e os artefatos carregados. O exemplo demonstra o schema, não um resultado garantido.

### Transações

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `GET` | `/api/v1/transactions` | Lista paginada e filtrada |
| `GET` | `/api/v1/transactions/summary` | Totais de receita, despesa e saldo |
| `GET` | `/api/v1/transactions/monthly-summary` | Série mensal da origem |
| `GET` | `/api/v1/transactions/category-summary` | Despesas por categoria da origem |
| `POST` | `/api/v1/transactions/classify` | Classifica transações sem persisti-las |
| `POST` | `/api/v1/transactions/reclassify-imported` | Reclassifica transações CSV atualmente em `OUTROS` |

Filtros de `GET /transactions`:

| Query | Tipo/valores | Padrão |
| --- | --- | --- |
| `type` | `INCOME`, `EXPENSE`, `TRANSFER` | todos |
| `source` | `CSV_IMPORT`, `OPEN_FINANCE_PLUGGY` | todas |
| `importSourceId` | UUID | todas as fontes do tipo |
| `category` | código, normalizado para maiúsculas | todas |
| `startDate`, `endDate` | `YYYY-MM-DD`, inclusivas | sem limite |
| `page` | inteiro; negativos viram `0` | `0` |
| `size` | inteiro limitado ao intervalo 1–100 | `50` |

Resposta paginada em `data`:

```json
{
  "content": [
    {
      "id": "5ebbb566-d2fd-4d28-afd6-0a4fa589147e",
      "description": "Supermercado ABC",
      "amount": 150.50,
      "date": "2026-07-01",
      "type": "EXPENSE",
      "category": "ALIMENTACAO",
      "source": "CSV_IMPORT",
      "createdAt": "2026-08-02T12:00:00Z"
    }
  ],
  "totalElements": 1,
  "totalPages": 1,
  "size": 50,
  "number": 0
}
```

`source` é opcional em `/summary`, mas obrigatório em `/monthly-summary` e `/category-summary`. Os três aceitam `importSourceId` opcional.

Classificação avulsa:

```json
{
  "transactions": [
    {
      "description": "PGTO POSTO SHELL 0234",
      "amount": 250.00,
      "date": "2026-06-05",
      "type": "EXPENSE",
      "paymentMethod": "CREDIT_CARD",
      "recurrent": false
    }
  ]
}
```

A resposta traz `classifiedTransactions` e `modelVersion` dentro do envelope. Exemplos contratuais adicionais estão em `finance_ai_dataset/exemplos_api.json`.

### Importação e fontes

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `GET` | `/api/v1/imports/sources` | Lista arquivos CSV e conexões Open Finance |
| `PUT` | `/api/v1/imports/sources/{type}/{sourceId}/default` | Define a fonte padrão e limpa a anterior |
| `DELETE` | `/api/v1/imports/sources/{type}/{sourceId}` | Exclui a fonte e seus dados associados |
| `POST` | `/api/v1/imports/transactions/csv` | Importa um CSV |

`type` no caminho aceita `CSV` ou `OPEN_FINANCE`. Na exclusão CSV, o objeto armazenado, as transações e os chunks RAG da fonte são removidos. Na exclusão Open Finance, são removidos a conexão, as transações e os chunks RAG; o código não chama uma API de revogação no provedor.

Upload:

```bash
curl -X POST \
  -H "Authorization: Bearer <jwt>" \
  -F "file=@transacoes.csv" \
  http://localhost:8080/api/v1/imports/transactions/csv
```

O campo multipart deve se chamar `file`. O limite é 5 MiB; o nome deve terminar em `.csv` ou o `Content-Type` deve ser `text/csv`/`application/csv`.

Formato aceito:

```csv
description,amount,date,type,payment_method,recurrent
Supermercado ABC,150.50,2026-07-01,EXPENSE,CREDIT_CARD,false
Salário,3500.00,2026-07-05,INCOME,PIX,true
Tarifa,-25.00,2026-07-06,,DEBIT_CARD,0
```

| Coluna | Obrigatória | Regra |
| --- | --- | --- |
| `description` | sim | texto não vazio |
| `amount` | sim | decimal diferente de zero; vírgula simples é convertida para ponto e o valor persistido usa módulo |
| `date` | sim | `YYYY-MM-DD` |
| `type` | não | `INCOME`/`RECEITA` ou `EXPENSE`/`DESPESA`; omitido usa o sinal do valor |
| `payment_method` | não | texto livre |
| `recurrent` | não | verdadeiro para `true`, `1`, `yes` ou `sim`; demais valores são falsos |

Cabeçalhos não diferenciam maiúsculas de minúsculas. `categoria`, `subcategoria`, `forma_pagamento`, `canal` e outros campos do dataset sintético não são lidos pelo importador atual.

O backend categoriza as linhas válidas antes de abrir a transação de persistência. Em uma transação curta, grava o arquivo e as transações, reconstrói fatos financeiros, cria chunks RAG e registra o job durável de indexação no mesmo commit. A importação não gera análise financeira automaticamente; ela pode ser solicitada depois por `/financial-analyses/from-transactions`. Linhas inválidas aparecem em `errors`; o arquivo ainda termina com status `COMPLETED` quando outras etapas não falham. Se a persistência falhar, o objeto armazenado é removido como compensação.

Resposta em `data`:

```json
{
  "id": "5e413a76-10af-4f67-9259-1e83e3a5c6fd",
  "originalName": "transacoes.csv",
  "storedName": "<uuid>_transacoes.csv",
  "status": "COMPLETED",
  "processedCount": 3,
  "categorizedCount": 3,
  "classificationModel": "FALLBACK",
  "errors": []
}
```

O mesmo conteúdo não pode ser importado duas vezes pelo mesmo usuário; a API retorna `DUPLICATE_FILE`.

### Open Finance

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `GET` | `/api/v1/open-finance/status` | Retorna `configured`, `provider` e `includeSandbox` |
| `POST` | `/api/v1/open-finance/connect-token` | Cria Connect Token da Pluggy |
| `POST` | `/api/v1/open-finance/items/{itemId}/sync` | Sincroniza contas/transações e gera análise |

Corpo da sincronização:

```json
{"model":"FINANCIAL_RULES"}
```

`model` aceita `MACHINE_LEARNING` ou `FINANCIAL_RULES`. A sincronização valida que o `clientUserId` do item é o UUID autenticado, importa apenas transações `POSTED`, evita duplicatas e retorna em `data`:

```json
{
  "importedCount": 42,
  "skippedCount": 3,
  "analysis": {"analysisId":"<uuid>"}
}
```

O objeto `analysis` segue o contrato completo de análise. Não existe endpoint de webhook receptor no backend atual.

### Usuários

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `GET` | `/api/v1/users/{userId}/dashboard` | Última análise, indicadores e até cinco recomendações |
| `GET` | `/api/v1/users/{userId}/history` | Histórico de análises |
| `GET` | `/api/v1/users/{userId}/recommendations` | Recomendações do usuário |
| `POST` | `/api/v1/users/{userId}/simulations/savings` | Simulação aritmética de poupança |

Corpo da simulação:

```json
{
  "monthlyIncome": 5000.00,
  "currentSavingsRate": 10.00,
  "targetSavingsRate": 20.00,
  "months": 12
}
```

As taxas são percentuais. A resposta inclui os mesmos quatro campos e `currentMonthlySavings`, `targetMonthlySavings`, `accumulatedCurrent`, `accumulatedTarget`, `additionalMonthlyEffort` e `projectedAnnualDifference`.

### Relatórios

| Método | Endpoint | Estado atual |
| --- | --- | --- |
| `GET` | `/api/v1/reports/financial/{userId}` | Retorna totais e resumo por categoria de todas as transações do usuário |
| `POST` | `/api/v1/reports/financial/{userId}/export` | Valida/monta o relatório, mas retorna apenas a string `Exportação de relatório em desenvolvimento` |

Não há geração de PDF ou Excel implementada.

### Agente financeiro

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `POST` | `/api/v1/agent/conversations` | Cria uma conversa |
| `GET` | `/api/v1/agent/conversations/{conversationId}` | Retorna conversa e mensagens |
| `POST` | `/api/v1/agent/conversations/{conversationId}/messages` | Persiste a mensagem e retorna a conversa completa |
| `POST` | `/api/v1/agent/conversations/{conversationId}/messages/stream` | Persiste e transmite a resposta por SSE |

Não existe endpoint para listar todas as conversas.

Criação:

```json
{
  "source": "OPEN_FINANCE_PLUGGY",
  "title": "Analisar dados do Open Finance",
  "sourceIds": ["4521dc7d-ad88-4dd0-85b1-e9893eea349f"],
  "topK": 5
}
```

`source` é obrigatório. `sourceIds` aceita até 100 UUIDs distintos; lista vazia significa todas as fontes daquela origem. `topK` aceita 1–20 e assume 5. `title` é opcional e assume `Nova conversa`.

Mensagem:

```json
{"content":"Qual foi meu pior mês de despesas?"}
```

No modo não streaming, `data.messages[].toolCalls` e `ragSources` são strings contendo JSON serializado, pois correspondem a colunas JSONB representadas como `String` no DTO atual.

No modo streaming, a resposta usa `text/event-stream`, `Cache-Control: no-store` e os eventos:

```text
event: conversation
data: {"conversationId":"<uuid>"}

event: tools
data: {"tools":["get_monthly_rankings"]}

event: sources
data: {"sources":[{"id":"<uuid>","source_id":"<uuid>","source_name":"extrato.csv","chunk_type":"MONTHLY_FACT","score":0.84}]}

event: token
data: {"token":"O mês com maior despesa..."}

event: done
data: {"conversationId":"<uuid>","message":{"id":"<uuid>","role":"assistant","content":"O mês com maior despesa...","timestamp":"2026-08-02T12:00:00Z","tools":["get_monthly_rankings"],"sources":[]}}
```

Também pode ocorrer `event: error` com `{"message":"..."}`. Se a chamada ao AI Service falhar antes de produzir texto, o backend emite uma resposta segura como eventos `tools`, `token` e `done`. Se a falha ocorrer depois de texto parcial, emite `error` e não persiste uma resposta concluída.

Ferramentas implementadas: `get_financial_profile`, `get_financial_indicators`, `get_spending_summary`, `get_monthly_rankings`, `get_transaction_rankings`, `get_transactions`, `get_recommendations`, `compare_periods`, `get_recurring_expenses` e `simulate_savings_plan`.

### RAG

| Método | Endpoint | Resposta |
| --- | --- | --- |
| `GET` | `/api/v1/rag/status?sourceIds=<id>&sourceIds=<id>` | Contadores de documentos do usuário |
| `POST` | `/api/v1/rag/index-step?sourceIds=<id>&sourceIds=<id>` | Executa uma etapa síncrona de indexação e retorna contadores |
| `GET` | `/api/v1/rag/queue` | Estado operacional do job durável do usuário |
| `POST` | `/api/v1/rag/reprocess` | Recupera o job e reenfileira documentos elegíveis |

Status:

```json
{
  "status": "COMPLETE",
  "totalDocuments": 120,
  "pendingDocuments": 0,
  "processingDocuments": 0,
  "indexedDocuments": 120,
  "failedDocuments": 0
}
```

`status` pode ser `EMPTY`, `PENDING`, `PROCESSING`, `FAILED` ou `COMPLETE`. A resposta de `/index-step` acrescenta `indexedCount`. `sourceIds` é opcional; sem ele, o escopo abrange todos os chunks do usuário.

Exemplo de job em dead-letter:

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

Reprocessamento normal:

```http
POST /api/v1/rag/reprocess
Authorization: Bearer <jwt>
Content-Type: application/json

{"force": false}
```

```json
{
  "queued": true,
  "force": false,
  "resetDocuments": 18,
  "queueStatus": "PENDING"
}
```

O corpo é opcional e equivale a `force=false`. O modo normal reinicia documentos sem embedding ou em `PENDING`, `PROCESSING` ou `FAILED`; `force=true` invalida todos os embeddings do usuário. A API retorna `202` ao enfileirar, `200` com `queued=false` quando não há documentos e `409 RAG_QUEUE_CONFLICT` se o job já está em processamento.

### Sistema

| Método | Endpoint | Autenticação | Descrição |
| --- | --- | --- | --- |
| `GET` | `/api/v1/model-status` | JWT | Estado do registry do AI Service |
| `GET` | `/actuator/health` | Pública | Health check do backend |
| `GET` | `/actuator/info` | Pública no Spring | Informações do Actuator; o Nginx atual não possui proxy para essa rota |

Exemplo abreviado de `/model-status`:

```json
{
  "status": "DEGRADED",
  "environment": "development",
  "modelsRequired": false,
  "registeredAt": "2026-08-02T12:00:00Z",
  "transactionClassifier": {
    "name": "FallbackTransactionClassifier",
    "version": "FALLBACK",
    "status": "FALLBACK",
    "active": false,
    "artifact_status": "MISSING",
    "artifact_path": "/app/models/transaction-classifier",
    "artifact_sha256": null,
    "metadata_sha256": null,
    "registered_at": "2026-08-02T12:00:00Z",
    "error": "model not found at /app/models/transaction-classifier"
  },
  "profileClassifier": {},
  "llmProvider": {
    "provider": "openai",
    "enabled": false,
    "model": "gpt-4o-mini"
  }
}
```

O conteúdo dos mapas de classificadores depende dos artefatos. O backend retorna `503` quando o AI Service não responde. Também retorna `503` quando `modelsRequired=true` e o status não é `READY`; um ambiente degradado com modelos opcionais retorna `200`.

## Endpoints internos do AI Service

Essas rotas não passam pelo Nginx (`/internal/` recebe `403`) e são consumidas pelo backend na rede Docker. Todas as rotas `/internal/v1/*` exigem `Authorization: Bearer <AI_SERVICE_TOKEN>`. Agente e RAG exigem também `X-FinVise-User-Id`, preenchido pelo backend com o UUID extraído do JWT; `user_id` enviado no JSON é rejeitado. `/health` permanece público.

| Método | Endpoint | Contrato resumido |
| --- | --- | --- |
| `GET` | `/health` | `status`, `version`, `environment` |
| `GET` | `/internal/v1/models/status` | Registry, artefatos e LLM |
| `POST` | `/internal/v1/transactions/classify` | `{items:[{description,amount,payment_method,recurrent,channel}]}` |
| `POST` | `/internal/v1/profiles/analyze` | Modelo, entrada financeira e nove indicadores |
| `POST` | `/internal/v1/profiles/recommendations` | Recomendações do motor Python |
| `POST` | `/internal/v1/agent/respond` | Header de usuário confiável e resposta completa do agente |
| `POST` | `/internal/v1/agent/respond/stream` | Header de usuário confiável e SSE `tools`, `sources`, `token`, `done` ou `error` |
| `POST` | `/internal/v1/rag/index` | Header de usuário confiável e `{source_ids,background,max_batches}` |

O worker da fila durável sempre usa `background=false`, pois precisa confirmar sucesso ou falha antes de concluir/reagendar o job. `background=true` permanece disponível apenas para chamadas internas diretas e não oferece a mesma garantia de persistência.

Não existe `/internal/v1/rag/search`; a recuperação é chamada internamente pelo orquestrador do agente.

## Erros

Exceções tratadas pelo `GlobalExceptionHandler` usam:

```json
{
  "timestamp": "2026-08-02T12:00:00Z",
  "status": 400,
  "code": "VALIDATION_ERROR",
  "message": "Dados de entrada inválidos",
  "path": "/api/v1/financial-analyses",
  "details": {
    "monthlyIncome": "Renda mensal deve ser positiva"
  },
  "traceId": "27d5a28f-a55f-41ce-a0b6-1421fd817672"
}
```

`details` é um objeto campo→mensagem ou `null`, não uma lista. Códigos relevantes incluem `INVALID_CREDENTIALS`, `AUTHENTICATION_REQUIRED`, `ACCESS_DENIED`, `VALIDATION_ERROR`, `INVALID_JSON`, `INVALID_PARAMETER`, `FILE_TOO_LARGE`, `DUPLICATE_FILE`, `INVALID_PERIOD`, `NO_TRANSACTIONS`, `NO_INCOME_TRANSACTIONS` e erros de Open Finance. `BusinessException` retorna `422`; e-mail duplicado retorna `409`.

Respostas geradas diretamente pelos filtros do Spring Security ou pelo FastAPI podem seguir formatos diferentes.

## Documentação interativa

- Swagger UI: `http://localhost:8080/api/v1/swagger-ui.html`
- OpenAPI JSON: `http://localhost:8080/api/v1/api-docs`
