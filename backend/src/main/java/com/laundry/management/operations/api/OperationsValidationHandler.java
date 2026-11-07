package com.laundry.management.operations.api;

import com.laundry.management.operations.application.OperationsValidationException;
import com.laundry.management.common.response.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class OperationsValidationHandler {
    private final ApiProblemFactory problems;
    public OperationsValidationHandler(ApiProblemFactory problems) { this.problems=problems; }
    @ExceptionHandler(OperationsValidationException.class)
    public ResponseEntity<ApiProblem> invalid(OperationsValidationException e, HttpServletRequest request) {
        return ResponseEntity.unprocessableEntity().body(problems.create(e.getStatus(),e.getErrorCode(),e.getTitle(),e.getMessage(),request,
            Map.of(e.field(),List.of(e.reason()))));
    }
}
