package com.laundry.management.auth.infrastructure;

import com.laundry.management.auth.domain.RefreshToken;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select token from RefreshToken token join fetch token.user where token.tokenHash = :tokenHash")
    Optional<RefreshToken> findForUpdateByTokenHash(@Param("tokenHash") String tokenHash);

    @Modifying
    @Query("""
        update RefreshToken token
        set token.revokedAt = :revokedAt
        where token.familyId = :familyId and token.revokedAt is null
        """)
    int revokeActiveFamily(@Param("familyId") String familyId, @Param("revokedAt") Instant revokedAt);
}
