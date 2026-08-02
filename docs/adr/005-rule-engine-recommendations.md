# ADR 005: Motor de regras para recomendações

## Status

Aceito

## Contexto

As recomendações persistidas junto às análises financeiras devem ser explicáveis e determinísticas, sem depender de LLM para cálculos.

## Decisão

Implementar um motor de regras no backend Java para gerar as entidades `Recommendation` a partir dos indicadores financeiros.

## Consequências

- Recomendações previsíveis e auditáveis.
- Fácil de manter e testar.
- O agente pode explicar os resultados e produzir orientação educacional em texto, mas esse texto não é persistido como uma nova entidade `Recommendation`.
- Existe um endpoint interno de recomendações no AI Service, porém o backend atual não o usa no fluxo que persiste análises.
