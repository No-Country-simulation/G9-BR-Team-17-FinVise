package com.financeai.backend.openfinance;

public record OpenFinanceStatusResponse(
    boolean configured,
    String provider,
    boolean includeSandbox
) {
}
