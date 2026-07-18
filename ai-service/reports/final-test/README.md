# Métricas finais — conjunto TEST independente

Avaliação dos artefatos de modelo carregados em produção, sem retreinamento e sem uso dos
rótulos de `TEST` para seleção de modelo ou hiperparâmetros.

| Modelo | Versão | Amostras | Usuários | Accuracy | Macro F1 | Weighted F1 |
|---|---:|---:|---:|---:|---:|---:|
| Classificador de transações | 1.1.0 | 19.692 | 225 | 0,999898 | 0,999863 | 0,999898 |
| Classificador de perfil | 1.0.0 | 2.700 | 225 | 0,987778 | 0,987541 | 0,987819 |

## Independência

- Unidade de separação: `usuario_id`.
- Sobreposição `TRAIN` × `VALIDATION`: 0 usuários.
- Sobreposição `TRAIN` × `TEST`: 0 usuários.
- Sobreposição `VALIDATION` × `TEST`: 0 usuários.
- Fingerprints SHA-256 dos conjuntos avaliados estão em `final-test-metrics.json`.

## Arquivos

- `final-test-metrics.json`: relatório consolidado e protocolo de avaliação.
- `transaction-classifier.json` e `profile-classifier.json`: relatórios individuais.
- `*-per-class.csv`: precision, recall, F1 e suporte por classe.
- `*-confusion-matrix.csv`: matrizes de confusão.

## Reproduzir

Na raiz do repositório:

```bash
make evaluate-models
```

Os dados são sintéticos. O split é independente por usuário, mas não representa uma validação
externa com dados bancários reais.
