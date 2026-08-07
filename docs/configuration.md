# Configuração do FinVise

Este documento consolida as variáveis utilizadas pelo Docker Compose, backend, frontend e AI Service. Os exemplos versionados continuam sendo a referência executável:

- raiz: [`.env.example`](../.env.example);
- backend isolado: [`backend/.env.example`](../backend/.env.example);
- frontend isolado: [`frontend/.env.example`](../frontend/.env.example);
- AI Service isolado: [`ai-service/.env.example`](../ai-service/.env.example).

Nunca versione `.env` preenchido, tokens, chaves privadas ou credenciais reais.

## Modos de configuração

### Docker Compose

Copie `.env.example` para `.env` na raiz. O Compose lê esse arquivo automaticamente para interpolar `docker-compose.yml`.

```bash
cp .env.example .env
docker compose config --quiet
docker compose up -d --build
```

Recrie os containers após alterar variáveis:

```bash
docker compose up -d --build --force-recreate
```

### Componentes isolados

- Spring Boot não carrega `backend/.env` automaticamente; as variáveis precisam existir no processo/IDE.
- Pydantic Settings carrega `ai-service/.env` quando o processo é iniciado a partir desse diretório.
- Vite carrega `.env.local`, mas `VITE_API_PROXY_TARGET` também precisa estar disponível ao processo porque `vite.config.ts` lê `process.env` diretamente.
- variáveis `VITE_*` são incorporadas ao bundle no build e não mudam apenas reiniciando o Nginx.

## Valores mínimos para Docker

```dotenv
POSTGRES_PASSWORD=<senha-do-banco>
SPRING_DATASOURCE_PASSWORD=<a-mesma-senha-do-banco>
JWT_SECRET=<32-ou-mais-bytes-aleatorios>
AI_SERVICE_TOKEN=<32-ou-mais-caracteres-aleatorios>
```

Na topologia padrão, as duas senhas do banco precisam ser iguais. No perfil `production`, a senha da datasource deve ter ao menos 16 caracteres e os segredos não podem usar placeholders conhecidos.

## Compose e exposição

| Variável | Padrão | Uso |
| --- | --- | --- |
| `COMPOSE_PROJECT_NAME` | `finvise` | prefixo lógico do projeto Compose |
| `NGINX_HTTP_PORT` | `8080` | porta HTTP publicada pelo Compose base |
| `VITE_API_BASE_URL` | `/api/v1` | base incorporada no build do frontend |

O override de produção publica Nginx em `80:80`, independentemente de `NGINX_HTTP_PORT`. O estado versionado não publica PostgreSQL, backend ou AI Service no host.

## PostgreSQL

| Variável | Padrão Compose | Uso |
| --- | --- | --- |
| `POSTGRES_DB` | `finvise` | banco criado pela imagem |
| `POSTGRES_USER` | `finvise` | usuário do banco |
| `POSTGRES_PASSWORD` | obrigatório | senha da imagem e fallback do AI Service |
| `PGDATA` | `/var/lib/postgresql/data/pgdata` | diretório interno de dados |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://postgres:5432/finvise` | URL usada nos containers backend/AI |
| `SPRING_DATASOURCE_USERNAME` | `finvise` | usuário usado nos containers |
| `SPRING_DATASOURCE_PASSWORD` | obrigatório | senha efetiva da datasource |
| `HIBERNATE_JDBC_BATCH_SIZE` | `100` | tamanho dos lotes Hibernate |

Na execução isolada do backend, `application.yml` usa `DATABASE_URL`, `DATABASE_USERNAME` e `DATABASE_PASSWORD`. Propriedades Spring `SPRING_DATASOURCE_*` também podem sobrescrever diretamente a datasource.

## Backend

### Servidor, JWT e CORS

| Variável | Padrão | Uso |
| --- | --- | --- |
| `SPRING_PROFILES_ACTIVE` | `local` | perfil Spring |
| `SERVER_PORT` | `8080` | porta no modo isolado |
| `SERVER_CONTEXT_PATH` | vazio | prefixo opcional do servlet |
| `MANAGEMENT_SERVER_PORT` | `8080` no exemplo isolado | porta dos endpoints Actuator quando sobrescrita |
| `JWT_SECRET` | obrigatório no Compose | chave HMAC; use 32+ bytes |
| `JWT_EXPIRATION_MS` | `86400000` | validade real do JWT de login |
| `CORS_ALLOWED_ORIGINS` | origens locais | lista separada por vírgulas |
| `SSE_TIMEOUT_MS` | `120000` | timeout assíncrono do stream público |

O campo `expiresInMs` retornado pelo login está atualmente fixado em `86400000`; mudar somente `JWT_EXPIRATION_MS` pode produzir divergência na informação devolvida ao cliente.

### Comunicação com o AI Service

| Variável | Padrão | Uso |
| --- | --- | --- |
| `AI_SERVICE_URL` | `http://ai-service:8000` no Compose | endereço interno |
| `AI_SERVICE_TOKEN` | obrigatório | Bearer compartilhado, mínimo 32 caracteres |
| `AI_SERVICE_CONNECT_TIMEOUT_MS` | `5000` | conexão HTTP |
| `AI_SERVICE_READ_TIMEOUT_MS` | `30000` | resposta HTTP não-SSE |

### Contexto do agente

| Variável | Padrão | Uso |
| --- | --- | --- |
| `AGENT_HISTORY_MAX_MESSAGES` | `16` | janela recente enviada ao AI Service |
| `AGENT_INPUT_TOKEN_BUDGET` | `8000` | orçamento aproximado de entrada |
| `AGENT_SUMMARY_MAX_CHARS` | `4000` | limite do resumo incremental |
| `AGENT_SUMMARY_BATCH_SIZE` | `100` | mensagens antigas processadas por ciclo |
| `AGENT_RECENT_TRANSACTIONS` | `20` | transações recentes no contexto |
| `AGENT_RECURRING_EXPENSES` | `20` | recorrências no contexto |
| `AGENT_ANALYTICAL_MAX_MONTHS` | `60` | fatos mensais máximos |
| `AGENT_CONVERSATION_LOCK_TIMEOUT_MS` | `120000` | retomada de lock abandonado |

### Fila RAG do backend

| Variável | Padrão | Uso |
| --- | --- | --- |
| `RAG_INDEX_QUEUE_ENABLED` | `true` | habilita o worker |
| `RAG_INDEX_QUEUE_POLL_DELAY_MS` | `1000` | intervalo de polling |
| `RAG_INDEX_QUEUE_LOCK_TIMEOUT_MS` | `120000` | expiração do lock |
| `RAG_INDEX_QUEUE_HEARTBEAT_INTERVAL_MS` | `30000` | renovação do heartbeat |
| `RAG_INDEX_QUEUE_MAX_BATCHES_PER_DRAIN` | `100` | lotes por ciclo |
| `RAG_INDEX_QUEUE_MAX_ATTEMPTS` | `5` | tentativas antes de `DEAD_LETTER` |
| `RAG_INDEX_QUEUE_RETRY_BASE_DELAY_MS` | `2000` | backoff inicial |
| `RAG_INDEX_QUEUE_RETRY_MAX_DELAY_MS` | `60000` | teto do backoff |

O heartbeat deve ser menor que o timeout do lock.

## Recuperação de senha por e-mail

| Variável | Padrão/fallback | Uso |
| --- | --- | --- |
| `RESEND_API_KEY` | vazio no Compose | chave da API Resend |
| `RESEND_FROM_ADDRESS` | `onboarding@resend.dev` no Compose | remetente completo |

Sem chave válida, o backend inicia e mantém a resposta genérica do endpoint, mas o envio assíncrono falha. Para destinatários reais, verifique o domínio no Resend ou use um remetente autorizado pela conta.

Exemplo:

```dotenv
RESEND_API_KEY=re_<valor-real>
RESEND_FROM_ADDRESS="FinVise <no-reply@dominio-verificado.example>"
```

## Open Finance / Pluggy

| Variável | Padrão | Uso |
| --- | --- | --- |
| `OPEN_FINANCE_PROVIDER` | `pluggy` | identificador retornado pelo status |
| `OPEN_FINANCE_BASE_URL` | `https://api.pluggy.ai` | base da API |
| `PLUGGY_CLIENT_ID` | vazio | credencial do servidor |
| `PLUGGY_CLIENT_SECRET` | vazio | segredo do servidor |
| `OPEN_FINANCE_WEBHOOK_URL` | vazio | valor encaminhado ao Connect Token |
| `OPEN_FINANCE_OAUTH_REDIRECT_URL` | vazio | URL/deep link de retorno |
| `OPEN_FINANCE_INCLUDE_SANDBOX` | `false` | inclui instituições sandbox |

O repositório não possui receptor de webhook. A sincronização acontece por `POST /api/v1/open-finance/items/{itemId}/sync`.

## Armazenamento de CSV

| Variável | Padrão | Uso |
| --- | --- | --- |
| `STORAGE_TYPE` | `local` | `local` ou `oci` |
| `STORAGE_LOCAL_BASE_PATH` | `/app/uploads` no Compose | diretório de arquivos |
| `OCI_NAMESPACE` | vazio | namespace do Object Storage |
| `OCI_BUCKET_NAME` | vazio | bucket |
| `OCI_REGION` | vazio | região OCI |

O modo OCI também exige um profile `DEFAULT` válido em `~/.oci/config`. O Compose atual não monta esse arquivo; não habilite `STORAGE_TYPE=oci` sem definir uma estratégia segura de credenciais.

## AI Service: runtime e modelos

| Variável | Padrão isolado | Padrão Compose/imagem | Uso |
| --- | --- | --- | --- |
| `ENVIRONMENT` / `AI_SERVICE_ENVIRONMENT` | `development` | `development` | ambiente efetivo |
| `HOST` | `0.0.0.0` | `0.0.0.0` | bind do Uvicorn isolado |
| `PORT` | `8000` | `8000` | porta isolada |
| `LOG_LEVEL` | `INFO` | `info` | nível de log |
| `MODELS_DIR` | `models` | `/app/models` | raiz dos artefatos |
| `TRANSACTION_MODEL_PATH` | `models/transaction-classifier` | `/app/models/transaction-classifier` | classificador de transações |
| `PROFILE_MODEL_PATH` | `models/profile-classifier` | `/app/models/profile-classifier` | classificador de perfil |
| `MODEL_EVALUATION_REPORT_DIR` | `reports/final-test` | não encaminhada pelo Compose | relatórios de avaliação |
| `REQUIRE_ACTIVE_MODELS` | `false` no código | `true` | falha se os modelos não estiverem ativos |
| `TRANSACTION_MODEL_VERSION` | vazio | `1.1.0-bootstrap.1` | versão esperada |
| `PROFILE_MODEL_VERSION` | vazio | `1.0.0-bootstrap.1` | versão esperada |

O perfil `production` sempre exige modelos ativos, mesmo que a flag seja desligada. A imagem Docker provisiona as versões bootstrap durante o build. Versão ausente, divergente, corrompida ou com metadata não ativa interrompe o startup.

## AI Service: LLM

| Variável | Padrão | Uso |
| --- | --- | --- |
| `ENABLE_LLM` | `false` | habilita respostas por provider remoto |
| `LLM_PROVIDER` | `openai` | provider aceito pelo código atual |
| `LLM_API_KEY` | vazio | Bearer da API |
| `LLM_MODEL` | `gpt-4o-mini` | modelo de chat |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | base compatível com OpenAI no modo isolado |
| `LLM_TIMEOUT_SECONDS` | `30` | timeout interno |
| `LLM_MAX_TOKENS` | `1024` | limite da resposta |
| `LLM_TEMPERATURE` | `0.2` | aleatoriedade |

No `.env` da raiz, `LLM_TIMEOUT` é convertido pelo Compose em `LLM_TIMEOUT_SECONDS`. O Compose atual não encaminha `LLM_BASE_URL`, `LLM_MAX_TOKENS` nem `LLM_TEMPERATURE`; seus padrões de código permanecem ativos dentro do container.

Sem `ENABLE_LLM=true` e chave, o agente usa um provider determinístico de template.

## AI Service: embeddings e recuperação

| Variável | Padrão | Regra |
| --- | --- | --- |
| `RAG_ENABLE_REMOTE_EMBEDDINGS` | `true` | remoto requer também `LLM_API_KEY` |
| `RAG_EMBEDDING_MODEL` | `text-embedding-3-small` | deve retornar 1536 dimensões |
| `RAG_EMBEDDING_BATCH_SIZE` | `200` | runtime limita a 1–500 |
| `RAG_INDEX_MAX_BATCHES` | `100` | 1–100 |
| `RAG_MIN_RELEVANCE` | `0.18` | corte vetorial |
| `RAG_HYBRID_RRF_K` | `60` | constante positiva da fusão RRF |
| `RAG_VECTOR_WEIGHT` | `1.0` | peso positivo |
| `RAG_TEXT_WEIGHT` | `1.0` | peso positivo |
| `RAG_CANDIDATE_MULTIPLIER` | `4` | 1–20 |
| `RAG_RETRIEVAL_METRICS_WINDOW` | `1000` | 10–10.000 amostras |

Sem embeddings remotos efetivamente habilitados, o serviço usa `local-hash-v2`. O full-text continua disponível quando pgvector/consulta vetorial não estiver disponível.

### Pool SQL do AI Service

| Variável | Padrão | Uso |
| --- | --- | --- |
| `RAG_DB_POOL_MIN_SIZE` | `0` | conexões mínimas |
| `RAG_DB_POOL_MAX_SIZE` | `10` | conexões máximas |
| `RAG_DB_POOL_TIMEOUT_SECONDS` | `10` | espera por conexão |

O mínimo não pode superar o máximo. A URL pode vir de `SPRING_DATASOURCE_URL` ou `DATABASE_URL`; usuário/senha priorizam `SPRING_DATASOURCE_*` e depois `POSTGRES_*`.

## AI Service: agente e treinamento

| Variável | Padrão | Uso |
| --- | --- | --- |
| `AGENT_SYSTEM_PROMPT_PATH` | `app/agent/prompts/system_prompt.txt` | prompt base |
| `AGENT_ENABLE_RECOMMENDATIONS` | `true` | existe nas settings; o orquestrador atual não consulta a flag |
| `AGENT_ENABLE_SIMULATIONS` | `true` | existe nas settings; o orquestrador atual não consulta a flag |
| `AGENT_INPUT_TOKEN_BUDGET` | `8000` | mínimo de 1000 |
| `DATASET_RAW_DIR` | `../finance_ai_dataset` | dataset canônico |
| `DATA_PROCESSED_DIR` | `data/processed` | dados preparados |
| `DATA_SAMPLES_DIR` | `data/samples` | amostras bootstrap |

## Frontend

| Variável | Padrão | Momento |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api/v1` | build e execução Vite |
| `VITE_API_PROXY_TARGET` | `http://localhost:8080` | servidor Vite local |

Em Docker, use caminho relativo `/api/v1` para que navegador, Nginx e backend permaneçam na mesma origem.

## Matriz de integrações opcionais

| Funcionalidade | Configuração necessária | Comportamento sem configuração |
| --- | --- | --- |
| Recuperação por e-mail | `RESEND_API_KEY` e remetente autorizado | API responde genericamente, mas e-mail não chega |
| Open Finance | credenciais Pluggy | status indica não configurado e conexão falha |
| Resposta por LLM | `ENABLE_LLM=true`, provider e chave | template determinístico |
| Embeddings remotos | flag, chave e modelo de 1536 dimensões | `local-hash-v2` |
| OCI Object Storage | tipo, namespace, bucket, região e credenciais | use armazenamento local |

## Verificação segura

```bash
docker compose config --quiet
docker compose -f docker-compose.yml -f docker-compose.production.yml config --quiet
docker compose ps
curl http://localhost:8080/health
curl http://localhost:8080/actuator/health
```

`docker compose config` pode renderizar segredos no terminal. Não copie sua saída para issues, PRs ou logs públicos.
