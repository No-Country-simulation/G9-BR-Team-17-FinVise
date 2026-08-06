# Notebook `finance_ai_data_science.ipynb`

Guia completo do notebook de Ciência de Dados do MVP FinVise.

## Objetivo

O notebook [`finance_ai_data_science.ipynb`](./finance_ai_data_science.ipynb) implementa um fluxo fim a fim para:

1. classificar transações de despesa por categoria;
2. classificar o perfil financeiro mensal do usuário;
3. gerar métricas auditáveis (validation/test), explicabilidade e artefatos serializados.

> Importante: os dados usados são sintéticos e servem para validação técnica do MVP.

## Escopo coberto no notebook

O notebook está organizado em 9 etapas:

1. **Escopo e critérios de validação**  
   Define os entregáveis e a política de split (`TRAIN`, `VALIDATION`, `TEST`) com isolamento por usuário.

2. **Carregamento e auditoria dos dados**  
   Lê os arquivos canônicos e valida duplicidade, nulos, tipos e distribuição dos splits.

3. **EDA de transações**  
   Resume período, volume, distribuição por categoria e evolução mensal de despesas.

4. **Limpeza e tratamento textual**  
   Normaliza descrições, remove ruído e aplica filtros de consistência para treino.

5. **Classificador de despesas**  
   Treina pipeline **TF-IDF + Regressão Logística**, avalia em validation/test e gera matriz de confusão.

6. **Análise de perfil financeiro**  
   Seleciona features numéricas de finanças pessoais, removendo colunas com potencial vazamento.

7. **Comparação de modelos de perfil**  
   Compara **Logistic Regression** vs **Random Forest** por macro F1 em validation, depois avalia no teste.

8. **Registro consolidado da execução**  
   Exporta métricas, metadados e inventário de artefatos.

9. **Conclusões e limitações**  
   Resume resultados, limitações de dados sintéticos e próximos passos para produção.

## Datasets e estrutura esperada

O notebook procura a raiz do repositório e usa:

- [`finance_ai_dataset/transacoes.csv`](../finance_ai_dataset/transacoes.csv)
- [`finance_ai_dataset/perfis_mensais.csv`](../finance_ai_dataset/perfis_mensais.csv)

Também grava saídas em:

- [`ai-service/models/notebook-experiments/`](../ai-service/models/notebook-experiments)

## Pré-requisitos

- Python 3.11+ (notebook validado com Python 3.12)
- Dependências do [`ai-service/`](../ai-service)
- Jupyter Lab (ou Notebook)

## Como executar

No repositório:

```bash
cd ai-service
python -m pip install --no-deps -e .
python -m pip install jupyter matplotlib
jupyter lab ../notebooks/finance_ai_data_science.ipynb
```

Execute as células em ordem, sem pular etapas, para preservar rastreabilidade entre treino, seleção e avaliação final.

## Principais resultados da execução validada

### Classificador de despesas

- Modelo: **TF-IDF (unigrama/bigrama) + Regressão Logística balanceada**
- Split final: **TEST (19.692 amostras)**
- Accuracy: **0.9999**
- Macro F1: **0.9999**
- Erros observados no teste: **2 registros**

### Classificador de perfil financeiro

- Candidatos comparados: Logistic Regression e Random Forest
- Selecionado por validation macro F1: **Random Forest**
- Split final: **TEST (2.700 amostras)**
- Accuracy: **0.9889**
- Macro F1: **0.9887**

## Artefatos gerados

Arquivos exportados em [`ai-service/models/notebook-experiments/`](../ai-service/models/notebook-experiments):

- `transaction_classifier.joblib`
- `profile_classifier.joblib`
- `profile_feature_names.json`
- `metrics.json`

O arquivo `metrics.json` consolida:

- metadados de ambiente (versões);
- política de split;
- métricas de validation/test;
- termos mais relevantes por categoria (modelo de transações);
- importância global de features (modelo de perfil).

## Decisões de modelagem

- O target de categorias usa apenas `DESPESA` para classificação textual.
- O split oficial do dataset é respeitado em todas as etapas.
- Há validação explícita para impedir vazamento por sobreposição de `usuario_id` entre splits.
- Features proibidas de perfil (ex.: `score_financeiro`, `regra_rotulacao`) não entram no treino.

## Limitações conhecidas

- Base sintética pode ser mais previsível que dados financeiros reais.
- Métricas altas não garantem generalização em produção.
- Novos estabelecimentos, textos curtos e outliers podem reduzir confiança.
- O modelo não substitui aconselhamento financeiro profissional.
- Uso com dados reais exige conformidade LGPD (consentimento, minimização, retenção e governança).

## Próximos passos recomendados

1. Avaliar em conjunto externo realista (fora do domínio sintético).
2. Calibrar probabilidades e usar fallback sob baixa confiança.
3. Incorporar feedback do usuário para retreinamento supervisionado.
4. Promover artefatos para produção só após testes integrados.
5. Monitorar drift, confiança e taxa de correção em runtime.
