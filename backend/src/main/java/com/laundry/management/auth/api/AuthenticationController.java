package com.laundry.management.auth.api;

import com.laundry.management.auth.access.api.AccessDtos;
import com.laundry.management.auth.access.application.AccessControlService;
import com.laundry.management.auth.application.AuthenticationService;
import com.laundry.management.auth.security.RefreshTokenProperties;
import jakarta.validation.Valid;
import java.time.Duration;
import java.time.Instant;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthenticationController {

    static final String REFRESH_COOKIE = "laundry_refresh";

    private final AuthenticationService authenticationService;
    private final AccessControlService accessControlService;
    private final RefreshTokenProperties refreshTokenProperties;

    public AuthenticationController(
        AuthenticationService authenticationService,
        AccessControlService accessControlService,
        RefreshTokenProperties refreshTokenProperties
    ) {
        this.authenticationService = authenticationService;
        this.accessControlService = accessControlService;
        this.refreshTokenProperties = refreshTokenProperties;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return sessionResponse(authenticationService.login(request));
    }

    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refresh(
        @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken
    ) {
        return sessionResponse(authenticationService.refresh(refreshToken));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
        @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken
    ) {
        authenticationService.logout(refreshToken);
        return ResponseEntity.noContent()
            .header(HttpHeaders.SET_COOKIE, clearRefreshCookie().toString())
            .build();
    }

    @GetMapping("/me")
    public ResponseEntity<AccessDtos.CurrentUserResponse> me() {
        return ResponseEntity.ok(accessControlService.currentUser());
    }

    private ResponseEntity<LoginResponse> sessionResponse(AuthenticationService.SessionResult result) {
        Duration remaining = Duration.between(Instant.now(), result.refreshExpiresAt());
        if (remaining.isNegative()) remaining = Duration.ZERO;
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE, result.refreshToken())
            .httpOnly(true)
            .secure(refreshTokenProperties.secureCookie())
            .sameSite("Strict")
            .path("/api/auth")
            .maxAge(remaining)
            .build();
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .header(HttpHeaders.SET_COOKIE, cookie.toString())
            .body(result.response());
    }

    private ResponseCookie clearRefreshCookie() {
        return ResponseCookie.from(REFRESH_COOKIE, "")
            .httpOnly(true)
            .secure(refreshTokenProperties.secureCookie())
            .sameSite("Strict")
            .path("/api/auth")
            .maxAge(Duration.ZERO)
            .build();
    }
}
