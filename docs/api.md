# API do Finance AI

## Base URL

- Local: `http://localhost:8080/api/v1`
- Produção: `https://<dominio>/api/v1`

## Autenticação

A maioria dos endpoints requer um token JWT no header:

```
Authorization: Bearer <token>
```

O UUID do usuário é obtido exclusivamente do JWT. Endpoints autenticados não aceitam
`userId` em query string ou no corpo; recursos como análises, conversas, arquivos e
contas Open Finance só podem ser acessados pelo próprio titular.

Obtenha o token em:

```
POST /api/v1/auth/login
```

Corpo:

```json
{
  "email": "demo@financeai.com",
  "password": "demo123"
}
```

> O usuário demo existe apenas para desenvolvimento.

## Endpoints

### Autenticação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/v1/auth/login` | Login e emissão de JWT |

### Análises financeiras

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/v1/financial-analyses` | Cria uma nova análise |
| GET | `/api/v1/financial-analyses/models` | Lista os dois modelos disponíveis |
| POST | `/api/v1/financial-analyses/from-transactions` | Analisa as transações já persistidas |
| GET | `/api/v1/financial-analyses` | Lista as análises do usuário |
| GET | `/api/v1/financial-analyses/latest` | Retorna a análise mais recente |
| GET | `/api/v1/financial-analyses/{analysisId}` | Retorna uma análise por ID |

Corpo para analisar as transações persistidas:

```json
{
  "model": "MACHINE_LEARNING",
  "source": "CSV_IMPORT",
  "startDate": "2026-01-01",
  "endDate": "2026-12-31"
}
```

`model` aceita `MACHINE_LEARNING` ou `FINANCIAL_RULES`. `source` é obrigatório e aceita
`CSV_IMPORT` ou `OPEN_FINANCE_PLUGGY`; as duas origens nunca são combinadas na mesma
análise. As datas são opcionais.

### Transações

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/v1/transactions/classify` | Classifica uma lista de transações |
| GET | `/api/v1/transactions?source=CSV_IMPORT` | Lista transações paginadas por origem |
| GET | `/api/v1/transactions/summary?source=CSV_IMPORT` | Retorna totais por origem |
| GET | `/api/v1/transactions/monthly-summary?source=CSV_IMPORT` | Retorna a série mensal usada nos gráficos |
| GET | `/api/v1/transactions/category-summary` | Retorna totais agrupados por categoria |
| POST | `/api/v1/transactions/reclassify-imported` | Reclassifica transações importadas usando o AI Service |

### Importação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/imports/sources` | Lista as fontes de importação disponíveis |
| POST | `/api/v1/imports/transactions/csv` | Importa transações de CSV |

#### Detalhes da importação de CSV

Envie o arquivo CSV como `multipart/form-data` com o campo `file`:

```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -F "file=@transacoes.csv" \
  http://localhost:8080/api/v1/imports/transactions/csv
```

**Formato esperado do CSV:**

```csv
descricao,valor,data,tipo,categoria
Supermercado ABC,150.50,2026-07-01,EXPENSE,ALIMENTACAO
Salário,3500.00,2026-07-01,INCOME,SALARIO
```

**Colunas obrigatórias:** `descricao`, `valor`, `data`, `tipo`  
**Colunas opcionais:** `categoria`, `subcategoria`, `forma_pagamento`, `recorrente`, `canal`

### Open Finance

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/open-finance/status` | Informa o provedor e se as credenciais estão configuradas |
| POST | `/api/v1/open-finance/connect-token` | Emite o Connect Token para o widget Pluggy |
| POST | `/api/v1/open-finance/items/{itemId}/sync` | Importa as transações do item e gera uma análise |

Corpo da sincronização:

```json
{
  "model": "FINANCIAL_RULES"
}
```

### Usuários

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/users/{userId}/dashboard` | Retorna dados do dashboard |
| GET | `/api/v1/users/{userId}/history` | Histórico mensal |
| GET | `/api/v1/users/{userId}/recommendations` | Recomendações ativas |
| POST | `/api/v1/users/{userId}/simulations/savings` | Simula plano de poupança |

### Relatórios

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/reports/financial/{userId}` | Gera relatório financeiro completo do usuário |
| POST | `/api/v1/reports/financial/{userId}/export` | Exporta relatório em PDF ou Excel |

### Agente financeiro

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/v1/agent/conversations` | Cria uma conversa |
| GET | `/api/v1/agent/conversations/{conversationId}` | Retorna detalhes da conversa |
| POST | `/api/v1/agent/conversations/{conversationId}/messages` | Envia mensagem |
| GET | `/api/v1/agent/conversations` | Lista todas as conversas do usuário |

Ao criar uma conversa, envie a mesma origem selecionada na interface:

```json
{
  "source": "OPEN_FINANCE_PLUGGY",
  "title": "Analisar dados do Open Finance"
}
```

Toda resposta dessa conversa considera exclusivamente a origem persistida nela.

### Sistema

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/model-status` | Status dos modelos do ai-service |
| GET | `/actuator/health` | Health check do backend |

Resposta de `/api/v1/model-status` quando o ai-service está disponível:

```json
{
  "transactionClassifier": {
    "name": "SklearnTransactionClassifier",
    "version": "1.1.0",
    "status": "LOADED"
  },
  "profileClassifier": {
    "name": "SklearnProfileClassifier",
    "version": "1.0.0",
    "status": "LOADED"
  },
  "llmProvider": {
    "provider": "openai",
    "enabled": false,
    "model": "gpt-4o-mini"
  }
}
```

Se o ai-service não responder, o endpoint retorna HTTP `503` com status `UNAVAILABLE`.

## Contrato de análise

### Requisição

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
      "type": "EXPENSE"
    }
  ]
}
```

### Resposta

```json
{
  "analysisId": "uuid",
  "userId": "uuid",
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
    "recurringExpensesCount": 1
  },
  "spendingSummary": {
    "ALIMENTACAO": { "amount": 420.00, "percentage": 55.26 }
  },
  "classifiedTransactions": [],
  "recommendations": [],
  "modelVersions": {
    "transactionClassifier": "FALLBACK",
    "profileClassifier": "FALLBACK"
  },
  "createdAt": "2026-07-15T10:00:00Z"
}
```

## Erros

Formato padrão de erro:

```json
{
  "timestamp": "2026-07-15T10:00:00Z",
  "status": 400,
  "code": "VALIDATION_ERROR",
  "message": "Os dados enviados são inválidos.",
  "path": "/api/v1/financial-analyses",
  "details": [
    {
      "field": "monthlyIncome",
      "message": "must be greater than zero"
    }
  ],
  "traceId": "uuid"
}
```

## Documentação interativa

A documentação Swagger UI está disponível em:

```
http://localhost:8080/api/v1/swagger-ui.html
```
