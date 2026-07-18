# Segurança do Finance AI

## Visão geral

A segurança é tratada em camadas: rede, aplicação, dados e operações.

## Rede

- Apenas as portas 80 e 443 são públicas em produção.
- PostgreSQL, Spring Boot e FastAPI ficam na rede interna do Docker.
- SSH restrito a IPs administrativos.
- Nginx atua como reverse proxy, rate limiter e adiciona headers de segurança.

## Autenticação e autorização

- Spring Security com JWT.
- Senhas hasheadas com BCrypt.
- Tokens com expiração configurável.
- CORS configurável via variáveis de ambiente.

## Dados

- Valores monetários usam `BigDecimal` (Java) e `NUMERIC` (PostgreSQL).
- IDs são UUID.
- Datas usam ISO 8601.
- Senhas nunca são armazenadas em texto puro.
- Não exponha entidades JPA diretamente na API.

## Logs

Nunca registre:

- Senhas
- Tokens
- Conteúdo integral de transações
- Informações financeiras sensíveis
- Chaves da OCI

Logs estruturados em JSON em produção com correlation/trace ID.

## Upload de arquivos

- Limite de tamanho configurável (padrão 5MB).
- Apenas arquivos CSV são aceitos.
- Nomes de arquivos são sanitizados.
- Arquivos armazenados localmente ou no OCI Object Storage.

## Variáveis de ambiente

- Segredos via `.env`.
- `.env` está no `.gitignore`.
- `.env.example` contém apenas valores fictícios.

## Containers

- Containers rodam com usuário não-root quando possível.
- Imagens base mínimas (Alpine ou slim).
- Dependências atualizadas.

## Headers de segurança no Nginx

- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Rate limiting

- Geral: 20 req/s por IP.
- Login: 5 req/min por IP.

## Auditoria básica

- `created_at` e `updated_at` em todas as tabelas principais.
- Histórico de análises e conversas do agente.

## Limites e validações

- Bean Validation nos DTOs.
- Sanitização de entrada.
- Tratamento global de exceções sem exposição de stack trace em produção.

## Disclaimer

As respostas do agente financeiro possuem caráter educacional e não substituem aconselhamento financeiro profissional.
