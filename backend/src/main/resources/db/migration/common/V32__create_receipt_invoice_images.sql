INSERT INTO permissions(code,name,module,resource,action,name_vi,name_en,description_vi,description_en,risk_level,display_order,is_system,status) VALUES
('inventory.invoice.read','Xem ảnh hóa đơn nhập hàng','inventory','invoice','read','Xem ảnh hóa đơn nhập hàng','View receipt invoice images','Xem ảnh hóa đơn nhập hàng trong chi nhánh được phép.','View receipt invoice images within authorized branches.','HIGH',338,TRUE,'ACTIVE'),
('inventory.invoice.upload','Tải lên hoặc thay ảnh hóa đơn','inventory','invoice','upload','Tải lên hoặc thay ảnh hóa đơn','Upload or replace receipt invoice images','Tải lên hoặc thay ảnh hóa đơn trong chi nhánh được phép.','Upload or replace receipt invoice images within authorized branches.','HIGH',339,TRUE,'ACTIVE'),
('inventory.invoice.delete','Gỡ ảnh hóa đơn','inventory','invoice','delete','Gỡ ảnh hóa đơn','Remove receipt invoice images','Gỡ ảnh hóa đơn trong chi nhánh được phép.','Remove receipt invoice images within authorized branches.','HIGH',340,TRUE,'ACTIVE');
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.code IN ('ADMIN','MANAGER') AND p.code IN ('inventory.invoice.read','inventory.invoice.upload','inventory.invoice.delete');

CREATE TABLE inventory_receipt_invoices (
    id CHAR(36) PRIMARY KEY,
    branch_id BIGINT NOT NULL,
    document_id BIGINT NOT NULL,
    business_type VARCHAR(20) NOT NULL DEFAULT 'RECEIPT',
    object_key VARCHAR(255) NOT NULL UNIQUE,
    original_name VARCHAR(180) NOT NULL,
    content_type VARCHAR(30) NOT NULL,
    byte_size BIGINT NOT NULL,
    checksum CHAR(64) NOT NULL,
    uploaded_by BIGINT NOT NULL,
    uploaded_at TIMESTAMP(6) NOT NULL,
    status VARCHAR(20) NOT NULL,
    version BIGINT NOT NULL,
    replaces_id CHAR(36) NULL,
    command_id CHAR(36) NOT NULL,
    FOREIGN KEY (branch_id) REFERENCES branches(id),
    FOREIGN KEY (document_id) REFERENCES stock_documents(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(id),
    FOREIGN KEY (replaces_id) REFERENCES inventory_receipt_invoices(id),
    UNIQUE (document_id, uploaded_by, command_id),
    INDEX ix_receipt_invoices_document (branch_id, document_id, status),
    INDEX ix_receipt_invoices_cleanup (status, uploaded_at),
    CHECK (business_type = 'RECEIPT'),
    CHECK (status IN ('PENDING', 'ACTIVE', 'REPLACED', 'DELETED'))
);

