from app.schemas.agent import AgentContext


def simulate_savings_plan(
    context: AgentContext,
    target_amount: float,
    months: int = 12,
) -> dict:
    profile = context.financial_profile
    income = profile.get("monthlyIncome", 0.0) or 0.0
    indicators = context.indicators
    current_rate = indicators.get("savingsRatePercentage", 0.0) or 0.0

    if income <= 0 or target_amount <= 0 or months <= 0:
        return {
            "tool": "simulate_savings_plan",
            "arguments": {"target_amount": target_amount, "months": months},
            "result": {
                "error": "Renda mensal, valor meta e prazo devem ser maiores que zero.",
            },
        }

    current_monthly_savings = income * (current_rate / 100.0)
    projected_total = current_monthly_savings * months
    recommended_monthly = target_amount / months
    recommended_rate = (recommended_monthly / income) * 100.0
    gap = max(0.0, target_amount - projected_total)

    return {
        "tool": "simulate_savings_plan",
        "arguments": {"target_amount": target_amount, "months": months},
        "result": {
            "monthly_income": income,
            "current_savings_rate": current_rate,
            "current_monthly_savings": round(current_monthly_savings, 2),
            "target_amount": target_amount,
            "months": months,
            "projected_total": round(projected_total, 2),
            "gap": round(gap, 2),
            "recommended_monthly_savings": round(recommended_monthly, 2),
            "recommended_savings_rate": round(recommended_rate, 2),
            "feasible": projected_total >= target_amount,
        },
    }
