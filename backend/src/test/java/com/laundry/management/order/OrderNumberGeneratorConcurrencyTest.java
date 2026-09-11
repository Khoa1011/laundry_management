package com.laundry.management.order;

import static org.assertj.core.api.Assertions.assertThat;
import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.order.application.OrderNumberGenerator;
import com.laundry.management.order.domain.BranchOrderSequence;
import com.laundry.management.order.infrastructure.BranchOrderSequenceRepository;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

@ActiveProfiles("test") @SpringBootTest
class OrderNumberGeneratorConcurrencyTest {
    @Autowired BranchRepository branches; @Autowired BranchOrderSequenceRepository sequences;
    @Autowired OrderNumberGenerator numbers; @Autowired TransactionTemplate transactions;
    private Long branchId;
    @BeforeEach void prepare(){branchId=transactions.execute(s->{Branch b=branches.save(new Branch("CN99","Concurrency branch"));sequences.save(new BranchOrderSequence(b));return b.getId();});}
    @Test void twentyConcurrentAllocationsAreUniqueAndMonotonicPerBranch() throws Exception {
        int count=20;CountDownLatch ready=new CountDownLatch(count),start=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(count);
        try{List<Future<String>> futures=new ArrayList<>();for(int i=0;i<count;i++)futures.add(pool.submit(()->{ready.countDown();start.await();return transactions.execute(s->{Branch locked=branches.findByIdForUpdate(branchId).orElseThrow();return numbers.next(locked);});}));ready.await();start.countDown();List<String> codes=new ArrayList<>();for(Future<String> f:futures)codes.add(f.get(20,TimeUnit.SECONDS));assertThat(new HashSet<>(codes)).hasSize(count);assertThat(codes).allMatch(v->v.matches("CN99-DH-\\d{6}"));}
        finally{pool.shutdownNow();}
    }
}
