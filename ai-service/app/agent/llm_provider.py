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
        lower = user_message.lower()
        rag_context = ""
        tool_context = ""

        if "[CONTEXTO RAG RECUPERADO DO BANCO VETORIAL DO USUARIO]:" in system_prompt:
            rag_context = system_prompt.split("[CONTEXTO RAG RECUPERADO DO BANCO VETORIAL DO USUARIO]:")[-1].strip()

        if "[MÉTRICAS E MODELOS PRÉ-CALCULADOS DO USUÁRIO]:" in system_prompt:
            tool_context = system_prompt.split("[MÉTRICAS E MODELOS PRÉ-CALCULADOS DO USUÁRIO]:")[1].split("[CONTEXTO RAG")[0].strip()

        # Resposta inteligente combinada sem emojis
        response_parts = []

        if rag_context:
            response_parts.append(f"**Dados do Histórico Financeiro (RAG)**:\n{rag_context}")

        if tool_context:
            response_parts.append(f"**Métricas e Indicadores Calculados**:\n{tool_context}")

        if any(word in lower for word in ["pior", "piores", "mes", "meses", "alto", "maior"]):
            response_parts.append("\n**Análise de Meses e Gastos Elevados**:\nCom base no seu histórico e categorias analisadas, recomendamos focar na redução de despesas variáveis não essenciais que apresentaram picos de gastos.")
        elif any(word in lower for word in ["saude", "saúde", "situacao", "situação", "como estou"]):
            response_parts.append("\n**Diagnóstico de Saúde Financeira**:\nSeus indicadores mostram a relação entre sua receita total, gastos e taxa de comprometimento. Mantenha sua taxa de poupança acima de 20% para garantir estabilidade.")
        elif any(word in lower for word in ["poupan", "economizar", "meta", "simular", "juntar"]):
            response_parts.append("\n**Estratégia de Poupança**:\nRecomendamos separar pelo menos 15% a 20% da sua receita mensal logo após o recebimento para construir sua reserva de emergência.")
        elif any(word in lower for word in ["divida", "dívida", "endividamento"]):
            response_parts.append("\n**Plano de Quitação de Dívidas**:\nPriorize o pagamento de modalidades com maiores juros nominais e evite novos parcelamentos até estabilizar seu saldo.")
        else:
            response_parts.append("\n**Análise Personalizada**:\nEstou à disposição para responder dúvidas específicas sobre seus extratos importados, calcular simuladores de reserva ou analisar seus piores meses de gastos.")

        return "\n\n".join(response_parts)


def get_llm_provider() -> LLMProvider:
    if not settings.enable_llm or not settings.llm_api_key:
        return FallbackTemplateProvider()
    if settings.llm_provider.lower() == "openai":
        return OpenAIProvider()
    return FallbackTemplateProvider()
