package com.laundry.management.auth.application;

import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.Role;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.auth.infrastructure.RoleRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BootstrapService {

    private final BranchRepository branchRepository;
    private final RoleRepository roleRepository;
    private final UserAccountRepository userAccountRepository;
    private final PasswordEncoder passwordEncoder;

    public BootstrapService(
        BranchRepository branchRepository,
        RoleRepository roleRepository,
        UserAccountRepository userAccountRepository,
        PasswordEncoder passwordEncoder
    ) {
        this.branchRepository = branchRepository;
        this.roleRepository = roleRepository;
        this.userAccountRepository = userAccountRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public void initialize(BootstrapProperties properties) {
        validate(properties);
        String username = properties.username().trim().toLowerCase();
        String branchCode = properties.branchCode().trim().toUpperCase();
        Branch branch = branchRepository.findByCodeIgnoreCase(branchCode)
            .orElseGet(() -> branchRepository.save(new Branch(branchCode, properties.branchName().trim())));
        Role admin = roleRepository.findByCode("ADMIN")
            .orElseThrow(() -> new IllegalStateException("ADMIN role is missing after migration"));

        UserAccount account = userAccountRepository.findByUsernameIgnoreCase(username)
            .orElseGet(() -> new UserAccount(
                username,
                passwordEncoder.encode(properties.password()),
                properties.username().trim(),
                branch
            ));
        if (!passwordEncoder.matches(properties.password(), account.getPasswordHash())) {
            account.replacePasswordHash(passwordEncoder.encode(properties.password()));
        }
        if (account.getRoles().size() != 1 || account.getRoles().stream().noneMatch(role -> "ADMIN".equals(role.getCode()))) {
            account.assignPrimaryRole(admin);
        }
        boolean needsBranchAssignment = account.getBranchAssignments().stream()
            .noneMatch(assignment -> assignment.getBranch().getId().equals(branch.getId()));
        account = userAccountRepository.saveAndFlush(account);
        if (needsBranchAssignment) {
            account.assignBranch(branch, true);
        }
        userAccountRepository.save(account);
    }

    private void validate(BootstrapProperties properties) {
        if (isBlank(properties.username()) || isBlank(properties.password())
            || isBlank(properties.branchCode()) || isBlank(properties.branchName())) {
            throw new IllegalStateException("Bootstrap credentials and branch values are required when enabled");
        }
        if (properties.password().length() < 12) {
            throw new IllegalStateException("Bootstrap password must contain at least 12 characters");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
