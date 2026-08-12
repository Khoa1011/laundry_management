ALTER TABLE permissions ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE permissions ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE permissions ADD COLUMN created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
ALTER TABLE permissions ADD COLUMN updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);

ALTER TABLE roles ADD COLUMN name_vi VARCHAR(120) NULL;
ALTER TABLE roles ADD COLUMN name_en VARCHAR(120) NULL;
ALTER TABLE roles ADD COLUMN description_vi VARCHAR(500) NULL;
ALTER TABLE roles ADD COLUMN description_en VARCHAR(500) NULL;
ALTER TABLE roles ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE roles ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE roles ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE roles ADD COLUMN created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
ALTER TABLE roles ADD COLUMN updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
ALTER TABLE roles ADD COLUMN created_by BIGINT NULL;
ALTER TABLE roles ADD COLUMN updated_by BIGINT NULL;

UPDATE roles
SET name_vi = name,
    name_en = CASE code
        WHEN 'OWNER' THEN 'Owner'
        WHEN 'MANAGER' THEN 'Manager'
        WHEN 'RECEPTIONIST' THEN 'Receptionist'
        ELSE code
    END,
    description_vi = description,
    description_en = description
WHERE name_vi IS NULL;

ALTER TABLE user_roles ADD COLUMN is_primary BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_roles ADD COLUMN effective_from TIMESTAMP(6) NULL;
ALTER TABLE user_roles ADD COLUMN effective_to TIMESTAMP(6) NULL;
ALTER TABLE user_roles ADD COLUMN created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
ALTER TABLE user_roles ADD COLUMN created_by BIGINT NULL;

ALTER TABLE role_permissions ADD COLUMN created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
ALTER TABLE role_permissions ADD COLUMN created_by BIGINT NULL;

ALTER TABLE users ADD COLUMN authorization_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN access_version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE user_permission_overrides ADD COLUMN reason VARCHAR(500) NULL;
ALTER TABLE user_permission_overrides ADD COLUMN effective_from TIMESTAMP(6) NULL;
ALTER TABLE user_permission_overrides ADD COLUMN effective_to TIMESTAMP(6) NULL;
ALTER TABLE user_permission_overrides ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE user_permission_overrides ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE user_permission_overrides ADD COLUMN created_by BIGINT NULL;
ALTER TABLE user_permission_overrides ADD COLUMN updated_by BIGINT NULL;

UPDATE user_permission_overrides
SET reason = 'Migrated existing override'
WHERE reason IS NULL;

CREATE TABLE authorization_audit_logs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    actor_user_id BIGINT NOT NULL,
    target_type VARCHAR(40) NOT NULL,
    target_id BIGINT NOT NULL,
    action VARCHAR(60) NOT NULL,
    permission_code VARCHAR(100) NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    reason VARCHAR(500) NULL,
    branch_id BIGINT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_access_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users (id),
    CONSTRAINT fk_access_audit_branch FOREIGN KEY (branch_id) REFERENCES branches (id)
);

CREATE INDEX idx_permissions_module_status_order
    ON permissions (module, status, display_order, code);
CREATE INDEX idx_roles_status_system_updated
    ON roles (status, is_system, updated_at, id);
CREATE INDEX idx_user_roles_role_primary
    ON user_roles (role_id, is_primary, user_id);
CREATE INDEX idx_user_overrides_user_status_period
    ON user_permission_overrides (user_id, status, effective_from, effective_to);
CREATE INDEX idx_access_audit_created
    ON authorization_audit_logs (created_at, id);
CREATE INDEX idx_access_audit_target
    ON authorization_audit_logs (target_type, target_id, created_at, id);
CREATE INDEX idx_access_audit_actor
    ON authorization_audit_logs (actor_user_id, created_at, id);

INSERT INTO permissions (
    code, name, module, resource, action, name_vi, name_en,
    description_vi, description_en, risk_level, display_order,
    is_system, status
) VALUES
    ('access.permission.read', 'Xem danh mục quyền', 'access', 'access.permission', 'read',
     'Xem danh mục quyền', 'View permission catalog',
     'Xem danh mục quyền và các quyền được nhóm theo mô-đun.',
     'View the permission catalog and permissions grouped by module.', 'LOW', 10, TRUE, 'ACTIVE'),
    ('access.role.read', 'Xem vai trò', 'access', 'access.role', 'read',
     'Xem vai trò', 'View roles', 'Xem danh sách, chi tiết và ma trận quyền của vai trò.',
     'View role lists, details, and permission matrices.', 'LOW', 20, TRUE, 'ACTIVE'),
    ('access.role.create', 'Tạo vai trò', 'access', 'access.role', 'create',
     'Tạo vai trò', 'Create roles', 'Tạo vai trò tùy chỉnh mới.',
     'Create a new custom role.', 'MEDIUM', 30, TRUE, 'ACTIVE'),
    ('access.role.update', 'Cập nhật vai trò', 'access', 'access.role', 'update',
     'Cập nhật vai trò', 'Update roles', 'Cập nhật tên, mô tả và trạng thái hợp lệ của vai trò.',
     'Update role names, descriptions, and eligible status.', 'MEDIUM', 40, TRUE, 'ACTIVE'),
    ('access.role.clone', 'Sao chép vai trò', 'access', 'access.role', 'clone',
     'Sao chép vai trò', 'Clone roles', 'Tạo vai trò tùy chỉnh từ quyền mặc định của vai trò hiện có.',
     'Create a custom role from an existing role default permissions.', 'MEDIUM', 50, TRUE, 'ACTIVE'),
    ('access.role.deactivate', 'Đổi trạng thái vai trò', 'access', 'access.role', 'deactivate',
     'Đổi trạng thái vai trò', 'Change role status', 'Kích hoạt hoặc vô hiệu hóa vai trò đủ điều kiện.',
     'Activate or deactivate an eligible role.', 'HIGH', 60, TRUE, 'ACTIVE'),
    ('access.role.permission.assign', 'Gán quyền cho vai trò', 'access', 'access.role.permission', 'assign',
     'Gán quyền cho vai trò', 'Assign role permissions', 'Lưu toàn bộ ma trận quyền mặc định của vai trò.',
     'Save the complete default permission matrix for a role.', 'HIGH', 70, TRUE, 'ACTIVE'),
    ('access.user.read', 'Xem truy cập người dùng', 'access', 'access.user', 'read',
     'Xem truy cập người dùng', 'View user access', 'Tìm kiếm và xem cấu hình truy cập của người dùng.',
     'Search and view user access configuration.', 'MEDIUM', 80, TRUE, 'ACTIVE'),
    ('access.user.role.assign', 'Gán vai trò người dùng', 'access', 'access.user.role', 'assign',
     'Gán vai trò người dùng', 'Assign user roles', 'Gán hoặc thay đổi vai trò chính đang hoạt động của người dùng.',
     'Assign or change a user active primary role.', 'HIGH', 90, TRUE, 'ACTIVE'),
    ('access.user.permission.override', 'Ghi đè quyền người dùng', 'access', 'access.user.permission', 'override',
     'Ghi đè quyền người dùng', 'Override user permissions', 'Thêm, thay đổi hoặc xóa ghi đè ALLOW và DENY của người dùng.',
     'Add, change, or remove user ALLOW and DENY overrides.', 'HIGH', 100, TRUE, 'ACTIVE'),
    ('access.effective-permission.read', 'Xem quyền hiệu lực', 'access', 'access.effective-permission', 'read',
     'Xem quyền hiệu lực', 'View effective permissions', 'Xem quyền hiệu lực và nguồn tạo ra kết quả phân quyền.',
     'View effective permissions and their authorization sources.', 'MEDIUM', 110, TRUE, 'ACTIVE'),
    ('access.audit.read', 'Xem nhật ký phân quyền', 'access', 'access.audit', 'read',
     'Xem nhật ký phân quyền', 'View authorization audit', 'Xem lịch sử thay đổi vai trò, ma trận và quyền người dùng.',
     'View role, matrix, and user authorization change history.', 'MEDIUM', 120, TRUE, 'ACTIVE');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.module = 'access'
WHERE r.code = 'OWNER';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'access.permission.read',
    'access.role.read',
    'access.user.read',
    'access.effective-permission.read',
    'access.audit.read'
)
WHERE r.code = 'MANAGER';
