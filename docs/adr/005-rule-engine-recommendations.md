# ADR 005: Motor de regras para recomendações

## Status

Aceito

## Contexto

As recomendações financeiras devem ser explicáveis e determinísticas, sem depender de LLM para cálculos.

## Decisão

Implementar um motor de regras simples no backend Java para gerar recomendações a partir dos indicadores financeiros.

## Consequências

- Recomendações previsíveis e auditáveis.
- Fácil de manter e testar.
- LLM pode ser usada apenas para explicar recomendações já existentes, nunca para criá-las.
