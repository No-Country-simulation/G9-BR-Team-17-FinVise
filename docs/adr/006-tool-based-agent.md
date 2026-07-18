# ADR 006: Agente baseado em ferramentas

## Status

Aceito

## Contexto

O agente financeiro deve responder perguntas sobre dados reais sem inventar valores.

## Decisão

Implementar um agente baseado em ferramentas (tool-calling). Cada ferramenta consulta dados reais do contexto fornecido. Uma interface abstrata de LLM permite fallback por templates quando nenhuma chave está configurada.

## Consequências

- O agente nunca inventa transações ou indicadores.
- Respostas são baseadas em dados reais.
- O sistema funciona sem LLM configurada.
- Respostas possuem disclaimer educacional.
