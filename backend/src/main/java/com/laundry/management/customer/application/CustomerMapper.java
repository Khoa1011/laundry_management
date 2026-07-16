package com.laundry.management.customer.application;

import com.laundry.management.customer.api.CustomerAddressResponse;
import com.laundry.management.customer.api.CustomerDetailResponse;
import com.laundry.management.customer.api.CustomerListItemResponse;
import com.laundry.management.customer.domain.Customer;
import com.laundry.management.customer.domain.CustomerAddress;
import com.laundry.management.customer.infrastructure.CustomerListProjection;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class CustomerMapper {

    public CustomerListItemResponse toListItem(CustomerListProjection customer) {
        return new CustomerListItemResponse(
            customer.getId(),
            customer.getCustomerCode(),
            customer.getFullName(),
            customer.getPhone(),
            customer.getEmail(),
            customer.getCustomerType(),
            customer.getSource(),
            customer.getStatus(),
            customer.getCreatedAt(),
            customer.getUpdatedAt()
        );
    }

    public CustomerDetailResponse toDetail(Customer customer, List<CustomerAddress> addresses) {
        return new CustomerDetailResponse(
            customer.getId(),
            customer.getCustomerCode(),
            customer.getFullName(),
            customer.getPhone(),
            customer.getEmail(),
            customer.getBirthDate(),
            customer.getCustomerType(),
            customer.getSource(),
            customer.getNote(),
            customer.getStatus(),
            new CustomerDetailResponse.BranchResponse(
                customer.getBranch().getId(),
                customer.getBranch().getCode(),
                customer.getBranch().getName()
            ),
            addresses.stream().map(this::toAddress).toList(),
            customer.getVersion(),
            customer.getCreatedAt(),
            customer.getUpdatedAt()
        );
    }

    public CustomerAddressResponse toAddress(CustomerAddress address) {
        return new CustomerAddressResponse(
            address.getId(),
            address.getReceiverName(),
            address.getReceiverPhone(),
            address.getProvince(),
            address.getDistrict(),
            address.getWard(),
            address.getAddressLine(),
            address.getDeliveryNote(),
            address.isDefaultAddress(),
            address.getStatus(),
            address.getVersion(),
            address.getCreatedAt(),
            address.getUpdatedAt()
        );
    }
}
