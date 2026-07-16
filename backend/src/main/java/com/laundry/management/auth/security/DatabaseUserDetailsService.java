package com.laundry.management.auth.security;

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

    public DatabaseUserDetailsService(UserAccountRepository userAccountRepository) {
        this.userAccountRepository = userAccountRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return userAccountRepository.findByUsernameIgnoreCase(username.trim())
            .map(AuthenticatedUser::from)
            .orElseThrow(() -> new UsernameNotFoundException(INVALID_CREDENTIALS));
    }
}
