# Dados do Finance AI

Este diretório contém os dados utilizados pelo projeto Finance AI.

## Estrutura

```
data/
├── raw/                    # Dados brutos originais (não versionados)
│   └── finance_ai_dataset/
├── processed/              # Dados processados para treinamento (não versionados)
├── samples/                # Amostras pequenas para testes (versionadas)
└── scripts/                # Scripts reprodutíveis de preparação
```

## Dataset original

O dataset sintético está disponível em `raw/finance_ai_dataset/` e contém:

- `usuarios.csv` — 1.500 usuários sintéticos
- `transacoes.csv` — 169.546 transações
- `perfis_mensais.csv` — 18.000 perfis mensais
- `categorias.csv` — mapeamento de categorias e subcategorias
- `dicionario_dados.csv` — dicionário de dados
- `exemplos_api.json` — exemplos de contratos de API
- `manifesto.json` — metadados do dataset
- `finance_ai_dataset_resumo.xlsx` — resumo estatístico

## Amostras

As amostras em `samples/` contêm 1.000 linhas de cada arquivo principal e podem ser usadas para desenvolvimento e testes rápidos.

Para regenerar as amostras:

```bash
python data/scripts/create_samples.py
```

## Processamento

Para gerar os dados processados e treinar os modelos:

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
```

## Notas

- Os arquivos grandes (`.csv`, `.xlsx`, `.joblib`, `.parquet`) estão ignorados pelo Git.
- Trate todos os dados como sintéticos e educacionais.
- Não utilize dados reais de usuários neste repositório.
