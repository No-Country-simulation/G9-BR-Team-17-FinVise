# ADR 013 — Busca híbrida RAG real

## Contexto

A recuperação anterior ordenava candidatos pelo vetor e calculava relevância textual somente nesse subconjunto. Quando havia qualquer resultado vetorial, a busca full-text independente não era executada. Um novo modelo também substituía o vetor anterior do documento, e o full-text usava a configuração genérica `simple`.

## Decisão

- Persistir embeddings em `rag_document_embeddings`, com chave `(document_id, embedding_model)`.
- Manter `rag_documents.search_vector` como coluna gerada por `to_tsvector('portuguese', document_chunk)` e indexada por GIN.
- Executar ranking vetorial e textual em consultas SQL separadas com os mesmos filtros de usuário e origem.
- Fundir candidatos por Reciprocal Rank Fusion ponderado e diversificar somente depois da fusão.
- Manter o ranking textual disponível durante reindexação ou falha vetorial.
- Expor telemetria limitada em memória e fornecer avaliação rotulada de Recall@K, Precision@K, MRR@K e latência.

## Consequências

- trocar o modelo não exige apagar embeddings anteriores;
- alterações no conteúdo removem por trigger todos os vetores obsoletos daquele documento;
- a store vetorial ocupa mais espaço quando vários modelos forem mantidos;
- pesos e profundidade de candidatos precisam ser calibrados com consultas rotuladas reais;
- métricas do endpoint são locais ao processo e reiniciam com a réplica;
- ambientes sem pgvector continuam com busca textual em português;
- os campos vetoriais legados em `rag_documents` permanecem temporariamente como cache de compatibilidade.
