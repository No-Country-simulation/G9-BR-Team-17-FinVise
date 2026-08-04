package com.financeai.backend.indicator;

import java.math.BigDecimal;
import java.util.UUID;

public interface SpendingSummaryView {
    UUID getAnalysisId();
    String getCategoryCode();
    BigDecimal getAmount();
    BigDecimal getPercentage();
}
