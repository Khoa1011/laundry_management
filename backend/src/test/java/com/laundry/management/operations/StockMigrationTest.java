package com.laundry.management.operations;

import static org.junit.jupiter.api.Assertions.*;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class StockMigrationTest {
    @Test void upgradesV28PreservingCatalogAndWorkflowWithRepeatableChecksums() {
        String mysql=System.getenv("STOCK_MIGRATION_MYSQL_URL");
        if(mysql!=null&&!mysql.startsWith("jdbc:mysql://127.0.0.1:13319/stock_phase2_upgrade_test?"))throw new IllegalArgumentException("Only the isolated stock upgrade database is allowed");
        boolean h2=mysql==null;String[] locations=h2?new String[]{"classpath:db/migration/common"}:new String[]{"classpath:db/migration/common","classpath:db/migration/mysql"};
        var source=new DriverManagerDataSource(h2?"jdbc:h2:mem:stock_upgrade_"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1":mysql,h2?"sa":"root",h2?"":System.getenv("STOCK_MIGRATION_MYSQL_PASSWORD"));var jdbc=new JdbcTemplate(source);
        try{
            Flyway.configure().dataSource(source).locations(locations).target("28").load().migrate();
            jdbc.update("INSERT INTO branches(code,name,status) VALUES ('STOCKUP','Stock upgrade fixture','ACTIVE')");
            long branch=jdbc.queryForObject("SELECT id FROM branches WHERE code='STOCKUP'",Long.class);
            jdbc.update("INSERT INTO users(username,password_hash,display_name,default_branch_id,status) VALUES ('stock.upgrade','test-only-unused-hash','Stock upgrade fixture',?,'ACTIVE')",branch);
            long actor=jdbc.queryForObject("SELECT id FROM users WHERE username='stock.upgrade'",Long.class);
            jdbc.update("INSERT INTO warehouses(branch_id,code,name,active,created_at,updated_at,created_by,updated_by) VALUES (?,'KEEP','Preserved warehouse',TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?,?)",branch,actor,actor);
            var result=Flyway.configure().dataSource(source).locations(locations).load().migrate();assertEquals(4,result.migrationsExecuted);
            assertEquals("Preserved warehouse",jdbc.queryForObject("SELECT name FROM warehouses WHERE branch_id=?",String.class,branch));
            assertEquals(50,jdbc.queryForObject("SELECT COUNT(*) FROM permissions WHERE module IN ('inventory','finance') AND status='ACTIVE'",Integer.class));
            assertEquals(8,jdbc.queryForObject("SELECT COUNT(*) FROM permissions WHERE module IN ('inventory','finance') AND status='INACTIVE'",Integer.class));
            assertEquals(4,jdbc.queryForObject("SELECT COUNT(*) FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id WHERE r.code IN ('ADMIN','MANAGER') AND p.code IN ('inventory.document.read','inventory.transfer.receive')",Integer.class));
            assertEquals(6,jdbc.queryForObject("SELECT COUNT(*) FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id WHERE r.code IN ('ADMIN','MANAGER') AND p.code LIKE 'inventory.invoice.%'",Integer.class));
            assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM inventory_receipt_invoices",Integer.class));
            assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM stock_ledger",Integer.class));
            assertEquals(0,Flyway.configure().dataSource(source).locations(locations).load().migrate().migrationsExecuted);
        }finally{if(h2)jdbc.execute("SHUTDOWN");}
    }
}
