ALTER TABLE permissions ADD COLUMN resource VARCHAR(100) NULL;
ALTER TABLE permissions ADD COLUMN action VARCHAR(60) NULL;
ALTER TABLE permissions ADD COLUMN name_vi VARCHAR(150) NULL;
ALTER TABLE permissions ADD COLUMN name_en VARCHAR(150) NULL;
ALTER TABLE permissions ADD COLUMN description_vi VARCHAR(500) NULL;
ALTER TABLE permissions ADD COLUMN description_en VARCHAR(500) NULL;
ALTER TABLE permissions ADD COLUMN risk_level VARCHAR(20) NULL;
ALTER TABLE permissions ADD COLUMN display_order INT NULL;

UPDATE permissions
SET resource = 'customer',
    action = 'read',
    name_vi = 'Xem khách hàng',
    name_en = 'View customers',
    description_vi = 'Xem danh sách và chi tiết khách hàng trong phạm vi dữ liệu được phép.',
    description_en = 'View customer lists and details within the allowed data scope.',
    risk_level = 'LOW',
    display_order = 10
WHERE code = 'customer.read';

UPDATE permissions
SET resource = 'customer',
    action = 'create',
    name_vi = 'Tạo khách hàng',
    name_en = 'Create customers',
    description_vi = 'Tạo hồ sơ khách hàng mới trong chi nhánh được phép.',
    description_en = 'Create a customer profile in an allowed branch.',
    risk_level = 'MEDIUM',
    display_order = 20
WHERE code = 'customer.create';

UPDATE permissions
SET resource = 'customer',
    action = 'update',
    name_vi = 'Cập nhật khách hàng',
    name_en = 'Update customers',
    description_vi = 'Cập nhật thông tin hồ sơ khách hàng.',
    description_en = 'Update customer profile information.',
    risk_level = 'MEDIUM',
    display_order = 30
WHERE code = 'customer.update';

UPDATE permissions
SET resource = 'customer',
    action = 'deactivate',
    name_vi = 'Đổi trạng thái khách hàng',
    name_en = 'Change customer status',
    description_vi = 'Vô hiệu hóa hoặc kích hoạt lại hồ sơ khách hàng.',
    description_en = 'Deactivate or reactivate a customer profile.',
    risk_level = 'HIGH',
    display_order = 40
WHERE code = 'customer.deactivate';

UPDATE permissions
SET resource = 'customer.address',
    action = 'manage',
    name_vi = 'Quản lý địa chỉ khách hàng',
    name_en = 'Manage customer addresses',
    description_vi = 'Tạo, sửa, đặt mặc định và đổi trạng thái địa chỉ khách hàng.',
    description_en = 'Create, update, set default, and change customer address status.',
    risk_level = 'MEDIUM',
    display_order = 50
WHERE code = 'customer.address.manage';

UPDATE permissions
SET resource = 'customer.audit',
    action = 'read',
    name_vi = 'Xem lịch sử khách hàng',
    name_en = 'View customer audit history',
    description_vi = 'Xem lịch sử thay đổi và người thực hiện trên hồ sơ khách hàng.',
    description_en = 'View customer change history and acting users.',
    risk_level = 'HIGH',
    display_order = 60
WHERE code = 'customer.audit.read';

CREATE TABLE user_permission_overrides (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    permission_id BIGINT NOT NULL,
    effect VARCHAR(10) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_user_permission_override UNIQUE (user_id, permission_id),
    CONSTRAINT fk_user_permission_override_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_user_permission_override_permission FOREIGN KEY (permission_id) REFERENCES permissions (id),
    CONSTRAINT ck_user_permission_override_effect CHECK (effect IN ('ALLOW', 'DENY'))
);

CREATE INDEX idx_user_permission_override_permission ON user_permission_overrides (permission_id, user_id);
