CREATE TABLE permission_modules (
    code VARCHAR(60) NOT NULL,
    name_vi VARCHAR(150) NOT NULL,
    name_en VARCHAR(150) NOT NULL,
    description_vi VARCHAR(500) NULL,
    description_en VARCHAR(500) NULL,
    display_order INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (code)
);

INSERT INTO permission_modules (
    code, name_vi, name_en, description_vi, description_en, display_order, status
) VALUES
    (
        'access',
        'Phân quyền và truy cập',
        'Access Control',
        'Quản lý danh mục quyền, vai trò, quyền người dùng và lịch sử thay đổi phân quyền.',
        'Manage the permission catalog, roles, user access overrides, and authorization history.',
        5,
        'ACTIVE'
    ),
    (
        'customer',
        'Khách hàng',
        'Customer Management',
        'Quản lý hồ sơ, địa chỉ và lịch sử thay đổi của khách hàng.',
        'Manage customer profiles, addresses, and change history.',
        10,
        'ACTIVE'
    );
