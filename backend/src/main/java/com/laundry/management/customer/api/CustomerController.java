package com.laundry.management.customer.api;

import com.laundry.management.customer.application.CustomerQueryService;
import com.laundry.management.customer.application.CustomerService;
import com.laundry.management.customer.domain.CustomerSource;
import com.laundry.management.customer.domain.CustomerStatus;
import com.laundry.management.customer.domain.CustomerType;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerQueryService queryService;
    private final CustomerService customerService;

    public CustomerController(CustomerQueryService queryService, CustomerService customerService) {
        this.queryService = queryService;
        this.customerService = customerService;
    }

    @GetMapping
    public CustomerListResponse list(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) CustomerStatus status,
        @RequestParam(required = false) CustomerType customerType,
        @RequestParam(required = false) CustomerSource source,
        @RequestParam(required = false) String sort,
        @RequestParam(required = false) Long branchId
    ) {
        return queryService.list(
            page,
            size,
            search,
            status,
            customerType,
            source,
            sort == null ? List.of() : List.of(sort),
            branchId
        );
    }

    @GetMapping("/{customerId}")
    public CustomerDetailResponse get(
        @PathVariable Long customerId,
        @RequestHeader(value = "X-Branch-Id", required = false) Long branchId
    ) {
        return queryService.get(customerId, branchId);
    }

    @PostMapping
    public ResponseEntity<CustomerDetailResponse> create(@Valid @RequestBody CustomerCreateRequest request) {
        CustomerDetailResponse created = customerService.create(request);
        return ResponseEntity.created(URI.create("/api/customers/" + created.id())).body(created);
    }

    @PutMapping("/{customerId}")
    public CustomerDetailResponse update(
        @PathVariable Long customerId,
        @RequestHeader(value = "X-Branch-Id", required = false) Long branchId,
        @Valid @RequestBody CustomerUpdateRequest request
    ) {
        return customerService.update(customerId, branchId, request);
    }

    @PatchMapping("/{customerId}/status")
    public CustomerDetailResponse changeStatus(
        @PathVariable Long customerId,
        @RequestHeader(value = "X-Branch-Id", required = false) Long branchId,
        @Valid @RequestBody CustomerStatusRequest request
    ) {
        return customerService.changeStatus(customerId, branchId, request);
    }
}
