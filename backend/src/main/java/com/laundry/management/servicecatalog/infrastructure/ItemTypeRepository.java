package com.laundry.management.servicecatalog.infrastructure;

import com.laundry.management.servicecatalog.domain.CatalogStatus;
import com.laundry.management.servicecatalog.domain.ItemType;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ItemTypeRepository extends JpaRepository<ItemType, Long> {

    @EntityGraph(attributePaths = "parent")
    List<ItemType> findAllByOrderBySortOrderAscNameViAscIdAsc();

    Optional<ItemType> findByIdAndStatus(Long id, CatalogStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select item from ItemType item where item.id = :id")
    Optional<ItemType> lockById(@Param("id") Long id);

    boolean existsByParentId(Long parentId);
    long countByStatus(CatalogStatus status);
}
