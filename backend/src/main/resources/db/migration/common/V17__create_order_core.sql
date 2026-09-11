CREATE TABLE branch_order_sequences (
    branch_id BIGINT NOT NULL,
    next_value BIGINT NOT NULL,
    PRIMARY KEY (branch_id),
    CONSTRAINT fk_order_sequence_branch FOREIGN KEY (branch_id) REFERENCES branches (id)
);

INSERT INTO branch_order_sequences (branch_id, next_value)
SELECT id, 1 FROM branches;

CREATE TABLE orders (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_code VARCHAR(50) NOT NULL,
    branch_id BIGINT NOT NULL,
    customer_id BIGINT NULL,
    customer_name_snapshot VARCHAR(150) NULL,
    customer_phone_snapshot VARCHAR(30) NULL,
    status VARCHAR(30) NOT NULL,
    promised_at TIMESTAMP(6) NULL,
    note VARCHAR(2000) NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    total_amount DECIMAL(18,2) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_by BIGINT NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_orders_code UNIQUE (order_code),
    CONSTRAINT fk_orders_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
    CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
    CONSTRAINT fk_orders_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_orders_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
    CONSTRAINT ck_orders_status CHECK (status IN ('RECEIVED','PROCESSING','READY','COMPLETED','CANCELLED','REOPENED')),
    CONSTRAINT ck_orders_total CHECK (total_amount >= 0),
    CONSTRAINT ck_orders_customer_snapshot CHECK (customer_name_snapshot IS NOT NULL OR customer_phone_snapshot IS NOT NULL OR customer_id IS NOT NULL)
);

CREATE TABLE order_items (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    service_id BIGINT NOT NULL,
    item_type_id BIGINT NULL,
    service_code_snapshot VARCHAR(40) NOT NULL,
    service_name_snapshot VARCHAR(150) NOT NULL,
    item_type_code_snapshot VARCHAR(40) NULL,
    item_type_name_snapshot VARCHAR(150) NULL,
    pricing_method_snapshot VARCHAR(30) NOT NULL,
    unit_type_snapshot VARCHAR(20) NOT NULL,
    sharing_mode_snapshot VARCHAR(30) NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    billable_quantity DECIMAL(10,3) NOT NULL,
    line_amount DECIMAL(18,2) NOT NULL,
    note VARCHAR(1000) NULL,
    pricing_snapshot_json TEXT NOT NULL,
    quoted_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id),
    CONSTRAINT fk_order_items_service FOREIGN KEY (service_id) REFERENCES laundry_services (id),
    CONSTRAINT fk_order_items_item_type FOREIGN KEY (item_type_id) REFERENCES item_types (id),
    CONSTRAINT ck_order_items_quantity CHECK (quantity > 0 AND billable_quantity > 0),
    CONSTRAINT ck_order_items_amount CHECK (line_amount >= 0)
);

CREATE TABLE order_status_history (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    action VARCHAR(40) NOT NULL,
    from_status VARCHAR(30) NULL,
    to_status VARCHAR(30) NULL,
    reason VARCHAR(500) NULL,
    changed_fields_json TEXT NULL,
    source VARCHAR(30) NOT NULL,
    actor_user_id BIGINT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_order_history_order FOREIGN KEY (order_id) REFERENCES orders (id),
    CONSTRAINT fk_order_history_actor FOREIGN KEY (actor_user_id) REFERENCES users (id)
);

CREATE INDEX idx_orders_branch_created ON orders (branch_id, created_at, id);
CREATE INDEX idx_orders_branch_status_created ON orders (branch_id, status, created_at, id);
CREATE INDEX idx_orders_branch_customer_created ON orders (branch_id, customer_id, created_at, id);
CREATE INDEX idx_orders_promised_status ON orders (branch_id, status, promised_at, id);
CREATE INDEX idx_order_items_order ON order_items (order_id, id);
CREATE INDEX idx_order_items_service ON order_items (service_id, order_id);
CREATE INDEX idx_order_history_order_created ON order_status_history (order_id, created_at, id);

INSERT INTO permission_modules (
    code, name_vi, name_en, description_vi, description_en, display_order, status
) VALUES (
    'order', 'Đơn hàng', 'Orders',
    'Tiếp nhận, tính giá, theo dõi và điều phối vòng đời đơn giặt theo chi nhánh.',
    'Create, price, track, and operate branch-scoped laundry orders.', 20, 'ACTIVE'
);

INSERT INTO permissions (
    code, name, module, resource, action, name_vi, name_en,
    description_vi, description_en, risk_level, display_order, is_system, status
) VALUES
    ('order.read','Xem đơn hàng','order','order','read','Xem đơn hàng','View orders','Xem danh sách và chi tiết đơn hàng trong chi nhánh được phép.','View orders within the allowed branch scope.','LOW',10,TRUE,'ACTIVE'),
    ('order.create','Tạo đơn hàng','order','order','create','Tạo đơn hàng','Create orders','Tạo đơn mới với giá do hệ thống tính.','Create orders with server-authoritative pricing.','MEDIUM',20,TRUE,'ACTIVE'),
    ('order.update','Cập nhật đơn hàng','order','order','update','Cập nhật đơn hàng','Update orders','Sửa nội dung đơn khi trạng thái nghiệp vụ cho phép.','Update orders while business state permits it.','MEDIUM',30,TRUE,'ACTIVE'),
    ('order.start-processing','Bắt đầu xử lý đơn','order','order','start-processing','Bắt đầu xử lý đơn','Start order processing','Chuyển đơn hợp lệ sang trạng thái đang xử lý.','Move an eligible order into processing.','MEDIUM',40,TRUE,'ACTIVE'),
    ('order.mark-ready','Đánh dấu đơn sẵn sàng','order','order','mark-ready','Đánh dấu đơn sẵn sàng','Mark orders ready','Xác nhận đơn đã xử lý xong và sẵn sàng trả khách.','Confirm an order is ready for customer pickup.','MEDIUM',50,TRUE,'ACTIVE'),
    ('order.complete','Hoàn tất đơn hàng','order','order','complete','Hoàn tất đơn hàng','Complete orders','Xác nhận hàng đã được bàn giao và hoàn tất đơn.','Confirm handoff and complete an order.','HIGH',60,TRUE,'ACTIVE'),
    ('order.cancel','Hủy đơn hàng','order','order','cancel','Hủy đơn hàng','Cancel orders','Hủy đơn hợp lệ với lý do bắt buộc.','Cancel an eligible order with a required reason.','HIGH',70,TRUE,'ACTIVE'),
    ('order.reopen','Mở lại đơn hàng','order','order','reopen','Mở lại đơn hàng','Reopen orders','Mở lại đơn đã hoàn tất với lý do bắt buộc.','Reopen a completed order with a required reason.','HIGH',80,TRUE,'ACTIVE'),
    ('order.audit.read','Xem lịch sử đơn hàng','order','order.audit','read','Xem lịch sử đơn hàng','View order history','Xem lịch sử trạng thái và thay đổi quan trọng của đơn.','View order status and change history.','HIGH',90,TRUE,'ACTIVE');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.module = 'order'
WHERE r.code IN ('OWNER','MANAGER');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
    'order.read','order.create','order.update','order.start-processing','order.mark-ready','order.complete'
) WHERE r.code = 'RECEPTIONIST';
