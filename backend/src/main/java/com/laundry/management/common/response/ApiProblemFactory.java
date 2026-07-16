package com.laundry.management.common.response;

import com.laundry.management.common.exception.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class ApiProblemFactory {

    public ApiProblem create(
        HttpStatus status,
        ErrorCode errorCode,
        String title,
        String detail,
        HttpServletRequest request
    ) {
        return create(status, errorCode, title, detail, request, Map.of());
    }

    public ApiProblem create(
        HttpStatus status,
        ErrorCode errorCode,
        String title,
        String detail,
        HttpServletRequest request,
        Map<String, List<String>> fieldErrors
    ) {
        return new ApiProblem(
            "urn:laundry:error:" + errorCode.name().toLowerCase().replace('_', '-'),
            title,
            status.value(),
            detail,
            request.getRequestURI(),
            errorCode.name(),
            fieldErrors,
            Instant.now()
        );
    }
}
