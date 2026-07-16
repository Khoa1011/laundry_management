package com.laundry.management.auth.api;

import com.laundry.management.auth.security.BranchAccess;
import java.util.List;
import java.util.Set;

public record LoginResponse(
    String accessToken,
    String tokenType,
    long expiresIn,
    UserResponse user
) {

    public record UserResponse(
        Long id,
        String username,
        String displayName,
        Set<String> roles,
        Set<String> permissions,
        List<BranchAccess> branches,
        Long defaultBranchId
    ) {
    }
}
