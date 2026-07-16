package com.laundry.management.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.common.response.ApiProblem;
import com.laundry.management.common.response.ApiProblemFactory;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

@Component
public class ApiAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper;
    private final ApiProblemFactory problemFactory;

    public ApiAccessDeniedHandler(ObjectMapper objectMapper, ApiProblemFactory problemFactory) {
        this.objectMapper = objectMapper;
        this.problemFactory = problemFactory;
    }

    @Override
    public void handle(
        HttpServletRequest request,
        HttpServletResponse response,
        AccessDeniedException accessDeniedException
    ) throws IOException, ServletException {
        ApiProblem problem = problemFactory.create(
            HttpStatus.FORBIDDEN,
            ErrorCode.FORBIDDEN,
            "Permission denied",
            "You do not have permission to perform this action.",
            request
        );
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), problem);
    }
}
