package com.laundry.management.customer.infrastructure;

import com.laundry.management.customer.domain.Customer;
import com.laundry.management.customer.domain.CustomerSource;
import com.laundry.management.customer.domain.CustomerStatus;
import com.laundry.management.customer.domain.CustomerType;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CustomerRepository extends JpaRepository<Customer, Long> {

    Optional<Customer> findByIdAndBranchId(Long id, Long branchId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Customer c where c.id = :id and c.branch.id = :branchId")
    Optional<Customer> findByIdAndBranchIdForUpdate(@Param("id") Long id, @Param("branchId") Long branchId);

    boolean existsByBranchIdAndNormalizedPhone(Long branchId, String normalizedPhone);

    boolean existsByBranchIdAndNormalizedPhoneAndIdNot(Long branchId, String normalizedPhone, Long id);

    @Query("""
        select c.id as id,
               c.customerCode as customerCode,
               c.fullName as fullName,
               c.phone as phone,
               c.email as email,
               c.customerType as customerType,
               c.source as source,
               c.status as status,
               c.createdAt as createdAt,
               c.updatedAt as updatedAt
        from Customer c
        where c.branch.id = :branchId
          and (:status is null or c.status = :status)
          and (:customerType is null or c.customerType = :customerType)
          and (:source is null or c.source = :source)
          and (
              :searchPattern is null
              or lower(c.customerCode) like :searchPattern escape '!'
              or lower(c.fullName) like :searchPattern escape '!'
              or lower(c.phone) like :searchPattern escape '!'
              or lower(c.normalizedPhone) like :searchPattern escape '!'
              or lower(c.email) like :searchPattern escape '!'
              or (:exactPhone is not null and c.normalizedPhone = :exactPhone)
          )
        """)
    Page<CustomerListProjection> search(
        @Param("branchId") Long branchId,
        @Param("searchPattern") String searchPattern,
        @Param("exactPhone") String exactPhone,
        @Param("status") CustomerStatus status,
        @Param("customerType") CustomerType customerType,
        @Param("source") CustomerSource source,
        Pageable pageable
    );

    @Query("""
        select c.id as id,
               c.customerCode as customerCode,
               c.fullName as fullName,
               c.phone as phone,
               c.email as email,
               c.customerType as customerType,
               c.source as source,
               c.status as status,
               c.createdAt as createdAt,
               c.updatedAt as updatedAt
        from Customer c
        where c.branch.id = :branchId
          and c.normalizedPhone = :exactPhone
          and (:status is null or c.status = :status)
          and (:customerType is null or c.customerType = :customerType)
          and (:source is null or c.source = :source)
        """)
    Page<CustomerListProjection> searchByExactPhone(
        @Param("branchId") Long branchId,
        @Param("exactPhone") String exactPhone,
        @Param("status") CustomerStatus status,
        @Param("customerType") CustomerType customerType,
        @Param("source") CustomerSource source,
        Pageable pageable
    );
}
