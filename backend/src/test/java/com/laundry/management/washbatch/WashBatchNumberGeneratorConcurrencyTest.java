package com.laundry.management.washbatch;

import static org.assertj.core.api.Assertions.assertThat;

import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.washbatch.application.WashBatchNumberGenerator;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

@ActiveProfiles("test")
@SpringBootTest
class WashBatchNumberGeneratorConcurrencyTest {
    @Autowired BranchRepository branches;
    @Autowired WashBatchNumberGenerator numbers;
    @Autowired TransactionTemplate transactions;
    private Long branchId;
    private String branchCode;

    @BeforeEach
    void prepare() {
        branchCode = "M" + UUID.randomUUID().toString().substring(0, 6).toUpperCase(Locale.ROOT);
        branchId = transactions.execute(status -> branches.saveAndFlush(new Branch(branchCode, "Batch sequence branch")).getId());
    }

    @Test
    void concurrentAllocationsAreUniqueAndMonotonicPerBranch() throws Exception {
        int count = 12;
        CountDownLatch ready = new CountDownLatch(count);
        CountDownLatch start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(count);
        try {
            List<Future<String>> futures = new ArrayList<>();
            for (int i = 0; i < count; i++) futures.add(pool.submit(() -> {
                ready.countDown();
                start.await();
                return transactions.execute(status -> numbers.next(branches.findByIdForUpdate(branchId).orElseThrow()));
            }));
            ready.await();
            start.countDown();
            List<String> codes = new ArrayList<>();
            for (Future<String> future : futures) codes.add(future.get(20, TimeUnit.SECONDS));
            assertThat(new HashSet<>(codes)).hasSize(count);
            assertThat(codes).allMatch(value -> value.matches(branchCode + "-MG-\\d{6}"));
            assertThat(codes.stream().map(value -> value.substring(value.length() - 6)).collect(java.util.stream.Collectors.toSet()))
                .containsExactlyInAnyOrderElementsOf(java.util.stream.IntStream.rangeClosed(1, count)
                    .mapToObj(value -> String.format("%06d", value)).toList());
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void branchesHaveIndependentSequences() {
        String otherCode = "N" + UUID.randomUUID().toString().substring(0, 6).toUpperCase(Locale.ROOT);
        String[] codes = transactions.execute(status -> {
            Branch first = branches.findByIdForUpdate(branchId).orElseThrow();
            Branch second = branches.saveAndFlush(new Branch(otherCode, "Other batch branch"));
            return new String[] { numbers.next(first), numbers.next(second) };
        });
        assertThat(codes).containsExactly(branchCode + "-MG-000001", otherCode + "-MG-000001");
    }
}
