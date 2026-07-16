package com.laundry.management.customer.application;

import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.customer.api.CustomerAddressCreateRequest;
import com.laundry.management.customer.api.CustomerAddressResponse;
import com.laundry.management.customer.api.CustomerAddressStatusRequest;
import com.laundry.management.customer.api.CustomerAddressUpdateRequest;
import com.laundry.management.customer.api.CustomerAddressVersionRequest;
import com.laundry.management.customer.domain.AddressStatus;
import com.laundry.management.customer.domain.Customer;
import com.laundry.management.customer.domain.CustomerActivityAction;
import com.laundry.management.customer.domain.CustomerAddress;
import com.laundry.management.customer.infrastructure.CustomerAddressRepository;
import com.laundry.management.customer.infrastructure.CustomerRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerAddressService {

    private final CustomerRepository customerRepository;
    private final CustomerAddressRepository addressRepository;
    private final UserAccountRepository userAccountRepository;
    private final CurrentUserProvider currentUserProvider;
    private final PhoneNormalizer phoneNormalizer;
    private final CustomerDataNormalizer dataNormalizer;
    private final CustomerActivityService activityService;
    private final CustomerMapper customerMapper;

    public CustomerAddressService(
        CustomerRepository customerRepository,
        CustomerAddressRepository addressRepository,
        UserAccountRepository userAccountRepository,
        CurrentUserProvider currentUserProvider,
        PhoneNormalizer phoneNormalizer,
        CustomerDataNormalizer dataNormalizer,
        CustomerActivityService activityService,
        CustomerMapper customerMapper
    ) {
        this.customerRepository = customerRepository;
        this.addressRepository = addressRepository;
        this.userAccountRepository = userAccountRepository;
        this.currentUserProvider = currentUserProvider;
        this.phoneNormalizer = phoneNormalizer;
        this.dataNormalizer = dataNormalizer;
        this.activityService = activityService;
        this.customerMapper = customerMapper;
    }

    @PreAuthorize("hasAuthority('" + PermissionCodes.CUSTOMER_READ + "')")
    @Transactional(readOnly = true)
    public List<CustomerAddressResponse> list(Long customerId, Long requestedBranchId) {
        Long branchId = currentUserProvider.resolveAuthorizedBranch(requestedBranchId);
        requireCustomer(customerId, branchId, false);
        return addressRepository.findAllByCustomerIdOrderByDefaultAddressDescCreatedAtAsc(customerId)
            .stream().map(customerMapper::toAddress).toList();
    }

    @PreAuthorize("hasAuthority('" + PermissionCodes.CUSTOMER_ADDRESS_MANAGE + "')")
    @Transactional
    public CustomerAddressResponse create(
        Long customerId,
        Long requestedBranchId,
        CustomerAddressCreateRequest request
    ) {
        Long branchId = currentUserProvider.resolveAuthorizedBranch(requestedBranchId);
        Customer customer = requireCustomer(customerId, branchId, true);
        UserAccount actor = actor();
        return customerMapper.toAddress(createAddress(customer, request, actor));
    }

    public CustomerAddress createInitialAddress(
        Customer customer,
        CustomerAddressCreateRequest request,
        UserAccount actor
    ) {
        return createAddress(customer, request, actor);
    }

    @PreAuthorize("hasAuthority('" + PermissionCodes.CUSTOMER_ADDRESS_MANAGE + "')")
    @Transactional
    public CustomerAddressResponse update(
        Long customerId,
        Long addressId,
        Long requestedBranchId,
        CustomerAddressUpdateRequest request
    ) {
        Long branchId = currentUserProvider.resolveAuthorizedBranch(requestedBranchId);
        Customer customer = requireCustomer(customerId, branchId, true);
        CustomerAddress address = requireAddress(customerId, addressId, branchId);
        requireVersion(address, request.version());
        UserAccount actor = actor();
        NormalizedPhone phone = phoneNormalizer.normalize(request.receiverPhone());
        String oldPhone = address.getNormalizedReceiverPhone();
        address.update(
            dataNormalizer.requiredText(request.receiverName(), "Receiver name"),
            phone.display(),
            phone.e164(),
            dataNormalizer.optionalText(request.province()),
            dataNormalizer.optionalText(request.district()),
            dataNormalizer.optionalText(request.ward()),
            dataNormalizer.requiredText(request.addressLine(), "Address line"),
            dataNormalizer.optionalText(request.deliveryNote()),
            actor
        );
        boolean promotedToDefault = request.defaultAddress() && !address.isDefaultAddress();
        if (promotedToDefault) {
            promoteDefault(customerId, address, actor);
        }
        addressRepository.flush();

        Map<String, Object> changes = new LinkedHashMap<>();
        changes.put("fields", List.of(
            "receiverName", "receiverPhone", "province", "district", "ward", "addressLine", "deliveryNote"
        ));
        if (!oldPhone.equals(phone.e164())) {
            changes.put("receiverPhone", Map.of(
                "from", phoneNormalizer.mask(oldPhone),
                "to", phoneNormalizer.mask(phone.e164())
            ));
        }
        activityService.record(
            customer,
            "CUSTOMER_ADDRESS",
            address.getId(),
            CustomerActivityAction.ADDRESS_UPDATED,
            changes,
            actor
        );
        if (promotedToDefault) {
            activityService.record(
                customer,
                "CUSTOMER_ADDRESS",
                address.getId(),
                CustomerActivityAction.ADDRESS_DEFAULT_CHANGED,
                Map.of("defaultAddressId", address.getId()),
                actor
            );
        }
        return customerMapper.toAddress(address);
    }

    @PreAuthorize("hasAuthority('" + PermissionCodes.CUSTOMER_ADDRESS_MANAGE + "')")
    @Transactional
    public CustomerAddressResponse setDefault(
        Long customerId,
        Long addressId,
        Long requestedBranchId,
        CustomerAddressVersionRequest request
    ) {
        Long branchId = currentUserProvider.resolveAuthorizedBranch(requestedBranchId);
        Customer customer = requireCustomer(customerId, branchId, true);
        CustomerAddress address = requireAddress(customerId, addressId, branchId);
        requireVersion(address, request.version());
        if (address.getStatus() != AddressStatus.ACTIVE) {
            throw new ApiException(
                HttpStatus.CONFLICT,
                ErrorCode.INVALID_ADDRESS_STATUS,
                "Invalid address status",
                "An inactive address cannot be set as default."
            );
        }
        if (!address.isDefaultAddress()) {
            UserAccount actor = actor();
            promoteDefault(customerId, address, actor);
            addressRepository.flush();
            activityService.record(
                customer,
                "CUSTOMER_ADDRESS",
                address.getId(),
                CustomerActivityAction.ADDRESS_DEFAULT_CHANGED,
                Map.of("defaultAddressId", address.getId()),
                actor
            );
        }
        return customerMapper.toAddress(address);
    }

    @PreAuthorize("hasAuthority('" + PermissionCodes.CUSTOMER_ADDRESS_MANAGE + "')")
    @Transactional
    public CustomerAddressResponse changeStatus(
        Long customerId,
        Long addressId,
        Long requestedBranchId,
        CustomerAddressStatusRequest request
    ) {
        Long branchId = currentUserProvider.resolveAuthorizedBranch(requestedBranchId);
        Customer customer = requireCustomer(customerId, branchId, true);
        CustomerAddress address = requireAddress(customerId, addressId, branchId);
        requireVersion(address, request.version());
        AddressStatus oldStatus = address.getStatus();
        if (oldStatus == request.status()) {
            return customerMapper.toAddress(address);
        }

        UserAccount actor = actor();
        if (request.status() == AddressStatus.INACTIVE) {
            deactivate(customerId, address, request.replacementAddressId(), branchId, actor);
        } else {
            reactivate(customerId, address, actor);
        }
        addressRepository.flush();
        activityService.record(
            customer,
            "CUSTOMER_ADDRESS",
            address.getId(),
            CustomerActivityAction.ADDRESS_STATUS_CHANGED,
            Map.of("status", Map.of("from", oldStatus.name(), "to", request.status().name())),
            actor
        );
        return customerMapper.toAddress(address);
    }

    private CustomerAddress createAddress(Customer customer, CustomerAddressCreateRequest request, UserAccount actor) {
        NormalizedPhone phone = phoneNormalizer.normalize(request.receiverPhone());
        boolean hasActiveAddress = addressRepository.existsByCustomerIdAndStatus(customer.getId(), AddressStatus.ACTIVE);
        boolean makeDefault = !hasActiveAddress || request.defaultAddress();
        CustomerAddress address = new CustomerAddress(
            customer,
            dataNormalizer.requiredText(request.receiverName(), "Receiver name"),
            phone.display(),
            phone.e164(),
            dataNormalizer.optionalText(request.province()),
            dataNormalizer.optionalText(request.district()),
            dataNormalizer.optionalText(request.ward()),
            dataNormalizer.requiredText(request.addressLine(), "Address line"),
            dataNormalizer.optionalText(request.deliveryNote()),
            makeDefault,
            actor
        );
        if (makeDefault && hasActiveAddress) {
            clearExistingDefault(customer.getId(), actor);
        }
        address = addressRepository.saveAndFlush(address);
        activityService.record(
            customer,
            "CUSTOMER_ADDRESS",
            address.getId(),
            CustomerActivityAction.ADDRESS_CREATED,
            Map.of(
                "fields", List.of("receiverName", "receiverPhone", "addressLine"),
                "receiverPhone", phoneNormalizer.mask(phone.e164()),
                "default", makeDefault
            ),
            actor
        );
        return address;
    }

    private void deactivate(
        Long customerId,
        CustomerAddress address,
        Long replacementAddressId,
        Long branchId,
        UserAccount actor
    ) {
        List<CustomerAddress> activeOthers = addressRepository
            .findAllByCustomerIdAndStatusOrderById(customerId, AddressStatus.ACTIVE)
            .stream().filter(candidate -> !candidate.getId().equals(address.getId())).toList();
        if (address.isDefaultAddress() && !activeOthers.isEmpty()) {
            if (replacementAddressId == null) {
                throw invalidReplacement("Select another active address as the default before deactivating this address.");
            }
            CustomerAddress replacement = activeOthers.stream()
                .filter(candidate -> candidate.getId().equals(replacementAddressId))
                .findFirst()
                .orElseThrow(() -> invalidReplacement("The replacement must be an active address for this customer."));
            if (!addressRepository.existsByIdAndCustomerBranchId(replacement.getId(), branchId)) {
                throw invalidReplacement("The replacement must be an active address for this customer.");
            }
            replacement.makeDefault(actor);
        }
        address.changeStatus(AddressStatus.INACTIVE, actor);
    }

    private void reactivate(Long customerId, CustomerAddress address, UserAccount actor) {
        address.changeStatus(AddressStatus.ACTIVE, actor);
        boolean activeDefaultExists = addressRepository
            .findByCustomerIdAndDefaultAddressTrueAndStatus(customerId, AddressStatus.ACTIVE)
            .isPresent();
        if (!activeDefaultExists) {
            address.makeDefault(actor);
        }
    }

    private void promoteDefault(Long customerId, CustomerAddress address, UserAccount actor) {
        clearExistingDefault(customerId, actor);
        address.makeDefault(actor);
    }

    private void clearExistingDefault(Long customerId, UserAccount actor) {
        addressRepository.findByCustomerIdAndDefaultAddressTrueAndStatus(customerId, AddressStatus.ACTIVE)
            .ifPresent(currentDefault -> currentDefault.clearDefault(actor));
    }

    private Customer requireCustomer(Long customerId, Long branchId, boolean lock) {
        return (lock
            ? customerRepository.findByIdAndBranchIdForUpdate(customerId, branchId)
            : customerRepository.findByIdAndBranchId(customerId, branchId))
            .orElseThrow(this::customerNotFound);
    }

    private CustomerAddress requireAddress(Long customerId, Long addressId, Long branchId) {
        return addressRepository.findByIdAndCustomerId(addressId, customerId).orElseThrow(() -> {
            if (addressRepository.existsByIdAndCustomerBranchId(addressId, branchId)) {
                return new ApiException(
                    HttpStatus.CONFLICT,
                    ErrorCode.CUSTOMER_ADDRESS_MISMATCH,
                    "Address mismatch",
                    "The address does not belong to the selected customer."
                );
            }
            return new ApiException(
                HttpStatus.NOT_FOUND,
                ErrorCode.CUSTOMER_ADDRESS_NOT_FOUND,
                "Address not found",
                "The address does not exist or is not accessible."
            );
        });
    }

    private UserAccount actor() {
        return userAccountRepository.getReferenceById(currentUserProvider.getRequired().id());
    }

    private void requireVersion(CustomerAddress address, Long requestedVersion) {
        if (requestedVersion == null || address.getVersion() != requestedVersion) {
            throw new ApiException(
                HttpStatus.CONFLICT,
                ErrorCode.CUSTOMER_VERSION_CONFLICT,
                "Address version conflict",
                "This address was updated by another user. Reload the latest data before saving again."
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

    private ApiException invalidReplacement(String detail) {
        return new ApiException(
            HttpStatus.CONFLICT,
            ErrorCode.INVALID_DEFAULT_ADDRESS_REPLACEMENT,
            "Invalid default address replacement",
            detail
        );
    }
}
