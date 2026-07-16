package com.laundry.management.customer;

import static org.assertj.core.api.Assertions.assertThat;

import com.laundry.management.customer.application.CustomerCodeGenerator;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

@ActiveProfiles("test")
@SpringBootTest
class CustomerCodeGeneratorConcurrencyTest {

    @Autowired
    private CustomerCodeGenerator codeGenerator;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Test
    void concurrentAllocationsRemainUnique() throws Exception {
        int allocationCount = 12;
        CountDownLatch ready = new CountDownLatch(allocationCount);
        CountDownLatch start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(allocationCount);
        try {
            List<Future<String>> futures = new ArrayList<>();
            for (int index = 0; index < allocationCount; index++) {
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    start.await();
                    return transactionTemplate.execute(status -> codeGenerator.nextCode());
                }));
            }
            ready.await();
            start.countDown();
            List<String> codes = new ArrayList<>();
            for (Future<String> future : futures) {
                codes.add(future.get());
            }

            assertThat(new HashSet<>(codes)).hasSize(allocationCount);
            assertThat(codes).allMatch(code -> code.matches("KH-\\d{6,}"));
        } finally {
            executor.shutdownNow();
        }
    }
}
