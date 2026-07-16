package com.laundry.management.customer.api;

import com.laundry.management.customer.application.CustomerActivityService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/customers/{customerId}/activities")
public class CustomerActivityController {

    private final CustomerActivityService activityService;

    public CustomerActivityController(CustomerActivityService activityService) {
        this.activityService = activityService;
    }

    @GetMapping
    public CustomerActivityListResponse list(
        @PathVariable Long customerId,
        @RequestHeader(value = "X-Branch-Id", required = false) Long branchId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return activityService.list(customerId, branchId, page, size);
    }
}
