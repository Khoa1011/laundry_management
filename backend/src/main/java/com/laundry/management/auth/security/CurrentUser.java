package com.laundry.management.auth.security;

import java.util.List;
import java.util.Set;

public record CurrentUser(
    Long id,
    String username,
    String displayName,
    Long defaultBranchId,
    Set<String> roles,
    Set<String> permissions,
    List<Long> branchIds,
    long authorizationVersion
) {

    public boolean canAccessBranch(Long branchId) {
        return branchId != null && branchIds.contains(branchId);
    }
}
