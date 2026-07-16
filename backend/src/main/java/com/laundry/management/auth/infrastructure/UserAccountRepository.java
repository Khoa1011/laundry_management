package com.laundry.management.auth.infrastructure;

import com.laundry.management.auth.domain.UserAccount;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {

    @EntityGraph(attributePaths = {
        "roles",
        "roles.permissions",
        "branchAssignments",
        "branchAssignments.branch",
        "defaultBranch"
    })
    Optional<UserAccount> findByUsernameIgnoreCase(String username);
}
