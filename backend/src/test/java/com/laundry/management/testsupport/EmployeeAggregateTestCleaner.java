package com.laundry.management.testsupport;

import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Removes test-created employee aggregate data in foreign-key dependency order.
 *
 * <p>Employee positions seeded by Flyway are intentionally preserved. Positions created by tests
 * have an audit creator and are removed only after employees no longer reference them.</p>
 */
public final class EmployeeAggregateTestCleaner {

    private EmployeeAggregateTestCleaner() {
    }

    public static void clean(JdbcTemplate jdbc) {
        jdbc.update("delete from employee_documents");
        jdbc.update("delete from employee_identities");
        jdbc.update("delete from employee_compensations");
        jdbc.update("delete from employee_audit_logs");
        jdbc.update("delete from employee_branches");
        jdbc.update("delete from employees");
        jdbc.update("delete from employee_positions where created_by is not null");
        jdbc.update("update users set locked_at = null, locked_reason = null, locked_by = null where locked_by is not null");
    }
}
