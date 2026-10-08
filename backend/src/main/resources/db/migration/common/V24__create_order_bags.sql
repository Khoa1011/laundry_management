CREATE TABLE order_bags (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    bag_code VARCHAR(64) NOT NULL,
    sequence_number INT NOT NULL,
    status VARCHAR(30) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_by BIGINT NOT NULL,
    last_print_requested_at TIMESTAMP(6) NULL,
    print_request_count INT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_order_bags_code UNIQUE (bag_code),
    CONSTRAINT uk_order_bags_order_sequence UNIQUE (order_id, sequence_number),
    CONSTRAINT fk_order_bags_order FOREIGN KEY (order_id) REFERENCES orders (id),
    CONSTRAINT fk_order_bags_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_order_bags_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
    CONSTRAINT ck_order_bags_sequence CHECK (sequence_number BETWEEN 1 AND 99),
    CONSTRAINT ck_order_bags_status CHECK (status IN ('RECEIVED', 'LEGACY_UNVERIFIED')),
    CONSTRAINT ck_order_bags_print_count CHECK (print_request_count >= 0)
);

-- Historical orders predate physical-bag intake. Keep the invariant without
-- claiming that a bag was physically received or verified at the counter.
INSERT INTO order_bags (order_id, bag_code, sequence_number, status, created_at, created_by, updated_at, updated_by)
SELECT id, CONCAT(order_code, '-01'), 1, 'LEGACY_UNVERIFIED', created_at, created_by, updated_at, updated_by
FROM orders;

INSERT INTO permissions (
    code, name, module, resource, action, name_vi, name_en,
    description_vi, description_en, risk_level, display_order, is_system, status
) VALUES (
    'order.bag.print', 'In tem túi', 'order', 'order.bag', 'print',
    'In tem túi', 'Print bag labels',
    'Gửi yêu cầu in hoặc in lại tem túi của đơn trong chi nhánh được phép.',
    'Request printing or reprinting branch-scoped order bag labels.',
    'MEDIUM', 100, TRUE, 'ACTIVE'
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'order.bag.print'
WHERE r.code IN ('ADMIN', 'MANAGER', 'RECEPTIONIST');
