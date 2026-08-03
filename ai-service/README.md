# AI Service — FinVise

Serviço FastAPI responsável por inferência de modelos, fallbacks, ferramentas do agente, integração HTTP com LLM/embeddings e acesso ao PostgreSQL para RAG.

## Responsabilidades

- Classificação de transações.
- Classificação de perfil por Machine Learning ou regras.
- Motor interno de recomendações.
- Registry e validação de artefatos de modelo.
- Agente financeiro com ferramentas determinísticas.
- Resposta completa ou streaming SSE.
- Geração de embeddings remotos ou `local-hash-v2`.
- Indexação e recuperação híbrida em `rag_documents`.

O backend Spring é a API pública e o proprietário do schema. O AI Service não executa DDL; seu acesso SQL é restrito ao pipeline RAG.

## Estrutura

```text
ai-service/
├── app/
│   ├── agent/                   # provider, RAG, prompt, orquestração e ferramentas
│   ├── api/                     # rotas FastAPI
│   ├── core/                    # configuração, logging e exceções
│   ├── explainability/          # extração genérica de importância
│   ├── model_registry/          # ativação e validação de artefatos
│   ├── preprocessing/           # normalização textual
│   ├── profile_classifier/      # sklearn, regras e fallback
│   ├── recommendations/         # motor Python interno
│   ├── schemas/                 # contratos Pydantic
│   └── transaction_classifier/  # sklearn e fallback
├── training/                    # preparação, treino e avaliação
├── data/samples/                # amostras versionadas
├── models/                      # artefatos locais ignorados pelo Git
├── reports/final-test/          # métricas finais versionadas
└── tests/                       # pytest
```

## Pré-requisitos

- Python >= 3.11.
- PostgreSQL acessível para indexação/recuperação RAG.
- Artefatos de modelo opcionais quando fallbacks são permitidos.

## Executar localmente

```bash
cd ai-service
cp .env.example .env

python -m pip install -r requirements.lock
python -m pip install --no-deps -e .

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

Resposta:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "environment": "development"
}
```

## Configuração

### Runtime e modelos

| Variável | Padrão | Uso |
| --- | --- | --- |
| `ENVIRONMENT` | `development` | `production`/`prod` exige modelos ativos |
| `LOG_LEVEL` | `INFO` | nível de log |
| `HOST` | `0.0.0.0` | usado ao executar `app.main` diretamente |
| `PORT` | `8000` | usado ao executar `app.main` diretamente |
| `MODELS_DIR` | `models` | diretório geral |
| `TRANSACTION_MODEL_PATH` | `models/transaction-classifier` | classificador de transações |
| `PROFILE_MODEL_PATH` | `models/profile-classifier` | classificador de perfil |
| `MODEL_EVALUATION_REPORT_DIR` | `reports/final-test` | saída da avaliação |
| `REQUIRE_ACTIVE_MODELS` | `false` | falha na inicialização quando um modelo é inválido/ausente |
| `TRANSACTION_MODEL_VERSION` | vazio | versão esperada opcional |
| `PROFILE_MODEL_VERSION` | vazio | versão esperada opcional |

### Banco para RAG

O parser aceita `SPRING_DATASOURCE_URL` ou `DATABASE_URL`, em formato JDBC/PostgreSQL. Usuário e senha usam os primeiros valores disponíveis:

```dotenv
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/finvise
SPRING_DATASOURCE_USERNAME=finvise
SPRING_DATASOURCE_PASSWORD=<senha>
```

Fallbacks: `POSTGRES_USER`, `POSTGRES_PASSWORD` e banco `finvise`. O serviço não lê uma variável separada de host/porta; eles são extraídos da URL.

As conexões são reutilizadas por um pool iniciado e encerrado com a aplicação:

| Variável | Padrão | Uso |
| --- | --- | --- |
| `RAG_DB_POOL_MIN_SIZE` | `0` | conexões mantidas mesmo sem demanda |
| `RAG_DB_POOL_MAX_SIZE` | `10` | limite de conexões simultâneas do AI Service |
| `RAG_DB_POOL_TIMEOUT_SECONDS` | `10` | espera máxima por uma conexão disponível |

`RAG_DB_POOL_MIN_SIZE` não pode superar `RAG_DB_POOL_MAX_SIZE`. O padrão mínimo zero evita conexão antecipada; após o primeiro uso, conexões ociosas permanecem disponíveis para reutilização conforme a política do pool.

### LLM

| Variável | Padrão |
| --- | --- |
| `ENABLE_LLM` | `false` |
| `LLM_PROVIDER` | `openai` |
| `LLM_API_KEY` | vazio |
| `LLM_MODEL` | `gpt-4o-mini` |
| `LLM_BASE_URL` | `https://api.openai.com/v1` |
| `LLM_TIMEOUT_SECONDS` | `30` |
| `LLM_MAX_TOKENS` | `1024` |
| `LLM_TEMPERATURE` | `0.2` |

Somente `LLM_PROVIDER=openai` ativa `OpenAIProvider`; outro valor usa o provider de template. O cliente chama `{LLM_BASE_URL}/chat/completions` com `httpx`. Não há LangChain nem SDK oficial da OpenAI.

### RAG

| Variável | Padrão | Limite efetivo |
| --- | --- | --- |
| `RAG_ENABLE_REMOTE_EMBEDDINGS` | `true` | remoto exige também `LLM_API_KEY` |
| `RAG_EMBEDDING_MODEL` | `text-embedding-3-small` | resposta deve ter 1536 dimensões |
| `RAG_EMBEDDING_BATCH_SIZE` | `200` | 1–500 |
| `RAG_INDEX_MAX_BATCHES` | `100` | 1–100 |
| `RAG_MIN_RELEVANCE` | `0.18` | limiar vetorial |

Sem embeddings remotos, o modelo efetivo é `local-hash-v2`. A busca cai para full-text quando `pgvector`/vetor não está disponível ou não retorna candidato relevante.

### Agente e dados

| Variável | Padrão |
| --- | --- |
| `AGENT_SYSTEM_PROMPT_PATH` | `app/agent/prompts/system_prompt.txt` |
| `AGENT_ENABLE_RECOMMENDATIONS` | `true` |
| `AGENT_ENABLE_SIMULATIONS` | `true` |
| `DATASET_RAW_DIR` | `../finance_ai_dataset` |
| `DATA_PROCESSED_DIR` | `data/processed` |
| `DATA_SAMPLES_DIR` | `data/samples` |

`AGENT_ENABLE_RECOMMENDATIONS` e `AGENT_ENABLE_SIMULATIONS` existem nas settings, mas o orquestrador atual não as consulta ao selecionar ferramentas.

## Endpoints

| Método | Endpoint | Uso |
| --- | --- | --- |
| `GET` | `/health` | health do processo |
| `GET` | `/internal/v1/models/status` | registry, artefatos e LLM |
| `POST` | `/internal/v1/transactions/classify` | inferência de categoria |
| `POST` | `/internal/v1/profiles/analyze` | inferência/regras de perfil |
| `POST` | `/internal/v1/profiles/recommendations` | motor Python de recomendações |
| `POST` | `/internal/v1/agent/respond` | agente síncrono |
| `POST` | `/internal/v1/agent/respond/stream` | SSE do agente |
| `POST` | `/internal/v1/rag/index` | indexação síncrona ou background |

Não existe `/internal/v1/rag/search`; a recuperação é chamada diretamente pelo orquestrador.

O serviço não autentica essas rotas. No Compose, ele não publica porta e o Nginx bloqueia `/internal/`; ao executá-lo isoladamente em `8000`, proteja o acesso por rede.

Documentação FastAPI em execução isolada:

- Swagger UI: `http://localhost:8000/docs`;
- OpenAPI: `http://localhost:8000/openapi.json`.

## Ferramentas do agente

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

A seleção usa termos da última mensagem. Ferramentas operam no `AgentContext` enviado pelo backend e rodam em paralelo com o retrieval RAG. O provider recebe os resultados já calculados; a chamada remota não executa tool-calling.

## Modelos e fallbacks

Artefatos esperados:

```text
models/transaction-classifier/
├── model.joblib
├── metadata.json
└── labels.json

models/profile-classifier/
├── model.joblib
├── metadata.json
├── feature_names.json
└── preprocessor.joblib  # opcional
```

`metadata.status` deve ser `ACTIVE`. O registry calcula SHA-256 dos artefatos obrigatórios e expõe paths/erros no status.

Sem modelo válido e com fallbacks permitidos:

- transações: palavras-chave de `categorias.csv` mais mapa embutido;
- perfil ML: regras fallback;
- opção `FINANCIAL_RULES`: `RuleBasedProfileClassifier` versão `RULES-1.0.0`.

## Treinamento e avaliação

```bash
python -m training.prepare_dataset
python -m training.train_transaction_classifier
python -m training.train_profile_classifier
python -m training.evaluate_models
```

Detalhes, features, hiperparâmetros e métricas: `../docs/data-science.md`.

## Testes e lint

```bash
ruff check .
pytest
```

O lockfile inclui as dependências de desenvolvimento usadas no CI. A suíte cobre API, schemas, registry/artefatos, classificadores, leakage, RAG, ferramentas, analytics e streaming.

## Docker

O `Dockerfile` usa Python 3.11 slim, instala `requirements.lock`, instala o pacote em modo editável sem resolver dependências novamente e inicia:

```text
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

O container não declara usuário não-root. No Compose, modelos são montados read-only e credenciais do PostgreSQL são encaminhadas para o RAG.
