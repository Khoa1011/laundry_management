package com.laundry.management.auth.security;

import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class CurrentUserProvider {

    public CurrentUser getRequired() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
            || !(authentication.getPrincipal() instanceof AuthenticatedUser principal)) {
            throw new ApiException(
                HttpStatus.UNAUTHORIZED,
                ErrorCode.UNAUTHORIZED,
                "Authentication required",
                "Sign in to continue."
            );
        }

        return new CurrentUser(
            principal.id(),
            principal.getUsername(),
            principal.displayName(),
            principal.defaultBranchId(),
            principal.roles(),
            principal.permissions(),
            principal.branches().stream().map(BranchAccess::id).toList()
        );
    }

    public Long resolveAuthorizedBranch(Long requestedBranchId) {
        CurrentUser user = getRequired();
        Long resolvedBranchId = requestedBranchId == null ? user.defaultBranchId() : requestedBranchId;
        if (!user.canAccessBranch(resolvedBranchId)) {
            throw new ApiException(
                HttpStatus.FORBIDDEN,
                ErrorCode.BRANCH_ACCESS_DENIED,
                "Branch access denied",
                "You do not have access to the selected branch."
            );
        }
        return resolvedBranchId;
    }

}
