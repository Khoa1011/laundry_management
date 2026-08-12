CREATE TABLE catalog_code_sequences (
    sequence_name VARCHAR(40) NOT NULL,
    next_value BIGINT NOT NULL,
    PRIMARY KEY (sequence_name)
);

INSERT INTO catalog_code_sequences (sequence_name, next_value) VALUES
    ('SERVICE', 1),
    ('ITEM_TYPE', 1),
    ('PRICE_LIST', 1);

CREATE TABLE laundry_services (
    id BIGINT NOT NULL AUTO_INCREMENT,
    code VARCHAR(40) NOT NULL,
    name_vi VARCHAR(150) NOT NULL,
    name_en VARCHAR(150) NULL,
    description_vi VARCHAR(1000) NULL,
    description_en VARCHAR(1000) NULL,
    processing_type VARCHAR(40) NOT NULL,
    default_unit_type VARCHAR(20) NOT NULL,
    sharing_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    estimated_minutes INT NULL,
    minimum_quantity DECIMAL(10,3) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_by BIGINT NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_laundry_services_code UNIQUE (code),
    CONSTRAINT fk_laundry_services_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_laundry_services_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
    CONSTRAINT ck_laundry_services_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    CONSTRAINT ck_laundry_services_estimated CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),
    CONSTRAINT ck_laundry_services_minimum CHECK (minimum_quantity IS NULL OR minimum_quantity >= 0)
);

CREATE TABLE item_types (
    id BIGINT NOT NULL AUTO_INCREMENT,
    code VARCHAR(40) NOT NULL,
    parent_id BIGINT NULL,
    name_vi VARCHAR(150) NOT NULL,
    name_en VARCHAR(150) NULL,
    description_vi VARCHAR(1000) NULL,
    description_en VARCHAR(1000) NULL,
    default_unit_type VARCHAR(20) NULL,
    requires_separate_wash BOOLEAN NOT NULL DEFAULT FALSE,
    default_color_risk VARCHAR(30) NULL,
    default_hygiene_level VARCHAR(30) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_by BIGINT NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_item_types_code UNIQUE (code),
    CONSTRAINT fk_item_types_parent FOREIGN KEY (parent_id) REFERENCES item_types (id),
    CONSTRAINT fk_item_types_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_item_types_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
    CONSTRAINT ck_item_types_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    CONSTRAINT ck_item_types_sort_order CHECK (sort_order >= 0)
);

CREATE TABLE price_lists (
    id BIGINT NOT NULL AUTO_INCREMENT,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(180) NOT NULL,
    description VARCHAR(1000) NULL,
    branch_id BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    effective_from TIMESTAMP(6) NOT NULL,
    effective_to TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_by BIGINT NOT NULL,
    published_at TIMESTAMP(6) NULL,
    published_by BIGINT NULL,
    archived_at TIMESTAMP(6) NULL,
    archived_by BIGINT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_price_lists_code UNIQUE (code),
    CONSTRAINT fk_price_lists_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
    CONSTRAINT fk_price_lists_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_price_lists_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
    CONSTRAINT fk_price_lists_published_by FOREIGN KEY (published_by) REFERENCES users (id),
    CONSTRAINT fk_price_lists_archived_by FOREIGN KEY (archived_by) REFERENCES users (id),
    CONSTRAINT ck_price_lists_status CHECK (status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'EXPIRED', 'ARCHIVED')),
    CONSTRAINT ck_price_lists_period CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE price_rules (
    id BIGINT NOT NULL AUTO_INCREMENT,
    price_list_id BIGINT NOT NULL,
    service_id BIGINT NOT NULL,
    item_type_id BIGINT NULL,
    pricing_method VARCHAR(30) NOT NULL,
    unit_type VARCHAR(20) NOT NULL,
    sharing_mode VARCHAR(30) NOT NULL DEFAULT 'ANY',
    priority_level INT NULL,
    base_price DECIMAL(18,2) NULL,
    unit_price DECIMAL(18,2) NULL,
    minimum_quantity DECIMAL(10,3) NULL,
    maximum_quantity DECIMAL(10,3) NULL,
    minimum_charge DECIMAL(18,2) NULL,
    included_quantity DECIMAL(10,3) NULL,
    excess_unit_price DECIMAL(18,2) NULL,
    tier_calculation_mode VARCHAR(20) NULL,
    rule_priority INT NOT NULL DEFAULT 0,
    effective_from TIMESTAMP(6) NOT NULL,
    effective_to TIMESTAMP(6) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    version_number INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_by BIGINT NOT NULL,
    published_at TIMESTAMP(6) NULL,
    published_by BIGINT NULL,
    row_version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_price_rules_list FOREIGN KEY (price_list_id) REFERENCES price_lists (id),
    CONSTRAINT fk_price_rules_service FOREIGN KEY (service_id) REFERENCES laundry_services (id),
    CONSTRAINT fk_price_rules_item_type FOREIGN KEY (item_type_id) REFERENCES item_types (id),
    CONSTRAINT fk_price_rules_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_price_rules_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
    CONSTRAINT fk_price_rules_published_by FOREIGN KEY (published_by) REFERENCES users (id),
    CONSTRAINT ck_price_rules_status CHECK (status IN ('DRAFT', 'ACTIVE', 'EXPIRED', 'ARCHIVED')),
    CONSTRAINT ck_price_rules_period CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT ck_price_rules_money CHECK (
        (base_price IS NULL OR base_price >= 0)
        AND (unit_price IS NULL OR unit_price >= 0)
        AND (minimum_charge IS NULL OR minimum_charge >= 0)
        AND (excess_unit_price IS NULL OR excess_unit_price >= 0)
    ),
    CONSTRAINT ck_price_rules_quantity CHECK (
        (minimum_quantity IS NULL OR minimum_quantity >= 0)
        AND (maximum_quantity IS NULL OR maximum_quantity > 0)
        AND (included_quantity IS NULL OR included_quantity >= 0)
        AND (minimum_quantity IS NULL OR maximum_quantity IS NULL OR maximum_quantity >= minimum_quantity)
    )
);

CREATE TABLE price_rule_tiers (
    id BIGINT NOT NULL AUTO_INCREMENT,
    price_rule_id BIGINT NOT NULL,
    from_quantity DECIMAL(10,3) NOT NULL,
    to_quantity DECIMAL(10,3) NULL,
    unit_price DECIMAL(18,2) NOT NULL,
    sort_order INT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_price_rule_tiers_start UNIQUE (price_rule_id, from_quantity),
    CONSTRAINT fk_price_rule_tiers_rule FOREIGN KEY (price_rule_id) REFERENCES price_rules (id),
    CONSTRAINT ck_price_rule_tiers_range CHECK (
        from_quantity >= 0 AND (to_quantity IS NULL OR to_quantity > from_quantity)
    ),
    CONSTRAINT ck_price_rule_tiers_price CHECK (unit_price >= 0),
    CONSTRAINT ck_price_rule_tiers_sort CHECK (sort_order >= 0)
);

CREATE TABLE pricing_audit_logs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    entity_type VARCHAR(40) NOT NULL,
    entity_id BIGINT NOT NULL,
    action VARCHAR(60) NOT NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    reason VARCHAR(500) NULL,
    branch_id BIGINT NULL,
    actor_user_id BIGINT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_pricing_audit_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
    CONSTRAINT fk_pricing_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users (id)
);

CREATE INDEX idx_laundry_services_status_name ON laundry_services (status, name_vi, id);
CREATE INDEX idx_item_types_parent_sort ON item_types (parent_id, sort_order, name_vi, id);
CREATE INDEX idx_item_types_status_name ON item_types (status, name_vi, id);
CREATE INDEX idx_price_lists_branch_status_period
    ON price_lists (branch_id, status, effective_from, effective_to, id);
CREATE INDEX idx_price_rules_resolution
    ON price_rules (price_list_id, status, service_id, item_type_id, sharing_mode, effective_from, effective_to);
CREATE INDEX idx_price_rules_priority
    ON price_rules (service_id, item_type_id, sharing_mode, rule_priority, version_number);
CREATE INDEX idx_price_rule_tiers_rule_sort ON price_rule_tiers (price_rule_id, sort_order, id);
CREATE INDEX idx_pricing_audit_entity_created
    ON pricing_audit_logs (entity_type, entity_id, created_at, id);
CREATE INDEX idx_pricing_audit_branch_created
    ON pricing_audit_logs (branch_id, created_at, id);

INSERT INTO permission_modules (
    code, name_vi, name_en, description_vi, description_en, display_order, status
) VALUES
    ('service', 'Danh mục dịch vụ', 'Service Catalog', 'Quản lý dịch vụ giặt là và khả năng xử lý.', 'Manage laundry services and processing capability.', 35, 'ACTIVE'),
    ('item-type', 'Danh mục loại đồ', 'Item Type Catalog', 'Quản lý cây phân loại đồ giặt.', 'Manage the hierarchical laundry item catalog.', 36, 'ACTIVE'),
    ('price-list', 'Bảng giá', 'Price Lists', 'Quản lý vòng đời bảng giá theo chi nhánh.', 'Manage branch-scoped price-list lifecycle.', 37, 'ACTIVE'),
    ('price-rule', 'Quy tắc giá', 'Pricing Rules', 'Quản lý quy tắc, bậc giá và phiên bản.', 'Manage pricing rules, tiers, and versions.', 38, 'ACTIVE'),
    ('pricing', 'Tính giá', 'Pricing Engine', 'Tính giá phía máy chủ và đọc lịch sử.', 'Calculate authoritative prices and read history.', 39, 'ACTIVE');

INSERT INTO permissions (
    code, name, module, resource, action, name_vi, name_en,
    description_vi, description_en, risk_level, display_order, is_system, status
) VALUES
    ('service.read', 'Xem dịch vụ', 'service', 'service', 'read', 'Xem dịch vụ', 'View services', 'Xem danh sách và chi tiết dịch vụ.', 'View service lists and details.', 'LOW', 10, TRUE, 'ACTIVE'),
    ('service.create', 'Tạo dịch vụ', 'service', 'service', 'create', 'Tạo dịch vụ', 'Create services', 'Tạo dịch vụ mới với mã do hệ thống sinh.', 'Create services with system-generated codes.', 'MEDIUM', 20, TRUE, 'ACTIVE'),
    ('service.update', 'Cập nhật dịch vụ', 'service', 'service', 'update', 'Cập nhật dịch vụ', 'Update services', 'Cập nhật thông tin dịch vụ.', 'Update service information.', 'MEDIUM', 30, TRUE, 'ACTIVE'),
    ('service.archive', 'Lưu trữ dịch vụ', 'service', 'service', 'archive', 'Lưu trữ dịch vụ', 'Archive services', 'Ngừng hoạt động hoặc lưu trữ dịch vụ.', 'Deactivate or archive services.', 'HIGH', 40, TRUE, 'ACTIVE'),
    ('item-type.read', 'Xem loại đồ', 'item-type', 'item-type', 'read', 'Xem loại đồ', 'View item types', 'Xem cây và chi tiết loại đồ.', 'View item hierarchy and details.', 'LOW', 10, TRUE, 'ACTIVE'),
    ('item-type.create', 'Tạo loại đồ', 'item-type', 'item-type', 'create', 'Tạo loại đồ', 'Create item types', 'Tạo loại đồ gốc hoặc loại đồ con.', 'Create root or child item types.', 'MEDIUM', 20, TRUE, 'ACTIVE'),
    ('item-type.update', 'Cập nhật loại đồ', 'item-type', 'item-type', 'update', 'Cập nhật loại đồ', 'Update item types', 'Cập nhật hoặc chuyển loại đồ.', 'Update or move item types.', 'MEDIUM', 30, TRUE, 'ACTIVE'),
    ('item-type.archive', 'Lưu trữ loại đồ', 'item-type', 'item-type', 'archive', 'Lưu trữ loại đồ', 'Archive item types', 'Ngừng hoạt động hoặc lưu trữ loại đồ.', 'Deactivate or archive item types.', 'HIGH', 40, TRUE, 'ACTIVE'),
    ('price-list.read', 'Xem bảng giá', 'price-list', 'price-list', 'read', 'Xem bảng giá', 'View price lists', 'Xem bảng giá trong phạm vi chi nhánh.', 'View branch-scoped price lists.', 'LOW', 10, TRUE, 'ACTIVE'),
    ('price-list.create', 'Tạo bảng giá', 'price-list', 'price-list', 'create', 'Tạo bảng giá', 'Create price lists', 'Tạo bảng giá nháp.', 'Create draft price lists.', 'MEDIUM', 20, TRUE, 'ACTIVE'),
    ('price-list.update-draft', 'Sửa bảng giá nháp', 'price-list', 'price-list', 'update-draft', 'Sửa bảng giá nháp', 'Update draft price lists', 'Cập nhật bảng giá nháp.', 'Update draft price lists.', 'MEDIUM', 30, TRUE, 'ACTIVE'),
    ('price-list.duplicate', 'Nhân bản bảng giá', 'price-list', 'price-list', 'duplicate', 'Nhân bản bảng giá', 'Duplicate price lists', 'Tạo bản nháp từ bảng giá hiện có.', 'Create a draft from an existing price list.', 'MEDIUM', 40, TRUE, 'ACTIVE'),
    ('price-list.publish', 'Công bố bảng giá', 'price-list', 'price-list', 'publish', 'Công bố bảng giá', 'Publish price lists', 'Công bố hoặc lên lịch bảng giá.', 'Publish or schedule price lists.', 'CRITICAL', 50, TRUE, 'ACTIVE'),
    ('price-list.archive', 'Lưu trữ bảng giá', 'price-list', 'price-list', 'archive', 'Lưu trữ bảng giá', 'Archive price lists', 'Lưu trữ bảng giá và giữ lịch sử.', 'Archive price lists and preserve history.', 'HIGH', 60, TRUE, 'ACTIVE'),
    ('price-rule.read', 'Xem quy tắc giá', 'price-rule', 'price-rule', 'read', 'Xem quy tắc giá', 'View pricing rules', 'Xem quy tắc và bậc giá.', 'View pricing rules and tiers.', 'LOW', 10, TRUE, 'ACTIVE'),
    ('price-rule.create', 'Tạo quy tắc giá', 'price-rule', 'price-rule', 'create', 'Tạo quy tắc giá', 'Create pricing rules', 'Thêm quy tắc vào bảng giá nháp.', 'Add rules to draft price lists.', 'MEDIUM', 20, TRUE, 'ACTIVE'),
    ('price-rule.update-draft', 'Sửa quy tắc nháp', 'price-rule', 'price-rule', 'update-draft', 'Sửa quy tắc nháp', 'Update draft pricing rules', 'Cập nhật quy tắc chưa công bố.', 'Update unpublished rules.', 'MEDIUM', 30, TRUE, 'ACTIVE'),
    ('price-rule.delete-draft', 'Xóa quy tắc nháp', 'price-rule', 'price-rule', 'delete-draft', 'Xóa quy tắc nháp', 'Delete draft pricing rules', 'Xóa quy tắc chỉ khi còn nháp.', 'Delete rules only while draft.', 'HIGH', 40, TRUE, 'ACTIVE'),
    ('price-rule.override-conflict', 'Ghi đè xung đột giá', 'price-rule', 'price-rule', 'override-conflict', 'Ghi đè xung đột giá', 'Override pricing conflicts', 'Thực hiện ngoại lệ có lý do cho xung đột.', 'Perform a reasoned conflict exception.', 'CRITICAL', 50, TRUE, 'ACTIVE'),
    ('pricing.preview', 'Xem thử giá', 'pricing', 'pricing', 'preview', 'Xem thử giá', 'Preview prices', 'Yêu cầu máy chủ tính thử giá.', 'Request an authoritative price preview.', 'LOW', 10, TRUE, 'ACTIVE'),
    ('pricing.read-history', 'Xem lịch sử giá', 'pricing', 'pricing', 'read-history', 'Xem lịch sử giá', 'View pricing history', 'Xem lịch sử công bố và phiên bản.', 'View publication and version history.', 'MEDIUM', 20, TRUE, 'ACTIVE');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.module IN ('service', 'item-type', 'price-list', 'price-rule', 'pricing')
WHERE r.code = 'OWNER';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
    'service.read', 'service.create', 'service.update', 'service.archive',
    'item-type.read', 'item-type.create', 'item-type.update', 'item-type.archive',
    'price-list.read', 'price-list.create', 'price-list.update-draft', 'price-list.duplicate',
    'price-list.publish', 'price-list.archive',
    'price-rule.read', 'price-rule.create', 'price-rule.update-draft', 'price-rule.delete-draft',
    'pricing.preview', 'pricing.read-history'
) WHERE r.code = 'MANAGER';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
    'service.read', 'item-type.read', 'price-list.read', 'price-rule.read', 'pricing.preview'
) WHERE r.code = 'RECEPTIONIST';
