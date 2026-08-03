# ADR 008: Fila durável para indexação RAG

## Status

Aceito

## Contexto

A indexação automática era iniciada por um evento após o commit e delegada a `BackgroundTasks` do FastAPI. Reinícios do processo podiam perder a tarefa, falhas HTTP não eram reagendadas e múltiplas instâncias não possuíam coordenação durável.

## Decisão

Persistir um job por usuário em `rag_index_jobs`, na mesma transação que grava os chunks. Workers do backend reivindicam jobs com `FOR UPDATE SKIP LOCKED`, chamam o AI Service de forma síncrona e registram conclusão ou retry com backoff exponencial. Um `lock_token` protege contra resultados atrasados e `rerun_requested` agrupa ingestões recebidas durante o processamento.

## Consequências

- Reinícios do backend não removem jobs pendentes.
- Réplicas podem compartilhar a fila sem processar o mesmo job simultaneamente.
- Jobs abandonados voltam a ficar elegíveis após o timeout do lock.
- O fluxo não exige Redis, RabbitMQ ou outro serviço operacional.
- A vazão de cada réplica é limitada a um job por vez pelo scheduler padrão.
- O PostgreSQL acumula no máximo um registro de job por usuário; uma nova ingestão reativa jobs concluídos ou com falha.
- Chamadas diretas ao endpoint interno com `background=true` continuam fora dessa garantia.
