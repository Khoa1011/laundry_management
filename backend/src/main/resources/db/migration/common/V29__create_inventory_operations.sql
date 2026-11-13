INSERT INTO permissions(code,name,module,resource,action,name_vi,name_en,description_vi,description_en,risk_level,display_order,is_system,status) VALUES
('inventory.document.read','Xem chứng từ kho','inventory','document','read','Xem chứng từ kho','View stock documents','Xem chứng từ kho trong phạm vi các chi nhánh liên quan được phép.','View stock documents within every involved authorized branch.','LOW',336,TRUE,'ACTIVE'),
('inventory.transfer.receive','Nhận hoặc hoàn hàng đang chuyển','inventory','transfer','receive','Nhận hoặc hoàn hàng đang chuyển','Receive or return stock in transit','Nhận hoặc hoàn hàng đang chuyển trong phạm vi các chi nhánh liên quan được phép.','Receive or return stock in transit within every involved authorized branch.','HIGH',337,TRUE,'ACTIVE');
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.code IN ('ADMIN','MANAGER') AND p.code IN ('inventory.document.read','inventory.transfer.receive');

CREATE TABLE stock_documents (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 branch_id BIGINT NOT NULL, destination_branch_id BIGINT NULL,
 code VARCHAR(80) NOT NULL UNIQUE, kind VARCHAR(20) NOT NULL, status VARCHAR(30) NOT NULL,
 warehouse_id BIGINT NOT NULL, destination_warehouse_id BIGINT NULL, supplier_id BIGINT NULL,
 business_at TIMESTAMP(6) NOT NULL, created_at TIMESTAMP(6) NOT NULL, updated_at TIMESTAMP(6) NOT NULL,
 created_by BIGINT NOT NULL, updated_by BIGINT NOT NULL, version BIGINT NOT NULL DEFAULT 0,
 current_snapshot TEXT NOT NULL,
 FOREIGN KEY(branch_id) REFERENCES branches(id), FOREIGN KEY(destination_branch_id) REFERENCES branches(id),
 FOREIGN KEY(warehouse_id) REFERENCES warehouses(id), FOREIGN KEY(destination_warehouse_id) REFERENCES warehouses(id),
 FOREIGN KEY(supplier_id) REFERENCES suppliers(id), FOREIGN KEY(created_by) REFERENCES users(id), FOREIGN KEY(updated_by) REFERENCES users(id),
 CHECK(kind IN ('RECEIPT','ISSUE','TRANSFER','STOCKTAKE','ADJUSTMENT')),
 CHECK(status IN ('DRAFT','RECORDED','CANCELLED','IN_TRANSIT','PARTIALLY_RECEIVED','RECEIVED')),
 INDEX ix_stock_documents_branch_time(branch_id,business_at,id),
 INDEX ix_stock_documents_destination(destination_branch_id,id),
 INDEX ix_stock_documents_warehouse(warehouse_id,kind,status,id), INDEX ix_stock_documents_supplier(supplier_id,id)
);
CREATE TABLE stock_revisions (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, document_id BIGINT NOT NULL,
 revision BIGINT NOT NULL, action VARCHAR(30) NOT NULL, actor_id BIGINT NOT NULL,
 recorded_at TIMESTAMP(6) NOT NULL, reason VARCHAR(1000) NULL,
 before_snapshot TEXT NULL, snapshot TEXT NOT NULL, effects TEXT NOT NULL,
 UNIQUE(document_id,revision), FOREIGN KEY(document_id) REFERENCES stock_documents(id), FOREIGN KEY(actor_id) REFERENCES users(id)
);
CREATE TABLE stock_balances (
 warehouse_id BIGINT NOT NULL, item_id BIGINT NOT NULL, branch_id BIGINT NOT NULL,
 quantity DECIMAL(19,6) NOT NULL DEFAULT 0, stock_value DECIMAL(24,6) NOT NULL DEFAULT 0,
 version BIGINT NOT NULL DEFAULT 0,
 PRIMARY KEY(warehouse_id,item_id), FOREIGN KEY(warehouse_id) REFERENCES warehouses(id), FOREIGN KEY(item_id) REFERENCES inventory_items(id),
 FOREIGN KEY(branch_id) REFERENCES branches(id), INDEX ix_stock_balances_branch(branch_id,item_id)
);
CREATE TABLE stock_lots (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, warehouse_id BIGINT NOT NULL, item_id BIGINT NOT NULL,
 lot_code VARCHAR(80) NOT NULL, expiry_date DATE NULL, quantity DECIMAL(19,6) NOT NULL DEFAULT 0,
 version BIGINT NOT NULL DEFAULT 0, UNIQUE(warehouse_id,item_id,lot_code),
 FOREIGN KEY(warehouse_id,item_id) REFERENCES stock_balances(warehouse_id,item_id), CHECK(quantity>=0),
 INDEX ix_stock_lots_expiry(expiry_date,item_id)
);
CREATE TABLE stock_ledger (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, document_id BIGINT NOT NULL, revision BIGINT NOT NULL,
 branch_id BIGINT NOT NULL, warehouse_id BIGINT NOT NULL, item_id BIGINT NOT NULL,
 lot_code VARCHAR(80) NULL, expiry_date DATE NULL, line_number INT NOT NULL, phase VARCHAR(30) NOT NULL,
 quantity_delta DECIMAL(19,6) NOT NULL, value_delta DECIMAL(24,6) NOT NULL,
 quantity_after DECIMAL(19,6) NOT NULL, value_after DECIMAL(24,6) NOT NULL,
 recorded_at TIMESTAMP(6) NOT NULL, actor_id BIGINT NOT NULL,
 FOREIGN KEY(document_id,revision) REFERENCES stock_revisions(document_id,revision),
 FOREIGN KEY(warehouse_id,item_id) REFERENCES stock_balances(warehouse_id,item_id),
 FOREIGN KEY(branch_id) REFERENCES branches(id), FOREIGN KEY(actor_id) REFERENCES users(id),
 UNIQUE(document_id,revision,phase,line_number,warehouse_id,item_id),
 INDEX ix_stock_ledger_scope(branch_id,warehouse_id,item_id,id), INDEX ix_stock_ledger_time(branch_id,recorded_at,id)
);
CREATE TABLE stock_transit (
 document_id BIGINT NOT NULL, line_number INT NOT NULL,
 item_id BIGINT NOT NULL, destination_item_id BIGINT NOT NULL,
 dispatched DECIMAL(19,6) NOT NULL, received DECIMAL(19,6) NOT NULL DEFAULT 0, returned DECIMAL(19,6) NOT NULL DEFAULT 0,
 remaining_value DECIMAL(24,6) NOT NULL,
 PRIMARY KEY(document_id,line_number), FOREIGN KEY(document_id) REFERENCES stock_documents(id),
 FOREIGN KEY(item_id) REFERENCES inventory_items(id), FOREIGN KEY(destination_item_id) REFERENCES inventory_items(id),
 CHECK(dispatched>0 AND received>=0 AND returned>=0 AND received+returned<=dispatched)
);
CREATE TABLE stock_commands (
 branch_id BIGINT NOT NULL, command_key VARCHAR(100) NOT NULL,
 payload_digest VARCHAR(64) NOT NULL, result_snapshot TEXT NOT NULL, recorded_at TIMESTAMP(6) NOT NULL,
 PRIMARY KEY(branch_id,command_key), FOREIGN KEY(branch_id) REFERENCES branches(id)
);
