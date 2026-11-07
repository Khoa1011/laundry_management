package com.laundry.management.operations.application;

import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.operations.domain.*;
import com.laundry.management.operations.infrastructure.*;
import com.laundry.management.operations.api.OperationsDtos;
import java.time.*;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Internal persistence helper. Public application services own permission checks and transactions. */
@Component
public class CatalogPersistence {
    private final OperationsAccess access;
    private final BranchRepository branches;
    private final OperationsAuditRepository audits;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public CatalogPersistence(OperationsAccess access, BranchRepository branches, OperationsAuditRepository audits,
        JdbcTemplate jdbc, Clock clock) {
        this.access = access; this.branches = branches; this.audits = audits; this.jdbc = jdbc; this.clock = clock;
    }

    public static Pageable page(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw OperationsAccess.invalid("Page must be non-negative; size must be 1–100.");
        return PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id"));
    }

    public <T extends CatalogRecord> Page<T> list(CatalogRepository<T> repo, Long branchId, int page, int size,
        String search, Boolean active) {
        Long branch = access.branch(branchId);
        if (search != null && search.length() > 150) throw OperationsAccess.invalid("Search exceeds 150 characters.");
        Specification<T> spec = (root, query, cb) -> cb.equal(root.get("branchId"), branch);
        if (active != null) spec = spec.and((r, q, cb) -> cb.equal(r.get("active"), active));
        if (search != null && !search.isBlank()) {
            String escaped = search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
            spec = spec.and((r, q, cb) -> cb.or(cb.like(cb.lower(r.get("name")), "%" + escaped + "%", '\\'),
                cb.like(cb.lower(r.get("code")), "%" + escaped + "%", '\\')));
        }
        return repo.findAll(spec, page(page, size));
    }

    public <T extends CatalogRecord> T get(CatalogRepository<T> repo, Long id, Long branchId) {
        return repo.findByIdAndBranchId(id, access.branch(branchId)).orElseThrow(OperationsAccess::missing);
    }

    public <T extends CatalogRecord> T active(CatalogRepository<T> repo, Long id, Long branchId) {
        if (id == null) throw OperationsAccess.invalid("A required reference is missing.");
        T record = repo.findCurrentByIdAndBranchId(id, access.branch(branchId)).orElseThrow(OperationsAccess::missing);
        if (!record.isActive()) throw OperationsAccess.invalid("Selected reference is inactive.");
        return record;
    }

    public void initialize(CatalogRecord record, Long branchId, String kind, String prefix) {
        Long branch = access.branch(branchId);
        var locked = branches.findByIdForUpdate(branch).orElseThrow(OperationsAccess::missing);
        // The existing branch lock serializes first creation as well as later increments.
        // A locking/current read is required after waiting for the branch lock under MySQL REPEATABLE READ.
        var next = jdbc.queryForList("SELECT next_value FROM operations_sequences WHERE branch_id = ? AND kind = ? FOR UPDATE", Long.class, branch, kind);
        long value = next.isEmpty() ? 1 : next.get(0);
        if (next.isEmpty()) jdbc.update("INSERT INTO operations_sequences(branch_id, kind, next_value) VALUES (?, ?, ?)", branch, kind, value + 1);
        else jdbc.update("UPDATE operations_sequences SET next_value = ? WHERE branch_id = ? AND kind = ?", value + 1, branch, kind);
        record.initialize(branch, locked.getCode() + "-" + prefix + "-" + String.format(Locale.ROOT, "%06d", value), access.actor(), Instant.now(clock));
    }

    public void lockBranch(Long branchId) {
        branches.findByIdForUpdate(branchId).orElseThrow(OperationsAccess::missing);
    }

    public void update(CatalogRecord record, String name, boolean active, String note) {
        record.update(name, active, note, access.actor(), Instant.now(clock));
    }

    public void audit(Long branch, String module, String resource, Long id, String action, String fields) {
        audits.save(new OperationsAudit(branch, module, resource, id, action, access.actor(), Instant.now(clock), fields));
    }

    public <T> OperationsDtos.PageResponse<T> response(Page<?> page, List<T> items) {
        return new OperationsDtos.PageResponse<>(items, page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
    }
}
