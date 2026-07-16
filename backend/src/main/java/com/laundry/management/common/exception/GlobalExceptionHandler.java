package com.laundry.management.common.exception;

import com.laundry.management.common.response.ApiProblem;
import com.laundry.management.common.response.ApiProblemFactory;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private static final String SAFE_INTERNAL_DETAIL = "The request could not be completed.";

    private final ApiProblemFactory problemFactory;

    public GlobalExceptionHandler(ApiProblemFactory problemFactory) {
        this.problemFactory = problemFactory;
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiProblem> handleApiException(ApiException exception, HttpServletRequest request) {
        ApiProblem problem = problemFactory.create(
            exception.getStatus(),
            exception.getErrorCode(),
            exception.getTitle(),
            exception.getMessage(),
            request
        );
        return ResponseEntity.status(exception.getStatus()).body(problem);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiProblem> handleAccessDenied(
        AccessDeniedException exception,
        HttpServletRequest request
    ) {
        ApiProblem problem = problemFactory.create(
            HttpStatus.FORBIDDEN,
            ErrorCode.FORBIDDEN,
            "Permission denied",
            "You do not have permission to perform this action.",
            request
        );
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(problem);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiProblem> handleValidation(
        MethodArgumentNotValidException exception,
        HttpServletRequest request
    ) {
        Map<String, List<String>> fieldErrors = new LinkedHashMap<>();
        for (FieldError fieldError : exception.getBindingResult().getFieldErrors()) {
            fieldErrors.computeIfAbsent(fieldError.getField(), ignored -> new ArrayList<>())
                .add(fieldError.getDefaultMessage() == null ? "Invalid value" : fieldError.getDefaultMessage());
        }
        ApiProblem problem = problemFactory.create(
            HttpStatus.BAD_REQUEST,
            ErrorCode.VALIDATION_ERROR,
            "Validation failed",
            "One or more fields are invalid.",
            request,
            fieldErrors
        );
        return ResponseEntity.badRequest().body(problem);
    }

    @ExceptionHandler({ConstraintViolationException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<ApiProblem> handleMalformedRequest(Exception exception, HttpServletRequest request) {
        ApiProblem problem = problemFactory.create(
            HttpStatus.BAD_REQUEST,
            ErrorCode.VALIDATION_ERROR,
            "Validation failed",
            "The request contains an invalid value.",
            request
        );
        return ResponseEntity.badRequest().body(problem);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiProblem> handleIntegrityViolation(
        DataIntegrityViolationException exception,
        HttpServletRequest request
    ) {
        LOGGER.warn("Database constraint rejected request at {}", request.getRequestURI());
        ApiProblem problem = problemFactory.create(
            HttpStatus.CONFLICT,
            ErrorCode.VALIDATION_ERROR,
            "Request conflict",
            "The request conflicts with existing data.",
            request
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ApiProblem> handleOptimisticLock(
        ObjectOptimisticLockingFailureException exception,
        HttpServletRequest request
    ) {
        ApiProblem problem = problemFactory.create(
            HttpStatus.CONFLICT,
            ErrorCode.CUSTOMER_VERSION_CONFLICT,
            "Version conflict",
            "This record was updated by another user. Reload the latest data before saving again.",
            request
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiProblem> handleUnexpected(Exception exception, HttpServletRequest request) {
        LOGGER.error("Unhandled request failure at {}", request.getRequestURI(), exception);
        ApiProblem problem = problemFactory.create(
            HttpStatus.INTERNAL_SERVER_ERROR,
            ErrorCode.INTERNAL_ERROR,
            "Internal server error",
            SAFE_INTERNAL_DETAIL,
            request
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(problem);
    }
}
