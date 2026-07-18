package com.financeai.backend.openfinance;

public record OpenFinanceConnectTokenResponse(
    String accessToken,
    String provider,
    boolean includeSandbox
) {
}
