from app.schemas.profile import ProfileAnalyzeRequest, ProfileAnalyzeResponse
from app.profile_classifier.base import BaseProfileClassifier


class FallbackProfileClassifier(BaseProfileClassifier):
    name: str = "FallbackProfileClassifier"
    version: str = "FALLBACK"
    status: str = "FALLBACK"

    def predict(self, request: ProfileAnalyzeRequest) -> ProfileAnalyzeResponse:
        indicators = request.indicators
        factors: list[str] = []
        score = 100.0

        # Endividamento
        debt = request.debtLevelPercentage
        if debt >= 50:
            score -= 30
            factors.append("Nivel de endividamento elevado")
        elif debt >= 25:
            score -= 15
            factors.append("Nivel de endividamento moderado")

        # Comprometimento de renda
        income_commitment = indicators.incomeCommitmentPercentage
        if income_commitment >= 90:
            score -= 25
            factors.append("Renda muito comprometida")
        elif income_commitment >= 70:
            score -= 15
            factors.append("Renda comprometida")

        # Poupança
        savings = indicators.savingsRatePercentage
        if savings < 5:
            score -= 20
            factors.append("Baixa taxa de poupanca")
        elif savings < 10:
            score -= 10
            factors.append("Taxa de poupanca abaixo do ideal")

        # Reserva
        reserve = indicators.reserveInMonths
        if reserve < 1:
            score -= 20
            factors.append("Reserva de emergencia insuficiente")
        elif reserve < 3:
            score -= 10
            factors.append("Reserva de emergencia baixa")

        # Despesas fixas
        fixed = indicators.fixedExpensesPercentage
        if fixed >= 60:
            score -= 10
            factors.append("Despesas fixas elevadas")

        # Gastos não essenciais
        non_essential = indicators.nonEssentialExpensesPercentage
        if non_essential >= 50:
            score -= 10
            factors.append("Gastos nao essenciais altos")

        score = max(0.0, min(100.0, score))

        if score >= 70:
            classification = "SAUDAVEL"
            confidence = 0.75 + (score - 70) / 300
        elif score >= 45:
            classification = "EM_OBSERVACAO"
            confidence = 0.65
        else:
            classification = "EM_RISCO"
            confidence = 0.75 + (45 - score) / 220

        confidence = min(0.99, confidence)

        if not factors:
            factors.append("Indicadores financeiros equilibrados")

        return ProfileAnalyzeResponse(
            model_version=self.version,
            model_status=self.status,
            classification=classification,
            confidence=round(confidence, 2),
            score=round(score, 2),
            main_factors=factors,
        )
