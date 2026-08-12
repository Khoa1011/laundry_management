package com.laundry.management.servicecatalog.infrastructure;

import com.laundry.management.servicecatalog.domain.CatalogStatus;
import com.laundry.management.servicecatalog.domain.ItemType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemTypeRepository extends JpaRepository<ItemType, Long> {

    @EntityGraph(attributePaths = "parent")
    List<ItemType> findAllByOrderBySortOrderAscNameViAscIdAsc();

    Optional<ItemType> findByIdAndStatus(Long id, CatalogStatus status);

    boolean existsByParentId(Long parentId);
}
