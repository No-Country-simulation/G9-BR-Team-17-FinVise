# ADR 006: Agente baseado em ferramentas

## Status

Aceito

## Contexto

O agente financeiro deve responder perguntas sobre dados reais sem inventar valores.

## Decisão

Implementar um agente que seleciona e executa ferramentas determinísticas sobre o contexto fornecido pelo backend e, em paralelo, recupera evidências por RAG. Depois dessa etapa, um provider de LLM ou template recebe os resultados já calculados; a chamada remota atual não faz tool-calling.

## Consequências

- Ferramentas não calculam a partir de texto livre: usam indicadores, transações e fatos enviados pelo backend.
- O RAG filtra por usuário, origem e fontes selecionadas.
- Sem chave/LLM habilitada, `FallbackTemplateProvider` mantém o fluxo, e o backend ainda possui uma resposta segura para falha do stream.
- O prompt instrui o agente a declarar ausência de evidência, mas isso não substitui validação do conteúdo gerado.
- Respostas do endpoint interno possuem disclaimer educacional; o backend persiste conteúdo/tools/fontes, mas o DTO público de conversa não expõe um campo separado de disclaimer.
