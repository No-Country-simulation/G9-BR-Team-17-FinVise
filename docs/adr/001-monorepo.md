# ADR 001: Monorepo

## Status

Aceito

## Contexto

O Finance AI envolve frontend, backend, AI service, infraestrutura e documentação. Precisávamos decidir se usaríamos repositórios separados ou um monorepo.

## Decisão

Adotar um monorepo com todos os componentes do MVP.

## Consequências

- Facilita a integração entre frontend, backend e AI service.
- Versões dos modelos e da aplicação ficam alinhadas.
- Simplifica o onboarding e a execução local com Docker Compose.
- Pode crescer; se necessário, componentes podem ser extraídos no futuro.
