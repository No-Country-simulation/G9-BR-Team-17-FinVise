package com.financeai.backend.integration.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.util.List;

public record TransactionClassificationRequest(
    List<TransactionPayload> items
) {

    public record TransactionPayload(
        String description,
        BigDecimal amount,
        @JsonProperty("payment_method") String paymentMethod,
        Boolean recurrent,
        String channel
    ) {
        public TransactionPayload {
            paymentMethod = paymentMethod != null ? paymentMethod : "";
            recurrent = recurrent != null ? recurrent : false;
            channel = channel != null ? channel : "";
        }
    }
}
