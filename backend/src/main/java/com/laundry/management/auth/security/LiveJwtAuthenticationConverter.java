package com.laundry.management.auth.security;

import com.laundry.management.auth.infrastructure.UserAccountRepository;
import java.util.Objects;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.BearerTokenErrorCodes;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class LiveJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final UserAccountRepository userAccountRepository;

    public LiveJwtAuthenticationConverter(UserAccountRepository userAccountRepository) {
        this.userAccountRepository = userAccountRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public AbstractAuthenticationToken convert(Jwt jwt) {
        AuthenticatedUser user = userAccountRepository.findByUsernameIgnoreCase(jwt.getSubject())
            .map(AuthenticatedUser::from)
            .filter(AuthenticatedUser::isEnabled)
            .filter(candidate -> Objects.equals(candidate.id(), userIdClaim(jwt)))
            .orElseThrow(this::invalidToken);

        return new UsernamePasswordAuthenticationToken(user, jwt, user.getAuthorities());
    }

    private Long userIdClaim(Jwt jwt) {
        Object claim = jwt.getClaim("userId");
        return claim instanceof Number number ? number.longValue() : null;
    }

    private OAuth2AuthenticationException invalidToken() {
        return new OAuth2AuthenticationException(new OAuth2Error(
            BearerTokenErrorCodes.INVALID_TOKEN,
            "The access token is no longer valid.",
            null
        ));
    }
}
