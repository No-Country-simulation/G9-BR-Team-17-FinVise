# ADR 002: PostgreSQL como banco de dados

## Status

Aceito

## Contexto

O sistema precisa persistir usuários, transações, fontes, análises, indicadores, recomendações, histórico do agente, fatos financeiros e evidências RAG.

## Decisão

Usar PostgreSQL como banco principal e habilitar `pgvector` quando disponível. O schema é versionado exclusivamente pelas migrações Flyway do backend.

## Consequências

- Dados relacionais, `NUMERIC`, `JSONB`, full-text e vetores permanecem no mesmo banco.
- Flyway gerencia as migrações e tolera ambientes de teste sem a extensão vetorial.
- O backend é proprietário do schema e das tabelas de domínio.
- O AI Service recebe acesso SQL restrito a `rag_documents` para indexação e recuperação.
- `pgvector` adiciona requisitos de imagem/extensão e fixa o vetor atual em 1536 dimensões.
