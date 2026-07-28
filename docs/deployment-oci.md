# Deploy na OCI

## Visão geral

A produção do FinVise roda em uma única OCI Compute Instance Ubuntu com Docker Compose.

## Infraestrutura na OCI

### 1. VCN (Virtual Cloud Network)

Crie uma VCN com CIDR adequado, por exemplo `10.0.0.0/16`.

### 2. Subnet pública

Crie uma subnet pública na VCN, por exemplo `10.0.0.0/24`.

### 3. Internet Gateway

Anexe um Internet Gateway à VCN para permitir tráfego de entrada/saída.

### 4. Security List / NSG

Regras de entrada:

| Porta | Origem | Descrição |
|-------|--------|-----------|
| 22 | IP administrativo restrito | SSH |
| 80 | 0.0.0.0/0 | HTTP |
| 443 | 0.0.0.0/0 | HTTPS |

Regras de saída: permitir todo o tráfego para atualizações e imagens Docker.

## Compute Instance

Crie uma instância Ubuntu 22.04/24.04 LTS no shape desejado (ex: VM.Standard.A1.Flex ou VM.Standard.E4.Flex).

Acesse via SSH:

```bash
ssh -i ~/.ssh/oci_key ubuntu@<ip-publico>
```

## Instalação do Docker

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker ubuntu
```

Faça logout/login para aplicar o grupo `docker`.

## Domínio e HTTPS

1. Aponte o domínio (A record) para o IP público da instância.
2. Para HTTPS, use Let's Encrypt com Certbot ou configure certificados próprios.
3. Salve os certificados em `infrastructure/nginx/ssl/`:
   - `fullchain.pem`
   - `privkey.pem`
4. Ajuste `infrastructure/nginx/conf.d/default.conf` para usar SSL na porta 443.

Exemplo simplificado de bloco SSL:

```nginx
server {
    listen 443 ssl;
    server_name financeai.exemplo.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    location /api/ {
        proxy_pass http://backend:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://frontend:80/;
    }
}
```

## Deploy da aplicação

1. Clone o repositório na instância:

```bash
git clone <repo> /opt/finance-ai
cd /opt/finance-ai
```

2. Crie o `.env` a partir do `.env.example` e preencha com valores reais.

3. Suba a aplicação:

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
```

4. Verifique health checks:

```bash
bash infrastructure/scripts/health-check.sh
```

## Backup

Backup automático diário via cron:

```bash
0 2 * * * /opt/finance-ai/infrastructure/scripts/backup-postgres.sh >> /var/log/financeai-backup.log 2>&1
```

Os backups são salvos em `backups/` e podem ser replicados para OCI Object Storage opcionalmente.

## Restore

```bash
bash infrastructure/scripts/restore-postgres.sh backups/financeai_backup_YYYYMMDD_HHMMSS.sql.gz
```

## Atualização

```bash
cd /opt/finance-ai
git pull
docker compose -f docker-compose.yml -f docker-compose.production.yml down
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
```

## Rollback

```bash
cd /opt/finance-ai
git checkout <versao-anterior>
docker compose -f docker-compose.yml -f docker-compose.production.yml down
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
```

## Logs

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml logs -f
```

## Monitoramento básico

- Health checks dos containers.
- Logs estruturados em JSON.
- Espaço em disco: `df -h`.
- Uso de memória: `free -h`.
- Para monitoramento avançado, considere adicionar Prometheus/Grafana em uma fase posterior.

## Object Storage (opcional)

Configure `STORAGE_TYPE=oci` e as variáveis `OCI_NAMESPACE`, `OCI_BUCKET_NAME`, etc., para armazenar modelos, datasets, CSVs importados, relatórios e backups.

Se não configurado, o sistema usa armazenamento local (`LocalObjectStorageService`).
