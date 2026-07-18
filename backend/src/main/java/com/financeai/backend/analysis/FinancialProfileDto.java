package com.financeai.backend.analysis;

import java.math.BigDecimal;
import java.util.List;

public record FinancialProfileDto(
    String classification,
    BigDecimal score,
    BigDecimal confidence,
    List<String> mainFactors
) {
}
