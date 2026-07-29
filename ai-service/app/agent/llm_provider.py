from abc import ABC, abstractmethod
from typing import Any

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class LLMProvider(ABC):
    @abstractmethod
    def complete(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        tools: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        raise NotImplementedError


class OpenAIProvider(LLMProvider):
    def __init__(self) -> None:
        self.api_key = settings.llm_api_key
        self.base_url = settings.llm_base_url.rstrip("/")
        self.model = settings.llm_model
        self.timeout = settings.llm_timeout_seconds
        self.max_tokens = settings.llm_max_tokens
        self.temperature = settings.llm_temperature

    def complete(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        tools: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("OpenAI API key is not configured")

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": "system", "content": system_prompt}, *messages],
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            response = httpx.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:
            logger.error("LLM request failed: %s", exc)
            raise


class FallbackTemplateProvider(LLMProvider):
    """Deterministic provider used when ENABLE_LLM=false or no API key is set."""

    def complete(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        tools: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        user_message = messages[-1]["content"] if messages else ""
        return {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": self._render(user_message, system_prompt, tools),
                    }
                }
            ]
        }

    def _render(self, user_message: str, system_prompt: str, tools: list[dict[str, Any]] | None) -> str:
        if "[CONTEXTO RAG RECUPERADO DO BANCO VETORIAL DO USUARIO]:" in system_prompt:
            rag_section = system_prompt.split("[CONTEXTO RAG RECUPERADO DO BANCO VETORIAL DO USUARIO]:")[-1].strip()
            return (
                f"Com base nos dados RAG das suas transações e extratos importados:\n\n{rag_section}\n\n"
                "Essas informações representam o seu histórico financeiro registrado no sistema."
            )

        if "Nenhuma transacao ou extrato encontrado" in system_prompt:
            return (
                "Não encontrei informações suficientes no seu histórico financeiro para responder a esta pergunta. "
                "Por favor, realize o upload do seu arquivo CSV de transações ou conecte sua conta via Open Finance."
            )
        lower = user_message.lower()

        if any(word in lower for word in ["perfil", "situacao", "como estou"]):
            return (
                "Com base nos indicadores financeiros disponiveis, seu perfil reflete a combinacao "
                "entre renda comprometida, nivel de endividamento, taxa de poupanca e reserva de emergencia. "
                "Recomendo acompanhar a evolucao mensal desses indicadores."
            )

        if any(word in lower for word in ["dica", "recomendacao", "sugestao", "melhorar"]):
            return (
                "As recomendacoes atuais priorizam o equilibrio entre poupanca, controle de dividas "
                "e reducao de gastos nao essenciais. Comece pela acao de maior prioridade indicada."
            )

        if any(word in lower for word in ["gasto", "despesa", "transacao"]):
            return (
                "Suas transacoes e despesas recorrentes estao disponiveis no contexto. "
                "Analise categorias que mais comprometem o orcamento."
            )

        if any(word in lower for word in ["poupanca", "economizar", "meta", "simular", "juntar"]):
            return (
                "Para formar uma reserva ou atingir uma meta, mantenha uma taxa de poupanca consistente "
                "e revise gastos nao essenciais. Use a simulacao para ajustar prazo e valor mensal."
            )

        return (
            "Entendi sua pergunta. Posso ajudar com analise de perfil, indicadores, gastos, "
            "recomendacoes e simulacoes de poupanca. Qual desses topicos voce gostaria de explorar?"
        )


def get_llm_provider() -> LLMProvider:
    if not settings.enable_llm or not settings.llm_api_key:
        return FallbackTemplateProvider()
    if settings.llm_provider.lower() == "openai":
        return OpenAIProvider()
    return FallbackTemplateProvider()
