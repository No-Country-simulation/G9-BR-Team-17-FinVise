package com.financeai.backend.agent;

public class AgentIdempotencyConflictException extends RuntimeException {
    public AgentIdempotencyConflictException(String message) {
        super(message);
    }
}
