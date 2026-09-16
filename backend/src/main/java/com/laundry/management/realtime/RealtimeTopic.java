package com.laundry.management.realtime;

import com.laundry.management.auth.security.permission.PermissionCodes;

public enum RealtimeTopic {
    NOTIFICATION("notification", PermissionCodes.NOTIFICATION_READ_OWN),
    ORDER("order", PermissionCodes.ORDER_READ);

    private final String value;
    private final String requiredPermission;

    RealtimeTopic(String value, String requiredPermission) {
        this.value = value;
        this.requiredPermission = requiredPermission;
    }

    public String value() {
        return value;
    }

    public String requiredPermission() {
        return requiredPermission;
    }
}
