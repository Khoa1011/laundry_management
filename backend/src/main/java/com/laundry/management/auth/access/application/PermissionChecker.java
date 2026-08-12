package com.laundry.management.auth.access.application;

import com.laundry.management.auth.security.AuthenticatedUser;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component("permissionChecker")
public class PermissionChecker {

    public boolean has(Authentication authentication, String permissionCode) {
        return permissionCode != null
            && authentication != null
            && authentication.isAuthenticated()
            && authentication.getPrincipal() instanceof AuthenticatedUser user
            && user.permissions().contains(permissionCode);
    }

    public boolean hasAny(Authentication authentication, String... permissionCodes) {
        if (permissionCodes == null) {
            return false;
        }
        for (String permissionCode : permissionCodes) {
            if (has(authentication, permissionCode)) {
                return true;
            }
        }
        return false;
    }
}
