package com.financeai.backend.auth;


public record GenericMessageResponse(String message) {

    public static GenericMessageResponse forgotPasswordDefault() {
        return new GenericMessageResponse(
                "Se o e-mail informado estiver cadastrado, você receberá um código de verificação em instantes."
        );
    }
}