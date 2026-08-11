from pydantic import BaseModel, ConfigDict, Field


class ProfileIndicators(BaseModel):
    incomeCommitmentPercentage: float
    savingsRatePercentage: float
    fixedExpensesPercentage: float
    nonEssentialExpensesPercentage: float
    recurringExpensesCount: int = Field(..., ge=0)
    transactionsExpenseCount: int = Field(..., ge=0)
    expenseVariationPercentage: float
    reserveInMonths: float


class ProfileAnalyzeRequest(BaseModel):
    model: str = "MACHINE_LEARNING"
    monthlyIncome: float = Field(..., gt=0)
    debtLevelPercentage: float = Field(..., ge=0.0, le=100.0)
    savingFrequency: str = ""
    financialReserve: float = Field(default=0.0)
    indicators: ProfileIndicators


class ProfileAnalyzeResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_version: str
    model_status: str
    classification: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    score: float
    main_factors: list[str]
