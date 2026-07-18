from app.schemas.profile import ProfileAnalyzeRequest, ProfileIndicators


class RecommendationEngine:
    def recommend(self, request: ProfileAnalyzeRequest) -> list[dict]:
        indicators = request.indicators
        recommendations: list[dict] = []

        if indicators.savingsRatePercentage < 5:
            recommendations.append(
                {
                    "category": "POUPANCA",
                    "priority": "HIGH",
                    "message": "Aumente sua taxa de poupanca; idealmente guarde pelo menos 10% da renda.",
                }
            )

        if request.debtLevelPercentage >= 40:
            recommendations.append(
                {
                    "category": "DIVIDAS",
                    "priority": "HIGH",
                    "message": "Priorize a quitação de dividas de juros altos antes de novos gastos.",
                }
            )

        if indicators.incomeCommitmentPercentage >= 80:
            recommendations.append(
                {
                    "category": "ORCAMENTO",
                    "priority": "HIGH",
                    "message": "Seu comprometimento de renda está alto. Reveja despesas fixas e nao essenciais.",
                }
            )

        if indicators.reserveInMonths < 3:
            recommendations.append(
                {
                    "category": "RESERVA",
                    "priority": "MEDIUM",
                    "message": "Construa uma reserva de emergencia equivalente a pelo menos 3 meses de despesas.",
                }
            )

        if indicators.nonEssentialExpensesPercentage >= 40:
            recommendations.append(
                {
                    "category": "GASTOS",
                    "priority": "MEDIUM",
                    "message": "Reduza gastos nao essenciais para melhorar a margem de poupanca.",
                }
            )

        if not recommendations:
            recommendations.append(
                {
                    "category": "SAUDE_FINANCEIRA",
                    "priority": "LOW",
                    "message": "Seus indicadores estão equilibrados. Continue acompanhando seu orcamento.",
                }
            )

        return recommendations

    def simulate_savings_plan(
        self,
        monthly_income: float,
        current_savings_rate: float,
        target_amount: float,
        months: int,
    ) -> dict:
        if months <= 0:
            months = 12
        current_monthly_savings = monthly_income * (current_savings_rate / 100.0)
        projected_total = current_monthly_savings * months
        gap = max(0.0, target_amount - projected_total)
        recommended_monthly_savings = target_amount / months
        recommended_rate = (recommended_monthly_savings / monthly_income) * 100.0 if monthly_income else 0.0

        return {
            "monthly_income": monthly_income,
            "current_savings_rate": current_savings_rate,
            "current_monthly_savings": round(current_monthly_savings, 2),
            "target_amount": target_amount,
            "months": months,
            "projected_total": round(projected_total, 2),
            "gap": round(gap, 2),
            "recommended_monthly_savings": round(recommended_monthly_savings, 2),
            "recommended_savings_rate": round(recommended_rate, 2),
            "feasible": projected_total >= target_amount,
        }


def get_recommendation_engine() -> RecommendationEngine:
    return RecommendationEngine()
