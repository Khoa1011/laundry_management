CREATE TABLE employee_compensations (
    id BIGINT NOT NULL AUTO_INCREMENT,
    employee_id BIGINT NOT NULL,
    base_salary DECIMAL(18, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    status VARCHAR(20) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_employee_compensation_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT fk_employee_compensation_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_employee_compensation_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
    CONSTRAINT ck_employee_compensation_salary CHECK (base_salary >= 0),
    CONSTRAINT ck_employee_compensation_period CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT ck_employee_compensation_status CHECK (status IN ('ACTIVE', 'SCHEDULED', 'ENDED'))
);

CREATE TABLE employee_identities (
    id BIGINT NOT NULL AUTO_INCREMENT,
    employee_id BIGINT NOT NULL,
    identity_type VARCHAR(30) NOT NULL,
    encrypted_number TEXT NOT NULL,
    number_hash VARCHAR(64) NOT NULL,
    number_last4 VARCHAR(4) NOT NULL,
    issued_date DATE NULL,
    issued_place VARCHAR(255) NULL,
    expires_on DATE NULL,
    verification_status VARCHAR(30) NOT NULL,
    verification_reason VARCHAR(500) NULL,
    verified_at TIMESTAMP(6) NULL,
    verified_by BIGINT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_employee_identity_type UNIQUE (employee_id, identity_type),
    CONSTRAINT uk_employee_identity_number_hash UNIQUE (number_hash),
    CONSTRAINT fk_employee_identity_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT fk_employee_identity_verified_by FOREIGN KEY (verified_by) REFERENCES users (id),
    CONSTRAINT fk_employee_identity_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_employee_identity_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
    CONSTRAINT ck_employee_identity_type CHECK (identity_type IN ('CITIZEN_ID', 'PASSPORT', 'OTHER')),
    CONSTRAINT ck_employee_identity_verification CHECK (verification_status IN ('NOT_VERIFIED', 'VERIFIED', 'REJECTED'))
);

CREATE TABLE employee_documents (
    id BIGINT NOT NULL AUTO_INCREMENT,
    employee_id BIGINT NOT NULL,
    document_type VARCHAR(40) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,
    description VARCHAR(500) NULL,
    document_version INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    replaces_document_id BIGINT NULL,
    deleted_at TIMESTAMP(6) NULL,
    deleted_by BIGINT NULL,
    delete_reason VARCHAR(500) NULL,
    record_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_by BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_employee_document_storage_key UNIQUE (storage_key),
    CONSTRAINT fk_employee_document_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT fk_employee_document_replaces FOREIGN KEY (replaces_document_id) REFERENCES employee_documents (id),
    CONSTRAINT fk_employee_document_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id),
    CONSTRAINT fk_employee_document_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT ck_employee_document_size CHECK (size_bytes > 0),
    CONSTRAINT ck_employee_document_version CHECK (document_version > 0),
    CONSTRAINT ck_employee_document_status CHECK (status IN ('ACTIVE', 'REPLACED', 'DELETED'))
);

CREATE INDEX idx_employee_compensation_period ON employee_compensations (employee_id, effective_from, effective_to, id);
CREATE INDEX idx_employee_compensation_status ON employee_compensations (employee_id, status, effective_from, id);
CREATE INDEX idx_employee_identity_employee ON employee_identities (employee_id, identity_type, id);
CREATE INDEX idx_employee_document_list ON employee_documents (employee_id, status, document_type, created_at, id);
CREATE INDEX idx_employee_document_replaces ON employee_documents (replaces_document_id, id);

INSERT INTO permissions (
    code, name, module, resource, action, name_vi, name_en,
    description_vi, description_en, risk_level, display_order,
    is_system, status
) VALUES
    ('employee.compensation.read', 'Xem lương hiện tại', 'employee', 'employee.compensation', 'read', 'Xem lương hiện tại', 'View current compensation', 'Xem mức lương hiện tại của nhân viên trong phạm vi chi nhánh được phép.', 'View current employee compensation within the allowed branch scope.', 'CRITICAL', 150, TRUE, 'ACTIVE'),
    ('employee.compensation.update', 'Cập nhật lương', 'employee', 'employee.compensation', 'update', 'Cập nhật lương', 'Update compensation', 'Tạo kỳ lương mới và kết thúc kỳ lương trước theo ngày hiệu lực.', 'Create a new compensation period and end the previous period by effective date.', 'CRITICAL', 160, TRUE, 'ACTIVE'),
    ('employee.compensation.history.read', 'Xem lịch sử lương', 'employee', 'employee.compensation.history', 'read', 'Xem lịch sử lương', 'View compensation history', 'Xem toàn bộ lịch sử thay đổi lương của nhân viên.', 'View the complete employee compensation history.', 'CRITICAL', 170, TRUE, 'ACTIVE'),
    ('employee.identity.masked-read', 'Xem định danh đã che', 'employee', 'employee.identity', 'masked-read', 'Xem định danh đã che', 'View masked identity', 'Xem thông tin định danh với số giấy tờ đã được che.', 'View identity metadata with the document number masked.', 'HIGH', 180, TRUE, 'ACTIVE'),
    ('employee.identity.read', 'Xem đầy đủ định danh', 'employee', 'employee.identity', 'read', 'Xem đầy đủ định danh', 'View full identity', 'Giải mã và xem đầy đủ số giấy tờ định danh của nhân viên.', 'Decrypt and view the employee full identity document number.', 'CRITICAL', 190, TRUE, 'ACTIVE'),
    ('employee.identity.update', 'Cập nhật định danh', 'employee', 'employee.identity', 'update', 'Cập nhật định danh', 'Update identity', 'Tạo, cập nhật và xác minh thông tin định danh được mã hóa.', 'Create, update, and verify encrypted employee identity information.', 'CRITICAL', 200, TRUE, 'ACTIVE'),
    ('employee.file.read', 'Xem metadata hồ sơ riêng tư', 'employee', 'employee.file', 'read', 'Xem metadata hồ sơ riêng tư', 'View private file metadata', 'Xem danh sách và metadata hồ sơ riêng tư của nhân viên.', 'View employee private document lists and metadata.', 'HIGH', 210, TRUE, 'ACTIVE'),
    ('employee.file.upload', 'Tải lên hồ sơ riêng tư', 'employee', 'employee.file', 'upload', 'Tải lên hồ sơ riêng tư', 'Upload private files', 'Tải ảnh hoặc PDF vào kho hồ sơ riêng tư của nhân viên.', 'Upload images or PDFs to the employee private document store.', 'CRITICAL', 220, TRUE, 'ACTIVE'),
    ('employee.file.replace', 'Thay thế hồ sơ riêng tư', 'employee', 'employee.file', 'replace', 'Thay thế hồ sơ riêng tư', 'Replace private files', 'Tạo phiên bản thay thế cho hồ sơ riêng tư hiện có.', 'Create a replacement version for an existing private document.', 'CRITICAL', 230, TRUE, 'ACTIVE'),
    ('employee.file.delete', 'Xóa mềm hồ sơ riêng tư', 'employee', 'employee.file', 'delete', 'Xóa mềm hồ sơ riêng tư', 'Delete private files', 'Đánh dấu đã xóa hồ sơ riêng tư mà không xóa vật lý dữ liệu lưu trữ.', 'Soft-delete private document metadata without physically deleting stored content.', 'CRITICAL', 240, TRUE, 'ACTIVE'),
    ('employee.file.download', 'Tải hoặc xem nội dung hồ sơ riêng tư', 'employee', 'employee.file', 'download', 'Tải hoặc xem nội dung hồ sơ riêng tư', 'Download private files', 'Tải hoặc xem trực tiếp nội dung hồ sơ riêng tư sau khi kiểm tra quyền và phạm vi.', 'Download or preview private document content after permission and scope checks.', 'CRITICAL', 250, TRUE, 'ACTIVE');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'employee.compensation.read',
    'employee.compensation.update',
    'employee.compensation.history.read',
    'employee.identity.masked-read',
    'employee.identity.read',
    'employee.identity.update',
    'employee.file.read',
    'employee.file.upload',
    'employee.file.replace',
    'employee.file.delete',
    'employee.file.download'
)
WHERE r.code = 'OWNER';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('employee.identity.masked-read', 'employee.file.read')
WHERE r.code = 'MANAGER';
