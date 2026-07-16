CREATE TABLE customers (
    id BIGINT NOT NULL AUTO_INCREMENT,
    customer_code VARCHAR(30) NULL,
    branch_id BIGINT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    normalized_phone VARCHAR(20) NOT NULL,
    email VARCHAR(254) NULL,
    birth_date DATE NULL,
    customer_type VARCHAR(20) NOT NULL,
    source VARCHAR(30) NULL,
    note VARCHAR(2000) NULL,
    status VARCHAR(20) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_customers_customer_code UNIQUE (customer_code),
    CONSTRAINT uk_customers_branch_phone UNIQUE (branch_id, normalized_phone),
    CONSTRAINT fk_customers_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
    CONSTRAINT fk_customers_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_customers_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
    CONSTRAINT ck_customers_type CHECK (customer_type IN ('INDIVIDUAL', 'BUSINESS')),
    CONSTRAINT ck_customers_source CHECK (source IS NULL OR source IN (
        'WALK_IN', 'REFERRAL', 'FACEBOOK', 'ZALO', 'GOOGLE', 'WEBSITE', 'PARTNER', 'OTHER'
    )),
    CONSTRAINT ck_customers_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX idx_customers_branch_status_updated ON customers (branch_id, status, updated_at, id);
CREATE INDEX idx_customers_branch_type ON customers (branch_id, customer_type, id);
CREATE INDEX idx_customers_branch_source ON customers (branch_id, source, id);
CREATE INDEX idx_customers_branch_name ON customers (branch_id, full_name, id);
CREATE INDEX idx_customers_branch_email ON customers (branch_id, email, id);

CREATE TABLE customer_addresses (
    id BIGINT NOT NULL AUTO_INCREMENT,
    customer_id BIGINT NOT NULL,
    receiver_name VARCHAR(150) NOT NULL,
    receiver_phone VARCHAR(30) NOT NULL,
    normalized_receiver_phone VARCHAR(20) NOT NULL,
    province VARCHAR(120) NULL,
    district VARCHAR(120) NULL,
    ward VARCHAR(120) NULL,
    address_line VARCHAR(500) NOT NULL,
    delivery_note VARCHAR(1000) NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_customer_addresses_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
    CONSTRAINT fk_customer_addresses_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_customer_addresses_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
    CONSTRAINT ck_customer_addresses_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT ck_customer_addresses_default CHECK (is_default = FALSE OR status = 'ACTIVE')
);

CREATE INDEX idx_customer_addresses_customer_status ON customer_addresses (customer_id, status, id);
CREATE INDEX idx_customer_addresses_customer_default ON customer_addresses (customer_id, is_default, status, id);

CREATE TABLE customer_audit_activities (
    id BIGINT NOT NULL AUTO_INCREMENT,
    branch_id BIGINT NOT NULL,
    customer_id BIGINT NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id BIGINT NOT NULL,
    action VARCHAR(60) NOT NULL,
    changed_fields TEXT NULL,
    actor_user_id BIGINT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_customer_audit_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
    CONSTRAINT fk_customer_audit_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
    CONSTRAINT fk_customer_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users (id)
);

CREATE INDEX idx_customer_audit_customer_created ON customer_audit_activities (customer_id, created_at, id);
CREATE INDEX idx_customer_audit_branch_created ON customer_audit_activities (branch_id, created_at, id);
