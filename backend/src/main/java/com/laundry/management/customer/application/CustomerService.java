package com.laundry.management.customer.application;

import com.laundry.management.auth.domain.AccountStatus;
import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.customer.api.CustomerCreateRequest;
import com.laundry.management.customer.api.CustomerDetailResponse;
import com.laundry.management.customer.api.CustomerStatusRequest;
import com.laundry.management.customer.api.CustomerUpdateRequest;
import com.laundry.management.customer.domain.Customer;
import com.laundry.management.customer.domain.CustomerActivityAction;
import com.laundry.management.customer.domain.CustomerStatus;
import com.laundry.management.customer.infrastructure.CustomerAddressRepository;
import com.laundry.management.customer.infrastructure.CustomerRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final CustomerAddressRepository addressRepository;
    private final BranchRepository branchRepository;
    private final UserAccountRepository userAccountRepository;
    private final CurrentUserProvider currentUserProvider;
    private final PhoneNormalizer phoneNormalizer;
    private final CustomerDataNormalizer dataNormalizer;
    private final CustomerCodeGenerator codeGenerator;
    private final CustomerActivityService activityService;
    private final CustomerAddressService addressService;
    private final CustomerMapper customerMapper;

    public CustomerService(
        CustomerRepository customerRepository,
        CustomerAddressRepository addressRepository,
        BranchRepository branchRepository,
        UserAccountRepository userAccountRepository,
        CurrentUserProvider currentUserProvider,
        PhoneNormalizer phoneNormalizer,
        CustomerDataNormalizer dataNormalizer,
        CustomerCodeGenerator codeGenerator,
        CustomerActivityService activityService,
        CustomerAddressService addressService,
        CustomerMapper customerMapper
    ) {
        this.customerRepository = customerRepository;
        this.addressRepository = addressRepository;
        this.branchRepository = branchRepository;
        this.userAccountRepository = userAccountRepository;
        this.currentUserProvider = currentUserProvider;
        this.phoneNormalizer = phoneNormalizer;
        this.dataNormalizer = dataNormalizer;
        this.codeGenerator = codeGenerator;
        this.activityService = activityService;
        this.addressService = addressService;
        this.customerMapper = customerMapper;
    }

    @PreAuthorize("hasAuthority('" + PermissionCodes.CUSTOMER_CREATE + "')")
    @Transactional
    public CustomerDetailResponse create(CustomerCreateRequest request) {
        Long branchId = currentUserProvider.resolveAuthorizedBranch(request.branchId());
        Branch branch = branchRepository.findById(branchId)
            .filter(candidate -> candidate.getStatus() == AccountStatus.ACTIVE)
            .orElseThrow(() -> new ApiException(
                HttpStatus.FORBIDDEN,
                ErrorCode.BRANCH_ACCESS_DENIED,
                "Branch unavailable",
                "The selected branch is not active or accessible."
            ));
        UserAccount actor = actor();
        NormalizedPhone phone = phoneNormalizer.normalize(request.phone());
        ensurePhoneAvailable(branchId, phone.e164(), null);

        Customer customer = new Customer(
            codeGenerator.nextCode(),
            branch,
            dataNormalizer.meaningfulName(request.fullName()),
            phone.display(),
            phone.e164(),
            dataNormalizer.email(request.email()),
            request.birthDate(),
            request.customerType(),
            request.source(),
            dataNormalizer.optionalText(request.note()),
            actor
        );
        try {
            customer = customerRepository.saveAndFlush(customer);
        } catch (DataIntegrityViolationException exception) {
            throw translateIntegrityViolation(exception);
        }

        activityService.record(
            customer,
            "CUSTOMER",
            customer.getId(),
            CustomerActivityAction.CUSTOMER_CREATED,
            Map.of(
                "fields", List.of("fullName", "phone", "customerType", "source"),
                "phone", phoneNormalizer.mask(phone.e164())
            ),
            actor
        );
        if (request.initialAddress() != null) {
            addressService.createInitialAddress(customer, request.initialAddress(), actor);
        }
        customerRepository.flush();
        return detail(customer);
    }

    @PreAuthorize("hasAuthority('" + PermissionCodes.CUSTOMER_UPDATE + "')")
    @Transactional
    public CustomerDetailResponse update(
        Long customerId,
        Long requestedBranchId,
        CustomerUpdateRequest request
    ) {
        Long branchId = currentUserProvider.resolveAuthorizedBranch(requestedBranchId);
        Customer customer = customerRepository.findByIdAndBranchId(customerId, branchId)
            .orElseThrow(this::customerNotFound);
        requireVersion(customer, request.version());
        NormalizedPhone phone = phoneNormalizer.normalize(request.phone());
        ensurePhoneAvailable(branchId, phone.e164(), customerId);
        UserAccount actor = actor();
        Map<String, Object> safeChanges = changedFields(customer, request, phone);

        customer.update(
            dataNormalizer.meaningfulName(request.fullName()),
            phone.display(),
            phone.e164(),
            dataNormalizer.email(request.email()),
            request.birthDate(),
            request.customerType(),
            request.source(),
            dataNormalizer.optionalText(request.note()),
            actor
        );
        try {
            customerRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            throw translateIntegrityViolation(exception);
        }
        activityService.record(
            customer,
            "CUSTOMER",
            customer.getId(),
            CustomerActivityAction.CUSTOMER_UPDATED,
            safeChanges,
            actor
        );
        return detail(customer);
    }

    @PreAuthorize("hasAuthority('" + PermissionCodes.CUSTOMER_DEACTIVATE + "')")
    @Transactional
    public CustomerDetailResponse changeStatus(
        Long customerId,
        Long requestedBranchId,
        CustomerStatusRequest request
    ) {
        Long branchId = currentUserProvider.resolveAuthorizedBranch(requestedBranchId);
        Customer customer = customerRepository.findByIdAndBranchId(customerId, branchId)
            .orElseThrow(this::customerNotFound);
        requireVersion(customer, request.version());
        CustomerStatus oldStatus = customer.getStatus();
        if (oldStatus != request.status()) {
            UserAccount actor = actor();
            customer.changeStatus(request.status(), actor);
            customerRepository.flush();
            activityService.record(
                customer,
                "CUSTOMER",
                customer.getId(),
                CustomerActivityAction.CUSTOMER_STATUS_CHANGED,
                Map.of("status", Map.of("from", oldStatus.name(), "to", request.status().name())),
                actor
            );
        }
        return detail(customer);
    }

    private CustomerDetailResponse detail(Customer customer) {
        return customerMapper.toDetail(
            customer,
            addressRepository.findAllByCustomerIdOrderByDefaultAddressDescCreatedAtAsc(customer.getId())
        );
    }

    private Map<String, Object> changedFields(
        Customer customer,
        CustomerUpdateRequest request,
        NormalizedPhone phone
    ) {
        List<String> fields = new ArrayList<>();
        addChanged(fields, "fullName", customer.getFullName(), dataNormalizer.meaningfulName(request.fullName()));
        addChanged(fields, "phone", customer.getNormalizedPhone(), phone.e164());
        addChanged(fields, "email", customer.getEmail(), dataNormalizer.email(request.email()));
        addChanged(fields, "birthDate", customer.getBirthDate(), request.birthDate());
        addChanged(fields, "customerType", customer.getCustomerType(), request.customerType());
        addChanged(fields, "source", customer.getSource(), request.source());
        addChanged(fields, "note", customer.getNote(), dataNormalizer.optionalText(request.note()));
        Map<String, Object> changes = new LinkedHashMap<>();
        changes.put("fields", fields);
        if (!customer.getNormalizedPhone().equals(phone.e164())) {
            changes.put("phone", Map.of(
                "from", phoneNormalizer.mask(customer.getNormalizedPhone()),
                "to", phoneNormalizer.mask(phone.e164())
            ));
        }
        return changes;
    }

    private void addChanged(List<String> fields, String field, Object oldValue, Object newValue) {
        if (!Objects.equals(oldValue, newValue)) {
            fields.add(field);
        }
    }

    private void ensurePhoneAvailable(Long branchId, String normalizedPhone, Long excludedCustomerId) {
        boolean duplicate = excludedCustomerId == null
            ? customerRepository.existsByBranchIdAndNormalizedPhone(branchId, normalizedPhone)
            : customerRepository.existsByBranchIdAndNormalizedPhoneAndIdNot(
                branchId,
                normalizedPhone,
                excludedCustomerId
            );
        if (duplicate) {
            throw duplicatePhone();
        }
    }

    private void requireVersion(Customer customer, Long requestedVersion) {
        if (requestedVersion == null || customer.getVersion() != requestedVersion) {
            throw new ApiException(
                HttpStatus.CONFLICT,
                ErrorCode.CUSTOMER_VERSION_CONFLICT,
                "Customer version conflict",
                "This customer record was updated by another user. Reload the latest data before saving again."
            );
        }
    }

    private UserAccount actor() {
        return userAccountRepository.getReferenceById(currentUserProvider.getRequired().id());
    }

    private ApiException duplicatePhone() {
        return new ApiException(
            HttpStatus.CONFLICT,
            ErrorCode.CUSTOMER_PHONE_DUPLICATE,
            "Duplicate customer phone",
            "A customer with this phone number already exists in the selected branch."
        );
    }

    private RuntimeException translateIntegrityViolation(DataIntegrityViolationException exception) {
        Throwable current = exception;
        while (current != null) {
            String message = current.getMessage();
            if (message != null && message.toLowerCase().contains("uk_customers_branch_phone")) {
                return duplicatePhone();
            }
            current = current.getCause();
        }
        return exception;
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
