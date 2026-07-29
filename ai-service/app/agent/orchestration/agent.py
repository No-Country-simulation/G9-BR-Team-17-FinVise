from pathlib import Path
from typing import Any

from app.agent import tools as tool_module
from app.agent.llm_provider import LLMProvider, get_llm_provider
from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.agent import AgentRequest, AgentResponse, ToolCall
from app.schemas.common import Message

logger = get_logger(__name__)

DISCLAIMER = (
    "Esta resposta possui carater educacional e nao constitui aconselhamento financeiro, "
    "investimento ou recomendacao personalizada de produtos. Consulte um profissional qualificado "
    "para decisoes financeiras importantes."
)

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_financial_profile",
            "description": "Retorna o perfil financeiro do usuario.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_financial_indicators",
            "description": "Retorna indicadores financeiros do mes atual.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_spending_summary",
            "description": "Retorna o resumo dos gastos.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_transactions",
            "description": "Retorna transacoes recentes.",
            "parameters": {
                "type": "object",
                "properties": {"limit": {"type": "integer", "default": 10}},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_recommendations",
            "description": "Retorna recomendacoes financeiras.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_periods",
            "description": "Compara indicadores do periodo atual com o anterior.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_recurring_expenses",
            "description": "Retorna despesas recorrentes.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "simulate_savings_plan",
            "description": "Simula um plano de poupanca.",
            "parameters": {
                "type": "object",
                "properties": {
                    "target_amount": {"type": "number"},
                    "months": {"type": "integer", "default": 12},
                },
                "required": ["target_amount"],
            },
        },
    },
]


class FinancialAgent:
    def __init__(self, llm_provider: LLMProvider | None = None):
        self.llm = llm_provider or get_llm_provider()
        self.system_prompt = self._load_system_prompt()

    def _load_system_prompt(self) -> str:
        path = Path(settings.agent_system_prompt_path)
        if path.exists():
            return path.read_text(encoding="utf-8")
        return "Voce e um assistente financeiro educacional. Use apenas dados fornecidos."

    def respond(self, request: AgentRequest) -> AgentResponse:
        tool_calls = self._execute_tools(request)
        messages = [m.model_dump() for m in request.messages]

        from app.agent.rag_service import rag_service

        user_id = str(request.context.user_id) if hasattr(request.context, "user_id") and request.context.user_id else ""
        last_query = request.messages[-1].content if request.messages else ""
        rag_chunks = rag_service.retrieve_context(user_id, last_query)

        # Format pre-computed tool metrics for token optimization and maximum precision
        tool_text = ""
        if tool_calls:
            formatted_tools = [f"- {tc.tool}: {tc.result}" for tc in tool_calls if tc.result]
            if formatted_tools:
                tool_text = "\n\n[MÉTRICAS E MODELOS PRÉ-CALCULADOS DO USUÁRIO]:\n" + "\n".join(formatted_tools)

        if rag_chunks:
            chunks_formatted = "\n".join([f"- {c['content']}" for c in rag_chunks])
            rag_text = f"\n\n[CONTEXTO RAG RECUPERADO DO BANCO VETORIAL DO USUARIO]:\n{chunks_formatted}"
        else:
            rag_text = "\n\n[CONTEXTO RAG RECUPERADO]: Nenhuma transacao ou extrato encontrado no banco vetorial RAG para este usuario."

        effective_system_prompt = self.system_prompt + tool_text + rag_text

        try:
            completion = self.llm.complete(
                system_prompt=effective_system_prompt,
                messages=messages,
                tools=TOOL_DEFINITIONS,
            )
            content = completion["choices"][0]["message"].get("content", "")
        except Exception as exc:  # noqa: BLE001
            logger.error("LLM call failed: %s", exc)
            content = (
                "Nao foi possivel gerar uma resposta automatizada no momento. "
                "Por favor, tente novamente mais tarde."
            )

        return AgentResponse(
            message=Message(role="assistant", content=content),
            tool_calls=tool_calls,
            disclaimer=DISCLAIMER,
        )

    def respond_stream(self, request: AgentRequest):
        tool_calls = self._execute_tools(request)
        messages = [m.model_dump() for m in request.messages]

        from app.agent.rag_service import rag_service

        user_id = str(request.context.user_id) if hasattr(request.context, "user_id") and request.context.user_id else ""
        last_query = request.messages[-1].content if request.messages else ""
        rag_chunks = rag_service.retrieve_context(user_id, last_query)

        tool_text = ""
        if tool_calls:
            formatted_tools = [f"- {tc.tool}: {tc.result}" for tc in tool_calls if tc.result]
            if formatted_tools:
                tool_text = "\n\n[MÉTRICAS E MODELOS PRÉ-CALCULADOS DO USUÁRIO]:\n" + "\n".join(formatted_tools)

        if rag_chunks:
            chunks_formatted = "\n".join([f"- {c['content']}" for c in rag_chunks])
            rag_text = f"\n\n[CONTEXTO RAG RECUPERADO DO BANCO VETORIAL DO USUARIO]:\n{chunks_formatted}"
        else:
            rag_text = "\n\n[CONTEXTO RAG RECUPERADO]: Nenhuma transacao ou extrato encontrado no banco vetorial RAG para este usuario."

        effective_system_prompt = self.system_prompt + tool_text + rag_text

        for chunk in self.llm.stream_complete(
            system_prompt=effective_system_prompt,
            messages=messages,
            tools=TOOL_DEFINITIONS,
        ):
            yield chunk

    def _execute_tools(self, request: AgentRequest) -> list[ToolCall]:
        executed: list[ToolCall] = []
        tool_names = self._select_tools(request)

        for tool_name in tool_names:
            func = getattr(tool_module, tool_name, None)
            if func is None:
                continue
            try:
                arguments: dict[str, Any] = {}
                if tool_name == "simulate_savings_plan":
                    arguments = self._extract_savings_arguments(request)
                    result = func(request.context, **arguments)
                elif tool_name == "get_transactions":
                    arguments = {"limit": 10}
                    result = func(request.context, **arguments)
                else:
                    result = func(request.context)
                executed.append(
                    ToolCall(tool=tool_name, arguments=arguments, result=result.get("result", result))
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Tool %s failed: %s", tool_name, exc)
        return executed

    def _extract_savings_arguments(self, request: AgentRequest) -> dict[str, Any]:
        import re as _re

        text = request.messages[-1].content if request.messages else ""
        matches = _re.findall(r"[R$]?\s*(\d+(?:[.,]\d+)?)", text)
        target = 10000.0
        for m in matches:
            value = float(m.replace(".", "").replace(",", "."))
            if value > target:
                target = value
        months = 12
        if "mes" in text.lower():
            month_matches = _re.findall(r"(\d+)\s*mes(?:es)?", text.lower())
            if month_matches:
                months = int(month_matches[0])
        return {"target_amount": target, "months": months}

    def _select_tools(self, request: AgentRequest) -> list[str]:
        last_message = request.messages[-1].content.lower() if request.messages else ""
        selected: list[str] = []

        if any(w in last_message for w in ["perfil", "situacao", "como estou"]):
            selected.extend(["get_financial_profile", "get_financial_indicators"])
        if any(w in last_message for w in ["indicador", "metrica", "numero"]):
            selected.append("get_financial_indicators")
        if any(w in last_message for w in ["gasto", "despesa", "transacao"]):
            selected.extend(["get_spending_summary", "get_transactions", "get_recurring_expenses"])
        if any(w in last_message for w in ["recomendacao", "dica", "sugestao", "melhorar"]):
            selected.append("get_recommendations")
        if any(w in last_message for w in ["comparar", "mes passado", "periodo", "evolucao"]):
            selected.append("compare_periods")
        if any(w in last_message for w in ["recorrente", "assinatura", "fixa"]):
            selected.append("get_recurring_expenses")
        if any(w in last_message for w in ["poupanca", "economizar", "meta", "simular", "juntar"]):
            selected.append("simulate_savings_plan")

        # Default set if no intent matched
        if not selected:
            selected = [
                "get_financial_profile",
                "get_financial_indicators",
                "get_recommendations",
            ]
        return list(dict.fromkeys(selected))


def get_agent() -> FinancialAgent:
    return FinancialAgent()
