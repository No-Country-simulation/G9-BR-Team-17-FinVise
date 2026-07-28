# Dataset sintético — FinVise

Dataset criado para iniciar o desenvolvimento e os testes do projeto **FinVise — Assistente Inteligente de Saúde Financeira**.

## Volume

- Usuários: **1,500**
- Transações: **169,546**
- Perfis mensais: **18,000**
- Período: **2025-07 a 2026-06**
- Seed: **20260715**

## Arquivos

- `usuarios.csv`: dados sintéticos e anônimos de usuários.
- `transacoes.csv`: transações com descrições ruidosas, categorias e subcategorias.
- `perfis_mensais.csv`: indicadores mensais e rótulo de perfil financeiro.
- `categorias.csv`: catálogo de categorias, subcategorias e exemplos.
- `dicionario_dados.csv`: descrição dos campos.
- `exemplos_api.json`: exemplos de payloads para a API.
- `finance_ai_dataset_resumo.xlsx`: resumo visual e amostras dos dados.

## Primeiros modelos sugeridos

### 1. Classificador de transações

- Entrada inicial: `descricao_normalizada`
- Features adicionais opcionais: `valor`, `forma_pagamento`, `recorrente`
- Target: `categoria`
- Baseline: TF-IDF + Regressão Logística ou Linear SVM
- Avaliação: macro F1, weighted F1 e matriz de confusão

Filtre `tipo == DESPESA` caso o MVP classifique somente despesas.

### 2. Classificador de perfil financeiro

Features sugeridas:

- `percentual_renda_comprometida`
- `nivel_endividamento_pct`
- `taxa_poupanca_pct`
- `percentual_despesas_fixas`
- `percentual_gastos_nao_essenciais`
- `quantidade_despesas_recorrentes`
- `variacao_despesas_pct`
- `reserva_em_meses`

Target: `perfil_financeiro`

**Não use** `score_financeiro`, `confianca_perfil`, `fatores_risco`,
`fatores_positivos` ou `regra_rotulacao` como features, pois esses campos
foram gerados junto com o rótulo e causariam vazamento de dados.

## Divisão de treino

A coluna `split` foi definida por usuário:

- TRAIN: aproximadamente 70%
- VALIDATION: aproximadamente 15%
- TEST: aproximadamente 15%

Isso impede que transações do mesmo usuário apareçam simultaneamente no treino e no teste.

## Aviso

Todos os dados são sintéticos e não representam pessoas ou movimentações reais.
O conjunto é adequado para prototipação, testes de API, pipelines de ML,
integração Java/Python, processamento em lote e demonstrações.

Antes de uso em produção, substitua ou complemente por dados reais autorizados,
anonimizados e tratados de acordo com a LGPD.
