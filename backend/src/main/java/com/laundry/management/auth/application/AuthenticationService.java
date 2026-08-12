package com.laundry.management.auth.application;

import com.laundry.management.auth.api.LoginRequest;
import com.laundry.management.auth.api.LoginResponse;
import com.laundry.management.auth.domain.RefreshToken;
import com.laundry.management.auth.infrastructure.RefreshTokenRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.auth.security.AuthenticatedUser;
import com.laundry.management.auth.security.DatabaseUserDetailsService;
import com.laundry.management.auth.security.JwtProperties;
import com.laundry.management.auth.security.RefreshTokenProperties;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthenticationService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final AuthenticationManager authenticationManager;
    private final JwtEncoder jwtEncoder;
    private final JwtProperties jwtProperties;
    private final RefreshTokenProperties refreshTokenProperties;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserAccountRepository userAccountRepository;
    private final DatabaseUserDetailsService userDetailsService;

    public AuthenticationService(
        AuthenticationManager authenticationManager,
        JwtEncoder jwtEncoder,
        JwtProperties jwtProperties,
        RefreshTokenProperties refreshTokenProperties,
        RefreshTokenRepository refreshTokenRepository,
        UserAccountRepository userAccountRepository,
        DatabaseUserDetailsService userDetailsService
    ) {
        this.authenticationManager = authenticationManager;
        this.jwtEncoder = jwtEncoder;
        this.jwtProperties = jwtProperties;
        this.refreshTokenProperties = refreshTokenProperties;
        this.refreshTokenRepository = refreshTokenRepository;
        this.userAccountRepository = userAccountRepository;
        this.userDetailsService = userDetailsService;
    }

    @Transactional
    public SessionResult login(LoginRequest request) {
        AuthenticatedUser user;
        try {
            var authentication = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(request.username().trim(), request.password())
            );
            user = (AuthenticatedUser) authentication.getPrincipal();
        } catch (BadCredentialsException exception) {
            throw invalidCredentials();
        } catch (AuthenticationException exception) {
            throw invalidCredentials();
        }

        Instant refreshExpiresAt = Instant.now().plus(refreshTokenProperties.expiration());
        String rawRefreshToken = randomToken();
        refreshTokenRepository.save(new RefreshToken(
            userAccountRepository.getReferenceById(user.id()),
            hash(rawRefreshToken),
            UUID.randomUUID().toString(),
            refreshExpiresAt
        ));
        return new SessionResult(issueAccessToken(user), rawRefreshToken, refreshExpiresAt);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public SessionResult refresh(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw invalidRefreshToken();
        }
        Instant now = Instant.now();
        RefreshToken current = refreshTokenRepository.findForUpdateByTokenHash(hash(rawRefreshToken))
            .orElseThrow(this::invalidRefreshToken);

        if (current.isRevoked()) {
            refreshTokenRepository.revokeActiveFamily(current.getFamilyId(), now);
            throw invalidRefreshToken();
        }
        if (current.isExpired(now)) {
            current.revoke(now);
            throw invalidRefreshToken();
        }

        AuthenticatedUser user;
        try {
            user = (AuthenticatedUser) userDetailsService.loadUserByUsername(current.getUser().getUsername());
        } catch (UsernameNotFoundException exception) {
            refreshTokenRepository.revokeActiveFamily(current.getFamilyId(), now);
            throw invalidRefreshToken();
        }
        if (!user.isEnabled()) {
            refreshTokenRepository.revokeActiveFamily(current.getFamilyId(), now);
            throw invalidRefreshToken();
        }

        String replacement = randomToken();
        String replacementHash = hash(replacement);
        current.rotate(replacementHash, now);
        refreshTokenRepository.save(new RefreshToken(
            current.getUser(),
            replacementHash,
            current.getFamilyId(),
            current.getExpiresAt()
        ));
        return new SessionResult(issueAccessToken(user), replacement, current.getExpiresAt());
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) return;
        refreshTokenRepository.findForUpdateByTokenHash(hash(rawRefreshToken))
            .ifPresent(token -> token.revoke(Instant.now()));
    }

    private LoginResponse issueAccessToken(AuthenticatedUser user) {
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plus(jwtProperties.expiration());
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer("laundry-management")
            .issuedAt(issuedAt)
            .expiresAt(expiresAt)
            .subject(user.getUsername())
            .claim("userId", user.id())
            .claim("displayName", user.displayName())
            .claim("roles", user.roles())
            .claim("permissions", user.permissions())
            .claim("branchIds", user.branches().stream().map(branch -> branch.id()).toList())
            .claim("defaultBranchId", user.defaultBranchId())
            .claim("authorizationVersion", user.authorizationVersion())
            .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();

        return new LoginResponse(
            token,
            "Bearer",
            jwtProperties.expiration().toSeconds(),
            new LoginResponse.UserResponse(
                user.id(),
                user.getUsername(),
                user.displayName(),
                user.roles(),
                user.permissions(),
                user.branches(),
                user.defaultBranchId(),
                user.authorizationVersion()
            )
        );
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private ApiException invalidCredentials() {
        return new ApiException(
            HttpStatus.UNAUTHORIZED,
            ErrorCode.UNAUTHORIZED,
            "Authentication failed",
            "The username or password is incorrect."
        );
    }

    private ApiException invalidRefreshToken() {
        return new ApiException(
            HttpStatus.UNAUTHORIZED,
            ErrorCode.UNAUTHORIZED,
            "Authentication required",
            "Sign in to continue."
        );
    }

    public record SessionResult(LoginResponse response, String refreshToken, Instant refreshExpiresAt) {
    }
}
