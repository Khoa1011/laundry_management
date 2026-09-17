package com.laundry.management.washbatch.infrastructure;

import com.laundry.management.washbatch.domain.WashBatchItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WashBatchItemRepository extends JpaRepository<WashBatchItem,Long> {}
