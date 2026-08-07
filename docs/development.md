# Desenvolvimento e operação local

Este guia cobre preparação do ambiente, execução, testes, CI, diagnóstico, backup e restore. Para variáveis, consulte [Configuração](configuration.md); para produção, consulte [Deploy na OCI](deployment-oci.md).

## Pré-requisitos

### Caminho Docker

- Docker Engine/Desktop com Docker Compose v2;
- Git;
- GNU Make opcional.

### Execução isolada

- Java 21;
- Node.js 22.12+ e npm 10+;
- Python 3.11+;
- PostgreSQL 16, preferencialmente com pgvector;
- ferramentas de compilação exigidas pelas dependências Python na plataforma.

## Primeiro startup com Docker

```bash
git clone https://github.com/No-Country-simulation/G9-BR-Team-17-FinVise.git
cd G9-BR-Team-17-FinVise
cp .env.example .env
```

Preencha ao menos:

```dotenv
POSTGRES_PASSWORD=<senha>
SPRING_DATASOURCE_PASSWORD=<mesma-senha>
JWT_SECRET=<32-ou-mais-bytes>
AI_SERVICE_TOKEN=<32-ou-mais-caracteres>
```

Depois:

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

URLs:

- aplicação: `http://localhost:8080`;
- Nginx health: `http://localhost:8080/health`;
- backend health: `http://localhost:8080/actuator/health`;
- Swagger: `http://localhost:8080/api/v1/swagger-ui.html`.

No estado versionado, somente o Nginx publica porta no host. Use `docker compose exec` para acessar serviços internos.

## Ciclo Docker

```bash
docker compose up -d
docker compose up -d --build
docker compose up -d --build --force-recreate
docker compose logs -f
docker compose logs -f backend ai-service
docker compose ps
docker compose down
```

Use `--force-recreate` depois de alterar `.env` quando quiser garantir que todos os containers recebam o novo ambiente.

O comando abaixo é destrutivo e remove o banco e uploads locais:

```bash
docker compose down -v --remove-orphans
```

## Makefile

| Comando | Uso |
| --- | --- |
| `make setup` | cria `.env` quando ausente e tenta gerar amostras |
| `make build` | build sem cache |
| `make up` / `make down` | inicia/encerra o ambiente |
| `make logs` | acompanha logs |
| `make test` | testa os três componentes |
| `make provision-models` | gera e ativa modelos bootstrap |
| `make health` | checks HTTP de melhor esforço |
| `make backup` | cria dump gzip em `backups/` |
| `make clean` | remove containers e volumes |

`make restore` não recebe o caminho exigido pelo script atual. Para restaurar, invoque o script diretamente conforme a seção de backup.

## Execução isolada

### Banco

Você pode iniciar apenas PostgreSQL com Compose. Se o estado versionado não publicar a porta, use um override local não commitado ou execute o backend no próprio Compose. Não altere o Compose oficial somente para uma necessidade pessoal sem separar esse escopo.

### Backend

```bash
cd backend
./mvnw spring-boot:run
```

PowerShell:

```powershell
cd backend
./mvnw.cmd spring-boot:run
```

O processo precisa receber banco, JWT e credenciais do AI Service. Consulte [`../backend/README.md`](../backend/README.md).

### AI Service

```bash
cd ai-service
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.lock
python -m pip install --no-deps -e .
cp .env.example .env
python -m training.provision_models
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

No PowerShell, ative com `.venv\Scripts\Activate.ps1`. Para desenvolvimento isolado com fallbacks, `REQUIRE_ACTIVE_MODELS=false` é aceito fora de produção; o Compose oficial exige os dois modelos.

### Frontend

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Abra `http://localhost:5173`. O proxy encaminha `/api` para `VITE_API_PROXY_TARGET`.

## Testes e qualidade

### Backend

```bash
cd backend
./mvnw test -Dspring.profiles.active=test
```

### AI Service

```bash
cd ai-service
ruff check .
pytest
```

### Frontend

```bash
cd frontend
npm run lint
npm run test:coverage -- --run
npm run build
```

### Validação de documentação e configuração

```bash
git diff --check
docker compose config --quiet
docker compose -f docker-compose.yml -f docker-compose.production.yml config --quiet
```

Confirme também que links relativos apontam para arquivos existentes e que exemplos não contêm segredos.

## CI e pull requests

O workflow `.github/workflows/ci.yml` é executado em pushes e PRs para `dev`, `homolog` e `main`. Ele possui três jobs independentes:

- backend: Java 21 e `mvn test`;
- frontend: Node 22, instalação limpa, lint, coverage e build;
- AI Service: Python 3.11, lockfile, Ruff e Pytest.

O workflow de política de branches valida a promoção. O fluxo esperado é:

```text
feature/*, fix/*, docs/* -> dev -> homolog -> main
```

Detalhes: [Estratégia de branches](BRANCHING.md).

## Modelos

```bash
make provision-models
make train-transaction-model
make train-profile-model
make evaluate-models
```

O provisionamento bootstrap usa amostras versionadas, treina em área temporária, valida o carregamento dos dois classificadores, grava hashes e ativa o conjunto atomicamente. O build Docker já executa esse fluxo.

Diagnóstico:

```bash
docker compose logs ai-service
curl -H "Authorization: Bearer <AI_SERVICE_TOKEN>" \
  http://localhost:8000/internal/v1/models/status
```

A rota interna só é acessível diretamente quando o AI Service é executado/publicado fora do Compose oficial. Pelo produto, use `GET /api/v1/model-status` com JWT.

## Backup e restore

Backup com o ambiente ativo:

```bash
bash infrastructure/scripts/backup-postgres.sh
```

O arquivo é criado em `backups/finvise_backup_<timestamp>.sql.gz` e contém opções `--clean --if-exists`.

Restore:

```bash
bash infrastructure/scripts/restore-postgres.sh backups/finvise_backup_<timestamp>.sql.gz
```

O restore altera o banco atual. Faça backup antes, confirme o arquivo e evite executar enquanto usuários escrevem dados.

## Diagnóstico por sintoma

### Compose recusa iniciar

- confira se os quatro segredos mínimos estão preenchidos;
- confirme que as senhas do PostgreSQL e Spring são iguais;
- rode `docker compose config --quiet`;
- se o volume já foi criado com outra senha, mudar somente `.env` não altera a senha interna automaticamente.

### Backend unhealthy

- verifique `docker compose logs backend postgres`;
- procure erro Flyway, credencial de banco ou validação de segredo;
- confirme `/actuator/health` dentro do container/rede.

### AI Service reinicia ou fica unhealthy

- procure versão esperada divergente, metadata inativa ou artefato ausente;
- confirme `TRANSACTION_MODEL_VERSION` e `PROFILE_MODEL_VERSION`;
- reconstrua a imagem para executar o provisionamento novamente;
- valide se `AI_SERVICE_TOKEN` possui 32+ caracteres.

### Recuperação retorna 200, mas o e-mail não chega

- isso é esperado sem uma chave Resend válida;
- confirme o log do backend, remetente e domínio verificado;
- `onboarding@resend.dev` possui restrições da conta de teste;
- o endpoint não revela se o e-mail está cadastrado.

### Resend retorna `403 Domain not verified`

Configure `RESEND_FROM_ADDRESS` com um domínio verificado na conta Resend ou use um remetente de teste permitido pela conta. Depois recrie o backend para atualizar o ambiente.

### Open Finance não conecta

- confira `GET /api/v1/open-finance/status`;
- valide ID, secret, redirect URL e opção sandbox;
- lembre que não há webhook receptor; a sincronização depende do endpoint explícito após o widget retornar `itemId`.

### RAG não conclui

- consulte `/api/v1/rag/status` e `/api/v1/rag/queue`;
- acompanhe logs do worker backend e do AI Service;
- `DEAD_LETTER` exige `/api/v1/rag/reprocess`;
- embeddings remotos precisam retornar exatamente 1536 dimensões;
- sem chave remota, verifique o uso de `local-hash-v2`.

### Frontend usa uma URL antiga

`VITE_API_BASE_URL` é build-time. Reconstrua a imagem/bundle; reiniciar somente o container não recompila os assets.

### SSE demora ou é interrompido

- alinhe `SSE_TIMEOUT_MS`, timeouts do cliente e `proxy_read_timeout` do Nginx;
- o Nginx versionado usa 120 segundos no endpoint do stream;
- confira eventos `error` e logs de cancelamento/conversa ocupada.

## Antes de entregar uma mudança

1. execute os testes da camada alterada;
2. valide Compose e `git diff --check`;
3. revise endpoints, variáveis e documentação afetados;
4. confirme que `.env`, artefatos locais, uploads e caches não estão staged;
5. use branch e Conventional Commit conforme `BRANCHING.md`;
6. abra PR para `dev` com resumo, impacto e validações.
