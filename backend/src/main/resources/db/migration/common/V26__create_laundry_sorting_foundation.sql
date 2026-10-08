ALTER TABLE order_bags DROP CONSTRAINT ck_order_bags_status;
ALTER TABLE order_bags ADD COLUMN sorted_at TIMESTAMP(6) NULL;
ALTER TABLE order_bags ADD COLUMN sorted_by BIGINT NULL;
ALTER TABLE order_bags ADD CONSTRAINT fk_order_bags_sorted_by FOREIGN KEY (sorted_by) REFERENCES users (id);
ALTER TABLE order_bags ADD CONSTRAINT ck_order_bags_status CHECK (status IN ('RECEIVED', 'SORTED', 'LEGACY_UNVERIFIED', 'VOIDED'));
ALTER TABLE order_bags ADD CONSTRAINT ck_order_bags_sorted_metadata CHECK (
    (status = 'SORTED' AND sorted_at IS NOT NULL AND sorted_by IS NOT NULL)
    OR (status <> 'SORTED' AND sorted_at IS NULL AND sorted_by IS NULL)
);

CREATE TABLE processing_groups (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_bag_id BIGINT NOT NULL,
    order_item_id BIGINT NOT NULL,
    group_code VARCHAR(80) NOT NULL,
    sequence_number INT NOT NULL,
    quantity DECIMAL(10, 3) NOT NULL,
    color_group VARCHAR(30) NOT NULL,
    fabric_care VARCHAR(30) NOT NULL,
    wash_mode VARCHAR(30) NOT NULL,
    temperature_profile VARCHAR(30) NOT NULL,
    detergent_profile VARCHAR(30) NOT NULL,
    softener_profile VARCHAR(30) NOT NULL,
    hygiene_level VARCHAR(30) NOT NULL,
    separate_wash BOOLEAN NOT NULL,
    drying_instruction VARCHAR(30) NOT NULL,
    note VARCHAR(1000) NULL,
    status VARCHAR(30) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_by BIGINT NOT NULL,
    voided_at TIMESTAMP(6) NULL,
    voided_by BIGINT NULL,
    void_reason VARCHAR(500) NULL,
    last_print_requested_at TIMESTAMP(6) NULL,
    print_request_count INT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_processing_groups_code UNIQUE (group_code),
    CONSTRAINT uk_processing_groups_bag_sequence UNIQUE (order_bag_id, sequence_number),
    CONSTRAINT fk_processing_groups_bag FOREIGN KEY (order_bag_id) REFERENCES order_bags (id),
    CONSTRAINT fk_processing_groups_item FOREIGN KEY (order_item_id) REFERENCES order_items (id),
    CONSTRAINT fk_processing_groups_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_processing_groups_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
    CONSTRAINT fk_processing_groups_voided_by FOREIGN KEY (voided_by) REFERENCES users (id),
    CONSTRAINT ck_processing_groups_sequence CHECK (sequence_number > 0),
    CONSTRAINT ck_processing_groups_quantity CHECK (quantity > 0),
    CONSTRAINT ck_processing_groups_status CHECK (status IN ('WAITING', 'VOIDED')),
    CONSTRAINT ck_processing_groups_void CHECK (
        (status = 'VOIDED' AND voided_at IS NOT NULL AND voided_by IS NOT NULL
            AND void_reason IS NOT NULL AND CHAR_LENGTH(TRIM(void_reason)) > 0)
        OR (status = 'WAITING' AND voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL)
    ),
    CONSTRAINT ck_processing_groups_print_count CHECK (print_request_count >= 0),
    INDEX ix_processing_groups_waiting (status, created_at, id),
    INDEX ix_processing_groups_item_status (order_item_id, status)
);

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en,
    description_vi, description_en, risk_level, display_order, is_system, status) VALUES
('sorting.read', 'Xem nhóm đồ và hàng chờ', 'sorting', 'sorting', 'read',
    'Xem nhóm đồ và hàng chờ', 'View sorting and waiting groups',
    'Xem túi, nhóm đồ và hàng chờ trong chi nhánh được phép.',
    'View branch-scoped bags, groups and waiting queue.', 'LOW', 10, TRUE, 'ACTIVE'),
('sorting.process', 'Phân loại và in tem nhóm đồ', 'sorting', 'sorting', 'process',
    'Phân loại và in tem nhóm đồ', 'Sort bags and print group labels',
    'Quét túi, xác nhận hoặc mở lại phân loại và yêu cầu in tem nhóm đồ.',
    'Resolve bags, confirm or reopen sorting, and request group-label printing.', 'MEDIUM', 20, TRUE, 'ACTIVE');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('sorting.read', 'sorting.process')
WHERE r.code IN ('ADMIN', 'MANAGER', 'RECEPTIONIST');
