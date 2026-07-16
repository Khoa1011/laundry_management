package com.laundry.management.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

@Entity
@Table(name = "user_branches")
public class UserBranch {

    @EmbeddedId
    private UserBranchId id;

    @MapsId("userId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @MapsId("branchId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "branch_id", nullable = false)
    private Branch branch;

    @Column(name = "is_default", nullable = false)
    private boolean defaultBranch;

    protected UserBranch() {
    }

    public UserBranch(UserAccount user, Branch branch, boolean defaultBranch) {
        this.user = user;
        this.branch = branch;
        this.defaultBranch = defaultBranch;
        this.id = new UserBranchId(user.getId(), branch.getId());
    }

    public Branch getBranch() {
        return branch;
    }

    public boolean isDefaultBranch() {
        return defaultBranch;
    }
}
