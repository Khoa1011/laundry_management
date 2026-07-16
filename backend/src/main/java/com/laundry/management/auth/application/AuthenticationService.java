package com.laundry.management.auth.application;

import com.laundry.management.auth.api.LoginRequest;
import com.laundry.management.auth.api.LoginResponse;
import com.laundry.management.auth.security.AuthenticatedUser;
import com.laundry.management.auth.security.JwtProperties;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

@Service
public class AuthenticationService {

    private final AuthenticationManager authenticationManager;
    private final JwtEncoder jwtEncoder;
    private final JwtProperties jwtProperties;

    public AuthenticationService(
        AuthenticationManager authenticationManager,
        JwtEncoder jwtEncoder,
        JwtProperties jwtProperties
    ) {
        this.authenticationManager = authenticationManager;
        this.jwtEncoder = jwtEncoder;
        this.jwtProperties = jwtProperties;
    }

    public LoginResponse login(LoginRequest request) {
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
                user.defaultBranchId()
            )
        );
    }

    private ApiException invalidCredentials() {
        return new ApiException(
            HttpStatus.UNAUTHORIZED,
            ErrorCode.UNAUTHORIZED,
            "Authentication failed",
            "The username or password is incorrect."
        );
    }
}
