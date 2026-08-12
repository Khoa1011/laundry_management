package com.laundry.management.employee.infrastructure;

import com.laundry.management.employee.domain.EmployeeDocument;
import com.laundry.management.employee.domain.EmployeeDocumentStatus;
import com.laundry.management.employee.domain.EmployeeDocumentType;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmployeeDocumentRepository extends JpaRepository<EmployeeDocument, Long> {
    @EntityGraph(attributePaths = {"createdBy", "replacesDocument"})
    @Query("""
        select d from EmployeeDocument d
        where d.employee.id = :employeeId
          and (:status is null or d.status = :status)
          and (:type is null or d.documentType = :type)
        """)
    Page<EmployeeDocument> search(@Param("employeeId") Long employeeId,
                                  @Param("status") EmployeeDocumentStatus status,
                                  @Param("type") EmployeeDocumentType type,
                                  Pageable pageable);

    @EntityGraph(attributePaths = {"employee", "createdBy", "replacesDocument"})
    @Query("select d from EmployeeDocument d where d.id = :id and d.employee.id = :employeeId")
    Optional<EmployeeDocument> findOwned(@Param("employeeId") Long employeeId, @Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = "employee")
    @Query("select d from EmployeeDocument d where d.id = :id and d.employee.id = :employeeId")
    Optional<EmployeeDocument> findOwnedForUpdate(@Param("employeeId") Long employeeId, @Param("id") Long id);

    @Query("select coalesce(max(d.documentVersion), 0) from EmployeeDocument d where d.employee.id = :employeeId and d.documentType = :type")
    int maxVersion(@Param("employeeId") Long employeeId, @Param("type") EmployeeDocumentType type);
}
