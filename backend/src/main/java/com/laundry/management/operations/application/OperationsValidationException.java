package com.laundry.management.operations.application;

import com.laundry.management.common.exception.*;
import org.springframework.http.HttpStatus;

public class OperationsValidationException extends ApiException {
    private final String field;
    private final String reason;
    public OperationsValidationException(String field, String reason) {
        super(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.OPERATIONS_VALIDATION_ERROR,
            "Invalid master data", "Check the indicated field.");
        this.field=field; this.reason=reason;
    }
    public String field() { return field; }
    public String reason() { return reason; }
}
