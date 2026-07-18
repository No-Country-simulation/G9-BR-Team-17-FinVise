# ADR 003: Separação entre Spring Boot e FastAPI

## Status

Aceito

## Contexto

Precisávamos escolher se a inteligência artificial ficaria no backend Java ou em um serviço separado.

## Decisão

Manter o backend principal em Java/Spring Boot e o AI service em Python/FastAPI.

## Consequências

- O backend gerencia autenticação, persistência e regras de negócio.
- O AI service foca em modelos de ML, pré-processamento e agente.
- Facilita a evolução independente dos modelos.
- O frontend nunca acessa o AI service diretamente.
