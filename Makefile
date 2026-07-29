.PHONY: setup build up down logs test test-backend test-ai test-frontend train-transaction-model train-profile-model evaluate-models health backup restore clean

COMPOSE_FILES := -f docker-compose.yml
ifdef PROD
	COMPOSE_FILES += -f docker-compose.production.yml
endif

setup:
	@echo "=== FinVise Setup ==="
	@test -f .env || (echo "Creating .env from .env.example"; cp .env.example .env)
	@echo "Creating sample dataset if needed..."
	@mkdir -p data/samples
	@python3 data/scripts/create_samples.py || echo "Sample script not available or Python missing"
	@echo "Setup complete. Edit .env with real values before production."

build:
	docker compose $(COMPOSE_FILES) build --no-cache

up:
	docker compose $(COMPOSE_FILES) up -d

down:
	docker compose $(COMPOSE_FILES) down

logs:
	docker compose $(COMPOSE_FILES) logs -f

test: test-backend test-ai test-frontend

test-backend:
	cd backend && ./mvnw test -Dspring.profiles.active=test

test-ai:
	cd ai-service && python -m pytest tests/ -v

test-frontend:
	cd frontend && npm run test -- --run

train-transaction-model:
	cd ai-service && python training/train_transaction_classifier.py

train-profile-model:
	cd ai-service && python training/train_profile_classifier.py

evaluate-models:
	cd ai-service && python -m training.evaluate_models

health:
	@echo "=== Backend health ==="
	@curl -s http://localhost:8080/actuator/health || echo "Backend not reachable"
	@echo ""
	@echo "=== AI Service health ==="
	@curl -s http://localhost:8000/health || echo "AI Service not reachable"

backup:
	@mkdir -p backups
	bash infrastructure/scripts/backup-postgres.sh

restore:
	bash infrastructure/scripts/restore-postgres.sh

clean:
	docker compose $(COMPOSE_FILES) down -v --remove-orphans
	@echo "Volumes removed. Data in postgres_data is gone unless backed up."
