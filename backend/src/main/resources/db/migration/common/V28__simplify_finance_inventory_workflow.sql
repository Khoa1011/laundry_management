-- Forward-only transition. Retain historical permission, grant, override and settings data.
-- New cancellation grants follow existing reversal grants, never approval grants or role names.
ALTER TABLE inventory_settings ALTER COLUMN approval_required SET DEFAULT FALSE;
ALTER TABLE inventory_settings ALTER COLUMN approval_threshold SET DEFAULT 0;
ALTER TABLE finance_settings ALTER COLUMN approval_required SET DEFAULT FALSE;
ALTER TABLE finance_settings ALTER COLUMN approval_threshold SET DEFAULT 0;

UPDATE permissions SET name='Chỉnh sửa chứng từ đã lưu', name_vi='Chỉnh sửa chứng từ đã lưu', name_en='Edit saved documents', description_vi='Chỉnh sửa chứng từ đã lưu trong chi nhánh được phép; tính chênh lệch an toàn, giữ ledger cũ và audit.', description_en='Edit saved branch-scoped documents using safe revision deltas, immutable ledger entries and audit.', risk_level='HIGH' WHERE code='inventory.document.update';

INSERT INTO permissions (code,name,module,resource,action,name_vi,name_en,description_vi,description_en,risk_level,display_order,is_system,status) VALUES ('inventory.document.cancel', 'Hủy chứng từ đã lưu', 'inventory', 'document', 'cancel', 'Hủy chứng từ đã lưu', 'Cancel saved documents', 'Hủy chứng từ trong chi nhánh được phép bằng điều chỉnh hoặc đảo nghiệp vụ có liên kết; không xóa ledger.', 'Cancel branch-scoped documents through linked adjustment or reversal entries without deleting ledger history.', 'CRITICAL',240,TRUE,'ACTIVE');

INSERT INTO role_permissions (role_id,permission_id)
SELECT rp.role_id, current_permission.id
FROM role_permissions rp
JOIN permissions previous_permission ON previous_permission.id=rp.permission_id AND previous_permission.code='inventory.document.reverse'
JOIN permissions current_permission ON current_permission.code='inventory.document.cancel';

INSERT INTO user_permission_overrides
(user_id,permission_id,effect,reason,effective_from,effective_to,status,version,created_at,updated_at,created_by,updated_by)
SELECT o.user_id, current_permission.id, o.effect, o.reason, o.effective_from, o.effective_to,
       o.status, o.version, o.created_at, o.updated_at, o.created_by, o.updated_by
FROM user_permission_overrides o
JOIN permissions previous_permission ON previous_permission.id=o.permission_id AND previous_permission.code='inventory.document.reverse'
JOIN permissions current_permission ON current_permission.code='inventory.document.cancel';

UPDATE permissions SET name='Chỉnh sửa chứng từ đã lưu', name_vi='Chỉnh sửa chứng từ đã lưu', name_en='Edit saved documents', description_vi='Chỉnh sửa chứng từ đã lưu trong chi nhánh được phép; tính chênh lệch an toàn, giữ ledger cũ và audit.', description_en='Edit saved branch-scoped documents using safe revision deltas, immutable ledger entries and audit.', risk_level='CRITICAL' WHERE code='finance.document.update';

INSERT INTO permissions (code,name,module,resource,action,name_vi,name_en,description_vi,description_en,risk_level,display_order,is_system,status) VALUES ('finance.document.cancel', 'Hủy chứng từ đã lưu', 'finance', 'document', 'cancel', 'Hủy chứng từ đã lưu', 'Cancel saved documents', 'Hủy chứng từ trong chi nhánh được phép bằng điều chỉnh hoặc đảo nghiệp vụ có liên kết; không xóa ledger.', 'Cancel branch-scoped documents through linked adjustment or reversal entries without deleting ledger history.', 'CRITICAL',160,TRUE,'ACTIVE');

INSERT INTO role_permissions (role_id,permission_id)
SELECT rp.role_id, current_permission.id
FROM role_permissions rp
JOIN permissions previous_permission ON previous_permission.id=rp.permission_id AND previous_permission.code='finance.document.reverse'
JOIN permissions current_permission ON current_permission.code='finance.document.cancel';

INSERT INTO user_permission_overrides
(user_id,permission_id,effect,reason,effective_from,effective_to,status,version,created_at,updated_at,created_by,updated_by)
SELECT o.user_id, current_permission.id, o.effect, o.reason, o.effective_from, o.effective_to,
       o.status, o.version, o.created_at, o.updated_at, o.created_by, o.updated_by
FROM user_permission_overrides o
JOIN permissions previous_permission ON previous_permission.id=o.permission_id AND previous_permission.code='finance.document.reverse'
JOIN permissions current_permission ON current_permission.code='finance.document.cancel';

UPDATE users SET authorization_version=authorization_version+1, access_version=access_version+1
WHERE EXISTS (SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id
              JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=users.id AND p.code IN ('inventory.document.submit', 'inventory.document.approve', 'inventory.document.post', 'inventory.document.reverse', 'finance.document.submit', 'finance.document.approve', 'finance.document.post', 'finance.document.reverse'))
   OR EXISTS (SELECT 1 FROM user_permission_overrides o JOIN permissions p ON p.id=o.permission_id
              WHERE o.user_id=users.id AND p.code IN ('inventory.document.submit', 'inventory.document.approve', 'inventory.document.post', 'inventory.document.reverse', 'finance.document.submit', 'finance.document.approve', 'finance.document.post', 'finance.document.reverse'));

UPDATE roles SET version=version+1
WHERE EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id
              WHERE rp.role_id=roles.id AND p.code IN ('inventory.document.submit', 'inventory.document.approve', 'inventory.document.post', 'inventory.document.reverse', 'finance.document.submit', 'finance.document.approve', 'finance.document.post', 'finance.document.reverse'));

UPDATE permissions SET status='INACTIVE' WHERE code IN ('inventory.document.submit', 'inventory.document.approve', 'inventory.document.post', 'inventory.document.reverse', 'finance.document.submit', 'finance.document.approve', 'finance.document.post', 'finance.document.reverse');
