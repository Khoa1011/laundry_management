package com.laundry.management.washbatch.infrastructure;

import com.laundry.management.washbatch.domain.WashBatchActiveItem;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface WashBatchActiveItemRepository extends JpaRepository<WashBatchActiveItem,Long> {
    @EntityGraph(attributePaths={"membership","membership.batch"})
    List<WashBatchActiveItem> findByOrderItemIdIn(Collection<Long> orderItemIds);
    @Modifying @Query("delete from WashBatchActiveItem a where a.orderItemId in :ids")
    int release(@Param("ids") Collection<Long> orderItemIds);
}
