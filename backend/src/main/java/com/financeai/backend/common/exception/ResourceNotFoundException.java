package com.financeai.backend.common.exception;

public class ResourceNotFoundException extends BusinessException {

    public ResourceNotFoundException(String resource, Object id) {
        super("RESOURCE_NOT_FOUND", resource + " não encontrado(a) com identificador: " + id);
    }
}
