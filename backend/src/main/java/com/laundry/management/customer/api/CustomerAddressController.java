package com.laundry.management.customer.api;

import com.laundry.management.customer.application.CustomerAddressService;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/customers/{customerId}/addresses")
public class CustomerAddressController {

    private final CustomerAddressService addressService;

    public CustomerAddressController(CustomerAddressService addressService) {
        this.addressService = addressService;
    }

    @GetMapping
    public List<CustomerAddressResponse> list(
        @PathVariable Long customerId,
        @RequestHeader(value = "X-Branch-Id", required = false) Long branchId
    ) {
        return addressService.list(customerId, branchId);
    }

    @PostMapping
    public ResponseEntity<CustomerAddressResponse> create(
        @PathVariable Long customerId,
        @RequestHeader(value = "X-Branch-Id", required = false) Long branchId,
        @Valid @RequestBody CustomerAddressCreateRequest request
    ) {
        CustomerAddressResponse created = addressService.create(customerId, branchId, request);
        return ResponseEntity.created(URI.create(
            "/api/customers/" + customerId + "/addresses/" + created.id()
        )).body(created);
    }

    @PutMapping("/{addressId}")
    public CustomerAddressResponse update(
        @PathVariable Long customerId,
        @PathVariable Long addressId,
        @RequestHeader(value = "X-Branch-Id", required = false) Long branchId,
        @Valid @RequestBody CustomerAddressUpdateRequest request
    ) {
        return addressService.update(customerId, addressId, branchId, request);
    }

    @PatchMapping("/{addressId}/default")
    public CustomerAddressResponse setDefault(
        @PathVariable Long customerId,
        @PathVariable Long addressId,
        @RequestHeader(value = "X-Branch-Id", required = false) Long branchId,
        @Valid @RequestBody CustomerAddressVersionRequest request
    ) {
        return addressService.setDefault(customerId, addressId, branchId, request);
    }

    @PatchMapping("/{addressId}/status")
    public CustomerAddressResponse changeStatus(
        @PathVariable Long customerId,
        @PathVariable Long addressId,
        @RequestHeader(value = "X-Branch-Id", required = false) Long branchId,
        @Valid @RequestBody CustomerAddressStatusRequest request
    ) {
        return addressService.changeStatus(customerId, addressId, branchId, request);
    }
}
