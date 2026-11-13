package com.laundry.management.operations;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.laundry.management.auth.domain.*;
import com.laundry.management.auth.infrastructure.*;
import com.laundry.management.inventory.operations.*;
import com.laundry.management.operations.application.CatalogPersistence;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;

/** Real commits and independent HTTP transactions; no enclosing test transaction hides lock/rollback bugs. */
@SpringBootTest(properties="stock.concurrent-tests=true") @AutoConfigureMockMvc @ActiveProfiles("test")
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class StockConcurrencyIntegrationTest {
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired StockStore db;@Autowired JdbcTemplate jdbc;
    @Autowired BranchRepository branches;@Autowired UserAccountRepository users;@Autowired RoleRepository roles;
    @Autowired PasswordEncoder passwords;@Autowired TransactionTemplate tx;
    @MockitoSpyBean CatalogPersistence audit;
    long branch,actor,warehouse,destination,item;String token;
    @BeforeEach void setup() throws Exception {
        tx.executeWithoutResult(s->{String key=UUID.randomUUID().toString();var b=branches.saveAndFlush(new Branch(key,"Concurrent inventory"));branch=b.getId();
            var u=new UserAccount(key,passwords.encode("concurrency-test-only"),"Concurrent operator",b);u.addRole(roles.findByCode("ADMIN").orElseThrow());u=users.saveAndFlush(u);u.assignBranch(b,true);users.saveAndFlush(u);actor=u.getId();
            warehouse=catalog("warehouses","Source");destination=catalog("warehouses","Destination");long category=catalog("inventory_categories","Chemicals");
            long unit=db.insert("INSERT INTO inventory_units(branch_id,code,name,active,created_at,updated_at,created_by,updated_by,dimension) VALUES (?,?,?,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?,?,'VOLUME')",branch,key,"Lít",actor,actor);
            item=db.insert("INSERT INTO inventory_items(branch_id,code,name,active,created_at,updated_at,created_by,updated_by,category_id,base_unit_id,minimum_stock,track_lots,track_expiry) VALUES (?,?,?,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?,?,?,?,5,FALSE,FALSE)",branch,key,"Detergent",actor,actor,category,unit);
        });
        String username=jdbc.queryForObject("SELECT username FROM users WHERE id=?",String.class,actor);
        token=json.readTree(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.createObjectNode().put("username",username).put("password","concurrency-test-only").toString())).andReturn().getResponse().getContentAsByteArray()).path("accessToken").asText();
    }
    long catalog(String table,String name){return db.insert("INSERT INTO "+table+"(branch_id,code,name,active,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?,?)",branch,UUID.randomUUID().toString(),name,actor,actor);}
    ObjectNode request(String kind,String quantity){var r=json.createObjectNode().put("branchId",branch).put("kind",kind).put("warehouseId",warehouse).put("businessAt",Instant.now().minusSeconds(1).toString()).put("draft",false).put("issueType","CONSUMPTION").put("reason","Concurrent test");r.putArray("lines").add(json.createObjectNode().put("itemId",item).put("quantity",quantity).put("unitPrice","40"));return r;}
    MvcResult send(MockHttpServletRequestBuilder r) throws Exception{return mvc.perform(r.header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)).andReturn();}
    MvcResult create(ObjectNode r,String key) throws Exception{return send(post("/api/inventory/documents").header("Idempotency-Key",key).content(r.toString()));}
    JsonNode seed(String q) throws Exception{var r=create(request("RECEIPT",q),UUID.randomUUID().toString());assertEquals(201,r.getResponse().getStatus(),r.getResponse().getContentAsString());return json.readTree(r.getResponse().getContentAsByteArray());}
    List<MvcResult> together(Callable<MvcResult> a,Callable<MvcResult> b) throws Exception{
        var start=new CountDownLatch(1);var ready=new CountDownLatch(2);var pool=Executors.newFixedThreadPool(2);
        try{var first=pool.submit(()->{ready.countDown();start.await();return a.call();});var second=pool.submit(()->{ready.countDown();start.await();return b.call();});assertTrue(ready.await(10,TimeUnit.SECONDS));start.countDown();return List.of(first.get(30,TimeUnit.SECONDS),second.get(30,TimeUnit.SECONDS));}
        finally{pool.shutdownNow();}
    }
    void balance(String q,String value){var b=db.one("SELECT * FROM stock_balances WHERE warehouse_id=? AND item_id=?",warehouse,item);assertEquals(0,new BigDecimal(q).compareTo(StockStore.dec(b,"quantity")));assertEquals(0,new BigDecimal(value).compareTo(StockStore.dec(b,"stockValue")));}
    void reconcile() throws Exception{var r=send(get("/api/inventory/reconciliation").param("branchId",""+branch));assertEquals(200,r.getResponse().getStatus());assertTrue(json.readTree(r.getResponse().getContentAsByteArray()).path("matches").asBoolean());}
    @Test void twoReceiptsSerializeWithoutLostUpdate() throws Exception{var results=together(()->create(request("RECEIPT","10"),"receipt_first"),()->create(request("RECEIPT","5"),"receipt_second"));assertEquals(List.of(201,201),results.stream().map(r->r.getResponse().getStatus()).toList());balance("15","600");reconcile();}
    @Test void twoIssuesCannotBothSpendTheSameStock() throws Exception{seed("10");String username="operator-"+UUID.randomUUID();
        tx.executeWithoutResult(s->{var b=branches.findById(branch).orElseThrow();var u=new UserAccount(username,passwords.encode("concurrency-test-only"),"Second operator",b);u.addRole(roles.findByCode("MANAGER").orElseThrow());u=users.saveAndFlush(u);u.assignBranch(b,true);users.saveAndFlush(u);});
        String secondToken=json.readTree(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.createObjectNode().put("username",username).put("password","concurrency-test-only").toString())).andReturn().getResponse().getContentAsByteArray()).path("accessToken").asText();
        var results=together(()->create(request("ISSUE","8"),"issue_first"),()->mvc.perform(post("/api/inventory/documents").header("Authorization","Bearer "+secondToken).header("Idempotency-Key","issue_second").contentType(MediaType.APPLICATION_JSON).content(request("ISSUE","8").toString())).andReturn());assertEquals(List.of(201,422),results.stream().map(r->r.getResponse().getStatus()).sorted().toList());balance("2","80");reconcile();}
    @Test void simultaneousRetryCreatesExactlyOneRevisionAndLedger() throws Exception{var body=request("RECEIPT","5");var results=together(()->create(body,"same_retry_command"),()->create(body,"same_retry_command"));for(var r:results)assertEquals(201,r.getResponse().getStatus(),r.getResponse().getContentAsString());assertEquals(json.readTree(results.get(0).getResponse().getContentAsByteArray()),json.readTree(results.get(1).getResponse().getContentAsByteArray()));assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM stock_ledger WHERE branch_id=?",Integer.class,branch));balance("5","200");}
    @Test void simultaneousReceiveUsesDocumentVersionAndCannotDuplicateStock() throws Exception{seed("10");var body=request("TRANSFER","6").put("destinationBranchId",branch).put("destinationWarehouseId",destination);var d=json.readTree(create(body,"transfer_start").getResponse().getContentAsByteArray());long id=d.path("id").asLong();var receipt=json.createObjectNode().put("branchId",branch).put("version",0).put("reason","Physically received");receipt.putArray("lines").add(json.createObjectNode().put("lineNumber",1).put("quantity","4"));
        var results=together(()->send(post("/api/inventory/documents/"+id+"/receive").header("Idempotency-Key","receive_first").content(receipt.toString())),()->send(post("/api/inventory/documents/"+id+"/receive").header("Idempotency-Key","receive_second").content(receipt.toString())));assertEquals(List.of(200,409),results.stream().map(r->r.getResponse().getStatus()).sorted().toList());assertEquals(0,new BigDecimal("4").compareTo(jdbc.queryForObject("SELECT quantity FROM stock_balances WHERE warehouse_id=? AND item_id=?",BigDecimal.class,destination,item)));reconcile();}
    @Test void concurrentCountAndReceiptNeverOverwriteReceipt() throws Exception{seed("10");var count=request("STOCKTAKE","12");((ObjectNode)count.path("lines").get(0)).put("balanceVersion",0);var results=together(()->create(count,"count_snapshot"),()->create(request("RECEIPT","1"),"receipt_after_count"));assertEquals(201,results.get(1).getResponse().getStatus());int status=results.get(0).getResponse().getStatus();assertTrue(status==201||status==409);balance(status==201?"13":"11",status==201?"520":"440");reconcile();}
    @Test void failureAfterLedgerAndBalanceWritesRollsBackEntireTransaction() throws Exception{seed("10");long ledgers=jdbc.queryForObject("SELECT COUNT(*) FROM stock_ledger WHERE branch_id=?",Long.class,branch);long audits=jdbc.queryForObject("SELECT COUNT(*) FROM operations_audit WHERE branch_id=?",Long.class,branch);
        doThrow(new IllegalStateException("Injected inventory audit failure")).when(audit).audit(eq(branch),eq("inventory"),eq("documents"),anyLong(),anyString(),anyString());
        try{assertEquals(500,create(request("ISSUE","8"),"rollback_command").getResponse().getStatus());}finally{reset(audit);}
        balance("10","400");assertEquals(ledgers,jdbc.queryForObject("SELECT COUNT(*) FROM stock_ledger WHERE branch_id=?",Long.class,branch));assertEquals(audits,jdbc.queryForObject("SELECT COUNT(*) FROM operations_audit WHERE branch_id=?",Long.class,branch));assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM stock_commands WHERE branch_id=? AND command_key='rollback_command'",Integer.class,branch));assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM stock_documents WHERE branch_id=?",Integer.class,branch));reconcile();}
    @Test void committedLowStockAlertIsDeduplicatedOnRetry() throws Exception{seed("10");var body=request("ISSUE","6");assertEquals(201,create(body,"low_stock_once").getResponse().getStatus());assertEquals(201,create(body,"low_stock_once").getResponse().getStatus());assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM notifications WHERE branch_id=? AND title_key='inventoryAlerts.LOW_STOCK.title'",Integer.class,branch));balance("4","160");}
}
