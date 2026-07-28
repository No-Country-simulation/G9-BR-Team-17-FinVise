# ai-service — FinVise

Serviço Python (FastAPI) responsável por:

- Classificação de transações financeiras.
- Análise de perfil financeiro.
- Assistente financeiro via agente com ferramentas.

## Estrutura

- `app/` — código da aplicação FastAPI.
- `training/` — scripts de preparação e treinamento dos modelos.
- `models/` — artefatos de modelos treinados (`.joblib`, metadados, métricas).
- `tests/` — testes com pytest.

## Executar localmente

```bash
cd ai-service
cp .env.example .env
pip install -e ".[dev]"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Treinar modelos

```bash
python -m training.prepare_dataset
python -m training.train_transaction_classifier
python -m training.train_profile_classifier
python -m training.evaluate_models
```

Os modelos treinados são opcionais: o serviço funciona com classificadores fallback determinísticos.

## Testes

```bash
pytest tests/
```

## Health check

```bash
curl http://localhost:8000/health
```
