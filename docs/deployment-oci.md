# Deploy na OCI

> Antes do deploy, revise o [catálogo de configuração](configuration.md), o [checklist de segurança](security.md), a [estratégia de CI/CD](ci-cd.md) e o [índice da documentação](README.md). A CI valida o código e a promoção, mas não executa este deploy.

## Visão geral

O deploy versionado executa Nginx, frontend, backend, AI Service e PostgreSQL em uma única OCI Compute Instance com Docker Compose.

O override `docker-compose.production.yml`:

- ativa `SPRING_PROFILES_ACTIVE=production`;
- publica Nginx em `80:80`;
- remove a publicação do PostgreSQL;
- mantém backend, AI Service e frontend somente na rede Docker;
- aplica limites de memória declarativos aos serviços;
- usa restart policy `always`.

A configuração atual **não escuta 443 nem monta certificados**. HTTPS exige terminação TLS externa ou uma configuração Nginx adicional ainda não versionada.

## Infraestrutura na OCI

### 1. VCN e subnet

Crie uma VCN e uma subnet adequada à topologia. Para uma instância diretamente pública, a subnet precisa de Internet Gateway e rota de saída. Em uma topologia com load balancer público, a instância pode receber tráfego somente do load balancer.

### 2. Security List / NSG

Portas exigidas pelo Compose atual na instância:

| Porta | Origem recomendada | Uso |
| --- | --- | --- |
| `22/tcp` | IPs administrativos | SSH |
| `80/tcp` | Load balancer ou público durante validação controlada | Nginx HTTP |

Não abra `5432`, `8080` ou `8000` em produção. O override não publica esses serviços.

Se um OCI Load Balancer terminar TLS, exponha `443` no load balancer, use certificado válido nele e encaminhe para a porta 80 da instância. Restrinja a regra de entrada da instância aos endereços/subnet do load balancer.

### 3. Saída

Os containers podem precisar de saída HTTPS para:

- registro de imagens e atualizações;
- Pluggy;
- Resend;
- `LLM_BASE_URL` para chat/embeddings;
- APIs OCI, quando Object Storage estiver habilitado.

A rede Docker está configurada com `internal: false` para permitir essa saída.

## Compute Instance

Use uma imagem Ubuntu LTS compatível com Docker. Dimensione CPU, memória e disco considerando:

- limites declarados: PostgreSQL 1 GiB, backend 1 GiB, AI Service 1 GiB, frontend 256 MiB e Nginx 256 MiB;
- espaço para imagens, `postgres_data`, `uploads_data`, logs e backups;
- treinamento de modelos não faz parte do deploy de runtime e pode exigir mais recursos.

Acesso:

```bash
ssh -i ~/.ssh/oci_key ubuntu@<ip-publico>
```

## Instalação do Docker

Exemplo baseado no repositório oficial do Docker para Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

Faça logout/login e valide:

```bash
docker version
docker compose version
```

## Configuração

### 1. Código

```bash
sudo mkdir -p /opt/finance-ai
sudo chown ubuntu:ubuntu /opt/finance-ai
git clone <repo> /opt/finance-ai
cd /opt/finance-ai
```

### 2. Ambiente

```bash
cp .env.example .env
chmod 600 .env
```

Obrigatórias para o Compose:

```dotenv
POSTGRES_PASSWORD=<senha-forte>
SPRING_DATASOURCE_PASSWORD=<a-mesma-senha-forte>
JWT_SECRET=<segredo-hmac-aleatorio-com-32-ou-mais-bytes>
AI_SERVICE_TOKEN=<segredo-aleatorio-com-32-ou-mais-caracteres>
```

No perfil de produção, a senha da datasource precisa ter pelo menos 16 caracteres e não pode ser um placeholder conhecido. Mantenha `POSTGRES_PASSWORD` e `SPRING_DATASOURCE_PASSWORD` iguais na topologia padrão.

Ajuste também:

```dotenv
SPRING_PROFILES_ACTIVE=production
CORS_ALLOWED_ORIGINS=https://<dominio>
NGINX_HTTP_PORT=8080
```

`NGINX_HTTP_PORT` é ignorado pelo binding final do override de produção, que usa `80:80`; pode permanecer no arquivo para o Compose base.

Funcionalidades opcionais:

```dotenv
# Open Finance
PLUGGY_CLIENT_ID=
PLUGGY_CLIENT_SECRET=
OPEN_FINANCE_WEBHOOK_URL=
OPEN_FINANCE_OAUTH_REDIRECT_URL=
OPEN_FINANCE_INCLUDE_SANDBOX=false

# Agente e embeddings
ENABLE_LLM=false
LLM_API_KEY=
LLM_MODEL=gpt-4o-mini
RAG_ENABLE_REMOTE_EMBEDDINGS=true
RAG_EMBEDDING_MODEL=text-embedding-3-small
RAG_HYBRID_RRF_K=60
RAG_VECTOR_WEIGHT=1.0
RAG_TEXT_WEIGHT=1.0
RAG_CANDIDATE_MULTIPLIER=4

# E-mail de redefinição
RESEND_API_KEY=
RESEND_FROM_ADDRESS=Finance AI <no-reply@example.com>
```

`OPEN_FINANCE_WEBHOOK_URL` é encaminhada à Pluggy, mas o backend atual não possui rota receptora de webhook. Configure-a somente se houver um receptor externo válido.

### 3. Modelos

O build do AI Service provisiona modelos bootstrap a partir dos CSVs versionados, valida seu carregamento e os incorpora à imagem:

```text
ai-service/models/
├── transaction-classifier/
│   ├── model.joblib
│   ├── metadata.json
│   └── labels.json
├── profile-classifier/
│   ├── model.joblib
│   ├── metadata.json
│   ├── feature_names.json
│   └── preprocessor.joblib  # somente quando o modelo selecionado usa scaler
└── provisioning-manifest.json
```

O Compose exige `1.1.0-bootstrap.1` para transações e `1.0.0-bootstrap.1` para perfil. O override de produção define também `ENVIRONMENT=production`; sem os dois artefatos ativos e compatíveis, o AI Service falha no startup e bloqueia a subida dependente do backend/frontend.

Os modelos bootstrap são adequados para disponibilizar o fluxo e verificar a infraestrutura. Antes de decisões financeiras em produção, promova artefatos treinados e avaliados com o dataset canônico completo, alterando as versões esperadas junto com a imagem.

## Deploy

Valide a combinação dos arquivos e suba os serviços:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  config --quiet

docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  up -d --build
```

Inspecione o estado:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  ps
```

## Health checks

Pelo host:

```bash
curl -fsS http://localhost/health
curl -fsS http://localhost/actuator/health
```

O AI Service não é publicado. Verifique-o dentro do container:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  exec ai-service wget -q -O - http://localhost:8000/health
```

`infrastructure/scripts/health-check.sh` usa por padrão `http://localhost:8080` para Nginx/backend e `http://localhost:8000` para o AI Service. Esses padrões correspondem ao desenvolvimento/execução isolada, não ao override de produção. Além disso, o script trata cada falha com `|| true`, portanto serve como diagnóstico de melhor esforço e não como gate de deploy.

## Domínio e HTTPS

### Opção comprovada pelo arquivo de produção: TLS externo

O comentário em `docker-compose.production.yml` prevê terminação no load balancer da nuvem:

1. configure o DNS para o load balancer;
2. instale/associe o certificado no listener HTTPS;
3. encaminhe o backend set para `HTTP:80` na instância;
4. configure health check do load balancer em `/health`;
5. restrinja a porta 80 da instância ao load balancer;
6. defina `CORS_ALLOWED_ORIGINS=https://<dominio>`.

### TLS no Nginx da instância

Não há bloco `listen 443 ssl`, volume de certificados nem publicação `443:443` nos arquivos atuais.

`[TODO: Criar e testar um override dedicado com configuração TLS, montagem read-only de certificados, redirect 80→443 e renovação antes de usar esta opção.]`

Somente copiar certificados para `infrastructure/nginx/ssl/` não os torna visíveis ao container.

## Logs

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  logs -f
```

Por serviço:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  logs -f backend ai-service
```

Os logs atuais são texto; o repositório não configura encoder JSON nem rotação de logs Docker.

`[TODO: Definir driver, tamanho e retenção de logs para a instância de produção.]`

## Backup

O script usa `pg_dump --clean --if-exists`, gzip e o container `finvise-postgres`:

```bash
bash infrastructure/scripts/backup-postgres.sh
```

Saída:

```text
backups/finvise_backup_YYYYMMDD_HHMMSS.sql.gz
```

Cron diário às 02:00:

```cron
0 2 * * * cd /opt/finance-ai && /usr/bin/bash infrastructure/scripts/backup-postgres.sh >> /var/log/finvise-backup.log 2>&1
```

O script salva somente no disco local. Não há upload automático para OCI Object Storage nem política de retenção.

`[TODO: Implementar cópia externa, criptografia e retenção/expurgo dos backups.]`

## Restore

O restore é destrutivo para objetos presentes no dump porque o backup contém `--clean --if-exists`. Valide o arquivo e faça uma cópia atual antes da operação.

```bash
bash infrastructure/scripts/restore-postgres.sh \
  backups/finvise_backup_YYYYMMDD_HHMMSS.sql.gz
```

O script executa `gunzip -c | psql` no container atual. Ele não interrompe automaticamente backend/AI Service; planeje uma janela de manutenção para evitar gravações concorrentes.

## Atualização

```bash
cd /opt/finance-ai
git pull --ff-only

docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  up -d --build
```

`up -d --build` recria apenas o necessário e preserva volumes. As migrações Flyway rodam quando o backend inicia.

Antes de atualizar:

- gere e valide um backup;
- leia novas migrações;
- confirme compatibilidade de artefatos de modelo;
- valide `.env.example` contra o `.env` da instância.

## Rollback

Um rollback de código não reverte migrações automaticamente.

```bash
cd /opt/finance-ai
git switch --detach <tag-ou-commit-validado>

docker compose \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  up -d --build
```

Se a versão anterior não compreender o schema atual, restaure um backup compatível durante manutenção. Não use `down -v` como rollback.

## Object Storage opcional

O `ObjectStorageService` é usado atualmente para os arquivos CSV importados. Modelos, datasets, relatórios e backups não são enviados a OCI por essa integração.

Modo local padrão:

```dotenv
STORAGE_TYPE=local
STORAGE_LOCAL_BASE_PATH=/app/uploads
```

O volume `uploads_data` persiste os arquivos.

Modo OCI:

```dotenv
STORAGE_TYPE=oci
OCI_NAMESPACE=<namespace>
OCI_BUCKET_NAME=<bucket>
OCI_REGION=<regiao>
```

O cliente usa `ConfigFileAuthenticationDetailsProvider("DEFAULT")` e procura credenciais em `~/.oci/config`. O Compose atual não monta esse arquivo no container backend.

`[TODO: Adicionar uma estratégia segura de autenticação OCI — por exemplo, configuração/volume read-only validado ou adaptação para instance principals — antes de habilitar STORAGE_TYPE=oci.]`

## Persistência e operações destrutivas

- `docker compose down` preserva os volumes.
- `docker compose down -v` e `make clean` removem `postgres_data` e `uploads_data`.
- A remoção de uma fonte pela API exclui transações e chunks associados; uma fonte CSV também exclui o objeto armazenado.
- Mantenha backup do banco e, no modo local, dos uploads antes de qualquer limpeza.

## Monitoramento mínimo

- status/health checks dos containers;
- espaço de disco (`df -h`);
- memória (`free -h` e `docker stats`);
- logs de falha de indexação RAG, Resend, Pluggy e AI Service;
- `GET /api/v1/rag/status` por usuário/fonte durante diagnóstico autenticado;
- `GET /api/v1/rag/queue` para tentativas, heartbeat, erro e dead-letter do usuário;
- métricas autenticadas `finvise.rag.queue.*` em `/actuator/metrics`;
- validade do certificado no terminador TLS;
- idade e restauração periódica dos backups.

O Actuator publica as métricas internas da fila, mas exportação Prometheus, Grafana, alertas, tracing distribuído e coleta centralizada de logs não estão implementados no repositório.
