# ADR 002: PostgreSQL como banco de dados

## Status

Aceito

## Contexto

O backend precisa persistir usuários, transações, análises, indicadores, recomendações e histórico do agente.

## Decisão

Usar PostgreSQL como banco de dados relacional principal.

## Consequências

- Suporte robusto a dados estruturados, transações e JSONB para metadados.
- Type `NUMERIC` ideal para valores monetários.
- Flyway gerencia migrations de forma versionada.
- Banco relacional atende ao MVP sem adicionar complexidade.
