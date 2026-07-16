package com.laundry.management.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record ApiProblem(
    String type,
    String title,
    int status,
    String detail,
    String instance,
    String errorCode,
    Map<String, List<String>> fieldErrors,
    Instant timestamp
) {
}
