package com.laundry.management.customer.infrastructure;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CustomerCodeSequenceRepository extends JpaRepository<CustomerCodeSequence, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from CustomerCodeSequence s where s.sequenceName = :name")
    Optional<CustomerCodeSequence> findByNameForUpdate(@Param("name") String name);
}
