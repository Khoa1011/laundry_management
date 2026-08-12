INSERT INTO permission_modules (
    code, name_vi, name_en, description_vi, description_en, display_order, status
) VALUES (
    'location',
    'Danh mục địa chỉ',
    'Location Catalog',
    'Tra cứu danh mục tỉnh, thành, quận, huyện, phường và xã Việt Nam theo phiên bản hành chính.',
    'Look up Vietnamese provinces, districts, and wards by administrative version.',
    15,
    'ACTIVE'
);

INSERT INTO permissions (
    code, name, module, resource, action, name_vi, name_en,
    description_vi, description_en, risk_level, display_order,
    is_system, status
) VALUES (
    'location.read',
    'Tra cứu danh mục địa chỉ',
    'location',
    'location',
    'read',
    'Tra cứu danh mục địa chỉ',
    'View location catalog',
    'Tra cứu tỉnh, thành, quận, huyện, phường và xã để nhập địa chỉ có cấu trúc.',
    'View provinces, districts, and wards for structured address entry.',
    'LOW',
    10,
    TRUE,
    'ACTIVE'
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'location.read'
WHERE r.code IN ('OWNER', 'MANAGER', 'RECEPTIONIST');

ALTER TABLE customer_addresses ADD COLUMN administrative_version VARCHAR(10) NULL;
ALTER TABLE customer_addresses ADD COLUMN province_code INT NULL;
ALTER TABLE customer_addresses ADD COLUMN district_code INT NULL;
ALTER TABLE customer_addresses ADD COLUMN ward_code INT NULL;
ALTER TABLE customer_addresses ADD CONSTRAINT ck_customer_address_admin_version
    CHECK (administrative_version IS NULL OR administrative_version IN ('V1', 'V2'));
ALTER TABLE customer_addresses ADD CONSTRAINT ck_customer_address_v2_no_district
    CHECK (administrative_version <> 'V2' OR (district IS NULL AND district_code IS NULL));

ALTER TABLE employees ADD COLUMN administrative_version VARCHAR(10) NULL;
ALTER TABLE employees ADD COLUMN province VARCHAR(120) NULL;
ALTER TABLE employees ADD COLUMN province_code INT NULL;
ALTER TABLE employees ADD COLUMN district VARCHAR(120) NULL;
ALTER TABLE employees ADD COLUMN district_code INT NULL;
ALTER TABLE employees ADD COLUMN ward VARCHAR(120) NULL;
ALTER TABLE employees ADD COLUMN ward_code INT NULL;
ALTER TABLE employees ADD CONSTRAINT ck_employee_address_admin_version
    CHECK (administrative_version IS NULL OR administrative_version IN ('V1', 'V2'));
ALTER TABLE employees ADD CONSTRAINT ck_employee_address_v2_no_district
    CHECK (administrative_version <> 'V2' OR (district IS NULL AND district_code IS NULL));
