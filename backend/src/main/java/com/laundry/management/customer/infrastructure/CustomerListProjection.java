package com.laundry.management.customer.infrastructure;

import com.laundry.management.customer.domain.CustomerSource;
import com.laundry.management.customer.domain.CustomerStatus;
import com.laundry.management.customer.domain.CustomerType;
import java.time.Instant;

public interface CustomerListProjection {

    Long getId();
    String getCustomerCode();
    String getFullName();
    String getPhone();
    String getEmail();
    CustomerType getCustomerType();
    CustomerSource getSource();
    CustomerStatus getStatus();
    Instant getCreatedAt();
    Instant getUpdatedAt();
}
