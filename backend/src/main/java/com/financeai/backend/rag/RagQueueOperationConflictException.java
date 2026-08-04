package com.financeai.backend.rag;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.CONFLICT)
public class RagQueueOperationConflictException extends RuntimeException {

    public RagQueueOperationConflictException(String message) {
        super(message);
    }
}
