package com.financeai.backend.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Constraint(validatedBy = EnumValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidEnum {

    Class<? extends Enum<?>> enumClass();

    String message() default "Valor inválido para o enum";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
