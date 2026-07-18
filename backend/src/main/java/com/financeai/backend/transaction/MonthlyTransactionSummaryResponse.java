package com.financeai.backend.transaction;

import java.math.BigDecimal;
import java.time.YearMonth;

public record MonthlyTransactionSummaryResponse(
    YearMonth month,
    BigDecimal income,
    BigDecimal expense,
    BigDecimal balance
) {
}
