# Dados do FinVise

Este diretório organiza espelhos locais, dados processados e amostras usadas no desenvolvimento. O dataset sintético canônico versionado nesta cópia do projeto está em `../finance_ai_dataset/`.

## Estrutura

```text
data/
├── raw/
│   └── finance_ai_dataset/  # espelho opcional; CSV/XLSX ignorados pelo Git
├── processed/               # saídas locais opcionais; o pipeline Python usa ai-service/data/processed
├── samples/                 # amostras versionadas de 1.000 linhas
└── scripts/
    └── create_samples.py    # lê exclusivamente data/raw/finance_ai_dataset
```

Também existe `ai-service/data/samples/`, mantido pelo pipeline de preparação do AI Service.

## Dataset canônico

`finance_ai_dataset/` na raiz contém:

- `usuarios.csv` — 1.500 usuários sintéticos;
- `transacoes.csv` — 169.546 transações;
- `perfis_mensais.csv` — 18.000 perfis mensais;
- `categorias.csv` — 47 pares de categoria/subcategoria;
- `dicionario_dados.csv` — dicionário de campos;
- `exemplos_api.json` — três exemplos contratuais validados por teste do backend;
- `manifesto.json` — versão, seed, período e contagens;
- `finance_ai_dataset_resumo.xlsx` — resumo tabular.

O padrão `DATASET_RAW_DIR=../finance_ai_dataset`, avaliado a partir de `ai-service/`, aponta para esse diretório da raiz.

## Espelho em `data/raw`

Os padrões do `.gitignore` excluem CSV, XLSX e ZIP sob `data/raw/`. Por isso, o repositório mantém ali apenas documentação/metadados pequenos, salvo quando um desenvolvedor provisiona manualmente o espelho completo.

`data/scripts/create_samples.py` **não** usa automaticamente o dataset da raiz. Ele procura:

```text
data/raw/finance_ai_dataset/transacoes.csv
data/raw/finance_ai_dataset/perfis_mensais.csv
```

Se os arquivos não existem, imprime `[skip] Source not found` e termina sem erro.

## Amostras

`data/samples/` e `ai-service/data/samples/` contêm as primeiras 1.000 linhas de `transacoes.csv` e `perfis_mensais.csv`.

Para regenerar `data/samples/` depois de provisionar o espelho:

```bash
python data/scripts/create_samples.py
```

Para regenerar amostras do AI Service a partir do dataset canônico:

```bash
cd ai-service
python -m training.prepare_dataset
```

## Processamento e treinamento

O pipeline executável grava Parquet em `ai-service/data/processed/`, não em `data/processed/`:

```bash
cd ai-service
python -m training.prepare_dataset
python -m training.train_transaction_classifier
python -m training.train_profile_classifier
python -m training.evaluate_models
```

Ou, após preparar os Parquet:

```bash
make train-transaction-model
make train-profile-model
make evaluate-models
```

Os alvos de treinamento do Makefile não chamam a preparação automaticamente.

## Dataset de treino versus CSV de importação

O schema de `transacoes.csv` foi criado para treinamento e inclui campos como `transacao_id`, `descricao_normalizada`, `categoria`, `split` e `fonte`. Ele não corresponde ao upload público.

O endpoint `/api/v1/imports/transactions/csv` aceita:

```csv
description,amount,date,type,payment_method,recurrent
Supermercado ABC,150.50,2026-07-01,EXPENSE,CREDIT_CARD,false
```

Transforme explicitamente os campos antes de usar uma amostra do dataset no fluxo de importação.

## Contratos de API

`finance_ai_dataset/exemplos_api.json` é a cópia canônica. `data/raw/finance_ai_dataset/exemplos_api.json` deve permanecer byte/semanticamente equivalente; `ApiExamplesContractTest` desserializa os requests nos DTOs reais e compara as duas cópias.

## Notas de uso

- Todos os dados são sintéticos e educacionais.
- Não adicione dados financeiros reais ao repositório.
- CSVs, XLSX, Parquet, Joblib e backups grandes são ignorados conforme `.gitignore`.
- O split `TEST` deve permanecer fora da seleção de modelos/hiperparâmetros.
- Antes de uso com dados reais autorizados, aplique governança, anonimização, retenção e controles compatíveis com a LGPD.
