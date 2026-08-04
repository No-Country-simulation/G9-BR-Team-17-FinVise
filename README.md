<h1 align="center">FinVise - Plataforma de Inteligência Financeira</h1>

<p align="center">
  <b>Importação de transações, análises financeiras explicáveis, modelos de classificação e agente conversacional com recuperação de contexto.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.11+" />
  <img src="https://img.shields.io/badge/FastAPI-0.115.6-005571?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI 0.115.6" />
  <img src="https://img.shields.io/badge/Java_21-Spring_Boot_3.2.5-6DB33F?style=for-the-badge&logo=spring&logoColor=white" alt="Java 21 e Spring Boot 3.2.5" />
  <img src="https://img.shields.io/badge/React_19.2-Vite_7.3-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19.2 e Vite 7.3" />
  <img src="https://img.shields.io/badge/PostgreSQL-16_+_pgvector-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL 16 com pgvector" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker Compose" />
</p>

## 📌 Visão geral

O **FinVise** é uma aplicação financeira em monorepo. O usuário pode cadastrar uma conta, importar transações por CSV ou sincronizá-las pela Pluggy, gerar análises com modelos de Machine Learning ou regras determinísticas e consultar os dados pelo agente financeiro.

### Funcionalidades implementadas

- Cadastro, login JWT e redefinição de senha com código enviado pela Resend.
- Importação de CSV com limite de 5 MiB, armazenamento local ou OCI Object Storage e bloqueio de arquivo repetido por SHA-256.
- Integração Open Finance com Pluggy para Connect Token e sincronização explícita de um `itemId`.
- Classificação de transações por modelo Scikit-learn ou fallback por palavras-chave.
- Classificação de perfil por modelo Scikit-learn, regras financeiras selecionáveis ou fallback.
- Indicadores, resumos mensais e por categoria, recomendações determinísticas e simulação de poupança.
- Agente com ferramentas analíticas, rankings vetorial e full-text em português independentes, fusão RRF e respostas síncronas ou por SSE.
- Contexto do agente com agregações SQL, histórico paginado/resumido, orçamento de tokens, idempotência e cancelamento ponta a ponta.
- Seleção de origem e de fontes específicas (`sourceIds`) para isolar o contexto do agente.
- Indexação RAG assíncrona por fila durável no PostgreSQL, com retry, status consultável e reprocessamento manual.
- Interface React responsiva, PWA, rotas privadas e consumo do backend por `/api/v1`.

## 🏗️ Arquitetura

```text
Navegador
   │ HTTP local ou HTTPS com terminação TLS externa
   ▼
Nginx :8080 (desenvolvimento) / :80 (produção)
   ├── /, assets e rotas SPA ───────────────► frontend (React)
   ├── /api/* e /actuator/health ───────────► backend (Spring Boot)
   └── /internal/* ─────────────────────────► 403
                                                │
                           ┌────────────────────┴────────────────────┐
                           ▼                                         ▼
                  ai-service (FastAPI)                     PostgreSQL 16 + pgvector
                           │                                         ▲
                           ├── modelos Joblib                        │
                           ├── API compatível com OpenAI             │
                           └── SQL direto restrito a RAG ────────────┘
```

### Componentes

- **`frontend/`**: React 19.2.7, TypeScript, Vite 7.3.6, React Router, TanStack Query, React Hook Form, Zod, Recharts e Tailwind CSS.
- **`backend/`**: Java 21, Spring Boot 3.2.5, Spring Security, JWT, JPA, Flyway, PostgreSQL, Pluggy, Resend e armazenamento local/OCI.
- **`ai-service/`**: Python 3.11+, FastAPI, Scikit-learn, Pandas, Psycopg e cliente HTTP para Chat Completions/Embeddings. Não há dependência de LangChain nem de SHAP.
- **`infrastructure/`**: Nginx, scripts Bash de ciclo de vida, health check, backup e restore.

O backend é o proprietário das regras de negócio, do schema Flyway e dos dados financeiros. O AI Service acessa diretamente `rag_documents` para gerar/persistir embeddings e recuperar evidências; as demais informações do agente são calculadas no backend e enviadas no contexto da chamada.

Mais detalhes em [`docs/architecture.md`](docs/architecture.md) e [`docs/rag-architecture.md`](docs/rag-architecture.md).

## 🛠️ Tecnologias e versões

| Camada | Versão comprovada nos manifests | Uso |
| --- | --- | --- |
| Frontend | React 19.2.7, Vite 7.3.6, TypeScript 5.5.x | SPA/PWA e interface |
| Backend | Java 21, Spring Boot 3.2.5 | API, segurança, persistência e integrações |
| Banco | imagem `pgvector/pgvector:pg16` | Dados relacionais, JSONB, full-text e vetores de 1536 dimensões |
| AI/ML | Python >= 3.11, FastAPI 0.115.6, Scikit-learn 1.9.0 | Inferência, treinamento e agente |
| LLM | API HTTP configurável; padrão `gpt-4o-mini` | Chat opcional e embeddings remotos |
| Infraestrutura | Docker Compose e Nginx 1.27 Alpine | Orquestração e proxy reverso |

Consulte os manifests para a lista completa: [`backend/pom.xml`](backend/pom.xml), [`frontend/package.json`](frontend/package.json) e [`ai-service/pyproject.toml`](ai-service/pyproject.toml).

## ⚡ Instalação rápida com Docker

### Pré-requisitos

- Docker Engine com o plugin Docker Compose.
- GNU Make, caso sejam usados os atalhos do `Makefile`.

### Execução

```bash
git clone https://github.com/No-Country-simulation/G9-BR-Team-17-FinVise.git
cd G9-BR-Team-17-FinVise

cp .env.example .env
# Defina POSTGRES_PASSWORD, SPRING_DATASOURCE_PASSWORD, JWT_SECRET e AI_SERVICE_TOKEN.
# As duas senhas do banco devem ser iguais.

docker compose up -d --build
```

A aplicação fica disponível em `http://localhost:8080`. No Compose versionado, PostgreSQL, backend e AI Service não publicam portas no host; o acesso externo ocorre somente pelo Nginx.

Requisitos dos segredos:

- `JWT_SECRET`: pelo menos 32 bytes para a chave HMAC.
- `AI_SERVICE_TOKEN`: pelo menos 32 caracteres aleatórios; o mesmo valor autentica o backend no AI Service.
- `POSTGRES_PASSWORD` e `SPRING_DATASOURCE_PASSWORD`: mesmo valor; no perfil `production`, o backend exige pelo menos 16 caracteres e rejeita placeholders conhecidos.
- `RESEND_API_KEY`: necessária para a entrega efetiva de e-mails de redefinição de senha. A ausência da chave não impede o backend de iniciar, mas o envio falhará de forma assíncrona.

Open Finance, LLM, embeddings remotos e OCI Object Storage são opcionais. Consulte [Variáveis de ambiente](#variáveis-de-ambiente).

## 🛠️ Comandos do Makefile

| Comando | Comportamento atual |
| --- | --- |
| `make setup` | Copia `.env.example` quando necessário e tenta gerar amostras a partir de `data/raw/finance_ai_dataset/` |
| `make build` | Reconstrói as imagens sem cache |
| `make up` | Inicia o Compose em segundo plano |
| `make down` | Encerra os containers sem remover volumes |
| `make logs` | Acompanha os logs de todos os serviços |
| `make test` | Executa testes de backend, AI Service e frontend |
| `make health` | Faz verificações HTTP de melhor esforço; o AI Service não é publicado pelo Compose padrão |
| `make backup` | Gera um dump comprimido em `backups/` |
| `make restore` | Invoca o script sem o argumento obrigatório e, no estado atual, termina exibindo o uso; execute o script diretamente com o backup |
| `make clean` | **Remove containers e volumes**, inclusive os dados de PostgreSQL e uploads locais |

Para usar o override de produção nos alvos do Makefile, execute, por exemplo, `make up PROD=1`.

## 🤖 Ciência de dados e modelos

O dataset canônico está em `finance_ai_dataset/`. Os scripts usam esse caminho por padrão quando são executados a partir de `ai-service/`.

```bash
make train-transaction-model
make train-profile-model
make evaluate-models
```

O classificador de transações usa TF-IDF de uni/bigramas com Regressão Logística. O classificador de perfil compara Regressão Logística e Random Forest durante o treinamento. Artefatos `.joblib` e metadados de modelos são ignorados pelo Git; sem artefatos válidos, o serviço usa classificadores fallback, salvo quando modelos ativos forem exigidos pela configuração.

O relatório reproduzível do conjunto `TEST` está em [`ai-service/reports/final-test/`](ai-service/reports/final-test/), e a metodologia completa está em [`docs/data-science.md`](docs/data-science.md).

## 🔌 Importação de dados

### CSV

O importador da aplicação aceita cabeçalhos em inglês:

```csv
description,amount,date,type,payment_method,recurrent
Supermercado ABC,150.50,2026-07-01,EXPENSE,CREDIT_CARD,false
Salário,3500.00,2026-07-05,INCOME,PIX,true
```

Campos obrigatórios: `description`, `amount` e `date`. `type` é opcional e aceita `INCOME`, `RECEITA`, `EXPENSE` ou `DESPESA`; quando omitido, o sinal de `amount` define o tipo. `payment_method` e `recurrent` são opcionais. A categoria é calculada pelo sistema — colunas `categoria`/`category` não são lidas pelo importador.

Os CSVs do dataset de treinamento possuem outro schema e não podem ser enviados diretamente ao endpoint de importação sem transformação.

### Open Finance

O backend cria um Connect Token da Pluggy sem expor `PLUGGY_CLIENT_SECRET` ao navegador. Após a conexão, o frontend solicita explicitamente a sincronização de um `itemId`; o backend valida `clientUserId`, percorre contas/transações publicadas, evita duplicatas por identificador externo, categoriza, persiste, atualiza os fatos/RAG e gera uma análise.

Não há endpoint receptor de webhook implementado no repositório. `OPEN_FINANCE_WEBHOOK_URL`, quando definido, é apenas encaminhado na criação do Connect Token.

## 🌐 Endpoints principais

Todas as rotas abaixo, exceto autenticação e health check, exigem JWT.

| Método | Endpoint | Finalidade |
| --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Cadastro |
| `POST` | `/api/v1/auth/login` | Emissão de JWT |
| `POST` | `/api/v1/auth/forgot-password` | Solicitação de código de redefinição |
| `POST` | `/api/v1/imports/transactions/csv` | Importação CSV |
| `GET` | `/api/v1/imports/sources` | Fontes CSV/Open Finance do usuário |
| `GET` | `/api/v1/transactions` | Transações filtradas e paginadas |
| `POST` | `/api/v1/financial-analyses/from-transactions` | Análise das transações persistidas |
| `POST` | `/api/v1/open-finance/connect-token` | Connect Token da Pluggy |
| `POST` | `/api/v1/open-finance/items/{itemId}/sync` | Sincronização explícita |
| `POST` | `/api/v1/agent/conversations` | Nova conversa com origem e opções RAG |
| `POST` | `/api/v1/agent/conversations/{id}/messages/stream` | Resposta do agente por SSE |
| `GET` | `/api/v1/rag/status` | Contadores da indexação RAG |
| `POST` | `/api/v1/rag/index-step` | Etapa manual de indexação |
| `GET` | `/api/v1/rag/queue` | Estado do job durável de indexação |
| `POST` | `/api/v1/rag/reprocess` | Recuperação manual e reprocessamento controlado |
| `GET` | `/api/v1/model-status` | Estado dos modelos e do provedor LLM |
| `GET` | `/actuator/health` | Health check público do backend |

O contrato completo, inclusive envelopes, filtros, payloads, SSE e endpoints internos, está em [`docs/api.md`](docs/api.md). Swagger UI: `http://localhost:8080/api/v1/swagger-ui.html`.

## 🧪 Testes e verificações

```bash
# Backend
cd backend
./mvnw test -Dspring.profiles.active=test

# AI Service
cd ../ai-service
python -m pip install -r requirements.lock
python -m pip install --no-deps -e .
ruff check .
pytest

# Frontend
cd ../frontend
npm ci
npm run lint
npm run test:coverage -- --run
npm run build
```

Esses comandos refletem as verificações do workflow `.github/workflows/ci.yml`.

## Variáveis de ambiente

O Compose consome o `.env` da raiz. Os arquivos `backend/.env.example`, `ai-service/.env.example` e `frontend/.env.example` servem para execução isolada de cada componente.

| Grupo | Variáveis relevantes |
| --- | --- |
| Banco/segurança | `POSTGRES_*`, `SPRING_DATASOURCE_*`, `JWT_SECRET`, `JWT_EXPIRATION_MS`, `CORS_ALLOWED_ORIGINS` |
| AI Service | `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, timeouts, `MODELS_DIR`, caminhos dos modelos, `LOG_LEVEL` |
| LLM | `ENABLE_LLM`, `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_TIMEOUT` |
| RAG | `RAG_ENABLE_REMOTE_EMBEDDINGS`, `RAG_EMBEDDING_MODEL`, `RAG_EMBEDDING_BATCH_SIZE`, `RAG_INDEX_MAX_BATCHES`, `RAG_MIN_RELEVANCE`, `RAG_HYBRID_RRF_K`, `RAG_VECTOR_WEIGHT`, `RAG_TEXT_WEIGHT`, `RAG_CANDIDATE_MULTIPLIER`, `RAG_INDEX_QUEUE_*` |
| Open Finance | `OPEN_FINANCE_*`, `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` |
| Arquivos/OCI | `STORAGE_TYPE`, `STORAGE_LOCAL_BASE_PATH`, `OCI_NAMESPACE`, `OCI_BUCKET_NAME`, `OCI_REGION` |
| E-mail | `RESEND_API_KEY`, `RESEND_FROM_ADDRESS` |
| Proxy/frontend | `NGINX_HTTP_PORT`, `VITE_API_BASE_URL` |

Embeddings remotos exigem `RAG_ENABLE_REMOTE_EMBEDDINGS=true` e `LLM_API_KEY`; sem ambos, o RAG usa `local-hash-v2`. Respostas do agente por LLM também exigem `ENABLE_LLM=true`, `LLM_PROVIDER=openai` e a chave. O cliente usa URLs compatíveis com `/chat/completions` e `/embeddings`.

## 📚 Documentação técnica

- [Arquitetura](docs/architecture.md)
- [API pública e interna](docs/api.md)
- [Arquitetura RAG](docs/rag-architecture.md)
- [Ciência de dados](docs/data-science.md)
- [Segurança](docs/security.md)
- [Deploy na OCI](docs/deployment-oci.md)
- [Estratégia de branches](docs/BRANCHING.md)
- [Decisões arquiteturais](docs/adr/)
- [Notebook de ciência de dados](notebooks/finance_ai_data_science.ipynb)

## 🔒 Segurança

- Senhas de login são armazenadas com BCrypt.
- Recursos são isolados pelo UUID extraído do JWT; endpoints com `{userId}` rejeitam IDs diferentes do usuário autenticado.
- Códigos de redefinição são armazenados como SHA-256, expiram em 5 minutos e bloqueiam novas tentativas por 30 minutos após cinco erros.
- Nginx aplica headers de segurança e limite geral de API de 20 requisições/s por IP, com burst de 40.
- O override de produção não publica PostgreSQL, backend ou AI Service; somente Nginx na porta 80.
- A configuração atual não termina TLS no container. Produção deve usar terminação TLS externa ou receber uma configuração Nginx adicional validada.

Veja [`docs/security.md`](docs/security.md) para os limites e pendências conhecidos.

## 👥 Equipe

| Contribuidor | GitHub |
| --- | --- |
| Lucas Abreu | [@lucasabreuzip](https://github.com/lucasabreuzip) |
| Gabriel Silva | [@Gabrielsvdata](https://github.com/Gabrielsvdata) |
| Kauã Cantanhede | [@kant-sdev](https://github.com/kant-sdev) |
| Patricia Queiroz | [@PatQuei](https://github.com/PatQuei) |

## 📜 Licença

Distribuído sob a licença MIT. Consulte [`LICENSE`](LICENSE).

> As respostas do agente têm caráter educacional e informativo e não substituem aconselhamento financeiro profissional.
