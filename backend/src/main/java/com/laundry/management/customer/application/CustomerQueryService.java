package com.laundry.management.customer.application;

import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.customer.api.CustomerDetailResponse;
import com.laundry.management.customer.api.CustomerListResponse;
import com.laundry.management.customer.domain.CustomerSource;
import com.laundry.management.customer.domain.CustomerStatus;
import com.laundry.management.customer.domain.CustomerType;
import com.laundry.management.customer.infrastructure.CustomerAddressRepository;
import com.laundry.management.customer.infrastructure.CustomerRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerQueryService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final Map<String, String> ALLOWED_SORTS = allowedSorts();

    private final CustomerRepository customerRepository;
    private final CustomerAddressRepository addressRepository;
    private final CurrentUserProvider currentUserProvider;
    private final PhoneNormalizer phoneNormalizer;
    private final CustomerMapper customerMapper;

    public CustomerQueryService(
        CustomerRepository customerRepository,
        CustomerAddressRepository addressRepository,
        CurrentUserProvider currentUserProvider,
        PhoneNormalizer phoneNormalizer,
        CustomerMapper customerMapper
    ) {
        this.customerRepository = customerRepository;
        this.addressRepository = addressRepository;
        this.currentUserProvider = currentUserProvider;
        this.phoneNormalizer = phoneNormalizer;
        this.customerMapper = customerMapper;
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).CUSTOMER_READ)")
    @Transactional(readOnly = true)
    public CustomerListResponse list(
        int page,
        int size,
        String search,
        CustomerStatus status,
        CustomerType customerType,
        CustomerSource source,
        List<String> requestedSort,
        Long requestedBranchId
    ) {
        validatePage(page, size);
        Long branchId = currentUserProvider.resolveAuthorizedBranch(requestedBranchId);
        Sort sort = parseSort(requestedSort);
        String trimmedSearch = search == null ? null : search.trim();
        String searchPattern = trimmedSearch == null || trimmedSearch.isEmpty()
            ? null
            : "%" + escapeLike(trimmedSearch.toLowerCase(Locale.ROOT)) + "%";
        String exactPhone = trimmedSearch == null
            ? null
            : phoneNormalizer.tryNormalizeForSearch(trimmedSearch).orElse(null);

        PageRequest pageable = PageRequest.of(page, size, sort);
        var result = exactPhone == null
            ? customerRepository.search(
                branchId,
                searchPattern,
                null,
                status,
                customerType,
                source,
                pageable
            )
            : customerRepository.searchByExactPhone(
                branchId,
                exactPhone,
                status,
                customerType,
                source,
                pageable
            );
        return new CustomerListResponse(
            result.getContent().stream().map(customerMapper::toListItem).toList(),
            result.getNumber(),
            result.getSize(),
            result.getTotalElements(),
            result.getTotalPages(),
            sort.stream()
                .map(order -> new CustomerListResponse.SortItemResponse(
                    externalSortName(order.getProperty()),
                    order.getDirection().name()
                ))
                .toList()
        );
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).CUSTOMER_READ)")
    @Transactional(readOnly = true)
    public CustomerDetailResponse get(Long customerId, Long requestedBranchId) {
        Long branchId = currentUserProvider.resolveAuthorizedBranch(requestedBranchId);
        var customer = customerRepository.findByIdAndBranchId(customerId, branchId)
            .orElseThrow(this::customerNotFound);
        var addresses = addressRepository.findAllByCustomerIdOrderByDefaultAddressDescCreatedAtAsc(customerId);
        return customerMapper.toDetail(customer, addresses);
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

    private Sort parseSort(List<String> requestedSort) {
        if (requestedSort == null || requestedSort.isEmpty()) {
            return Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("id"));
        }
        List<Sort.Order> orders = new ArrayList<>();
        for (String rawSort : requestedSort) {
            String[] parts = rawSort.split(",", -1);
            String externalProperty = parts[0].trim();
            String property = ALLOWED_SORTS.get(externalProperty);
            if (property == null || parts.length > 2) {
                throw invalidSort();
            }
            Sort.Direction direction;
            try {
                direction = parts.length == 1 || parts[1].isBlank()
                    ? Sort.Direction.ASC
                    : Sort.Direction.fromString(parts[1]);
            } catch (IllegalArgumentException exception) {
                throw invalidSort();
            }
            orders.add(new Sort.Order(direction, property));
        }
        if (orders.stream().noneMatch(order -> order.getProperty().equals("id"))) {
            orders.add(Sort.Order.desc("id"));
        }
        return Sort.by(orders);
    }

    private String escapeLike(String value) {
        return value.replace("!", "!!").replace("%", "!%").replace("_", "!_");
    }

    private String externalSortName(String internalName) {
        return ALLOWED_SORTS.entrySet().stream()
            .filter(entry -> entry.getValue().equals(internalName))
            .map(Map.Entry::getKey)
            .findFirst()
            .orElse(internalName);
    }

    private ApiException invalidSort() {
        return new ApiException(
            HttpStatus.BAD_REQUEST,
            ErrorCode.INVALID_SORT,
            "Invalid sort",
            "Sort by fullName, customerCode, createdAt, updatedAt, status, customerType, or source."
        );
    }

    private ApiException customerNotFound() {
        return new ApiException(
            HttpStatus.NOT_FOUND,
            ErrorCode.CUSTOMER_NOT_FOUND,
            "Customer not found",
            "The customer does not exist or is not accessible."
        );
    }

    private static Map<String, String> allowedSorts() {
        Map<String, String> sorts = new LinkedHashMap<>();
        sorts.put("fullName", "fullName");
        sorts.put("customerCode", "customerCode");
        sorts.put("createdAt", "createdAt");
        sorts.put("updatedAt", "updatedAt");
        sorts.put("status", "status");
        sorts.put("customerType", "customerType");
        sorts.put("source", "source");
        return Map.copyOf(sorts);
    }
}
