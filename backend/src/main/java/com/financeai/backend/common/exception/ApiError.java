package com.financeai.backend.common.exception;

import java.time.Instant;
import java.util.Map;

public record ApiError(
    Instant timestamp,
    int status,
    String code,
    String message,
    String path,
    Map<String, String> details,
    String traceId
) {

    public ApiError {
        if (timestamp == null) {
            timestamp = Instant.now();
        }
    }
}
