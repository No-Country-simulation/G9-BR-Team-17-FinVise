# Dataset sintético — FinVise

Dataset canônico usado pelos scripts de treinamento e avaliação do FinVise.

## Volume

- Usuários: **1.500**.
- Transações: **169.546**.
- Perfis mensais: **18.000**.
- Categorias/subcategorias: **47**.
- Período: **2025-07 a 2026-06**.
- Seed: **20260715**.
- Versão do manifesto: **1.0.0**.

As contagens estão registradas em `manifesto.json` e correspondem aos CSVs versionados.

## Arquivos

- `usuarios.csv` — usuários sintéticos e anônimos.
- `transacoes.csv` — transações com descrições ruidosas, categorias e subcategorias.
- `perfis_mensais.csv` — indicadores mensais e rótulo de perfil.
- `categorias.csv` — catálogo e exemplos usados também pelo fallback de palavras-chave.
- `dicionario_dados.csv` — descrição dos campos.
- `exemplos_api.json` — requests/responses de análise e classificação validados pelo teste `ApiExamplesContractTest`.
- `manifesto.json` — metadados, período, quantidades e distribuição.
- `finance_ai_dataset_resumo.xlsx` — resumo tabular e amostras.

## Uso pelo pipeline

Com os comandos executados em `ai-service/`, o padrão:

```dotenv
DATASET_RAW_DIR=../finance_ai_dataset
```

aponta para este diretório.

```bash
cd ai-service
python -m training.prepare_dataset
python -m training.train_transaction_classifier
python -m training.train_profile_classifier
python -m training.evaluate_models
```

## Classificador de transações implementado

- Linhas usadas no treino: `tipo == DESPESA` e splits `TRAIN`/`VALIDATION`.
- Feature do modelo: `descricao_normalizada`.
- Target: `categoria`.
- Pipeline: TF-IDF de uni/bigramas (`max_features=20_000`, `min_df=2`, `sublinear_tf=True`) e Regressão Logística balanceada.
- Versão do artefato avaliado: `1.1.0`.
- Subcategoria não é um target treinado; o runtime a complementa com o fallback.

Campos como valor, forma de pagamento, recorrência e canal existem no dataset/schema de inferência, mas não entram no pipeline Scikit-learn atual.

## Classificador de perfil implementado

Features, na ordem do runtime:

- `percentual_renda_comprometida`;
- `nivel_endividamento_pct`;
- `taxa_poupanca_pct`;
- `percentual_despesas_fixas`;
- `percentual_gastos_nao_essenciais`;
- `quantidade_despesas_recorrentes`;
- `quantidade_transacoes_despesa`;
- `variacao_despesas_pct`;
- `reserva_em_meses`.

O treinamento compara Regressão Logística padronizada e Random Forest com 200 árvores, selecionando macro F1. O artefato final avaliado é Random Forest `1.0.0`.

Não use como features:

- `score_financeiro`, `confianca_perfil`, `fatores_risco`, `fatores_positivos`, `regra_rotulacao` ou `perfil_financeiro` — vazamento direto/indireto do rótulo;
- `split`, `fonte`, `usuario_id`, `mes_referencia` — metadados/partição;
- `renda_mensal`, `total_despesas` — excluídos explicitamente pelo script atual.

## Divisão

A coluna `split` foi definida por usuário:

- `TRAIN`: 1.050 usuários;
- `VALIDATION`: 225 usuários;
- `TEST`: 225 usuários.

Não há sobreposição de `usuario_id`. O avaliador final verifica a independência antes de calcular métricas e grava fingerprints SHA-256 do conjunto avaliado.

O treinamento de perfil combina as linhas oficiais `TRAIN`/`VALIDATION` preparadas e cria uma nova divisão por usuário de 15% para seleção entre os candidatos. O `TEST` oficial permanece reservado à avaliação dos artefatos.

## Formato diferente do upload público

`transacoes.csv` é um dataset de ML e **não** pode ser enviado diretamente a `/api/v1/imports/transactions/csv`. O importador público espera:

```csv
description,amount,date,type,payment_method,recurrent
Supermercado ABC,150.50,2026-07-01,EXPENSE,CREDIT_CARD,false
```

É necessária uma transformação explícita de colunas.

## Aviso

Todos os registros são sintéticos e não representam pessoas ou movimentações reais. As métricas versionadas medem generalização dentro do mesmo gerador controlado, não desempenho bancário externo.

Antes de uso em produção, valide com dados reais autorizados, anonimizados e governados conforme a LGPD.
