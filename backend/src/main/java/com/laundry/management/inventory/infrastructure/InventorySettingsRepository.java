package com.laundry.management.inventory.infrastructure;
import com.laundry.management.inventory.domain.InventorySettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.Optional;
public interface InventorySettingsRepository extends JpaRepository<InventorySettings, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from InventorySettings s where s.branchId=:branchId")
    Optional<InventorySettings> findCurrentForUpdate(@Param("branchId") Long branchId);
}
