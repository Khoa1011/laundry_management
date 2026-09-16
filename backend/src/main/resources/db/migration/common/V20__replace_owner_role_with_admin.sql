INSERT INTO roles (
    code, name, description, display_name, business_description,
    name_vi, name_en, description_vi, description_en,
    status, is_system, version, created_at, updated_at, created_by, updated_by
)
SELECT
    'ADMIN', 'Quản trị viên', 'Toàn quyền trong các chi nhánh được phân công',
    'Quản trị viên', 'Toàn quyền trong các chi nhánh được phân công',
    'Quản trị viên', 'Administrator',
    'Toàn quyền trong các chi nhánh được phân công',
    'Full access within assigned branches',
    owner_role.status, TRUE, owner_role.version,
    owner_role.created_at, CURRENT_TIMESTAMP(6), owner_role.created_by, owner_role.updated_by
FROM roles owner_role
WHERE owner_role.code = 'OWNER'
  AND NOT EXISTS (SELECT 1 FROM roles admin_role WHERE admin_role.code = 'ADMIN');

INSERT INTO role_permissions (role_id, permission_id, created_at, created_by)
SELECT admin_role.id, role_permission.permission_id, role_permission.created_at, role_permission.created_by
FROM role_permissions role_permission
JOIN roles owner_role ON owner_role.id = role_permission.role_id AND owner_role.code = 'OWNER'
JOIN roles admin_role ON admin_role.code = 'ADMIN'
WHERE NOT EXISTS (
    SELECT 1
    FROM role_permissions existing_permission
    WHERE existing_permission.role_id = admin_role.id
      AND existing_permission.permission_id = role_permission.permission_id
);

INSERT INTO user_roles (
    user_id, role_id, is_primary, effective_from, effective_to, created_at, created_by
)
SELECT
    user_role.user_id, admin_role.id, user_role.is_primary,
    user_role.effective_from, user_role.effective_to, user_role.created_at, user_role.created_by
FROM user_roles user_role
JOIN roles owner_role ON owner_role.id = user_role.role_id AND owner_role.code = 'OWNER'
JOIN roles admin_role ON admin_role.code = 'ADMIN'
WHERE NOT EXISTS (
    SELECT 1
    FROM user_roles existing_role
    WHERE existing_role.user_id = user_role.user_id
      AND existing_role.role_id = admin_role.id
);

DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE code = 'OWNER');

DELETE FROM user_roles
WHERE role_id IN (SELECT id FROM roles WHERE code = 'OWNER');

DELETE FROM roles
WHERE code = 'OWNER';

UPDATE roles
SET name = 'Quản trị viên',
    description = 'Toàn quyền trong các chi nhánh được phân công',
    display_name = 'Quản trị viên',
    business_description = 'Toàn quyền trong các chi nhánh được phân công',
    name_vi = 'Quản trị viên',
    name_en = 'Administrator',
    description_vi = 'Toàn quyền trong các chi nhánh được phân công',
    description_en = 'Full access within assigned branches',
    is_system = TRUE,
    updated_at = CURRENT_TIMESTAMP(6)
WHERE code = 'ADMIN';

UPDATE users
SET username = 'admin',
    display_name = 'Admin',
    updated_at = CURRENT_TIMESTAMP(6)
WHERE LOWER(username) = 'demo-owner'
  AND NOT EXISTS (
      SELECT 1
      FROM (SELECT username FROM users) existing_users
      WHERE LOWER(existing_users.username) = 'admin'
  );

UPDATE users
SET status = 'INACTIVE',
    updated_at = CURRENT_TIMESTAMP(6)
WHERE LOWER(username) = 'demo-owner';
