CREATE TABLE auth_refresh_tokens (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    family_id VARCHAR(36) NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    revoked_at TIMESTAMP(6) NULL,
    replaced_by_hash VARCHAR(64) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    last_used_at TIMESTAMP(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_auth_refresh_tokens_hash UNIQUE (token_hash),
    CONSTRAINT fk_auth_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_auth_refresh_tokens_user ON auth_refresh_tokens (user_id);
CREATE INDEX idx_auth_refresh_tokens_family ON auth_refresh_tokens (family_id);
CREATE INDEX idx_auth_refresh_tokens_expires ON auth_refresh_tokens (expires_at);
