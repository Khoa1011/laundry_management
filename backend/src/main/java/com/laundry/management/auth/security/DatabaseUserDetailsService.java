package com.laundry.management.auth.security;

import com.laundry.management.auth.access.application.EffectivePermissionService;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DatabaseUserDetailsService implements UserDetailsService {

    private static final String INVALID_CREDENTIALS = "Invalid credentials";

    private final UserAccountRepository userAccountRepository;
    private final EffectivePermissionService effectivePermissionService;

    public DatabaseUserDetailsService(
        UserAccountRepository userAccountRepository,
        EffectivePermissionService effectivePermissionService
    ) {
        this.userAccountRepository = userAccountRepository;
        this.effectivePermissionService = effectivePermissionService;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return userAccountRepository.findByUsernameIgnoreCase(username.trim())
            .map(account -> AuthenticatedUser.from(account, effectivePermissionService.resolve(account)))
            .orElseThrow(() -> new UsernameNotFoundException(INVALID_CREDENTIALS));
    }
}
