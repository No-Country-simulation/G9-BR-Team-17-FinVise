# Segurança do FinVise

## Visão geral

Os controles implementados cobrem proxy/rede, autenticação JWT, isolamento por proprietário, validação de entrada, armazenamento e tratamento de erros. Esta página também registra limites conhecidos para que a documentação não atribua proteções inexistentes ao sistema.

## Rede

### Docker Compose

- No Compose base, somente o Nginx é publicado no host, em `${NGINX_HTTP_PORT:-8080}:80`; PostgreSQL, backend e AI Service não publicam portas.
- Backend, frontend e AI Service não publicam portas no host.
- O override de produção remove a porta do PostgreSQL e publica somente Nginx em `80:80`.
- Todos os serviços compartilham `finvise_internal`. Apesar do nome, a rede usa `internal: false` para permitir saída à internet, necessária a Pluggy, Resend, API de LLM e pull de dependências/imagens.
- Nginx retorna `403` para `/internal/`; adicionalmente, os endpoints FastAPI internos exigem Bearer token de serviço.

### TLS

A configuração versionada escuta apenas HTTP. O arquivo `docker-compose.production.yml` orienta terminação TLS em um load balancer externo ou a criação de uma configuração Nginx dedicada.

`[TODO: Definir, versionar e testar a estratégia oficial de TLS antes de expor a aplicação diretamente à internet.]`

## Autenticação e autorização

- Spring Security usa sessão `STATELESS` e JWT HMAC.
- CSRF está desabilitado, compatível com a autenticação stateless por header.
- Senhas são armazenadas com BCrypt.
- O JWT contém o UUID no `subject`, e-mail em claim e expiração configurável por `JWT_EXPIRATION_MS`.
- O filtro carrega um `FinanceAiPrincipal`; serviços obtêm o UUID por `AuthenticatedUserProvider`.
- Recursos sem `{userId}` ignoram qualquer identidade fornecida pelo cliente e usam o principal.
- Endpoints com `{userId}` exigem igualdade com o usuário autenticado e retornam acesso negado para outro UUID.
- Repositórios/serviços de análises, conversas, fontes, arquivos e Open Finance filtram por usuário.

Rotas públicas no Spring Security:

- `/api/v1/auth/**`;
- `/actuator/health` e `/actuator/info`;
- Swagger UI e OpenAPI JSON;
- `OPTIONS /**`;
- dispatches internos `ASYNC` e `ERROR`.

Todas as demais rotas do backend exigem autenticação.

### Autenticação Backend → AI Service

- `AI_SERVICE_TOKEN` é obrigatório nos dois serviços e deve ter pelo menos 32 caracteres.
- O backend envia o token como `Authorization: Bearer` em toda rota `/internal/v1/*`.
- O AI Service compara o segredo em tempo constante e responde `401` sem revelar se o token estava ausente ou incorreto.
- Agente e RAG recebem a identidade em `X-FinVise-User-Id`, validada como UUID somente depois da autenticação do serviço.
- Os payloads dessas rotas proíbem `user_id`, impedindo que o chamador substitua a identidade delegada.
- `/health` é público e não expõe dados financeiros nem configuração do token.

### Segredo JWT

O JJWT cria uma chave HMAC a partir dos bytes de `JWT_SECRET`; use pelo menos 32 bytes aleatórios. No perfil `production`, `ProductionSecretsValidator` rejeita segredo vazio e valores contendo placeholders conhecidos.

Não há rotação de chave, `kid`, refresh token, blacklist ou revogação de sessões implementados.

## Redefinição de senha

- A solicitação retorna a mesma mensagem para e-mails existentes e inexistentes, reduzindo enumeração de contas.
- Um novo pedido invalida códigos ativos anteriores.
- O código possui seis dígitos, é gerado com `SecureRandom` e armazenado como SHA-256.
- Código e reset token expiram em cinco minutos.
- Após cinco tentativas inválidas, o registro é bloqueado por 30 minutos.
- O reset token é um JWT com claim `scope=password_reset` e é enviado no header Bearer do endpoint de alteração.
- Após o uso, o código é marcado com `used_at`.
- O envio pela Resend é assíncrono; falhas são registradas sem derrubar a resposta do endpoint.

Limite conhecido: redefinir a senha não invalida JWTs de login já emitidos. O próprio código mantém um `TODO` para blacklist ou versionamento de token.

## CORS

O backend lê `CORS_ALLOWED_ORIGINS` e permite os métodos `GET,POST,PUT,PATCH,DELETE,OPTIONS`, qualquer header, credenciais e exposição de `Authorization`.

Em produção, substitua as origens locais/IPs de exemplo pelo domínio efetivo. Como credenciais estão habilitadas, não use origem curinga no backend.

O FastAPI configura CORS com `allow_origins=["*"]` e `allow_credentials=True`, mas não é exposto pelo Compose/Nginx ao navegador. Rede interna, bloqueio no Nginx e token de serviço formam camadas independentes; CORS não substitui nenhuma delas.

## Dados e isolamento RAG

- Valores monetários usam `BigDecimal`/`NUMERIC`.
- IDs de domínio são UUIDs.
- O backend controla o schema com Flyway; o AI Service não executa DDL.
- Consultas vetoriais/full-text sempre incluem `user_id` e podem restringir `source_type`/`source_id`.
- `rag_document_embeddings` não armazena `user_id`; a autorização é aplicada pelo `JOIN` obrigatório com `rag_documents`, e a FK remove vetores junto com o chunk.
- Itens Pluggy são validados por `clientUserId` antes da sincronização.
- Conexões Pluggy já associadas a outro usuário são rejeitadas.
- Duplicatas CSV são bloqueadas por SHA-256 por usuário.
- Duplicatas Open Finance são bloqueadas por `(user_id, source, external_id)`.

Quando LLM ou embeddings remotos estão habilitados, prompts/chunks financeiros recuperados podem sair da infraestrutura para `LLM_BASE_URL`. Essa transferência deve ser avaliada conforme LGPD, base legal, retenção e contrato do provedor.

## Upload e armazenamento

- Limite da aplicação: 5 MiB por arquivo; limite multipart do Spring/Nginx: 6 MiB com overhead.
- Arquivo vazio é rejeitado.
- A extensão `.csv` ou `Content-Type` CSV é exigida.
- O parser usa UTF-8 e cabeçalhos sem diferenciação de maiúsculas/minúsculas.
- O nome armazenado recebe UUID e sanitização de caracteres; no armazenamento local, a resolução também impede path traversal.
- `uploads_data` persiste `/app/uploads` entre recriações de container.

Com `STORAGE_TYPE=oci`, namespace, bucket e região são obrigatórios. `OciObjectStorageService` carrega o profile `DEFAULT` de `~/.oci/config`; o Compose atual não monta esse arquivo.

`[TODO: Definir uma estratégia de credenciais OCI para o container backend antes de habilitar STORAGE_TYPE=oci no deploy Compose.]`

## Segredos e ambiente de produção

O Compose exige valores não vazios para:

- `POSTGRES_PASSWORD`;
- `SPRING_DATASOURCE_PASSWORD`;
- `JWT_SECRET`.
- `AI_SERVICE_TOKEN`.

As duas senhas do banco devem ser iguais na topologia padrão. No perfil `production`, a senha da datasource deve ter pelo menos 16 caracteres e não pode ser `finvise`, `postgres` ou conter `change_me`/`change-me`.

Segredos opcionais conforme a funcionalidade:

- `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` — Open Finance;
- `LLM_API_KEY` — LLM e/ou embeddings remotos;
- `RESEND_API_KEY` — entrega de e-mail de reset;
- credenciais do profile OCI — Object Storage.

Arquivos `.env`, chaves e certificados estão ignorados pelo Git. Os `.env.example` não devem receber valores reais.

## Headers de segurança no Nginx

Implementados globalmente:

```text
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

`server_tokens off` também está ativo.

Não há `Content-Security-Policy`, `Strict-Transport-Security` ou `Permissions-Policy` configurados. HSTS só deve ser ativado depois de TLS funcionar em todos os acessos de produção.

## Rate limiting

O Nginx define:

- zona `api`: 20 requisições/s por IP;
- zona `login`: 5 requisições/min por IP.

Porém, a configuração de locations aplica somente `zone=api burst=40 nodelay` a `/api/` e ao stream do agente. A zona `login` não é referenciada por nenhuma location; portanto, **não existe limite específico de 5 logins/min efetivamente aplicado**.

`[TODO: Adicionar uma location exata para /api/v1/auth/login usando a zona login e validar o comportamento de burst.]`

## Validação e erros

- Bean Validation protege DTOs de entrada.
- Enums de origem/modelo/tipo são desserializados pelos tipos Java.
- O período de análise rejeita data inicial posterior à final.
- O `GlobalExceptionHandler` não inclui stack trace e oculta a mensagem interna no perfil `production`.
- Respostas de validação usam um mapa campo→mensagem e um `traceId` aleatório.
- Erros inesperados são registrados no servidor.

O `traceId` da resposta não é propagado automaticamente entre Nginx, backend, AI Service e banco; ele é gerado no handler. Nginx envia `X-Trace-Id` ao backend, mas o código não estabelece um MDC/correlation ID ponta a ponta.

## Logs

O backend usa o padrão textual configurado pelo Spring. O perfil de produção define:

```text
data [thread] nível logger - mensagem
```

Não há encoder JSON estruturado no código atual. O Nginx usa access log textual com tempo de requisição e `X-Trace-Id` recebido.

Não registre deliberadamente:

- senhas, códigos de reset ou tokens;
- chaves Pluggy, Resend, LLM ou OCI;
- conteúdo integral de transações/chunks;
- respostas financeiras sensíveis.

O sender de reset confirma sucesso sem registrar o código. Ainda assim, a política de redaction não é aplicada por uma biblioteca central.

## Containers e dependências

- O runtime do backend executa como `appuser` não-root.
- O AI Service não declara `USER` e executa como o usuário padrão da imagem Python.
- Frontend e proxy usam imagens Nginx Alpine; o processo master segue o comportamento padrão da imagem.
- Imagens possuem versões principais fixadas (`nginx:1.27-alpine`, `python:3.11-slim`, Temurin 21 Alpine e `pgvector:pg16`).
- Dependências de aplicação têm versões registradas nos manifests/lockfiles; a documentação não presume que sejam as versões mais recentes disponíveis.

## Backup, auditoria e retenção

- Tabelas principais possuem timestamps conforme definido nas migrações; nem todas têm simultaneamente `created_at` e `updated_at`.
- Histórico de análises e conversas é persistido.
- O backup usa `pg_dump --clean --if-exists` e gzip.
- Não há criptografia de volume, política automática de retenção, replicação de backup para OCI ou auditoria imutável implementada nos scripts.
- `docker compose down -v`/`make clean` remove os volumes locais.

## Checklist mínimo de produção

- Configurar terminação TLS e restringir a entrada de rede.
- Usar segredos aleatórios e um mecanismo seguro de distribuição/rotação.
- Configurar CORS para o domínio real.
- Montar credenciais OCI apenas se Object Storage for habilitado.
- Configurar e verificar Resend/Pluggy/LLM conforme as funções habilitadas.
- Aplicar rate limit específico ao login.
- Definir retenção, criptografia e cópia externa de backups.
- Avaliar transferência de dados ao provedor de LLM/embeddings.
- Implementar revogação de sessões após reset de senha.

## Disclaimer

As respostas do agente financeiro têm caráter educacional e não substituem aconselhamento financeiro profissional.
