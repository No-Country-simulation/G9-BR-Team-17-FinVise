# Espelho local do dataset sintético — FinVise

Este diretório é o local esperado por `data/scripts/create_samples.py`. Ele não é o dataset canônico usado por padrão no treinamento.

## Conteúdo versionado

O `.gitignore` exclui CSV, XLSX e ZIP sob `data/raw/`. Nesta cópia do repositório permanecem versionados:

- `README.md`;
- `manifesto.json`;
- `exemplos_api.json`.

Os arquivos grandes, quando provisionados localmente, podem incluir:

- `usuarios.csv`;
- `transacoes.csv`;
- `perfis_mensais.csv`;
- `categorias.csv`;
- `dicionario_dados.csv`;
- `finance_ai_dataset_resumo.xlsx`.

## Fonte canônica

O pacote completo versionado nesta cópia está em:

```text
finance_ai_dataset/
```

O pipeline do AI Service usa por padrão `../finance_ai_dataset` quando executado em `ai-service/`. Para alterar isso, defina `DATASET_RAW_DIR` no ambiente do processo Python.

## Gerar amostras

O script da raiz lê **somente este espelho**:

```bash
python data/scripts/create_samples.py
```

Arquivos exigidos para gerar ambas as amostras:

```text
data/raw/finance_ai_dataset/transacoes.csv
data/raw/finance_ai_dataset/perfis_mensais.csv
```

Se estiverem ausentes, o script registra `[skip] Source not found` e não copia automaticamente os arquivos do diretório canônico.

Para usar diretamente o dataset canônico e gerar amostras do AI Service:

```bash
cd ai-service
python -m training.prepare_dataset
```

## Metadados

Segundo `manifesto.json`:

- 1.500 usuários;
- 169.546 transações;
- 18.000 perfis mensais;
- 47 categorias/subcategorias;
- período de 2025-07 a 2026-06;
- seed `20260715`.

`exemplos_api.json` deve permanecer semanticamente igual a `finance_ai_dataset/exemplos_api.json`; o backend verifica essa igualdade em teste.

## Aviso

Os dados são sintéticos e educacionais. Não coloque dados reais neste diretório, mesmo que os padrões do Git os ignorem localmente.
