package com.laundry.management.order;

import static org.assertj.core.api.Assertions.assertThat;
import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.order.domain.LaundryOrder;
import com.laundry.management.order.infrastructure.OrderRepository;
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
    @Autowired UserAccountRepository users; @Autowired OrderRepository orders;
    @Autowired OrderNumberGenerator numbers; @Autowired TransactionTemplate transactions;
    private Long branchId;
    private String branchCode;
    @BeforeEach void prepare(){branchCode="T"+UUID.randomUUID().toString().substring(0,6).toUpperCase(Locale.ROOT);branchId=transactions.execute(s->{Branch b=branches.save(new Branch(branchCode,"Concurrency branch"));sequences.save(new BranchOrderSequence(b));return b.getId();});}
    @Test void twentyConcurrentAllocationsAreUniqueAndMonotonicPerBranch() throws Exception {
        int count=20;CountDownLatch ready=new CountDownLatch(count),start=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(count);
        try{List<Future<String>> futures=new ArrayList<>();for(int i=0;i<count;i++)futures.add(pool.submit(()->{ready.countDown();start.await();return transactions.execute(s->{Branch locked=branches.findByIdForUpdate(branchId).orElseThrow();return numbers.next(locked);});}));ready.await();start.countDown();List<String> codes=new ArrayList<>();for(Future<String> f:futures)codes.add(f.get(20,TimeUnit.SECONDS));assertThat(new HashSet<>(codes)).hasSize(count);assertThat(codes).allMatch(v->v.matches(branchCode+"-DH-\\d{6}"));assertThat(codes.stream().map(value->value.substring(value.length()-6)).collect(java.util.stream.Collectors.toSet())).containsExactlyInAnyOrderElementsOf(java.util.stream.IntStream.rangeClosed(1,20).mapToObj(value->String.format("%06d",value)).toList());}
        finally{pool.shutdownNow();}
    }

    @Test void branchesAllocateIndependentSequences() {
        String secondCode="S"+UUID.randomUUID().toString().substring(0,6).toUpperCase(Locale.ROOT);
        String[] codes=transactions.execute(status->{Branch first=branches.findByIdForUpdate(branchId).orElseThrow();Branch second=branches.save(new Branch(secondCode,"Second sequence branch"));sequences.save(new BranchOrderSequence(second));return new String[]{numbers.next(first),numbers.next(second)};});
        assertThat(codes).containsExactly(branchCode+"-DH-000001",secondCode+"-DH-000001");
    }

    @Test void duplicateOrderCodeCannotBePersisted() {
        String duplicateCode=branchCode+"-DH-999999";
        transactions.executeWithoutResult(status->{Branch branch=branches.findById(branchId).orElseThrow();UserAccount actor=new UserAccount("duplicate-order-user-"+UUID.randomUUID(),"hash","Duplicate tester",branch);actor=users.saveAndFlush(actor);actor.assignBranch(branch,true);users.saveAndFlush(actor);orders.saveAndFlush(new LaundryOrder(duplicateCode,branch,null,"Guest",null,null,null,"VND",actor));});
        org.junit.jupiter.api.Assertions.assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->transactions.executeWithoutResult(status->{Branch branch=branches.findById(branchId).orElseThrow();UserAccount actor=users.findAll().stream().filter(value->value.getDefaultBranch()!=null&&value.getDefaultBranch().getId().equals(branchId)).findFirst().orElseThrow();orders.saveAndFlush(new LaundryOrder(duplicateCode,branch,null,"Other guest",null,null,null,"VND",actor));}));
    }
}
