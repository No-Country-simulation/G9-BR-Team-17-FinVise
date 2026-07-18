# Finance AI — Assistente Inteligente de Saúde Financeira

> "O Finance AI não mostra apenas para onde o dinheiro foi. Ele explica o que está acontecendo e indica o próximo passo."

## Visão geral

O Finance AI é uma aplicação Fintech que transforma transações e informações financeiras em:

1. Classificação automática de transações
2. Resumo de gastos por categoria
3. Identificação de padrões de consumo
4. Indicadores de saúde financeira
5. Classificação do perfil financeiro
6. Recomendações simples e explicáveis
7. Interação com um agente financeiro inteligente
8. Histórico mensal da evolução financeira

## Arquitetura

Monorepo com três aplicações principais:

- **frontend** — React + TypeScript + Vite + PWA
- **backend** — Java 21 + Spring Boot 3 + PostgreSQL
- **ai-service** — Python + FastAPI + Pandas + Scikit-learn

```
Usuário
   ↓ HTTPS
Nginx
   ├── /                 → frontend
   └── /api              → backend Spring Boot
                                ↓
                         ai-service FastAPI
                                ↓
                         modelos de ML
```

A comunicação detalhada está em `docs/architecture.md`.

## Pré-requisitos

- Docker e Docker Compose
- Java 21+ (para backend local)
- Maven (wrapper incluído)
- Python 3.11+ (para ai-service local)
- Node.js 22.12+ (para frontend local com React 19.2 e Vite 7)

## Instalação rápida

```bash
# Clone o repositório
git clone <repo>
cd finance-ai

# Crie o .env a partir do exemplo
cp .env.example .env

# Gere amostras do dataset
python data/scripts/create_samples.py

# Suba a aplicação
make up
```

Acesse: http://localhost:8080

## Comandos úteis

```bash
make setup     # Cria .env e amostras
make build     # Builda todos os containers
make up        # Sobe a aplicação
make down      # Para a aplicação
make logs      # Acompanha logs
make test      # Executa todos os testes
make health    # Verifica saúde dos serviços
make backup    # Backup do PostgreSQL
make restore   # Restore do PostgreSQL
```

## Treinamento dos modelos

```bash
make train-transaction-model
make train-profile-model
make evaluate-models
```

Ou manualmente:

```bash
cd ai-service
python -m training.prepare_dataset
python -m training.train_transaction_classifier
python -m training.train_profile_classifier
```

## Notebook de Ciência de Dados

O notebook completo da entrega está em
[`notebooks/finance_ai_data_science.ipynb`](notebooks/finance_ai_data_science.ipynb).

Ele contém EDA, limpeza, tratamento textual e financeiro, prevenção de vazamento,
engenharia de atributos, comparação de modelos, avaliação final em `TEST`, matrizes
de confusão, explicabilidade e serialização. Para preservar os modelos usados pela
aplicação, os artefatos experimentais são gravados separadamente em
`ai-service/models/notebook-experiments/`.

```bash
cd ai-service
pip install -e .
pip install jupyter matplotlib
jupyter lab ../notebooks/finance_ai_data_science.ipynb
```

## Testes

### Backend

```bash
cd backend
./mvnw test
```

### AI Service

```bash
cd ai-service
python -m pytest tests/ -v
```

### Frontend

```bash
cd frontend
npm run test -- --run
```

## Endpoints principais

- `POST /api/v1/auth/login` — Login
- `POST /api/v1/financial-analyses` — Nova análise
- `GET /api/v1/financial-analyses/models` — Modelos de perfil disponíveis
- `POST /api/v1/financial-analyses/from-transactions` — Analisa as transações persistidas
- `GET /api/v1/transactions/monthly-summary?source=CSV_IMPORT` — Série mensal separada por origem
- `GET /api/v1/financial-analyses/{analysisId}` — Detalhes da análise
- `GET /api/v1/open-finance/status` — Status da integração Open Finance
- `POST /api/v1/open-finance/connect-token` — Token para abrir o Pluggy Connect
- `POST /api/v1/open-finance/items/{itemId}/sync` — Sincroniza e analisa um item conectado
- `GET /api/v1/users/{userId}/dashboard` — Dashboard
- `GET /api/v1/users/{userId}/recommendations` — Recomendações
- `POST /api/v1/agent/conversations` — Criar conversa
- `POST /api/v1/agent/conversations/{conversationId}/messages` — Enviar mensagem
- `GET /api/v1/model-status` — Status dos modelos
- `GET /actuator/health` — Health check

Documentação completa da API em `docs/api.md`.

## Variáveis de ambiente

Veja `.env.example` para a lista completa. Principais:

- `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`
- `JWT_SECRET`
- `AI_SERVICE_URL`
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `ENABLE_LLM`, `LLM_API_KEY`, `LLM_MODEL`
- `OBJECT_STORAGE_ENABLED`, `OBJECT_STORAGE_BUCKET`
- `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` — credenciais server-side do Open Finance
- `OPEN_FINANCE_WEBHOOK_URL`, `OPEN_FINANCE_OAUTH_REDIRECT_URL` — URLs públicas opcionais do fluxo Pluggy

## Análise de perfil e Open Finance

Depois da importação CSV, o sistema persiste e classifica as transações e executa automaticamente o modelo de perfil escolhido. CSV e Open Finance são origens independentes em transações, indicadores, gráficos, análises e conversas do agente. Arquivos CSV idênticos são bloqueados por hash SHA-256 para evitar totais duplicados. Também é possível reanalisar a base existente, com período opcional, usando um dos modelos:

- `MACHINE_LEARNING` — modelo treinado para combinar padrões financeiros.
- `FINANCIAL_RULES` — regras determinísticas e explicáveis de saúde financeira.

Para habilitar o Open Finance, crie uma aplicação na Pluggy e preencha `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` no `.env`. O backend mantém as credenciais fora do navegador, emite o Connect Token, sincroniza contas e transações, evita duplicatas pelo identificador externo e gera a análise escolhida ao concluir a conexão.

## Deploy

O deploy em produção é feito em uma única OCI Compute Instance Ubuntu com Docker Compose.

Veja o guia completo em `docs/deployment-oci.md`.

## Documentação

- `docs/architecture.md` — Arquitetura e diagramas
- `docs/api.md` — Documentação da API
- `docs/data-science.md` — Modelos de ML
- `notebooks/finance_ai_data_science.ipynb` — EDA, treinamento e avaliação reproduzível
- `docs/deployment-oci.md` — Deploy na OCI
- `docs/security.md` — Práticas de segurança
- `docs/adr/` — Registro de decisões arquiteturais

## Segurança

- Senhas hasheadas com BCrypt
- Autenticação JWT
- CORS configurável
- Rate limiting no Nginx
- Headers de segurança
- Logs estruturados sem dados sensíveis
- Segredos via `.env` (ignorado pelo Git)

Mais detalhes em `docs/security.md`.

## Dataset

O dataset sintético está em `data/raw/finance_ai_dataset/`.

Arquivos grandes estão ignorados pelo Git. Amostras pequenas estão em `data/samples/`.

## Licença

MIT — veja `LICENSE`.

## Disclaimer

As respostas do agente financeiro possuem caráter educacional e não substituem aconselhamento financeiro profissional.
