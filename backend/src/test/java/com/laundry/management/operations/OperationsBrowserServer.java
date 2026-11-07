package com.laundry.management.operations;

import com.laundry.management.LaundryManagementApplication;
import com.laundry.management.auth.domain.*;
import com.laundry.management.auth.infrastructure.*;
import org.springframework.boot.SpringApplication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;

/** Explicitly launched test-only browser fixture. Always forces a disposable in-memory database. */
public final class OperationsBrowserServer {
    private OperationsBrowserServer() {}
    public static void main(String[] args) {
        var app=new SpringApplication(LaundryManagementApplication.class);
        app.setAdditionalProfiles("test");
        var context=app.run("--server.port=18080", "--server.address=127.0.0.1",
            "--spring.datasource.url=jdbc:h2:mem:operations_browser;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
            "--spring.datasource.driver-class-name=org.h2.Driver", "--spring.datasource.username=sa",
            "--spring.datasource.password=", "--spring.flyway.locations=classpath:db/migration/common",
            "--app.bootstrap.enabled=false", "--app.demo-seed.enabled=false");
        context.getBean(TransactionTemplate.class).executeWithoutResult(s -> {
            var branches=context.getBean(BranchRepository.class);
            var users=context.getBean(UserAccountRepository.class);
            var roles=context.getBean(RoleRepository.class);
            var passwords=context.getBean(PasswordEncoder.class);
            var branch=branches.saveAndFlush(new Branch("TEST","Chi nhánh kiểm thử cô lập"));
            for(String role:new String[]{"ADMIN","MANAGER","RECEPTIONIST"}) {
                var account=new UserAccount("browser."+role.toLowerCase(),passwords.encode("foundation-test-only"),"Kiểm thử "+role,branch);
                account.addRole(roles.findByCode(role).orElseThrow());
                account=users.saveAndFlush(account);account.assignBranch(branch,true);users.saveAndFlush(account);
            }
        });
        System.out.println("OPERATIONS_BROWSER_FIXTURE_READY");
    }
}
