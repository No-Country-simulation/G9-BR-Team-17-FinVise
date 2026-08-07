# Data Science no FinVise

## Objetivos

- Classificar despesas em categorias financeiras.
- Classificar o perfil do usuário como `SAUDAVEL`, `EM_OBSERVACAO` ou `EM_RISCO`.
- Expor confiança e fatores explicativos compatíveis com cada classificador.
- Manter fallbacks determinísticos quando artefatos treinados não estão disponíveis.
- Produzir evidências reproduzíveis de avaliação no split oficial `TEST`.

## Dataset

O dataset canônico está em `finance_ai_dataset/`. Com o diretório de trabalho em `ai-service/`, o padrão de `DATASET_RAW_DIR` (`../finance_ai_dataset`) resolve para esse local.

| Arquivo | Volume | Uso |
| --- | ---: | --- |
| `usuarios.csv` | 1.500 usuários | identidade sintética e divisão por usuário |
| `transacoes.csv` | 169.546 transações | classificador de categoria |
| `perfis_mensais.csv` | 18.000 perfis | classificador de perfil |
| `categorias.csv` | 47 pares categoria/subcategoria | catálogo e palavras-chave do fallback |
| `dicionario_dados.csv` | — | definição de campos |
| `manifesto.json` | — | seed, período e contagens |

Período: julho de 2025 a junho de 2026. Seed: `20260715`.

A coluna `split` foi definida por `usuario_id`: 1.050 usuários em `TRAIN`, 225 em `VALIDATION` e 225 em `TEST`. A avaliação final verifica que não existe sobreposição de usuários.

`data/raw/finance_ai_dataset/` é um espelho opcional para o gerador de amostras `data/scripts/create_samples.py`; os CSVs/XLSX desse diretório são ignorados pelo Git. Ele não é o caminho padrão do pipeline de treinamento.

## Preparação

```bash
cd ai-service
python -m training.prepare_dataset
```

O script:

- processa CSV em chunks de 10.000 linhas;
- mantém somente `tipo == "DESPESA"` e splits `TRAIN`/`VALIDATION` para `transaction_train.parquet`;
- mantém splits `TRAIN`/`VALIDATION` para `profile_train.parquet`;
- grava os Parquet em `ai-service/data/processed/`;
- gera amostras de 1.000 linhas em `ai-service/data/samples/` quando os arquivos brutos existem.

`TEST` não é gravado nos Parquet de treino; os avaliadores o leem diretamente dos CSVs brutos.

## Classificador de transações

### Entrada e target

- Feature treinada: somente `descricao_normalizada`.
- Target treinado: `categoria`.
- Filtro: somente despesas.

`amount`, `payment_method`, `recurrent` e `channel` fazem parte do schema interno de inferência, mas o pipeline Scikit-learn atual não os usa. O fallback por palavras-chave também decide pela descrição.

O modelo não treina um target de subcategoria. Na inferência, a subcategoria vem do fallback quando ele concorda com a categoria prevista; caso contrário, recebe o próprio código de categoria.

### Pipeline

```python
Pipeline([
    (
        "tfidf",
        TfidfVectorizer(
            ngram_range=(1, 2),
            min_df=2,
            max_features=20_000,
            sublinear_tf=True,
        ),
    ),
    (
        "clf",
        LogisticRegression(
            class_weight="balanced",
            max_iter=1000,
            random_state=42,
        ),
    ),
])
```

Fluxo de `training.train_transaction_classifier`:

1. treina em `TRAIN`;
2. calcula métricas em `VALIDATION`;
3. refaz o fit em `TRAIN + VALIDATION`;
4. calcula métricas informativas no `TEST` oficial;
5. grava o artefato final versão `1.1.0`.

O script verifica que os três splits têm usuários disjuntos. A confiança mínima é `0.60`; previsões abaixo dela são substituídas pela previsão do fallback.

### Artefatos

```text
ai-service/models/transaction-classifier/
├── model.joblib
├── metadata.json
├── metrics.json
└── labels.json
```

Para ativação, `model.joblib`, `metadata.json` e `labels.json` devem existir e não estar vazios; `metadata.status` deve ser `ACTIVE`. Quando `TRANSACTION_MODEL_VERSION` é definida, ela deve coincidir com a versão do metadata.

## Classificador de perfil financeiro

### Features usadas

Na ordem validada pelo runtime:

1. `percentual_renda_comprometida`;
2. `nivel_endividamento_pct`;
3. `taxa_poupanca_pct`;
4. `percentual_despesas_fixas`;
5. `percentual_gastos_nao_essenciais`;
6. `quantidade_despesas_recorrentes`;
7. `quantidade_transacoes_despesa`;
8. `variacao_despesas_pct`;
9. `reserva_em_meses`.

### Campos excluídos

O treinamento mantém uma lista explícita de campos que não podem ser features:

- vazamento de rótulo: `score_financeiro`, `confianca_perfil`, `fatores_risco`, `fatores_positivos`, `regra_rotulacao`, `perfil_financeiro`;
- partição/metadados: `split`, `fonte`, `usuario_id`, `mes_referencia`;
- redundância com os indicadores escolhidos: `renda_mensal`, `total_despesas`.

### Seleção do modelo

O script `training.train_profile_classifier` recebe o Parquet que já contém os usuários dos splits oficiais `TRAIN` e `VALIDATION`, mas faz uma nova separação por usuário com `train_test_split(test_size=0.15, random_state=42)` sobre esse conjunto combinado.

Candidatos:

| Modelo | Configuração |
| --- | --- |
| Regressão Logística | `class_weight=balanced`, `max_iter=1000`, `random_state=42`, `n_jobs=5`; features padronizadas |
| Random Forest | 200 árvores, `class_weight=balanced`, `random_state=42`, `n_jobs=5`; sem scaler |

O vencedor é o maior macro F1 da validação recriada. O artefato salvo é o modelo já ajustado na porção de treino dessa divisão; o script não refaz o fit em todo `TRAIN + VALIDATION` após selecionar o vencedor.

O relatório final versionado identifica o artefato atual como Random Forest `1.0.0`.

### Artefatos

```text
ai-service/models/profile-classifier/
├── model.joblib
├── metadata.json
├── metrics.json
├── feature_names.json
└── preprocessor.joblib  # presente apenas se o vencedor usar scaler
```

Para ativação, `model.joblib`, `metadata.json` e `feature_names.json` são obrigatórios. A lista de features deve ser exatamente igual ao schema do runtime.

## Treinamento

Na raiz:

```bash
make provision-models
make train-transaction-model
make train-profile-model
```

`make provision-models` é o caminho reproduzível de bootstrap: usa os CSVs versionados em `data/samples`, prepara os dados em área temporária, treina e recarrega os dois classificadores, grava checksums em `models/provisioning-manifest.json` e só ativa o conjunto após todas as validações. Esses artefatos usam versões `1.1.0-bootstrap.1` e `1.0.0-bootstrap.1`.

Os alvos de treinamento não executam `prepare_dataset` automaticamente. Em uma instalação nova:

```bash
cd ai-service
python -m training.prepare_dataset
python -m training.train_transaction_classifier
python -m training.train_profile_classifier
```

Os scripts também estão registrados em `pyproject.toml` como `provision-models`, `prepare-dataset`, `train-transaction`, `train-profile` e `evaluate-models` quando o pacote é instalado.

Artefatos de modelo continuam ignorados pelo Git. No Docker, o provisionamento ocorre durante o build e os artefatos validados são incorporados à imagem; o Compose não depende mais de arquivos gerados previamente no host.

Os modelos bootstrap tornam o ambiente executável e impedem fallback silencioso, mas são treinados com amostras reduzidas. Eles não substituem uma promoção formal dos modelos finais produzidos pelo dataset canônico, avaliação completa e registro de artefatos externo.

## Avaliação final no conjunto TEST

```bash
make evaluate-models
```

`training.evaluate_models`:

- carrega os artefatos existentes, sem retreino;
- usa somente linhas `TEST` para a avaliação final;
- verifica independência por `usuario_id` entre `TRAIN`, `VALIDATION` e `TEST`;
- calcula fingerprints SHA-256 dos dados avaliados;
- produz accuracy, balanced accuracy, precision/recall/F1 macro, weighted F1, métricas por classe e matriz de confusão;
- calcula intervalos de confiança percentis por bootstrap com 500 reamostragens e seed 42.

Resultados versionados, gerados em 16/07/2026:

| Modelo | Amostras TEST | Usuários TEST | Accuracy | Macro F1 | Weighted F1 | Erros |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Transações 1.1.0 | 19.692 | 225 | 99,9898% | 99,9863% | 99,9898% | 2 |
| Perfil 1.0.0 | 2.700 | 225 | 98,7778% | 98,7541% | 98,7819% | 33 |

Intervalos de 95%:

- Transações — accuracy `[99,9746%; 100%]`; macro F1 `[99,9654%; 100%]`.
- Perfil — accuracy `[98,3704%; 99,1481%]`; macro F1 `[98,3331%; 99,1282%]`.

Saídas em `ai-service/reports/final-test/`:

- `final-test-metrics.json` — protocolo, independência, fingerprints e consolidação;
- `transaction-classifier.json` e `profile-classifier.json` — relatórios individuais;
- `*-per-class.csv` — precision, recall, F1 e suporte;
- `*-confusion-matrix.csv` — matrizes com rótulos;
- `README.md` — resumo versionado.

### Limitação das métricas

O split é independente por usuário, mas todos os dados vêm do mesmo gerador sintético. As métricas medem generalização dentro desse domínio controlado; não comprovam desempenho em extratos bancários reais. Antes de uso decisório em produção, ainda é necessária validação externa, temporal e com dados reais autorizados.

Além disso, `training.train_transaction_classifier` calcula métricas no `TEST` ao final do treinamento. O protocolo do relatório final declara que esses rótulos não foram usados para seleção/hiperparâmetros; preserve essa separação em mudanças futuras.

## Registry e ativação

Na inicialização, o `ModelRegistry` valida arquivos, metadata, versões opcionais e lista de labels/features. Status possíveis no registro incluem:

- artefato `VALID` e classificador `LOADED`;
- `MISSING` ou `INVALID`, com classificador `FALLBACK` quando modelos não são obrigatórios;
- falha de startup quando `REQUIRE_ACTIVE_MODELS=true` ou `ENVIRONMENT` é `production`/`prod` e um artefato está ausente/inválido.

O endpoint interno `/internal/v1/models/status` e o proxy autenticado `/api/v1/model-status` expõem estado, versões, caminhos, checksums e erros.

O Compose encaminha `ENVIRONMENT`, `REQUIRE_ACTIVE_MODELS` e as duas versões esperadas. A exigência é `true` por padrão e o override de produção também fixa `ENVIRONMENT=production`; por isso, ausência, corrupção ou versão divergente encerra a inicialização. O fallback só permanece acessível em execução isolada quando `REQUIRE_ACTIVE_MODELS=false` e o ambiente não é produção.

## Fallbacks

### Transações

`FallbackTransactionClassifier` carrega palavras-chave de `categorias.csv` quando disponível e complementa com um mapa embutido. Correspondências têm confiança `0.75`; ausência de correspondência retorna `OUTROS/OUTROS` com `0.4`.

### Perfil

`FallbackProfileClassifier` aplica thresholds sobre endividamento, comprometimento, poupança, reserva, despesas fixas e gastos não essenciais. `RuleBasedProfileClassifier` reutiliza essa lógica com identidade/versionamento `RULES-1.0.0` e atende à opção pública `FINANCIAL_RULES`.

## Explicabilidade

- O classificador de transações extrai até três n-gramas com contribuição positiva a partir dos coeficientes TF-IDF/Regressão Logística; se isso não for possível, usa tokens normalizados.
- O classificador de perfil retorna `main_factors` derivados de thresholds explícitos, inclusive quando a classe vem do modelo treinado.
- `extract_feature_importance` oferece suporte genérico a `feature_importances_` ou `coef_`, mas não há endpoint público dedicado a esse mapa.
- SHAP não está instalado nem integrado.
- Recomendações principais são geradas por regras no backend, não pela LLM.

## Notebook

`notebooks/finance_ai_data_science .ipynb` contém exploração e experimentos. Os scripts em `ai-service/training/` são a referência executável para o pipeline usado pelos artefatos e relatórios versionados; afirmações do notebook que divergirem desses scripts não descrevem o runtime atual.
