from app.schemas.agent import AgentContext


def get_monthly_rankings(context: AgentContext) -> dict:
    facts = context.analytical_facts
    rankings = facts.get("month_rankings", {})
    return {
        "tool": "get_monthly_rankings",
        "result": {
            "available": bool(rankings),
            "scope": facts.get("scope", {}),
            "rankings": rankings,
            "months": facts.get("months", []),
            "criteria": {
                "best_month": "highest_balance",
                "worst_month": "lowest_balance",
                "highest_spending": "highest_expense",
                "lowest_spending": "lowest_expense",
            },
        },
    }


def get_transaction_rankings(
    context: AgentContext,
    month: int | None = None,
    year: int | None = None,
) -> dict:
    facts = context.analytical_facts
    transaction_facts = facts.get("transaction_rankings", {})
    if month is None and year is None:
        result = transaction_facts.get("overall", {})
        periods: list[dict] = []
    else:
        periods = [
            period
            for period in transaction_facts.get("by_month", [])
            if _matches_period(period.get("period", ""), month, year)
        ]
        result = {}

    return {
        "tool": "get_transaction_rankings",
        "arguments": {"month": month, "year": year},
        "result": {
            "available": bool(result or periods),
            "scope": facts.get("scope", {}),
            "period_filter": {"month": month, "year": year},
            "overall": result,
            "periods": periods,
            "interpretation": {
                "best_income": "largest_incomes",
                "lowest_expense": "smallest_expenses",
                "highest_expense": "largest_expenses",
            },
        },
    }


def _matches_period(period: str, month: int | None, year: int | None) -> bool:
    try:
        period_year, period_month = (int(part) for part in period.split("-", maxsplit=1))
    except (TypeError, ValueError):
        return False
    if month is not None and period_month != month:
        return False
    if year is not None and period_year != year:
        return False
    return True
