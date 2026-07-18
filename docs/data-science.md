# Data Science no Finance AI

## Objetivos

- Classificar transações em categorias e subcategorias.
- Classificar o perfil financeiro do usuário em `SAUDAVEL`, `EM_OBSERVACAO` ou `EM_RISCO`.
- Fornecer explicabilidade para as classificações.
- Servir como base para recomendações e para o agente financeiro.

## Dataset

O dataset sintético está em `data/raw/finance_ai_dataset/`:

- `transacoes.csv` — 169.546 transações com `descricao_normalizada`, `valor`, `categoria`, `subcategoria`, etc.
- `perfis_mensais.csv` — 18.000 perfis mensais com indicadores e rótulo `perfil_financeiro`.
- `categorias.csv` — mapeamento de categorias e palavras-chave de exemplos.

A coluna `split` (`TRAIN`, `VALIDATION`, `TEST`) já divide os dados. Não fazemos nova divisão aleatória.

## Classificador de transações

### Entrada principal

`descricao_normalizada`

### Features opcionais

`valor`, `forma_pagamento`, `recorrente`, `canal`

### Target

`categoria` (principal) e `subcategoria` (secundário)

### Filtro

Apenas `tipo == "DESPESA"`.

### Baseline

Pipeline Scikit-learn:

```python
TfidfVectorizer(
    ngram_range=(1, 2),
    max_features=5000,
    min_df=2
)
LogisticRegression(
    class_weight='balanced',
    max_iter=1000
)
```

### Artefatos

```
ai-service/models/transaction-classifier/
├── model.joblib
├── metadata.json
├── metrics.json
└── labels.json
```

### Métricas

- Accuracy
- Macro F1
- Weighted F1
- Precision por categoria
- Recall por categoria
- Matriz de confusão
- Quantidade de exemplos por classe

## Classificador de perfil financeiro

### Classes

- `SAUDAVEL`
- `EM_OBSERVACAO`
- `EM_RISCO`

### Features permitidas

- `percentual_renda_comprometida`
- `nivel_endividamento_pct`
- `taxa_poupanca_pct`
- `percentual_despesas_fixas`
- `percentual_gastos_nao_essenciais`
- `quantidade_despesas_recorrentes`
- `quantidade_transacoes_despesa`
- `variacao_despesas_pct`
- `reserva_em_meses`

### Features proibidas (vazamento de dados)

- `score_financeiro`
- `confianca_perfil`
- `fatores_risco`
- `fatores_positivos`
- `regra_rotulacao`
- `perfil_sintetico_base`

### Baselines

1. Logistic Regression
2. Random Forest

Seleção pelo melhor `macro F1`, estabilidade entre classes, explicabilidade e complexidade operacional.

### Artefatos

```
ai-service/models/profile-classifier/
├── model.joblib
├── preprocessor.joblib
├── metadata.json
├── metrics.json
└── feature_names.json
```

## Treinamento

```bash
make train-transaction-model
make train-profile-model
```

Ou manualmente:

```bash
cd ai-service
python -m training.prepare_dataset
python -m training.train_transaction_classifier
python -m training.train_profile_classifier
python -m training.evaluate_models
```

## Avaliação final em teste independente

Os modelos finais são carregados dos artefatos já treinados e avaliados exclusivamente no
split oficial `TEST`. A avaliação não retreina modelos, não seleciona hiperparâmetros e não usa
os rótulos de teste durante a seleção. A independência é verificada por `usuario_id` antes do
cálculo: não há usuários compartilhados entre `TRAIN`, `VALIDATION` e `TEST`.

Resultados produzidos em 16/07/2026:

| Modelo | Amostras TEST | Usuários TEST | Accuracy | Macro F1 | Weighted F1 | Erros |
|---|---:|---:|---:|---:|---:|---:|
| Transações 1.1.0 | 19.692 | 225 | 99,9898% | 99,9863% | 99,9898% | 2 |
| Perfil 1.0.0 | 2.700 | 225 | 98,7778% | 98,7541% | 98,7819% | 33 |

Intervalos de confiança de 95% por bootstrap (500 reamostragens, seed 42):

- Transações — accuracy: `[99,9746%; 100%]`; macro F1: `[99,9654%; 100%]`.
- Perfil — accuracy: `[98,3704%; 99,1481%]`; macro F1: `[98,3331%; 99,1282%]`.

Para reproduzir:

```bash
make evaluate-models
```

Artefatos gerados em `ai-service/reports/final-test/`:

- `final-test-metrics.json` — protocolo, evidências de independência, fingerprints e métricas.
- `*-per-class.csv` — precision, recall, F1 e suporte por classe.
- `*-confusion-matrix.csv` — matrizes de confusão com rótulos.

### Limitação

O conjunto `TEST` é independente por usuário, mas pertence ao mesmo gerador de dados sintéticos
dos demais splits. As métricas medem generalização dentro desse domínio controlado e não devem ser
interpretadas como desempenho em dados bancários reais. Uma validação externa, temporal e com dados
reais autorizados continua necessária antes de uso em produção.

## Fallbacks

Se os modelos treinados não estiverem disponíveis, o sistema usa:

- **Transações**: classificador por keywords baseado em `categorias.csv`.
- **Perfil**: classificador por regras baseado em thresholds dos indicadores.

O status `FALLBACK` é informado na resposta da API.

## Explicabilidade

- Coeficientes da regressão logística indicam palavras/features mais importantes.
- O agente explica recomendações a partir dos indicadores reais.
- Nenhum valor é inventado pela LLM.
