import json
import re
from typing import Any

from app.agent.llm_provider import get_llm_provider
from app.core.config import settings
from app.core.logging import get_logger
from app.recommendations.rules import RecommendationEngine as FallbackRuleEngine
from app.schemas.recommendation import (
    RecommendationGenerateRequest,
    RecommendationGenerateResponse,
    RecommendationItem,
)

logger = get_logger(__name__)

SYSTEM_PROMPT = """Voce e um especialista em planejamento financeiro pessoal.
Analise a situacao financeira detalhada do usuario e responda APENAS um objeto JSON.

Regras de Categorias:
Use APENAS uma das seguintes categorias em portugues no campo 'category':
- "DIVIDAS" (para dividas, emprestimos, cartao)
- "RESERVA" (para reserva de emergencia)
- "POUPANCA" (para poupanca e investimentos)
- "ORCAMENTO" (para controle de gastos e orcamento geral)
- "LAZER" (para gastos nao essenciais)
- "MORADIA" (para custos fixos habitacionais)
- "ALIMENTACAO" (para mercado e alimentacao)
- "SERVICOS" (para assinaturas e contas)

EXEMPLO DE RESPOSTA JSON:
{
  "recommendations": [
    {
      "title": "Reduzir endividamento",
      "description": "Seu endividamento e de 45%. Priorize quitar dividas mais caras.",
      "reason": "Endividamento elevado",
      "priority": "CRITICAL",
      "category": "DIVIDAS",
      "impact": "Reducao de juros",
      "suggestedAmount": null,
      "relatedIndicator": "debtLevelPercentage"
    }
  ]
}
"""

CATEGORY_TRANSLATION_MAP = {
    "DEBT": "DIVIDAS",
    "EMERGENCY": "RESERVA",
    "SAVINGS": "POUPANCA",
    "PATRIMONIO": "POUPANCA",
    "BUDGET": "ORCAMENTO",
    "HOUSING": "MORADIA",
    "FOOD": "ALIMENTACAO",
    "SERVICES": "SERVICOS",
    "LEISURE": "LAZER",
}


class AiRecommendationEngine:
    def __init__(self) -> None:
        self.fallback_engine = FallbackRuleEngine()

    def generate(self, request: RecommendationGenerateRequest) -> RecommendationGenerateResponse:
        if settings.enable_llm and settings.llm_api_key:
            try:
                items = self._generate_with_llm(request)
                if items:
                    return RecommendationGenerateResponse(
                        source="LLM",
                        recommendations=items,
                    )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Falha na geracao de recomendacoes via LLM, acionando fallback por regras: %s", exc)

        # Fallback para regras determinísticas
        fallback_items = self._generate_fallback(request)
        return RecommendationGenerateResponse(
            source="RULES_FALLBACK",
            recommendations=fallback_items,
        )

    def _generate_with_llm(self, request: RecommendationGenerateRequest) -> list[RecommendationItem]:
        llm = get_llm_provider()
        user_data = {
            "monthlyIncome": request.monthlyIncome,
            "debtLevelPercentage": request.debtLevelPercentage,
            "incomeCommitmentPercentage": request.indicators.incomeCommitmentPercentage,
            "savingsRatePercentage": request.indicators.savingsRatePercentage,
            "fixedExpensesPercentage": request.indicators.fixedExpensesPercentage,
            "nonEssentialExpensesPercentage": request.indicators.nonEssentialExpensesPercentage,
            "recurringExpensesCount": request.indicators.recurringExpensesCount,
            "reserveInMonths": request.indicators.reserveInMonths,
        }
        if request.spendingByCategory:
            user_data["spendingByCategory"] = request.spendingByCategory

        user_message = f"Dados do usuario: {json.dumps(user_data, ensure_ascii=False)}"

        result = llm.complete(
            system_prompt=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        content = ""
        if "choices" in result and result["choices"]:
            content = result["choices"][0].get("message", {}).get("content", "")

        if not content:
            return []

        raw_json = content.strip()
        if "```json" in content:
            raw_json = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            raw_json = content.split("```")[1].split("```")[0].strip()

        recs_data: list[Any] = []
        try:
            parsed = json.loads(raw_json)
            if isinstance(parsed, dict):
                recs_data = parsed.get("recommendations", [])
            elif isinstance(parsed, list):
                recs_data = parsed
        except Exception:  # noqa: BLE001
            # Tentar extrair objetos JSON individuais com regex caso o JSON esteja incompleto
            pattern = r'\{\s*"title"\s*:\s*"[^"]+".*?\}'
            matches = re.findall(pattern, raw_json, re.DOTALL)
            for m in matches:
                try:
                    recs_data.append(json.loads(m))
                except Exception:  # noqa: BLE001
                    continue

        items: list[RecommendationItem] = []
        for raw_item in recs_data:
            try:
                if isinstance(raw_item, str):
                    items.append(
                        RecommendationItem(
                            title=raw_item,
                            description=raw_item,
                            reason="Recomendação gerada com base no seu perfil financeiro",
                            priority="HIGH" if request.debtLevelPercentage >= 40 else "MEDIUM",
                            category="ORCAMENTO",
                            impact="Melhoria da saúde financeira geral",
                            suggestedAmount=None,
                            relatedIndicator="",
                        )
                    )
                elif isinstance(raw_item, dict):
                    priority = str(raw_item.get("priority", "MEDIUM")).upper()
                    if priority not in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
                        priority = "MEDIUM"

                    raw_category = str(raw_item.get("category", "ORCAMENTO")).upper().strip()
                    category = CATEGORY_TRANSLATION_MAP.get(raw_category, raw_category)

                    items.append(
                        RecommendationItem(
                            title=str(raw_item.get("title", "Recomendação Financeira")),
                            description=str(raw_item.get("description", raw_item.get("title", ""))),
                            reason=str(raw_item.get("reason", "Análise de perfil financeiro")),
                            priority=priority,
                            category=category,
                            impact=str(raw_item.get("impact", "Melhoria do orçamento")),
                            suggestedAmount=raw_item.get("suggestedAmount") if isinstance(raw_item.get("suggestedAmount"), (int, float)) else None,
                            relatedIndicator=str(raw_item.get("relatedIndicator", "")),
                        )
                    )
            except Exception as item_err:  # noqa: BLE001
                logger.warning("Ignorando item invalido de recomendacao LLM: %s", item_err)
                continue

        return items

    def _generate_fallback(self, request: RecommendationGenerateRequest) -> list[RecommendationItem]:
        from app.schemas.profile import ProfileAnalyzeRequest

        profile_req = ProfileAnalyzeRequest(
            monthlyIncome=request.monthlyIncome,
            debtLevelPercentage=request.debtLevelPercentage,
            savingFrequency=request.savingFrequency,
            financialReserve=request.financialReserve,
            indicators=request.indicators,
        )
        rule_recs = self.fallback_engine.recommend(profile_req)
        items: list[RecommendationItem] = []
        for r in rule_recs:
            priority = r.get("priority", "MEDIUM")
            if priority == "HIGH" and (
                request.debtLevelPercentage >= 40 or request.indicators.incomeCommitmentPercentage >= 80
            ):
                priority = "CRITICAL"
            items.append(
                RecommendationItem(
                    title=r.get("message", "").split(";")[0],
                    description=r.get("message", ""),
                    reason=f"Indicador {r.get('category', '')} necessita de atencao",
                    priority=priority,
                    category=r.get("category", "ORCAMENTO"),
                    impact="Melhoria na saude financeira e seguranca do orcamento",
                    suggestedAmount=None,
                    relatedIndicator=r.get("category", "").lower(),
                )
            )
        return items


def get_ai_recommendation_engine() -> AiRecommendationEngine:
    return AiRecommendationEngine()
