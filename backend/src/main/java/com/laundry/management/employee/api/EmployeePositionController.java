package com.laundry.management.employee.api;

import com.laundry.management.employee.application.EmployeePositionService;
import com.laundry.management.employee.application.EmployeeQueryService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/employee-positions")
public class EmployeePositionController {

    private final EmployeeQueryService queryService;
    private final EmployeePositionService positionService;

    public EmployeePositionController(
        EmployeeQueryService queryService,
        EmployeePositionService positionService
    ) {
        this.queryService = queryService;
        this.positionService = positionService;
    }

    @GetMapping
    public List<EmployeeDtos.PositionResponse> list(
        @RequestParam(defaultValue = "false") boolean includeInactive
    ) {
        return queryService.positions(includeInactive);
    }

    @PostMapping
    public ResponseEntity<EmployeeDtos.PositionResponse> create(
        @Valid @RequestBody EmployeeDtos.PositionCreateRequest request
    ) {
        EmployeeDtos.PositionResponse created = positionService.create(request);
        return ResponseEntity.created(URI.create("/api/employee-positions/" + created.id())).body(created);
    }

    @PatchMapping("/{positionId}")
    public EmployeeDtos.PositionResponse update(
        @PathVariable Long positionId,
        @Valid @RequestBody EmployeeDtos.PositionUpdateRequest request
    ) {
        return positionService.update(positionId, request);
    }
}
