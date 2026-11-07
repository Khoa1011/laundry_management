package com.laundry.management.finance.infrastructure;
import com.laundry.management.finance.domain.FinanceSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.Optional;
public interface FinanceSettingsRepository extends JpaRepository<FinanceSettings, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from FinanceSettings s where s.branchId=:branchId")
    Optional<FinanceSettings> findCurrentForUpdate(@Param("branchId") Long branchId);
}
