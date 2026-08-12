package com.laundry.management.auth.infrastructure;

import com.laundry.management.auth.domain.PermissionModule;
import com.laundry.management.auth.domain.PermissionStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PermissionModuleRepository extends JpaRepository<PermissionModule, String> {

    List<PermissionModule> findAllByStatusOrderByDisplayOrderAscCodeAsc(PermissionStatus status);
}
