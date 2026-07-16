package com.laundry.management.customer.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.customer.api.CustomerActivityListResponse;
import com.laundry.management.customer.api.CustomerActivityResponse;
import com.laundry.management.customer.domain.Customer;
import com.laundry.management.customer.domain.CustomerActivity;
import com.laundry.management.customer.domain.CustomerActivityAction;
import com.laundry.management.customer.infrastructure.CustomerActivityRepository;
import com.laundry.management.customer.infrastructure.CustomerRepository;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerActivityService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final TypeReference<Map<String, Object>> CHANGES_TYPE = new TypeReference<>() { };

    private final CustomerActivityRepository activityRepository;
    private final CustomerRepository customerRepository;
    private final CurrentUserProvider currentUserProvider;
    private final ObjectMapper objectMapper;

    public CustomerActivityService(
        CustomerActivityRepository activityRepository,
        CustomerRepository customerRepository,
        CurrentUserProvider currentUserProvider,
        ObjectMapper objectMapper
    ) {
        this.activityRepository = activityRepository;
        this.customerRepository = customerRepository;
        this.currentUserProvider = currentUserProvider;
        this.objectMapper = objectMapper;
    }

    public void record(
        Customer customer,
        String entityType,
        Long entityId,
        CustomerActivityAction action,
        Map<String, Object> safeChanges,
        UserAccount actor
    ) {
        try {
            String changes = safeChanges.isEmpty() ? null : objectMapper.writeValueAsString(safeChanges);
            activityRepository.save(new CustomerActivity(
                customer.getBranch(),
                customer,
                entityType,
                entityId,
                action,
                changes,
                actor
            ));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize safe customer activity metadata", exception);
        }
    }

    @PreAuthorize("hasAuthority('" + PermissionCodes.CUSTOMER_AUDIT_READ + "')")
    @Transactional(readOnly = true)
    public CustomerActivityListResponse list(Long customerId, Long requestedBranchId, int page, int size) {
        validatePage(page, size);
        Long branchId = currentUserProvider.resolveAuthorizedBranch(requestedBranchId);
        if (customerRepository.findByIdAndBranchId(customerId, branchId).isEmpty()) {
            throw customerNotFound();
        }
        var pageable = PageRequest.of(page, size, Sort.by(
            Sort.Order.desc("createdAt"),
            Sort.Order.desc("id")
        ));
        var result = activityRepository.findByCustomerIdAndBranchId(customerId, branchId, pageable);
        return new CustomerActivityListResponse(
            result.getContent().stream().map(this::toResponse).toList(),
            result.getNumber(),
            result.getSize(),
            result.getTotalElements(),
            result.getTotalPages()
        );
    }

    private CustomerActivityResponse toResponse(CustomerActivity activity) {
        return new CustomerActivityResponse(
            activity.getId(),
            activity.getEntityType(),
            activity.getEntityId(),
            activity.getAction(),
            parseChanges(activity.getChangedFields()),
            new CustomerActivityResponse.ActorResponse(
                activity.getActor().getId(),
                activity.getActor().getDisplayName()
            ),
            activity.getCreatedAt()
        );
    }

    private Map<String, Object> parseChanges(String changes) {
        if (changes == null || changes.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(changes, CHANGES_TYPE);
        } catch (JsonProcessingException exception) {
            return Map.of("fields", "unavailable");
        }
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                ErrorCode.VALIDATION_ERROR,
                "Invalid pagination",
                "Page must not be negative and size must be positive."
            );
        }
        if (size > MAX_PAGE_SIZE) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                ErrorCode.PAGE_SIZE_EXCEEDED,
                "Page size exceeded",
                "Page size must not exceed 100."
            );
        }
    }

    private ApiException customerNotFound() {
        return new ApiException(
            HttpStatus.NOT_FOUND,
            ErrorCode.CUSTOMER_NOT_FOUND,
            "Customer not found",
            "The customer does not exist or is not accessible."
        );
    }
}
