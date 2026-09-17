package com.laundry.management.washbatch.infrastructure;

import com.laundry.management.washbatch.domain.WashBatchHistory;
import java.util.List;
import org.springframework.data.jpa.repository.*;

public interface WashBatchHistoryRepository extends JpaRepository<WashBatchHistory,Long> {
    @EntityGraph(attributePaths="actor")
    List<WashBatchHistory> findByBatchIdOrderByCreatedAtDescIdDesc(Long batchId);
}
