# ADR 003: Separação entre Spring Boot e FastAPI

## Status

Aceito

## Contexto

Precisávamos escolher se a inteligência artificial ficaria no backend Java ou em um serviço separado.

## Decisão

Manter o backend principal em Java/Spring Boot e o AI Service em Python/FastAPI. O backend controla autenticação, regras, persistência de domínio e schema Flyway. O AI Service pode acessar diretamente somente a store RAG para gerar/persistir embeddings e recuperar evidências.

## Consequências

- O backend gerencia autenticação, persistência de domínio, integrações e regras de negócio.
- O AI Service foca em modelos de ML, pré-processamento, agente, embeddings e retrieval.
- Facilita a evolução independente dos modelos.
- O frontend nunca acessa o AI service diretamente.
- Endpoints internos FastAPI dependem do isolamento da rede Docker e não têm autenticação própria.
- O AI Service não executa DDL; `_ensure_embedding_column` apenas verifica a capacidade criada por Flyway.
