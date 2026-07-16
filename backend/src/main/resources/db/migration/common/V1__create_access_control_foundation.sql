CREATE TABLE branches (
    id BIGINT NOT NULL AUTO_INCREMENT,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(150) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_branches_code UNIQUE (code),
    CONSTRAINT ck_branches_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    default_branch_id BIGINT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_users_username UNIQUE (username),
    CONSTRAINT fk_users_default_branch FOREIGN KEY (default_branch_id) REFERENCES branches (id),
    CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE roles (
    id BIGINT NOT NULL AUTO_INCREMENT,
    code VARCHAR(60) NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_roles_code UNIQUE (code)
);

CREATE TABLE permissions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    code VARCHAR(100) NOT NULL,
    name VARCHAR(150) NOT NULL,
    module VARCHAR(60) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_permissions_code UNIQUE (code)
);

CREATE TABLE user_roles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles (id)
);

CREATE TABLE role_permissions (
    role_id BIGINT NOT NULL,
    permission_id BIGINT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles (id),
    CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions (id)
);

CREATE TABLE user_branches (
    user_id BIGINT NOT NULL,
    branch_id BIGINT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (user_id, branch_id),
    CONSTRAINT fk_user_branches_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_user_branches_branch FOREIGN KEY (branch_id) REFERENCES branches (id)
);

CREATE INDEX idx_users_default_branch ON users (default_branch_id);
CREATE INDEX idx_user_branches_branch_user ON user_branches (branch_id, user_id);

INSERT INTO roles (code, name, description) VALUES
    ('OWNER', 'Chủ cửa hàng', 'Toàn quyền trong các chi nhánh được phân công'),
    ('MANAGER', 'Quản lý', 'Quản lý khách hàng trong các chi nhánh được phân công'),
    ('RECEPTIONIST', 'Nhân viên tiếp nhận', 'Tiếp nhận và cập nhật khách hàng');

INSERT INTO permissions (code, name, module) VALUES
    ('customer.read', 'Xem khách hàng', 'customer'),
    ('customer.create', 'Tạo khách hàng', 'customer'),
    ('customer.update', 'Cập nhật khách hàng', 'customer'),
    ('customer.deactivate', 'Thay đổi trạng thái khách hàng', 'customer'),
    ('customer.address.manage', 'Quản lý địa chỉ khách hàng', 'customer'),
    ('customer.audit.read', 'Xem lịch sử khách hàng', 'customer');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('OWNER', 'MANAGER');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'RECEPTIONIST'
  AND p.code IN ('customer.read', 'customer.create', 'customer.update', 'customer.address.manage');
