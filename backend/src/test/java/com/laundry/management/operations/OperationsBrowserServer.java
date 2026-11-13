package com.laundry.management.operations;

import com.laundry.management.LaundryManagementApplication;
import com.laundry.management.auth.domain.*;
import com.laundry.management.auth.infrastructure.*;
import org.springframework.boot.SpringApplication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;

/** Explicitly launched browser fixture. Database targets are fixed to the test environments below. */
public final class OperationsBrowserServer {
    private OperationsBrowserServer() {}
    public static void main(String[] args) {
        var app=new SpringApplication(LaundryManagementApplication.class);
        app.setAdditionalProfiles("test");
        if (java.util.Arrays.asList(args).contains("--mock-invoice-storage")) {
            app.addInitializers(context -> ((org.springframework.context.support.GenericApplicationContext) context)
                .registerBean("browserInvoiceStorage", com.laundry.management.storage.PrivateObjectStorage.class,
                    BrowserInvoiceStorage::new, definition -> definition.setPrimary(true)));
        }
        boolean mysql = java.util.Arrays.asList(args).contains("--isolated-mysql");
        var context=app.run("--server.port=18080", "--server.address=127.0.0.1",
            "--spring.datasource.url=" + (mysql
                ? "jdbc:mysql://127.0.0.1:13319/inventory_browser_test?serverTimezone=UTC"
                : "jdbc:h2:mem:operations_browser;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE"),
            "--spring.datasource.driver-class-name=" + (mysql ? "com.mysql.cj.jdbc.Driver" : "org.h2.Driver"),
            "--spring.datasource.username=" + (mysql ? "root" : "sa"),
            "--spring.datasource.password=", "--spring.flyway.locations=classpath:db/migration/common"
                + (mysql ? ",classpath:db/migration/mysql" : ""),
            "--app.bootstrap.enabled=false", "--app.demo-seed.enabled=false");
        context.getBean(TransactionTemplate.class).executeWithoutResult(s -> {
            var branches=context.getBean(BranchRepository.class);
            var users=context.getBean(UserAccountRepository.class);
            var roles=context.getBean(RoleRepository.class);
            var passwords=context.getBean(PasswordEncoder.class);
            var branch=branches.saveAndFlush(new Branch("TEST","Chi nhánh kiểm thử cô lập"));
            var secondBranch=branches.saveAndFlush(new Branch("TEST2","Chi nhánh kiểm thử thứ hai"));
            for(String role:new String[]{"ADMIN","MANAGER","RECEPTIONIST"}) {
                var account=new UserAccount("browser."+role.toLowerCase(),passwords.encode("foundation-test-only"),"Kiểm thử "+role,branch);
                account.addRole(roles.findByCode(role).orElseThrow());
                account=users.saveAndFlush(account);account.assignBranch(branch,true);account.assignBranch(secondBranch,false);users.saveAndFlush(account);
            }
            var db=context.getBean(com.laundry.management.inventory.operations.StockStore.class);
            long actor=com.laundry.management.inventory.operations.StockStore.id(db.one("SELECT id FROM users WHERE username=?","browser.manager"),"id");long b=branch.getId();
            for(String name:new String[]{"Kho chính kiểm thử","Kho nhận kiểm thử"})db.insert("INSERT INTO warehouses(branch_id,code,name,active,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?,?)",b,name,name,actor,actor);
            long category=db.insert("INSERT INTO inventory_categories(branch_id,code,name,active,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?,?)",b,"CAT","Hóa chất",actor,actor);
            long unit=db.insert("INSERT INTO inventory_units(branch_id,code,name,dimension,active,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,'VOLUME',TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?,?)",b,"LIT","Lít",actor,actor);
            for(String name:new String[]{"Nước giặt kiểm thử","Nước xả kiểm thử"})db.insert("INSERT INTO inventory_items(branch_id,code,name,active,created_at,updated_at,created_by,updated_by,category_id,base_unit_id,minimum_stock,track_lots,track_expiry) VALUES (?,?,?,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?,?,?,?,5,FALSE,FALSE)",b,name,name,actor,actor,category,unit);
            var reader=new UserAccount("browser.readonly",passwords.encode("foundation-test-only"),"Nhân viên chỉ đọc kho",branch);reader=users.saveAndFlush(reader);reader.assignBranch(branch,true);users.saveAndFlush(reader);
            db.jdbc().update("INSERT INTO user_permission_overrides(user_id,permission_id,effect,reason) SELECT ?,id,'ALLOW','Isolated browser fixture' FROM permissions WHERE code IN ('inventory.overview.read','inventory.document.read','inventory.stock.read','inventory.report.read','inventory.item.read','inventory.warehouse.read','inventory.category.read','inventory.unit.read','inventory.supplier.read','notification.read-own')",reader.getId());
            for (String identity : new String[]{"no-cost", "deny-receipt"}) {
                var operator = new UserAccount("browser." + identity, passwords.encode("foundation-test-only"),
                    "Kiểm thử " + identity, branch);
                operator.addRole(roles.findByCode("MANAGER").orElseThrow());
                operator = users.saveAndFlush(operator);
                operator.assignBranch(branch, true);
                users.saveAndFlush(operator);
                String denied = identity.equals("no-cost") ? "inventory.cost.read" : "inventory.receipt.create";
                db.jdbc().update("INSERT INTO user_permission_overrides(user_id,permission_id,effect,reason) SELECT ?,id,'DENY','Isolated browser fixture' FROM permissions WHERE code=?", operator.getId(), denied);
            }
        });
        System.out.println("OPERATIONS_BROWSER_FIXTURE_READY");
    }

    private static final class BrowserInvoiceStorage implements com.laundry.management.storage.PrivateObjectStorage {
        private final java.util.Map<String, byte[]> objects = new java.util.concurrent.ConcurrentHashMap<>();
        public boolean ready() { return true; }
        public void put(String key, byte[] bytes, String type) { objects.put(key, bytes.clone()); }
        public java.io.InputStream open(String key) {
            byte[] bytes = objects.get(key);
            if (bytes == null) throw new IllegalStateException("Test object missing");
            return new java.io.ByteArrayInputStream(bytes);
        }
        public void delete(String key) { objects.remove(key); }
    }
}
