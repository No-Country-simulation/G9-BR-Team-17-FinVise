package com.financeai.backend.transaction;

import java.math.BigDecimal;

public record CategorySpendingResponse(String category, BigDecimal amount) {
}
