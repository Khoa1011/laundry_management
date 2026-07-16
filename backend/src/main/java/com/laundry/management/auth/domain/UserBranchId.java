package com.laundry.management.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class UserBranchId implements Serializable {

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "branch_id")
    private Long branchId;

    protected UserBranchId() {
    }

    public UserBranchId(Long userId, Long branchId) {
        this.userId = userId;
        this.branchId = branchId;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof UserBranchId that)) {
            return false;
        }
        return Objects.equals(userId, that.userId) && Objects.equals(branchId, that.branchId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, branchId);
    }
}
