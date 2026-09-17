CREATE TABLE branch_wash_batch_sequences (
    branch_id BIGINT NOT NULL,
    next_value BIGINT NOT NULL,
    PRIMARY KEY (branch_id),
    CONSTRAINT fk_wash_batch_sequence_branch FOREIGN KEY (branch_id) REFERENCES branches (id)
);

INSERT INTO branch_wash_batch_sequences (branch_id, next_value)
SELECT id, 1 FROM branches;

CREATE TABLE wash_batches (
    id BIGINT NOT NULL AUTO_INCREMENT,
    batch_code VARCHAR(50) NOT NULL,
    branch_id BIGINT NOT NULL,
    service_id BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL,
    note VARCHAR(2000) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_by BIGINT NOT NULL,
    ready_at TIMESTAMP(6) NULL,
    ready_by BIGINT NULL,
    cancelled_at TIMESTAMP(6) NULL,
    cancelled_by BIGINT NULL,
    cancel_reason VARCHAR(500) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_wash_batches_code UNIQUE (batch_code),
    CONSTRAINT fk_wash_batches_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
    CONSTRAINT fk_wash_batches_service FOREIGN KEY (service_id) REFERENCES laundry_services (id),
    CONSTRAINT fk_wash_batches_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_wash_batches_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
    CONSTRAINT fk_wash_batches_ready_by FOREIGN KEY (ready_by) REFERENCES users (id),
    CONSTRAINT fk_wash_batches_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users (id),
    CONSTRAINT ck_wash_batches_status CHECK (status IN ('DRAFT','READY','PROCESSING','COMPLETED','CANCELLED'))
);

CREATE TABLE wash_batch_items (
    id BIGINT NOT NULL AUTO_INCREMENT,
    wash_batch_id BIGINT NOT NULL,
    order_item_id BIGINT NOT NULL,
    added_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    added_by BIGINT NOT NULL,
    removed_at TIMESTAMP(6) NULL,
    removed_by BIGINT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_wash_batch_items_batch FOREIGN KEY (wash_batch_id) REFERENCES wash_batches (id),
    CONSTRAINT fk_wash_batch_items_order_item FOREIGN KEY (order_item_id) REFERENCES order_items (id),
    CONSTRAINT fk_wash_batch_items_added_by FOREIGN KEY (added_by) REFERENCES users (id),
    CONSTRAINT fk_wash_batch_items_removed_by FOREIGN KEY (removed_by) REFERENCES users (id)
);

-- This portable lock table is the database authority for active membership.
-- Removing/cancelling a membership deletes only this lock row; wash_batch_items keeps history.
CREATE TABLE wash_batch_active_items (
    order_item_id BIGINT NOT NULL,
    wash_batch_item_id BIGINT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (order_item_id),
    CONSTRAINT uk_wash_batch_active_membership UNIQUE (wash_batch_item_id),
    CONSTRAINT fk_wash_batch_active_order_item FOREIGN KEY (order_item_id) REFERENCES order_items (id),
    CONSTRAINT fk_wash_batch_active_membership FOREIGN KEY (wash_batch_item_id) REFERENCES wash_batch_items (id)
);

CREATE TABLE wash_batch_history (
    id BIGINT NOT NULL AUTO_INCREMENT,
    wash_batch_id BIGINT NOT NULL,
    action VARCHAR(40) NOT NULL,
    from_status VARCHAR(30) NULL,
    to_status VARCHAR(30) NULL,
    reason VARCHAR(500) NULL,
    changed_fields_json TEXT NULL,
    actor_user_id BIGINT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_wash_batch_history_batch FOREIGN KEY (wash_batch_id) REFERENCES wash_batches (id),
    CONSTRAINT fk_wash_batch_history_actor FOREIGN KEY (actor_user_id) REFERENCES users (id)
);

CREATE INDEX idx_wash_batches_branch_status_created ON wash_batches (branch_id, status, created_at, id);
CREATE INDEX idx_wash_batches_branch_code ON wash_batches (branch_id, batch_code);
CREATE INDEX idx_wash_batch_items_batch ON wash_batch_items (wash_batch_id, id);
CREATE INDEX idx_wash_batch_items_order_item ON wash_batch_items (order_item_id, id);
CREATE INDEX idx_wash_batch_history_batch_created ON wash_batch_history (wash_batch_id, created_at, id);

INSERT INTO permission_modules (
    code, name_vi, name_en, description_vi, description_en, display_order, status
) VALUES (
    'batch', 'Mẻ giặt', 'Wash Batches',
    'Ghép các món của đơn đang chờ thành mẻ xử lý theo chi nhánh.',
    'Group waiting order items into branch-scoped operational wash batches.', 25, 'ACTIVE'
);

INSERT INTO permissions (
    code, name, module, resource, action, name_vi, name_en,
    description_vi, description_en, risk_level, display_order, is_system, status
) VALUES
    ('batch.read','Xem mẻ giặt','batch','batch','read','Xem mẻ giặt','View wash batches','Xem danh sách chờ, danh sách và chi tiết mẻ trong chi nhánh được phép.','View candidates, lists, and batch details within allowed branches.','LOW',10,TRUE,'ACTIVE'),
    ('batch.create','Tạo mẻ giặt','batch','batch','create','Tạo mẻ giặt','Create wash batches','Tạo mẻ nháp hoặc mẻ sẵn sàng từ các món hợp lệ.','Create draft or ready batches from eligible items.','MEDIUM',20,TRUE,'ACTIVE'),
    ('batch.update','Cập nhật mẻ giặt','batch','batch','update','Cập nhật mẻ giặt','Update wash batches','Thêm, xóa món và cập nhật ghi chú khi mẻ còn nháp.','Add or remove items and update notes while a batch is draft.','MEDIUM',30,TRUE,'ACTIVE'),
    ('batch.mark-ready','Đánh dấu mẻ sẵn sàng','batch','batch','mark-ready','Đánh dấu mẻ sẵn sàng','Mark wash batches ready','Khóa thành phần của mẻ hợp lệ để chờ đưa vào máy.','Lock a compatible batch composition for future machine assignment.','MEDIUM',40,TRUE,'ACTIVE'),
    ('batch.cancel','Hủy mẻ giặt','batch','batch','cancel','Hủy mẻ giặt','Cancel wash batches','Hủy mẻ nháp hoặc sẵn sàng với lý do bắt buộc và trả đồ về hàng chờ.','Cancel draft or ready batches with a required reason and release their items.','HIGH',50,TRUE,'ACTIVE'),
    ('batch.audit.read','Xem lịch sử mẻ giặt','batch','batch.audit','read','Xem lịch sử mẻ giặt','View wash batch history','Xem lịch sử thành phần và trạng thái của mẻ.','View batch composition and lifecycle history.','HIGH',60,TRUE,'ACTIVE');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.module = 'batch'
WHERE r.code IN ('ADMIN','MANAGER');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
    'batch.read','batch.create','batch.update','batch.mark-ready'
) WHERE r.code = 'RECEPTIONIST';
