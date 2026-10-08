INSERT INTO branches (code, name, status)
VALUES ('CI-LEGACY', 'CI Legacy Branch', 'ACTIVE');

INSERT INTO users (
    username,
    password_hash,
    display_name,
    default_branch_id,
    status
)
SELECT
    'ci-legacy-user',
    '$2a$10$ciOnlyFixtureHashNotUsedForAuthentication000000000000000',
    'CI Legacy User',
    id,
    'ACTIVE'
FROM branches
WHERE code = 'CI-LEGACY';

INSERT INTO orders (
    order_code,
    branch_id,
    customer_id,
    customer_name_snapshot,
    customer_phone_snapshot,
    status,
    promised_at,
    note,
    currency,
    total_amount,
    created_at,
    created_by,
    updated_at,
    updated_by,
    version
)
SELECT
    'GS-CI-LEGACY-0001',
    branch_record.id,
    NULL,
    'Khach hang migration CI',
    '0900000000',
    'COMPLETED',
    '2026-01-15 17:00:00.000000',
    'Fixture V23 for the V24 order-bag migration',
    'VND',
    240000.00,
    '2026-01-14 09:30:00.000000',
    user_record.id,
    '2026-01-15 17:05:00.000000',
    user_record.id,
    3
FROM branches branch_record
JOIN users user_record ON user_record.default_branch_id = branch_record.id
WHERE branch_record.code = 'CI-LEGACY'
  AND user_record.username = 'ci-legacy-user';
