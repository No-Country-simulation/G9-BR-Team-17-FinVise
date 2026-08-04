# ADR 009 — Consistência de fontes financeiras e RAG

## Contexto

Transações, `financial_fact_snapshots` e `rag_documents` representam o mesmo conjunto financeiro em formatos diferentes. Os fluxos anteriores atualizavam esses dados separadamente, ignoravam transações já indexadas e removiam todos os chunks derivados antes de recriá-los. Reclassificações também podiam deixar snapshots e evidências RAG desatualizados.

## Decisão

O backend usa `FinancialSourceConsistencyService` como caminho único para atualizar dados derivados depois de uma mutação de fonte.

Na mesma transação de banco, o serviço:

1. reconstrói o snapshot financeiro;
2. carrega todas as transações persistidas da fonte;
3. calcula o conjunto desejado de chunks;
4. reconcilia pelo `chunk_key` estável;
5. invalida somente embeddings cujo conteúdo mudou;
6. persiste o job durável de indexação quando houve alteração.

Chunks utilizam `schema_version=2.0`. A exclusão de uma fonte remove suas transações, snapshot e documentos RAG. Análises históricas são preservadas porque registram o resultado que foi apresentado ao usuário no momento da execução.

## Consequências

- Reclassificações atualizam snapshot, textos, metadados e embeddings afetados.
- Reprocessamentos idênticos não criam documentos nem jobs adicionais.
- A reconstrução deixa de ter uma janela em que todos os resumos derivados foram removidos.
- Consultas vetoriais consideram somente chunks `INDEXED` pelo modelo de embedding atual; enquanto um vetor é recalculado, o conteúdo atualizado continua disponível pela busca textual.
- Novos fluxos que alterem transações persistidas devem chamar `FinancialSourceConsistencyService.refresh`.
