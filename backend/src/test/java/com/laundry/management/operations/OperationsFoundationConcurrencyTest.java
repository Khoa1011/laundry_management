package com.laundry.management.operations;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

import com.laundry.management.auth.access.application.EffectivePermissionService;
import com.laundry.management.auth.domain.*;
import com.laundry.management.auth.infrastructure.*;
import com.laundry.management.auth.security.AuthenticatedUser;
import com.laundry.management.inventory.application.InventoryCatalogService;
import com.laundry.management.operations.api.*;
import com.laundry.management.operations.application.OperationsPolicyService;
import com.laundry.management.operations.domain.OperationsAudit;
import com.laundry.management.operations.infrastructure.OperationsAuditRepository;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.IntConsumer;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest @ActiveProfiles("test") @DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class OperationsFoundationConcurrencyTest {
    @Autowired InventoryCatalogService service;
    @Autowired OperationsPolicyService policies;
    @Autowired BranchRepository branches;
    @Autowired UserAccountRepository users;
    @Autowired RoleRepository roles;
    @Autowired EffectivePermissionService effective;
    @Autowired TransactionTemplate tx;
    @Autowired JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManagerFactory entityManagerFactory;
    @MockitoSpyBean OperationsAuditRepository audits;
    private Long branchId, userId;
    private AuthenticatedUser principal;

    @BeforeEach void setup() {
        tx.executeWithoutResult(s -> {
            String suffix=UUID.randomUUID().toString();
            Branch branch=branches.saveAndFlush(new Branch("FC"+suffix.substring(0,8),"Concurrency"));branchId=branch.getId();
            UserAccount user=new UserAccount("concurrent"+suffix,"test-only-unused-hash","Concurrent",branch);
            user.addRole(roles.findByCode("MANAGER").orElseThrow());user=users.saveAndFlush(user);user.assignBranch(branch,true);users.saveAndFlush(user);userId=user.getId();
            principal=AuthenticatedUser.from(user,effective.resolve(user));
        });
    }

    @AfterEach void cleanup() {
        SecurityContextHolder.clearContext();
        tx.executeWithoutResult(s -> {
            jdbc.update("delete from inventory_settings where branch_id=?",branchId);
            jdbc.update("delete from operations_audit where branch_id=?",branchId);
            jdbc.update("delete from warehouses where branch_id=?",branchId);
            jdbc.update("delete from operations_sequences where branch_id=?",branchId);
            users.deleteById(userId);users.flush();branches.deleteById(branchId);
        });
    }

    @Test void concurrentFirstCreationsUseUniqueSequentialCodes() throws Exception {
        Set<String> codes=ConcurrentHashMap.newKeySet();
        parallel(8,i -> codes.add(service.saveWarehouse(null,new OperationsDtos.WarehouseRequest(branchId,null,"Kho "+i,true,null)).code()));
        assertEquals(8,codes.size());
        assertEquals(8,jdbc.queryForObject("select count(*) from operations_audit where branch_id=?",Integer.class,branchId));
        assertEquals(9L,jdbc.queryForObject("select next_value from operations_sequences where branch_id=?",Long.class,branchId));
    }

    @Test void concurrentInitialSettingsCannotOverwriteEachOther() throws Exception {
        AtomicInteger successes=new AtomicInteger(), conflicts=new AtomicInteger();
        parallel(2,i -> {
            try { policies.saveInventory(new PolicyDtos.Request(branchId,-1L,true,BigDecimal.ZERO,false,null));successes.incrementAndGet(); }
            catch(com.laundry.management.common.exception.ApiException e) { assertEquals(409,e.getStatus().value());conflicts.incrementAndGet(); }
        });
        assertEquals(1,successes.get());assertEquals(1,conflicts.get());
    }

    @Test void auditFailureRollsBackMasterRecordAndSequenceInSameTransaction() {
        authenticate();
        doThrow(new IllegalStateException("Simulated audit persistence failure")).when(audits).save(any(OperationsAudit.class));
        assertThrows(IllegalStateException.class,() -> service.saveWarehouse(null,new OperationsDtos.WarehouseRequest(branchId,null,"Must roll back",true,null)));
        assertEquals(0,jdbc.queryForObject("select count(*) from warehouses where branch_id=?",Integer.class,branchId));
        assertEquals(0,jdbc.queryForObject("select count(*) from operations_sequences where branch_id=?",Integer.class,branchId));
        assertEquals(0,jdbc.queryForObject("select count(*) from operations_audit where branch_id=?",Integer.class,branchId));
    }

    @Test void pagedCatalogReadUsesConstantQueryCount() {
        authenticate();
        for(int i=0;i<25;i++) service.saveWarehouse(null,new OperationsDtos.WarehouseRequest(branchId,null,"Kho "+i,true,null));
        var statistics=entityManagerFactory.unwrap(org.hibernate.SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);statistics.clear();
        try {
            var page=service.listWarehouse(branchId,0,20,"",null);
            assertEquals(25,page.totalElements());assertEquals(20,page.items().size());
            assertEquals(3,statistics.getPrepareStatementCount(),"One branch lookup, one bounded page query and one count query; no per-record reads");
        } finally { statistics.setStatisticsEnabled(false); }
    }

    private void authenticate() { SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal,"test",principal.getAuthorities())); }
    private void parallel(int count, IntConsumer action) throws Exception {
        ExecutorService workers=Executors.newFixedThreadPool(count);
        CountDownLatch ready=new CountDownLatch(count),start=new CountDownLatch(1);
        try {
            List<Future<?>> futures=new ArrayList<>();
            for(int i=0;i<count;i++) { int index=i;futures.add(workers.submit(() -> {
                authenticate();ready.countDown();
                try { if(!start.await(10,TimeUnit.SECONDS)) throw new AssertionError("Start timeout");action.accept(index); }
                catch(InterruptedException e) { Thread.currentThread().interrupt();throw new AssertionError(e); }
                finally { SecurityContextHolder.clearContext(); }
            })); }
            assertTrue(ready.await(10,TimeUnit.SECONDS));start.countDown();
            for(Future<?> f:futures) f.get(30,TimeUnit.SECONDS);
        } finally { start.countDown();workers.shutdownNow(); }
    }
}
