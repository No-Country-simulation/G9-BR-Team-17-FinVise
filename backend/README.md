# FinVise — Backend

API pública do FinVise, implementada em Java 21 e Spring Boot 3.2.5. O backend é responsável por autenticação, regras de negócio, persistência, integrações externas e orquestração segura do AI Service.

## Responsabilidades

- cadastro, login JWT, troca e recuperação de senha;
- autorização e isolamento de recursos por usuário;
- importação e categorização de transações CSV;
- integração Open Finance com Pluggy;
- análises financeiras, indicadores, recomendações e simulações;
- gestão de fontes, transações, relatórios e exportação CSV;
- conversas do agente, contexto financeiro e streaming SSE;
- criação de fatos/chunks e fila durável de indexação RAG;
- schema PostgreSQL e migrações Flyway;
- armazenamento local ou OCI dos CSVs importados.

O backend não executa inferência Scikit-learn nem chama diretamente o navegador com credenciais de terceiros. Essas operações são delegadas ao AI Service ou mantidas no servidor.

## Tecnologias

- Java 21 e Spring Boot 3.2.5;
- Spring Web, Security, Validation, Data JPA e Actuator;
- PostgreSQL, Flyway e pgvector;
- JJWT para tokens HMAC;
- Resend para e-mail de recuperação;
- OCI Java SDK para Object Storage;
- SpringDoc/OpenAPI;
- JUnit, Spring Security Test, WireMock, Testcontainers e Embedded PostgreSQL.

As versões completas ficam em `pom.xml`.

## Estrutura

```text
src/main/java/com/financeai/backend/
├── auth/             # JWT, cadastro, login e recuperação
├── user/             # dashboard, histórico, senha e simulação
├── transaction/      # consulta, resumos e classificação
├── importation/      # CSV e gestão de fontes
├── openfinance/      # Pluggy e sincronização
├── analysis/         # análises e seleção de modelo
├── recommendation/   # motor determinístico
├── report/           # relatório e exportação CSV
├── agent/            # conversas, contexto, idempotência e SSE
├── fact/             # snapshots financeiros
├── rag/              # chunks, status e fila de indexação
├── integration/      # clientes do AI Service e Object Storage
├── config/           # propriedades e segurança
└── common/           # envelopes, validações e erros

src/main/resources/
├── application.yml
├── application-local.yml
├── application-production.yml
└── db/migration/     # histórico imutável das migrações Flyway
```

## Pré-requisitos

- JDK 21;
- PostgreSQL acessível;
- AI Service acessível e usando o mesmo `AI_SERVICE_TOKEN`;
- Docker, opcionalmente, para iniciar dependências ou toda a aplicação.

O Maven Wrapper está versionado; não é necessário instalar Maven globalmente.

## Execução isolada

1. Inicie PostgreSQL e o AI Service.
2. Copie o exemplo e preencha os segredos:

```bash
cd backend
cp .env.example .env
```

3. Exporte/carregue as variáveis do arquivo no processo e execute:

```bash
./mvnw spring-boot:run
```

No PowerShell:

```powershell
cd backend
Copy-Item .env.example .env
./mvnw.cmd spring-boot:run
```

O Spring Boot não carrega `.env` automaticamente. Use a IDE, o shell ou uma ferramenta de ambiente para disponibilizar as variáveis. Os principais valores são:

```text
DATABASE_URL=jdbc:postgresql://localhost:5432/finvise
DATABASE_USERNAME=finvise
DATABASE_PASSWORD=<senha>
JWT_SECRET=<32 ou mais bytes aleatórios>
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_TOKEN=<32 ou mais caracteres aleatórios>
```

Consulte o catálogo completo em [`../docs/configuration.md`](../docs/configuration.md).

## Perfis Spring

| Perfil | Uso |
| --- | --- |
| `local` | desenvolvimento; logs mais detalhados e fallback local para o segredo JWT |
| `test` | testes automatizados e banco de teste |
| `production` | mensagens de erro restritas e validação rígida de segredos |

Em produção, `JWT_SECRET` não pode ser placeholder, `SPRING_DATASOURCE_PASSWORD` deve ter ao menos 16 caracteres e `AI_SERVICE_TOKEN` deve ter ao menos 32 caracteres.

## Banco e migrações

Flyway executa as migrações automaticamente no startup. O Hibernate usa `ddl-auto=validate`: ele valida o schema, mas não o cria nem o altera.

Regras importantes:

- não edite uma migração já integrada; crie a próxima `V<N>__descricao.sql`;
- use UTC para timestamps;
- recursos financeiros devem permanecer associados ao `user_id`;
- o AI Service não executa DDL e acessa SQL diretamente apenas no pipeline RAG;
- as migrações de pgvector são tolerantes a ambientes sem a extensão, mantendo o fallback textual.

## API

Base padrão: `http://localhost:8080/api/v1`.

| Grupo | Prefixo |
| --- | --- |
| Autenticação e recuperação | `/auth` |
| Usuários e configurações de conta | `/users` |
| Transações | `/transactions` |
| Importações e fontes | `/imports` |
| Análises | `/financial-analyses` |
| Open Finance | `/open-finance` |
| Relatórios e exportação | `/reports` |
| Agente | `/agent` |
| Operação RAG | `/rag` |
| Estado dos modelos | `/model-status` |

Documentação completa: [`../docs/api.md`](../docs/api.md).

Com o backend em execução:

- Swagger UI: `http://localhost:8080/api/v1/swagger-ui.html`;
- OpenAPI JSON: `http://localhost:8080/api/v1/api-docs`;
- health: `http://localhost:8080/actuator/health`.

## Segurança

- todas as rotas, exceto autenticação, health/info e OpenAPI, exigem JWT;
- o UUID efetivo vem do principal autenticado;
- caminhos legados com `{userId}` exigem que o ID seja o mesmo do JWT;
- chamadas internas usam `Authorization: Bearer <AI_SERVICE_TOKEN>`;
- agente e RAG propagam o usuário confiável em `X-FinVise-User-Id`;
- senhas são armazenadas com BCrypt;
- códigos de reset ficam armazenados como SHA-256 e expiram em cinco minutos.

Detalhes e limites conhecidos: [`../docs/security.md`](../docs/security.md).

## Integrações

### AI Service

O cliente interno classifica transações, analisa perfis, consulta o registry, indexa RAG e obtém respostas do agente. Timeouts são configuráveis. O token deve ser idêntico nos dois processos.

### Resend

`RESEND_API_KEY` e `RESEND_FROM_ADDRESS` controlam o envio do código de recuperação. O envio é assíncrono: a API mantém resposta genérica e registra eventual falha. O domínio/remetente precisa estar autorizado na conta Resend.

### Pluggy

O backend cria o Connect Token e sincroniza um `itemId` explicitamente. Não existe receptor de webhook implementado; `OPEN_FINANCE_WEBHOOK_URL` é somente encaminhada ao provedor.

### Armazenamento

`STORAGE_TYPE=local` grava em disco/volume. `STORAGE_TYPE=oci` usa OCI Object Storage e exige namespace, bucket, região e um profile OCI `DEFAULT` acessível ao processo.

## Testes

```bash
cd backend
./mvnw test -Dspring.profiles.active=test
```

No Windows:

```powershell
./mvnw.cmd test -Dspring.profiles.active=test
```

A suíte cobre controllers, segurança, serviços, persistência, integrações simuladas e fluxos de negócio. Alguns testes escolhem PostgreSQL embarcado ou Testcontainers conforme o ambiente.

## Build e Docker

```bash
./mvnw clean package
docker build -t finvise-backend .
```

O Dockerfile usa build em múltiplos estágios e executa o runtime como usuário não-root. No Compose, o backend só inicia depois de PostgreSQL e AI Service saudáveis.

## Logs e diagnóstico

- aumente o log local por `application-local.yml` somente durante diagnóstico;
- não registre JWTs, senhas, códigos, chaves ou conteúdo financeiro completo;
- valide `/actuator/health` e `/api/v1/model-status` quando o startup ou a inferência falhar;
- use os logs do worker RAG para jobs com retry ou `DEAD_LETTER`.

Para o fluxo completo de desenvolvimento e troubleshooting, consulte [`../docs/development.md`](../docs/development.md).
