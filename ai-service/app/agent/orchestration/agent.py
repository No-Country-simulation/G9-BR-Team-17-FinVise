from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from app.agent import tools as tool_module
from app.agent.llm_provider import LLMProvider, get_llm_provider
from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.agent import AgentRequest, AgentResponse, RagSource, ToolCall
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
            "name": "get_monthly_rankings",
            "description": "Retorna os melhores e piores meses por saldo, renda e despesas.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_transaction_rankings",
            "description": "Retorna maiores e menores receitas e despesas, com filtro mensal.",
            "parameters": {
                "type": "object",
                "properties": {
                    "month": {"type": "integer", "minimum": 1, "maximum": 12},
                    "year": {"type": "integer"},
                },
                "required": [],
            },
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
        messages = [m.model_dump() for m in request.messages]
        from app.agent.rag_service import rag_service

        user_id = (
            str(request.user_id)
            if hasattr(request, "user_id") and request.user_id
            else (str(request.context.user_id) if hasattr(request.context, "user_id") and request.context.user_id else "")
        )
        last_query = request.messages[-1].content if request.messages else ""
        source_type = self._rag_source_type(request)
        top_k = request.context.retrieval.top_k
        source_ids = request.context.retrieval.source_ids

        # Parallel execution of tool calls and RAG vector context retrieval
        with ThreadPoolExecutor(max_workers=2) as executor:
            future_tools = executor.submit(self._execute_tools, request)
            future_rag = executor.submit(
                rag_service.retrieve_context,
                user_id,
                last_query,
                top_k,
                source_type,
                source_ids,
            )
            tool_calls = future_tools.result()
            rag_chunks = future_rag.result()

        # Format pre-computed tool metrics for token optimization and maximum precision
        tool_text = ""
        if tool_calls:
            formatted_tools = [f"- {tc.tool}: {tc.result}" for tc in tool_calls if tc.result]
            if formatted_tools:
                tool_text = "\n\n[MÉTRICAS E MODELOS PRÉ-CALCULADOS DO USUÁRIO]:\n" + "\n".join(formatted_tools)

        rag_text = self._format_rag_context(
            rag_chunks,
            self._has_tool_evidence(tool_calls),
        )

        effective_system_prompt = self.system_prompt + tool_text + rag_text

        try:
            completion = self.llm.complete(
                system_prompt=effective_system_prompt,
                messages=messages,
                tools=None,
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
            sources=self._rag_sources(rag_chunks),
            disclaimer=DISCLAIMER,
        )

    def respond_stream(self, request: AgentRequest):
        messages = [m.model_dump() for m in request.messages]
        from app.agent.rag_service import rag_service

        user_id = (
            str(request.user_id)
            if hasattr(request, "user_id") and request.user_id
            else (str(request.context.user_id) if hasattr(request.context, "user_id") and request.context.user_id else "")
        )
        last_query = request.messages[-1].content if request.messages else ""
        source_type = self._rag_source_type(request)
        top_k = request.context.retrieval.top_k
        source_ids = request.context.retrieval.source_ids

        # Parallel execution of tool calls and RAG vector context retrieval
        with ThreadPoolExecutor(max_workers=2) as executor:
            future_tools = executor.submit(self._execute_tools, request)
            future_rag = executor.submit(
                rag_service.retrieve_context,
                user_id,
                last_query,
                top_k,
                source_type,
                source_ids,
            )
            tool_calls = future_tools.result()
            rag_chunks = future_rag.result()

        yield {
            "type": "tools",
            "tools": [tool_call.tool for tool_call in tool_calls],
        }
        yield {
            "type": "sources",
            "sources": [
                source.model_dump() for source in self._rag_sources(rag_chunks)
            ],
        }

        tool_text = ""
        if tool_calls:
            formatted_tools = [f"- {tc.tool}: {tc.result}" for tc in tool_calls if tc.result]
            if formatted_tools:
                tool_text = "\n\n[MÉTRICAS E MODELOS PRÉ-CALCULADOS DO USUÁRIO]:\n" + "\n".join(formatted_tools)

        rag_text = self._format_rag_context(
            rag_chunks,
            self._has_tool_evidence(tool_calls),
        )

        effective_system_prompt = self.system_prompt + tool_text + rag_text

        generated_text = False
        for chunk in self.llm.stream_complete(
            system_prompt=effective_system_prompt,
            messages=messages,
            tools=None,
        ):
            if chunk and chunk.strip():
                generated_text = True
            yield {"type": "token", "token": chunk}

        if not generated_text:
            raise RuntimeError("O provedor de IA concluiu sem gerar texto")

    @staticmethod
    def _format_rag_context(
        rag_chunks: list[dict[str, Any]],
        has_tool_evidence: bool = False,
    ) -> str:
        if not rag_chunks:
            if has_tool_evidence:
                return (
                    "\n\n[CONTEXTO ANALÍTICO DETERMINÍSTICO]\n"
                    "Não houve chunk textual relevante, mas as ferramentas retornaram "
                    "fatos calculados diretamente das fontes selecionadas. Use esses fatos "
                    "como evidência numérica suficiente e não declare falta de dados."
                )
            return (
                "\n\n[CONTEXTO RAG RECUPERADO]\n"
                "Nenhuma evidência relevante foi encontrada nas fontes selecionadas. "
                "Informe claramente essa limitação e não complete lacunas por suposição."
            )
        chunks = []
        for index, chunk in enumerate(rag_chunks, start=1):
            source_name = chunk.get("source_name") or chunk.get("source_id") or "fonte"
            chunk_type = chunk.get("chunk_type", "DOCUMENT")
            score = chunk.get("score")
            score_label = f"{score:.2f}" if isinstance(score, (int, float)) else "n/d"
            chunks.append(
                f"[S{index}] fonte={source_name}; tipo={chunk_type}; "
                f"relevância={score_label}\n{chunk['content']}"
            )
        return (
            "\n\n[EVIDÊNCIAS RAG RECUPERADAS]\n"
            + "\n\n".join(chunks)
            + "\n\nUse [S1], [S2] etc. para citar toda afirmação baseada nesses dados."
        )

    @staticmethod
    def _has_tool_evidence(tool_calls: list[ToolCall]) -> bool:
        for tool_call in tool_calls:
            result = tool_call.result
            if isinstance(result, dict) and result.get("available") is False:
                continue
            if result:
                return True
        return False

    @staticmethod
    def _rag_sources(rag_chunks: list[dict[str, Any]]) -> list[RagSource]:
        return [
            RagSource(
                id=chunk["id"],
                source_id=chunk.get("source_id"),
                source_name=chunk.get("source_name"),
                chunk_type=chunk.get("chunk_type", "DOCUMENT"),
                score=chunk.get("score"),
            )
            for chunk in rag_chunks
        ]

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
                elif tool_name == "get_transaction_rankings":
                    arguments = self._extract_ranking_arguments(request)
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

    @staticmethod
    def _rag_source_type(request: AgentRequest) -> str | None:
        selected_source = request.context.financial_profile.source
        if not selected_source:
            return None

        source_mapping = {
            "CSV_IMPORT": "CSV_IMPORT",
            "OPEN_FINANCE_PLUGGY": "OPEN_FINANCE",
        }
        return source_mapping.get(str(selected_source).strip().upper())

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

    def _extract_ranking_arguments(self, request: AgentRequest) -> dict[str, Any]:
        import re as _re

        text = self._normalize_intent(
            request.messages[-1].content if request.messages else ""
        )
        month = next(
            (
                number
                for name, number in self._month_names().items()
                if _re.search(rf"\b{name}\b", text)
            ),
            None,
        )
        year_match = _re.search(r"\b(20\d{2})\b", text)
        return {
            "month": month,
            "year": int(year_match.group(1)) if year_match else None,
        }

    def _select_tools(self, request: AgentRequest) -> list[str]:
        last_message = self._normalize_intent(
            request.messages[-1].content if request.messages else ""
        )
        selected: list[str] = []
        ranking_terms = [
            "melhor",
            "pior",
            "maior",
            "maiores",
            "menor",
            "menores",
            "ranking",
            "top",
        ]
        transaction_terms = [
            "transacao",
            "transacoes",
            "receita",
            "receitas",
            "despesa",
            "despesas",
        ]
        month_terms = ["mes", "mensal", *self._month_names().keys()]
        is_ranking = any(term in last_message for term in ranking_terms)
        has_month_scope = any(term in last_message for term in month_terms)
        has_transaction_word = any(
            term in last_message for term in ["transacao", "transacoes"]
        )
        has_ranked_value = any(
            phrase in last_message
            for phrase in [
                "maior receita",
                "menor receita",
                "maior despesa",
                "menor despesa",
            ]
        )
        is_transaction_ranking = is_ranking and (
            has_transaction_word
            or has_ranked_value
            or (
                not has_month_scope
                and any(term in last_message for term in transaction_terms)
            )
        )
        is_month_ranking = is_ranking and has_month_scope and not is_transaction_ranking

        if is_transaction_ranking:
            selected.append("get_transaction_rankings")
        elif is_month_ranking:
            selected.append("get_monthly_rankings")

        if any(w in last_message for w in ["perfil", "situacao", "como estou"]):
            selected.extend(["get_financial_profile", "get_financial_indicators"])
        if any(w in last_message for w in ["indicador", "metrica", "numero"]):
            selected.append("get_financial_indicators")
        if not (is_transaction_ranking or is_month_ranking) and any(
            w in last_message for w in ["gasto", "despesa", "transacao"]
        ):
            selected.extend(["get_spending_summary", "get_transactions", "get_recurring_expenses"])
        if any(w in last_message for w in ["recomendacao", "dica", "sugestao", "melhorar"]):
            selected.append("get_recommendations")
        if "compar" in last_message or any(
            w in last_message for w in ["mes passado", "periodo", "evolucao"]
        ):
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

    @staticmethod
    def _normalize_intent(value: str) -> str:
        import unicodedata

        normalized = unicodedata.normalize("NFD", value.lower())
        return "".join(
            character
            for character in normalized
            if unicodedata.category(character) != "Mn"
        )

    @staticmethod
    def _month_names() -> dict[str, int]:
        return {
            "janeiro": 1,
            "fevereiro": 2,
            "marco": 3,
            "abril": 4,
            "maio": 5,
            "junho": 6,
            "julho": 7,
            "agosto": 8,
            "setembro": 9,
            "outubro": 10,
            "novembro": 11,
            "dezembro": 12,
        }


def get_agent() -> FinancialAgent:
    return FinancialAgent()
