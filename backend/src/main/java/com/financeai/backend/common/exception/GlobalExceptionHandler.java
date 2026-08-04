package com.financeai.backend.common.exception;

import com.financeai.backend.rag.RagQueueOperationConflictException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.validation.FieldError;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @Value("${spring.profiles.active:local}")
    private String activeProfile;

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(ResourceNotFoundException ex, HttpServletRequest request) {
        return buildResponse(HttpStatus.NOT_FOUND, ex.getCode(), ex.getMessage(), request, null);
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiError> handleBusiness(BusinessException ex, HttpServletRequest request) {
        return buildResponse(HttpStatus.UNPROCESSABLE_ENTITY, ex.getCode(), ex.getMessage(), request, null);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiError> handleBadCredentials(BadCredentialsException ex, HttpServletRequest request) {
        return buildResponse(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Credenciais inválidas", request, null);
    }

    @ExceptionHandler(AuthenticationCredentialsNotFoundException.class)
    public ResponseEntity<ApiError> handleMissingAuthentication(AuthenticationCredentialsNotFoundException ex,
                                                                 HttpServletRequest request) {
        return buildResponse(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED",
            "Autenticação obrigatória", request, null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        return buildResponse(HttpStatus.FORBIDDEN, "ACCESS_DENIED",
            "Acesso negado", request, null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        Map<String, String> details = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String field = error instanceof FieldError fe ? fe.getField() : error.getObjectName();
            details.put(field, error.getDefaultMessage());
        });
        return buildResponse(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Dados de entrada inválidos", request, details);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException ex, HttpServletRequest request) {
        Map<String, String> details = new HashMap<>();
        ex.getConstraintViolations().forEach(v ->
            details.put(v.getPropertyPath().toString(), v.getMessage())
        );
        return buildResponse(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Dados de entrada inválidos", request, details);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> handleNoResource(NoResourceFoundException ex, HttpServletRequest request) {
        return buildResponse(HttpStatus.NOT_FOUND, "ENDPOINT_NOT_FOUND",
            "Endpoint não encontrado", request, null);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException ex,
                                                        HttpServletRequest request) {
        return buildResponse(HttpStatus.BAD_REQUEST, "INVALID_PARAMETER",
            "Parâmetro inválido: " + ex.getName(), request, null);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleUnreadableMessage(HttpMessageNotReadableException ex,
                                                             HttpServletRequest request) {
        return buildResponse(HttpStatus.BAD_REQUEST, "INVALID_JSON",
            "Corpo JSON inválido", request, null);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> handleMaxUploadSize(MaxUploadSizeExceededException ex,
                                                         HttpServletRequest request) {
        return buildResponse(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE",
            "O arquivo excede o tamanho máximo de 5 MB", request, null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleGeneric(Exception ex, HttpServletRequest request) {
        log.error("Erro inesperado em {}", request.getRequestURI(), ex);
        String message = "production".equalsIgnoreCase(activeProfile)
            ? "Erro interno do servidor"
            : ex.getMessage();
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", message, request, null);
    }

    @ExceptionHandler(EmailAlreadyExistsException.class)
    public ResponseEntity<ApiError> handleEmailAlreadyExists(EmailAlreadyExistsException ex,
                                                             HttpServletRequest request) {
        return buildResponse(HttpStatus.CONFLICT, ex.getCode(), ex.getMessage(), request, null);
    }

    @ExceptionHandler(RagQueueOperationConflictException.class)
    public ResponseEntity<ApiError> handleRagQueueConflict(RagQueueOperationConflictException ex,
                                                            HttpServletRequest request) {
        return buildResponse(HttpStatus.CONFLICT, "RAG_QUEUE_CONFLICT", ex.getMessage(), request, null);
    }

    private ResponseEntity<ApiError> buildResponse(HttpStatus status, String code, String message,
                                                   HttpServletRequest request, Map<String, String> details) {
        String traceId = UUID.randomUUID().toString();
        ApiError error = new ApiError(
            Instant.now(),
            status.value(),
            code,
            message,
            request.getRequestURI(),
            details,
            traceId
        );
        return ResponseEntity.status(status).body(error);
    }
}
