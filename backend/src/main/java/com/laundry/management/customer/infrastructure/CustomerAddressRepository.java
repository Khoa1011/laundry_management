package com.laundry.management.customer.infrastructure;

import com.laundry.management.customer.domain.AddressStatus;
import com.laundry.management.customer.domain.CustomerAddress;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerAddressRepository extends JpaRepository<CustomerAddress, Long> {

    List<CustomerAddress> findAllByCustomerIdOrderByDefaultAddressDescCreatedAtAsc(Long customerId);

    List<CustomerAddress> findAllByCustomerIdAndStatusOrderById(Long customerId, AddressStatus status);

    Optional<CustomerAddress> findByIdAndCustomerId(Long id, Long customerId);

    boolean existsByIdAndCustomerBranchId(Long id, Long branchId);

    Optional<CustomerAddress> findByCustomerIdAndDefaultAddressTrueAndStatus(Long customerId, AddressStatus status);

    boolean existsByCustomerIdAndStatus(Long customerId, AddressStatus status);
}
