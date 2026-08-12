ALTER TABLE users ADD COLUMN locked_at TIMESTAMP(6) NULL;
ALTER TABLE users ADD COLUMN locked_reason VARCHAR(500) NULL;
ALTER TABLE users ADD COLUMN locked_by BIGINT NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_locked_by FOREIGN KEY (locked_by) REFERENCES users (id);

CREATE TABLE employee_positions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    code VARCHAR(60) NOT NULL,
    name_vi VARCHAR(150) NOT NULL,
    name_en VARCHAR(150) NOT NULL,
    description_vi VARCHAR(500) NULL,
    description_en VARCHAR(500) NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_by BIGINT NULL,
    updated_by BIGINT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_employee_positions_code UNIQUE (code),
    CONSTRAINT ck_employee_positions_sort_order CHECK (sort_order >= 0),
    CONSTRAINT fk_employee_positions_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_employee_positions_updated_by FOREIGN KEY (updated_by) REFERENCES users (id)
);

CREATE TABLE employee_code_sequences (
    sequence_name VARCHAR(40) NOT NULL,
    next_value BIGINT NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (sequence_name),
    CONSTRAINT ck_employee_code_sequence_positive CHECK (next_value > 0)
);

CREATE TABLE employees (
    id BIGINT NOT NULL AUTO_INCREMENT,
    employee_code VARCHAR(30) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NULL,
    normalized_phone VARCHAR(20) NULL,
    email VARCHAR(254) NULL,
    birth_date DATE NULL,
    address VARCHAR(500) NULL,
    hire_date DATE NOT NULL,
    position_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    linked_user_id BIGINT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_employees_employee_code UNIQUE (employee_code),
    CONSTRAINT uk_employees_linked_user UNIQUE (linked_user_id),
    CONSTRAINT fk_employees_position FOREIGN KEY (position_id) REFERENCES employee_positions (id),
    CONSTRAINT fk_employees_linked_user FOREIGN KEY (linked_user_id) REFERENCES users (id),
    CONSTRAINT fk_employees_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_employees_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
    CONSTRAINT ck_employees_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED'))
);

CREATE TABLE employee_branches (
    id BIGINT NOT NULL AUTO_INCREMENT,
    employee_id BIGINT NOT NULL,
    branch_id BIGINT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    active_marker BOOLEAN NULL,
    primary_marker BOOLEAN NULL,
    assigned_at TIMESTAMP(6) NOT NULL,
    unassigned_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_by BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_employee_branch_active UNIQUE (employee_id, branch_id, active_marker),
    CONSTRAINT uk_employee_primary_branch UNIQUE (employee_id, primary_marker),
    CONSTRAINT fk_employee_branches_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT fk_employee_branches_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
    CONSTRAINT fk_employee_branches_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT ck_employee_branch_active_marker CHECK (
        (unassigned_at IS NULL AND active_marker = TRUE)
        OR (unassigned_at IS NOT NULL AND active_marker IS NULL)
    ),
    CONSTRAINT ck_employee_branch_primary_marker CHECK (
        (unassigned_at IS NULL AND is_primary = TRUE AND primary_marker = TRUE)
        OR ((unassigned_at IS NOT NULL OR is_primary = FALSE) AND primary_marker IS NULL)
    )
);

CREATE TABLE employee_audit_logs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    employee_id BIGINT NOT NULL,
    action VARCHAR(60) NOT NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    reason VARCHAR(500) NULL,
    branch_id BIGINT NULL,
    actor_user_id BIGINT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_employee_audit_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT fk_employee_audit_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
    CONSTRAINT fk_employee_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users (id)
);

CREATE INDEX idx_employees_status_code ON employees (status, employee_code, id);
CREATE INDEX idx_employees_position_status ON employees (position_id, status, id);
CREATE INDEX idx_employees_phone ON employees (normalized_phone, id);
CREATE INDEX idx_employees_email ON employees (email, id);
CREATE INDEX idx_employees_full_name ON employees (full_name, id);
CREATE INDEX idx_employees_hire_date ON employees (hire_date, id);
CREATE INDEX idx_employees_updated_at ON employees (updated_at, id);
CREATE INDEX idx_employee_branches_scope ON employee_branches (branch_id, active_marker, employee_id);
CREATE INDEX idx_employee_branches_employee_history ON employee_branches (employee_id, assigned_at, id);
CREATE INDEX idx_employee_audit_employee_created ON employee_audit_logs (employee_id, created_at, id);
CREATE INDEX idx_employee_audit_branch_created ON employee_audit_logs (branch_id, created_at, id);

INSERT INTO employee_code_sequences (sequence_name, next_value) VALUES ('EMPLOYEE', 1);

INSERT INTO employee_positions (
    code, name_vi, name_en, description_vi, description_en, active, sort_order
) VALUES
    ('MANAGER', 'Quản lý', 'Manager', 'Điều phối hoạt động và nhân sự tại cửa hàng.', 'Coordinates store operations and staff.', TRUE, 10),
    ('RECEPTIONIST', 'Lễ tân', 'Receptionist', 'Tiếp nhận khách hàng và đơn giặt sấy.', 'Receives customers and laundry orders.', TRUE, 20),
    ('CASHIER', 'Thu ngân', 'Cashier', 'Thực hiện nghiệp vụ thu tiền tại quầy.', 'Handles counter payment operations.', TRUE, 30),
    ('LAUNDRY_OPERATOR', 'Nhân viên giặt sấy', 'Laundry operator', 'Thực hiện các công đoạn giặt, sấy và hoàn thiện.', 'Performs washing, drying, and finishing work.', TRUE, 40),
    ('DELIVERY_STAFF', 'Nhân viên giao nhận', 'Delivery staff', 'Thực hiện giao và nhận đồ của khách hàng.', 'Handles customer pickup and delivery.', TRUE, 50),
    ('WAREHOUSE_STAFF', 'Nhân viên kho', 'Warehouse staff', 'Theo dõi và xử lý vật tư trong kho.', 'Handles inventory materials and stock.', TRUE, 60),
    ('ACCOUNTANT', 'Kế toán', 'Accountant', 'Theo dõi nghiệp vụ kế toán và đối soát.', 'Handles accounting and reconciliation.', TRUE, 70);

INSERT INTO permission_modules (
    code, name_vi, name_en, description_vi, description_en, display_order, status
) VALUES (
    'employee',
    'Nhân viên',
    'Employee Management',
    'Quản lý hồ sơ, vị trí công việc, chi nhánh làm việc, tài khoản liên kết và lịch sử thay đổi của nhân viên.',
    'Manage employee profiles, positions, working branches, linked accounts, and change history.',
    20,
    'ACTIVE'
);

INSERT INTO permissions (
    code, name, module, resource, action, name_vi, name_en,
    description_vi, description_en, risk_level, display_order,
    is_system, status
) VALUES
    ('employee.read', 'Xem nhân viên', 'employee', 'employee', 'read', 'Xem nhân viên', 'View employees', 'Xem danh sách và hồ sơ nhân viên trong phạm vi chi nhánh được phép.', 'View employee lists and profiles within the allowed branch scope.', 'LOW', 10, TRUE, 'ACTIVE'),
    ('employee.read-self', 'Xem hồ sơ nhân viên của bản thân', 'employee', 'employee', 'read-self', 'Xem hồ sơ nhân viên của bản thân', 'View own employee profile', 'Xem hồ sơ nhân viên đang liên kết với tài khoản hiện tại.', 'View the employee profile linked to the current account.', 'LOW', 20, TRUE, 'ACTIVE'),
    ('employee.create', 'Tạo nhân viên', 'employee', 'employee', 'create', 'Tạo nhân viên', 'Create employees', 'Tạo hồ sơ nhân viên trong các chi nhánh được phép.', 'Create employee profiles in allowed branches.', 'MEDIUM', 30, TRUE, 'ACTIVE'),
    ('employee.update', 'Cập nhật hồ sơ nhân viên', 'employee', 'employee', 'update', 'Cập nhật hồ sơ nhân viên', 'Update employee profiles', 'Cập nhật thông tin hồ sơ thông thường của nhân viên.', 'Update ordinary employee profile fields.', 'MEDIUM', 40, TRUE, 'ACTIVE'),
    ('employee.status.change', 'Thay đổi trạng thái nhân viên', 'employee', 'employee.status', 'change', 'Thay đổi trạng thái nhân viên', 'Change employee status', 'Thay đổi vòng đời làm việc và khóa tài khoản liên kết khi chính sách yêu cầu.', 'Change employment lifecycle status and lock linked accounts when policy requires it.', 'HIGH', 50, TRUE, 'ACTIVE'),
    ('employee.account.link', 'Liên kết tài khoản nhân viên', 'employee', 'employee.account', 'link', 'Liên kết tài khoản nhân viên', 'Link employee accounts', 'Liên kết một tài khoản hiện có với hồ sơ nhân viên.', 'Link an existing user account to an employee profile.', 'HIGH', 60, TRUE, 'ACTIVE'),
    ('employee.account.unlink', 'Gỡ liên kết tài khoản nhân viên', 'employee', 'employee.account', 'unlink', 'Gỡ liên kết tài khoản nhân viên', 'Unlink employee accounts', 'Gỡ liên kết tài khoản mà không xóa hoặc tự động vô hiệu hóa tài khoản.', 'Unlink an account without deleting or automatically deactivating it.', 'HIGH', 70, TRUE, 'ACTIVE'),
    ('employee.branch.assign', 'Gán chi nhánh làm việc', 'employee', 'employee.branch', 'assign', 'Gán chi nhánh làm việc', 'Assign employee branches', 'Gán thêm chi nhánh làm việc cho nhân viên.', 'Assign additional working branches to an employee.', 'HIGH', 80, TRUE, 'ACTIVE'),
    ('employee.branch.remove', 'Gỡ chi nhánh làm việc', 'employee', 'employee.branch', 'remove', 'Gỡ chi nhánh làm việc', 'Remove employee branches', 'Kết thúc một phân công chi nhánh làm việc đang hoạt động.', 'End an active employee working-branch assignment.', 'HIGH', 90, TRUE, 'ACTIVE'),
    ('employee.position.assign', 'Gán vị trí công việc', 'employee', 'employee.position', 'assign', 'Gán vị trí công việc', 'Assign employee positions', 'Gán hoặc thay đổi vị trí công việc của nhân viên.', 'Assign or change an employee working position.', 'MEDIUM', 100, TRUE, 'ACTIVE'),
    ('employee.position.read', 'Xem danh mục vị trí công việc', 'employee', 'employee.position', 'read', 'Xem danh mục vị trí công việc', 'View employee positions', 'Xem các vị trí công việc để lọc hoặc gán cho nhân viên.', 'View working positions for employee filtering and assignment.', 'LOW', 110, TRUE, 'ACTIVE'),
    ('employee.position.manage', 'Quản lý danh mục vị trí công việc', 'employee', 'employee.position', 'manage', 'Quản lý danh mục vị trí công việc', 'Manage employee positions', 'Tạo, cập nhật hoặc ngừng sử dụng vị trí công việc.', 'Create, update, or deactivate working positions.', 'HIGH', 120, TRUE, 'ACTIVE'),
    ('employee.audit.read', 'Xem lịch sử nhân viên', 'employee', 'employee.audit', 'read', 'Xem lịch sử nhân viên', 'View employee audit history', 'Xem lịch sử thay đổi, người thực hiện và phạm vi chi nhánh của nhân viên.', 'View employee changes, acting users, and branch scope.', 'HIGH', 130, TRUE, 'ACTIVE'),
    ('employee.manage-all-branches', 'Quản lý nhân viên toàn hệ thống', 'employee', 'employee', 'manage-all-branches', 'Quản lý nhân viên toàn hệ thống', 'Manage employees across all branches', 'Mở rộng phạm vi chi nhánh cho hành động Employee đã được cấp riêng; quyền này không tự cấp bất kỳ hành động nào.', 'Extend branch scope for separately granted Employee actions; this permission grants no action by itself.', 'CRITICAL', 140, TRUE, 'ACTIVE');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.module = 'employee'
WHERE r.code = 'OWNER';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'employee.read',
    'employee.read-self',
    'employee.create',
    'employee.update',
    'employee.status.change',
    'employee.account.link',
    'employee.account.unlink',
    'employee.branch.assign',
    'employee.branch.remove',
    'employee.position.assign',
    'employee.position.read',
    'employee.audit.read'
)
WHERE r.code = 'MANAGER';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'employee.read-self'
WHERE r.code = 'RECEPTIONIST';
