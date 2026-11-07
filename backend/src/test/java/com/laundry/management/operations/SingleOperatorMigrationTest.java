package com.laundry.management.operations;

import static org.junit.jupiter.api.Assertions.*;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class SingleOperatorMigrationTest {
    @Test void upgradesV27WithoutLosingLegacyRowsOrEscalatingRevokedGrants() {
        String mysql=System.getenv("SINGLE_OPERATOR_MIGRATION_MYSQL_URL");
        if(mysql!=null && !mysql.startsWith("jdbc:mysql://127.0.0.1:13318/single_operator_upgrade_test?"))
            throw new IllegalArgumentException("Only the explicitly isolated single-operator upgrade test database is allowed.");
        boolean h2=mysql==null;
        String[] locations=h2?new String[]{"classpath:db/migration/common"}:new String[]{"classpath:db/migration/common","classpath:db/migration/mysql"};
        var source=new DriverManagerDataSource(h2?"jdbc:h2:mem:single_operator_"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1":mysql,h2?"sa":"root","");
        var jdbc=new JdbcTemplate(source);
        try {
            Flyway.configure().dataSource(source).locations(locations).target("27").load().migrate();
            jdbc.update("insert into branches(code,name,status) values ('UPGRADE','Upgrade fixture','ACTIVE')");
            Long branch=jdbc.queryForObject("select id from branches where code='UPGRADE'",Long.class);
            jdbc.update("insert into users(username,password_hash,display_name,default_branch_id,status) values ('upgrade.fixture','test-only-unused-hash','Upgrade fixture',?,'ACTIVE')",branch);
            Long user=jdbc.queryForObject("select id from users where username='upgrade.fixture'",Long.class);
            jdbc.update("insert into user_roles(user_id,role_id) select ?,id from roles where code='MANAGER'",user);
            jdbc.update("insert into user_permission_overrides(user_id,permission_id,effect,reason,effective_from,effective_to,status) select ?,id,'DENY','Preserve explicit denial',TIMESTAMP '2020-01-01 00:00:00',TIMESTAMP '2037-01-01 00:00:00','ACTIVE' from permissions where code='finance.document.reverse'",user);
            jdbc.update("insert into user_permission_overrides(user_id,permission_id,effect,reason,status) select ?,id,'ALLOW','Retain inactive override','INACTIVE' from permissions where code='inventory.document.reverse'",user);
            jdbc.update("insert into finance_settings(branch_id,approval_required,approval_threshold,allow_negative,updated_at,updated_by) values (?,TRUE,987654,FALSE,CURRENT_TIMESTAMP,?)",branch,user);
            jdbc.update("insert into roles(code,name,display_name,name_vi,name_en,status,is_system) values ('APPROVAL_ONLY','Old approval role','Old approval role','Vai trò cũ','Old role','ACTIVE',FALSE)");
            jdbc.update("insert into role_permissions(role_id,permission_id) select r.id,p.id from roles r cross join permissions p where r.code='APPROVAL_ONLY' and p.code='finance.document.approve'");
            jdbc.update("delete from role_permissions where role_id=(select id from roles where code='ADMIN') and permission_id=(select id from permissions where code='finance.document.reverse')");
            int oldAssignments=jdbc.queryForObject("select count(*) from role_permissions rp join permissions p on p.id=rp.permission_id where p.code like '%.document.reverse'",Integer.class);
            Flyway.configure().dataSource(source).locations(locations).load().migrate();

            assertEquals(8,jdbc.queryForObject("select count(*) from permissions where module in ('finance','inventory') and status='INACTIVE'",Integer.class));
            assertEquals(45,jdbc.queryForObject("select count(*) from permissions where module in ('finance','inventory') and status='ACTIVE'",Integer.class));
            assertEquals(oldAssignments,jdbc.queryForObject("select count(*) from role_permissions rp join permissions p on p.id=rp.permission_id where p.code like '%.document.reverse'",Integer.class));
            assertEquals(0,grant(jdbc,"ADMIN","finance.document.cancel"));
            assertEquals(1,grant(jdbc,"MANAGER","finance.document.cancel"));
            assertEquals(0,grant(jdbc,"APPROVAL_ONLY","finance.document.cancel"));
            assertEquals("DENY",jdbc.queryForObject("select o.effect from user_permission_overrides o join permissions p on p.id=o.permission_id where o.user_id=? and p.code='finance.document.cancel'",String.class,user));
            String snapshot="select o.effect,o.reason,o.effective_from,o.effective_to,o.status,o.version,o.created_at,o.updated_at,o.created_by,o.updated_by from user_permission_overrides o join permissions p on p.id=o.permission_id where o.user_id=? and p.code=?";
            assertEquals(jdbc.queryForMap(snapshot,user,"finance.document.reverse"),jdbc.queryForMap(snapshot,user,"finance.document.cancel"));
            assertEquals(jdbc.queryForMap(snapshot,user,"inventory.document.reverse"),jdbc.queryForMap(snapshot,user,"inventory.document.cancel"));
            assertEquals("INACTIVE",jdbc.queryForObject("select o.status from user_permission_overrides o join permissions p on p.id=o.permission_id where o.user_id=? and p.code='inventory.document.cancel'",String.class,user));
            assertEquals(4,jdbc.queryForObject("select count(*) from user_permission_overrides where user_id=?",Integer.class,user));
            assertTrue(jdbc.queryForObject("select approval_required from finance_settings where branch_id=?",Boolean.class,branch));
            assertEquals(987654,jdbc.queryForObject("select approval_threshold from finance_settings where branch_id=?",Integer.class,branch));
            assertEquals(1,jdbc.queryForObject("select authorization_version from users where id=?",Integer.class,user));
            jdbc.update("insert into inventory_settings(branch_id,allow_negative,updated_at,updated_by) values (?,FALSE,CURRENT_TIMESTAMP,?)",branch,user);
            assertFalse(jdbc.queryForObject("select approval_required from inventory_settings where branch_id=?",Boolean.class,branch));
            // A second migrate validates checksums and does not copy grants/overrides twice.
            assertEquals(0,Flyway.configure().dataSource(source).locations(locations).load().migrate().migrationsExecuted);
        } finally { if(h2) jdbc.execute("SHUTDOWN"); }
    }
    private int grant(JdbcTemplate jdbc,String role,String permission) {
        return jdbc.queryForObject("select count(*) from role_permissions rp join roles r on r.id=rp.role_id join permissions p on p.id=rp.permission_id where r.code=? and p.code=?",Integer.class,role,permission);
    }
}
