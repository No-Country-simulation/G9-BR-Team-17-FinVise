<h1 align="center">FinVise — Plataforma de Inteligência Financeira IA</h1>

<p align="center">
  <b>Transforme planilhas de transações e extratos em decisões estratégicas — diagnóstico executivo automático, ciência de dados e agente inteligente conversacional.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.11+" />
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Java_21-Spring_Boot_3-6DB33F?style=for-the-badge&logo=spring&logoColor=white" alt="Java 21 Spring Boot 3" />
  <img src="https://img.shields.io/badge/React_19-Vite_7-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL 16" />
  <img src="https://img.shields.io/badge/OpenAI_/_LLM-412991?style=for-the-badge&logo=openai&logoColor=white" alt="OpenAI" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker Compose" />
</p>

<p align="center">
  <a href="#-visão-geral">Visão Geral</a> •
  <a href="#%EF%B8%8F-arquitetura">Arquitetura</a> •
  <a href="#-tecnologias">Tecnologias</a> •
  <a href="#-instalação-rápida">Instalação Rápida</a> •
  <a href="#-ciência-de-dados--machine-learning">Machine Learning</a> •
  <a href="#-endpoints-da-api">Endpoints</a> •
  <a href="#-documentação">Documentação</a>
</p>

---

> *"O FinVise não mostra apenas para onde o dinheiro foi. Ele explica o que está acontecendo e indica o próximo passo."*

---

## 📌 Visão Geral

O **FinVise** é uma solução Fintech end-to-end desenvolvida para transformar transações financeiras brutas em diagnósticos executivos explicáveis e acionáveis. Através de algoritmos de Machine Learning, regras financeiras determinísticas e um Agente Conversacional (LLM), a plataforma capacita o usuário a entender seu comportamento financeiro e evoluir sua saúde financeira.

### 🌟 Funcionalidades Principais

- 🏷️ **Classificação Automática de Transações**: Categorização inteligente baseada em modelos de ML treinados e processamento de texto.
- 🔍 **RAG & Banco Vetorial (`pgvector`)**: Busca por similaridade de cosseno em vetor de 1536 dimensões (`text-embedding-3-small`) para recuperação contextual exata de transações.
- ⚡ **Processamento de Embeddings em Lote (Batching)**: Geração otimizada de embeddings em lote de 1 única chamada HTTP, reduzindo consumo de tokens, custo e latência de rede.
- ⚡ **Chat ao Vivo via SSE (Server-Sent Events)**: Respostas em tempo real com efeito de digitação suave no Agente Conversacional.
- 🎨 **Interface Limpa com Ícones Elegantes**: Subtituição de emojis por ícones minimalistas Lucide SVG (`Tag`, `BarChart3`, `Lightbulb`, `CreditCard`, `Search`, etc.) nos badges de ferramentas.
- 📊 **Resumo de Gastos e Séries Temporais**: Visão consolidada por categoria, origem de dados (`CsvImport` ou `OpenFinance`) e evolução mensal.
- 📈 **Indicadores de Saúde Financeira**: Cálculo de pontuação e métricas de sustentabilidade orçamentária.
- 👤 **Classificação de Perfil Financeiro**: Identificação automática do perfil do usuário por ML ou Regras Financeiras.
- 💡 **Recomendações Explicáveis e Personalizadas**: Dicas acionáveis orientadas ao perfil e hábitos de consumo identificados.
- 💬 **Agente Financeiro Inteligente (LLM)**: Chat em tempo real com controle de grounding estrito (*Strict RAG*) para evitar alucinações.
- 🔗 **Open Finance (Pluggy Integration)**: Conexão direta com instituições bancárias mantendo credenciais protegidas server-side.
- 🛑 **Anti-Duplicação por Hash SHA-256**: Bloqueio de importações repetidas de planilhas CSV para garantia da integridade dos dados.

## 🏗️ Arquitetura

O projeto é estruturado como um **Monorepo** desacoplado, resiliente e escalável:

```text
                           ┌───────────────────────────┐
                           │          Usuário          │
                           └─────────────┬─────────────┘
                                         │ HTTPS
                                         ▼
                           ┌───────────────────────────┐
                           │     Nginx Reverse Proxy   │
                           └──────┬─────────────┬──────┘
                                  │             │
                    ┌─────────────┘             └─────────────┐
                    ▼                                         ▼
   ┌─────────────────────────────────┐       ┌─────────────────────────────────┐
   │        frontend (React 19)      │       │     backend (Spring Boot 3)     │
   │      TypeScript + Vite + PWA    │       │     Java 21 + PostgreSQL 16    │
   └─────────────────────────────────┘       └────────────────┬────────────────┘
                                                              │
                                                              ▼
                                             ┌─────────────────────────────────┐
                                             │     ai-service (FastAPI)        │
                                             │  Python + Scikit-Learn + LLM    │
                                             └─────────────────────────────────┘
```

### Componentes

- **`frontend`**: Interface reativa e moderna construída com React 19, Vite 7, TypeScript e suporte a Progressive Web App (PWA).
- **`backend`**: API RESTful robusta desenvolvida em Java 21 com Spring Boot 3, JPA/Hibernate, segurança JWT e banco PostgreSQL 16.
- **`ai-service`**: Microserviço em Python (FastAPI) responsável pela inferência de ML, engenharia de atributos, explicabilidade (SHAP) e agente LLM.

---

## 🛠️ Tecnologias

| Camada | Tecnologia | Versão | Descrição |
| :--- | :--- | :--- | :--- |
| **Frontend** | React, Vite, TypeScript | React 19 / Vite 7 | Interface SPA e PWA responsiva e dinâmica |
| **Backend** | Java, Spring Boot | Java 21 / Spring 3.x | Regras de negócio, autenticação JWT e integrações |
| **Database** | PostgreSQL | 16 | Banco de dados relacional e persistência financeira |
| **AI / ML** | Python, FastAPI, Scikit-Learn | Python 3.11+ / FastAPI | Classificação de transações, perfis e inteligência |
| **LLM / Agente** | OpenAI API / LangChain | GPT-4o / GPT-3.5 | Agente conversacional que analisa dados em tempo real |
| **Infraestrutura** | Docker, Docker Compose, Nginx | Latest | Conteinerização completa e roteamento seguro |

---

## ⚡ Instalação Rápida

### Pré-requisitos

- **Docker** e **Docker Compose** instalados
- *(Opcional para desenvolvimento local sem Docker)*: Java 21+, Python 3.11+, Node.js 22.12+

### Passos para Execução

```bash
# 1. Clone o repositório
git clone https://github.com/No-Country-simulation/G9-BR-Team-17-FinVise.git
cd G9-BR-Team-17-FinVise

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Preencha POSTGRES_PASSWORD, SPRING_DATASOURCE_PASSWORD e JWT_SECRET.
# As duas senhas do banco devem ter o mesmo valor; JWT_SECRET exige 32+ caracteres.

# 3. Gere as amostras do dataset de treino
python data/scripts/create_samples.py

# 4. Inicie todos os serviços via Docker Compose
make up
```

Acesse a aplicação no navegador em: **`http://localhost:8080`**

---

## 🛠️ Comandos Úteis (`Makefile`)

A plataforma inclui um `Makefile` configurado para automatizar todo o ciclo de vida do desenvolvimento:

| Comando | Descrição |
| :--- | :--- |
| `make setup` | Cria o arquivo `.env` e gera os dados de amostra iniciais |
| `make build` | Constrói todas as imagens Docker dos microserviços |
| `make up` | Inicia os containers em segundo plano |
| `make down` | Interrompe e remove os containers ativos |
| `make logs` | Exibe os logs unificados em tempo real |
| `make test` | Executa a suíte completa de testes (Backend, Frontend e AI) |
| `make health` | Verifica a saúde operacional de todas as APIs |
| `make backup` | Executa backup do banco PostgreSQL |
| `make restore` | Restaura o banco PostgreSQL a partir de um backup |

---

## 🤖 Ciência de Dados & Machine Learning

O pipeline de inteligência do **FinVise** inclui EDA reproduzível, tratamento de linguagem natural para extratos bancários e explicabilidade de modelos.

### Treinamento dos Modelos via Makefile

```bash
make train-transaction-model   # Treina o classificador de transações
make train-profile-model       # Treina o classificador de perfil financeiro
make evaluate-models           # Executa a avaliação completa de métricas
```

### Notebook de Ciência de Dados

O notebook oficial da entrega está localizado em [`notebooks/finance_ai_data_science.ipynb`](notebooks/finance_ai_data_science.ipynb).

**O notebook cobre:**
- **Análise Exploratória de Dados (EDA)** detalhada de transações e padrões de gastos
- **Limpeza e Normalização Textual** das descrições de lançamentos bancários
- **Engenharia de Atributos (Feature Engineering)** para extração de sinais financeiros
- **Benchmark de Algoritmos**: Regressão Logística, Random Forest e SVM
- **Avaliação em Split de Teste** com matrizes de confusão e métricas F1-Score
- **Explicabilidade de Decisão** utilizando SHAP (*SHapley Additive exPlanations*) e Feature Importance
- **Serialização de Modelos** e empacotamento de artefatos para a API de produção

---

## 🔌 Open Finance & Importação CSV

A aplicação oferece duas formas independentes de ingestão de dados financeiros:

1. **Importação via Planilhas CSV**:
   - Suporte a extratos bancários padrão.
   - Bloqueio de arquivos duplicados por verificação de **Hash SHA-256**.
2. **Conexão Direta Open Finance (Pluggy)**:
   - O backend gera o token seguro (`Connect Token`) sem expor credenciais no cliente.
   - Sincronização automática de contas e transações via webhook ou polling.
   - Evita dados duplicados por mapeamento de identificadores externos únicos.

---

## 🌐 Endpoints da API

A documentação detalhada de endpoints está em [`docs/api.md`](docs/api.md). Principais rotas:

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Autenticação de usuário e emissão de JWT |
| `POST` | `/api/v1/financial-analyses` | Solicita nova análise financeira |
| `GET` | `/api/v1/financial-analyses/models` | Lista os modelos de perfil disponíveis (`MACHINE_LEARNING` / `FINANCIAL_RULES`) |
| `POST` | `/api/v1/financial-analyses/from-transactions` | Analisa a base de transações persistidas |
| `GET` | `/api/v1/transactions/monthly-summary` | Resumo mensal segregado por origem (CSV / Open Finance) |
| `POST` | `/api/v1/open-finance/connect-token` | Gera token para o widget Pluggy Connect |
| `POST` | `/api/v1/agent/conversations` | Inicia conversa com o Agente Financeiro IA |
| `POST` | `/api/v1/agent/conversations/{id}/messages` | Envia mensagem para o Agente |
| `GET` | `/api/v1/model-status` | Status de prontidão dos modelos de ML |
| `GET` | `/actuator/health` | Health Check da aplicação |

---

## 🧪 Suíte de Testes

Para garantir a qualidade e estabilidade do código, execute os testes por componente:

```bash
# Testes do Backend (Spring Boot / Maven)
cd backend && ./mvnw test

# Testes do AI Service (pytest)
cd ai-service && python -m pytest tests/ -v

# Testes do Frontend (Vitest / React Testing Library)
cd frontend && npm run test -- --run
```

---

## 📚 Documentação Técnica

- 📐 **[Arquitetura do Sistema](docs/architecture.md)** — Relações entre serviços e diagramas
- 📑 **[Documentação da API](docs/api.md)** — Especificação OpenAPI e contratos DTO
- 🔬 **[Ciência de Dados](docs/data-science.md)** — Detalhes dos hiperparâmetros e métricas dos modelos
- 📓 **[Jupyter Notebook](notebooks/finance_ai_data_science.ipynb)** — Experimentos de ML reproduzíveis
- ☁️ **[Guia de Deploy OCI](docs/deployment-oci.md)** — Implantação em instância Ubuntu na Oracle Cloud
- 🔒 **[Práticas de Segurança](docs/security.md)** — Criptografia, autenticação e proteção de dados

---

## 🛡️ Segurança

- 🔑 **Senhas Protegidas**: Criptografia forte com algoritmos BCrypt.
- 🛂 **Autenticação JWT**: Controle de sessão via tokens assinados e expiráveis.
- 🛡️ **Proteção Nginx**: Rate limiting e adição de headers HTTP de segurança.
- 🔒 **Isolamento de Credenciais**: Váriaveis sensíveis gerenciadas estritamente via `.env` (ignorado no versionamento).

---

## 👥 Equipe & Contribuidores

Agradecemos a todos os membros do **Team 17 (FinVise)** pela dedicação e contribuição no desenvolvimento desta plataforma:

| Contribuidor | GitHub |
| :--- | :--- |
| **Lucas Abreu** | [@lucasabreuzip](https://github.com/lucasabreuzip) |
| **Gabriel Silva** | [@Gabrielsvdata](https://github.com/Gabrielsvdata) |
| **Kauã Cantanhede** | [@kant-sdev](https://github.com/kant-sdev) |
| **Patricia Queiroz** | [@PatQuei](https://github.com/PatQuei) |

---

## 📜 Licença

Distribuído sob a licença **MIT**. Veja o arquivo [`LICENSE`](LICENSE) para mais detalhes.

---

<p align="center">
  <sub><i>Disclaimer: As orientações e respostas geradas pelo Agente Financeiro possuem caráter puramente educacional e informativo, não substituindo o aconselhamento de um profissional financeiro certificado.</i></sub>
</p>
