INSERT INTO permission_modules (code, name_vi, name_en, description_vi, description_en, display_order, status) VALUES ('inventory', 'Quản lý kho', 'Inventory', 'Danh mục và nghiệp vụ theo chi nhánh.', 'Branch-scoped master data and operations.', 30, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.warehouse.read', 'Xem kho', 'inventory', 'warehouse', 'read', 'Xem kho', 'View warehouses', 'Xem kho trong phạm vi chi nhánh được phép.', 'View warehouses within authorized branches.', 'LOW', 10, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.warehouse.manage', 'Quản lý kho', 'inventory', 'warehouse', 'manage', 'Quản lý kho', 'Manage warehouses', 'Quản lý kho trong phạm vi chi nhánh được phép.', 'Manage warehouses within authorized branches.', 'HIGH', 20, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.category.read', 'Xem nhóm vật tư', 'inventory', 'category', 'read', 'Xem nhóm vật tư', 'View item categories', 'Xem nhóm vật tư trong phạm vi chi nhánh được phép.', 'View item categories within authorized branches.', 'LOW', 30, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.category.manage', 'Quản lý nhóm vật tư', 'inventory', 'category', 'manage', 'Quản lý nhóm vật tư', 'Manage item categories', 'Quản lý nhóm vật tư trong phạm vi chi nhánh được phép.', 'Manage item categories within authorized branches.', 'MEDIUM', 40, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.unit.read', 'Xem đơn vị và quy cách', 'inventory', 'unit', 'read', 'Xem đơn vị và quy cách', 'View units and packages', 'Xem đơn vị và quy cách trong phạm vi chi nhánh được phép.', 'View units and packages within authorized branches.', 'LOW', 50, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.unit.manage', 'Quản lý đơn vị và quy cách', 'inventory', 'unit', 'manage', 'Quản lý đơn vị và quy cách', 'Manage units and packages', 'Quản lý đơn vị và quy cách trong phạm vi chi nhánh được phép.', 'Manage units and packages within authorized branches.', 'HIGH', 60, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.supplier.read', 'Xem nhà cung cấp', 'inventory', 'supplier', 'read', 'Xem nhà cung cấp', 'View suppliers', 'Xem nhà cung cấp trong phạm vi chi nhánh được phép.', 'View suppliers within authorized branches.', 'LOW', 70, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.supplier.manage', 'Quản lý nhà cung cấp', 'inventory', 'supplier', 'manage', 'Quản lý nhà cung cấp', 'Manage suppliers', 'Quản lý nhà cung cấp trong phạm vi chi nhánh được phép.', 'Manage suppliers within authorized branches.', 'MEDIUM', 80, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.item.read', 'Xem vật tư', 'inventory', 'item', 'read', 'Xem vật tư', 'View items', 'Xem vật tư trong phạm vi chi nhánh được phép.', 'View items within authorized branches.', 'LOW', 90, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.item.manage', 'Quản lý vật tư', 'inventory', 'item', 'manage', 'Quản lý vật tư', 'Manage items', 'Quản lý vật tư trong phạm vi chi nhánh được phép.', 'Manage items within authorized branches.', 'MEDIUM', 100, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.cost.read', 'Xem giá mua và giá vốn', 'inventory', 'cost', 'read', 'Xem giá mua và giá vốn', 'View purchase prices and costs', 'Xem giá mua và giá vốn trong phạm vi chi nhánh được phép.', 'View purchase prices and costs within authorized branches.', 'HIGH', 110, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.cost.update', 'Cập nhật giá nhập tham khảo', 'inventory', 'cost', 'update', 'Cập nhật giá nhập tham khảo', 'Update reference purchase prices', 'Cập nhật giá nhập tham khảo trong phạm vi chi nhánh được phép.', 'Update reference purchase prices within authorized branches.', 'HIGH', 120, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.settings.read', 'Xem cấu hình kho', 'inventory', 'settings', 'read', 'Xem cấu hình kho', 'View inventory settings', 'Xem cấu hình kho trong phạm vi chi nhánh được phép.', 'View inventory settings within authorized branches.', 'LOW', 130, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.settings.manage', 'Quản lý cấu hình kho', 'inventory', 'settings', 'manage', 'Quản lý cấu hình kho', 'Manage inventory settings', 'Quản lý cấu hình kho trong phạm vi chi nhánh được phép.', 'Manage inventory settings within authorized branches.', 'HIGH', 140, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.audit.read', 'Xem lịch sử danh mục kho', 'inventory', 'audit', 'read', 'Xem lịch sử danh mục kho', 'View inventory catalog history', 'Xem lịch sử danh mục kho trong phạm vi chi nhánh được phép.', 'View inventory catalog history within authorized branches.', 'HIGH', 150, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.overview.read', 'Xem tổng quan kho', 'inventory', 'overview', 'read', 'Xem tổng quan kho', 'View inventory overview', 'Xem tổng quan kho trong phạm vi chi nhánh được phép.', 'View inventory overview within authorized branches.', 'LOW', 160, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.stock.read', 'Xem tồn kho', 'inventory', 'stock', 'read', 'Xem tồn kho', 'View stock', 'Xem tồn kho trong phạm vi chi nhánh được phép.', 'View stock within authorized branches.', 'LOW', 170, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.receipt.create', 'Tạo phiếu nhập', 'inventory', 'receipt', 'create', 'Tạo phiếu nhập', 'Create receipts', 'Tạo phiếu nhập trong phạm vi chi nhánh được phép.', 'Create receipts within authorized branches.', 'MEDIUM', 180, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.issue.create', 'Tạo phiếu xuất', 'inventory', 'issue', 'create', 'Tạo phiếu xuất', 'Create issues', 'Tạo phiếu xuất trong phạm vi chi nhánh được phép.', 'Create issues within authorized branches.', 'MEDIUM', 190, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.document.update', 'Sửa phiếu nháp', 'inventory', 'document', 'update', 'Sửa phiếu nháp', 'Edit drafts', 'Sửa phiếu nháp trong phạm vi chi nhánh được phép.', 'Edit drafts within authorized branches.', 'MEDIUM', 200, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.document.submit', 'Gửi duyệt phiếu kho', 'inventory', 'document', 'submit', 'Gửi duyệt phiếu kho', 'Submit stock documents', 'Gửi duyệt phiếu kho trong phạm vi chi nhánh được phép.', 'Submit stock documents within authorized branches.', 'MEDIUM', 210, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.document.approve', 'Duyệt phiếu kho', 'inventory', 'document', 'approve', 'Duyệt phiếu kho', 'Approve stock documents', 'Duyệt phiếu kho trong phạm vi chi nhánh được phép.', 'Approve stock documents within authorized branches.', 'HIGH', 220, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.document.post', 'Ghi sổ kho', 'inventory', 'document', 'post', 'Ghi sổ kho', 'Post stock documents', 'Ghi sổ kho trong phạm vi chi nhánh được phép.', 'Post stock documents within authorized branches.', 'CRITICAL', 230, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.document.reverse', 'Đảo phiếu kho', 'inventory', 'document', 'reverse', 'Đảo phiếu kho', 'Reverse stock documents', 'Đảo phiếu kho trong phạm vi chi nhánh được phép.', 'Reverse stock documents within authorized branches.', 'CRITICAL', 240, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.stocktake.create', 'Tạo kiểm kê', 'inventory', 'stocktake', 'create', 'Tạo kiểm kê', 'Create stocktakes', 'Tạo kiểm kê trong phạm vi chi nhánh được phép.', 'Create stocktakes within authorized branches.', 'MEDIUM', 250, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.adjustment.create', 'Điều chỉnh tồn', 'inventory', 'adjustment', 'create', 'Điều chỉnh tồn', 'Adjust stock', 'Điều chỉnh tồn trong phạm vi chi nhánh được phép.', 'Adjust stock within authorized branches.', 'CRITICAL', 260, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.transfer.create', 'Chuyển kho', 'inventory', 'transfer', 'create', 'Chuyển kho', 'Transfer stock', 'Chuyển kho trong phạm vi chi nhánh được phép.', 'Transfer stock within authorized branches.', 'HIGH', 270, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.report.read', 'Xem báo cáo kho', 'inventory', 'report', 'read', 'Xem báo cáo kho', 'View stock reports', 'Xem báo cáo kho trong phạm vi chi nhánh được phép.', 'View stock reports within authorized branches.', 'HIGH', 280, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('inventory.report.export', 'Xuất báo cáo kho', 'inventory', 'report', 'export', 'Xuất báo cáo kho', 'Export stock reports', 'Xuất báo cáo kho trong phạm vi chi nhánh được phép.', 'Export stock reports within authorized branches.', 'HIGH', 290, TRUE, 'ACTIVE');

INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code='ADMIN' AND p.code IN ('inventory.warehouse.read', 'inventory.warehouse.manage', 'inventory.category.read', 'inventory.category.manage', 'inventory.unit.read', 'inventory.unit.manage', 'inventory.supplier.read', 'inventory.supplier.manage', 'inventory.item.read', 'inventory.item.manage', 'inventory.cost.read', 'inventory.cost.update', 'inventory.settings.read', 'inventory.settings.manage', 'inventory.audit.read', 'inventory.overview.read', 'inventory.stock.read', 'inventory.receipt.create', 'inventory.issue.create', 'inventory.document.update', 'inventory.document.submit', 'inventory.document.approve', 'inventory.document.post', 'inventory.document.reverse', 'inventory.stocktake.create', 'inventory.adjustment.create', 'inventory.transfer.create', 'inventory.report.read', 'inventory.report.export');

INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code='MANAGER' AND p.code IN ('inventory.warehouse.read', 'inventory.warehouse.manage', 'inventory.category.read', 'inventory.category.manage', 'inventory.unit.read', 'inventory.unit.manage', 'inventory.supplier.read', 'inventory.supplier.manage', 'inventory.item.read', 'inventory.item.manage', 'inventory.cost.read', 'inventory.cost.update', 'inventory.settings.read', 'inventory.settings.manage', 'inventory.audit.read', 'inventory.overview.read', 'inventory.stock.read', 'inventory.receipt.create', 'inventory.issue.create', 'inventory.document.update', 'inventory.document.submit', 'inventory.document.approve', 'inventory.document.post', 'inventory.document.reverse', 'inventory.stocktake.create', 'inventory.adjustment.create', 'inventory.transfer.create', 'inventory.report.read', 'inventory.report.export');

INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code='RECEPTIONIST' AND p.code IN ('inventory.warehouse.read', 'inventory.category.read', 'inventory.unit.read', 'inventory.supplier.read', 'inventory.item.read');

INSERT INTO permission_modules (code, name_vi, name_en, description_vi, description_en, display_order, status) VALUES ('finance', 'Quản lý thu chi', 'Finance', 'Danh mục và nghiệp vụ theo chi nhánh.', 'Branch-scoped master data and operations.', 31, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.account.read', 'Xem tài khoản quỹ', 'finance', 'account', 'read', 'Xem tài khoản quỹ', 'View cash accounts', 'Xem tài khoản quỹ trong phạm vi chi nhánh được phép.', 'View cash accounts within authorized branches.', 'HIGH', 10, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.account.manage', 'Quản lý tài khoản quỹ', 'finance', 'account', 'manage', 'Quản lý tài khoản quỹ', 'Manage cash accounts', 'Quản lý tài khoản quỹ trong phạm vi chi nhánh được phép.', 'Manage cash accounts within authorized branches.', 'CRITICAL', 20, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.category.read', 'Xem danh mục thu chi', 'finance', 'category', 'read', 'Xem danh mục thu chi', 'View transaction categories', 'Xem danh mục thu chi trong phạm vi chi nhánh được phép.', 'View transaction categories within authorized branches.', 'LOW', 30, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.category.manage', 'Quản lý danh mục thu chi', 'finance', 'category', 'manage', 'Quản lý danh mục thu chi', 'Manage transaction categories', 'Quản lý danh mục thu chi trong phạm vi chi nhánh được phép.', 'Manage transaction categories within authorized branches.', 'MEDIUM', 40, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.settings.read', 'Xem cấu hình thu chi', 'finance', 'settings', 'read', 'Xem cấu hình thu chi', 'View finance settings', 'Xem cấu hình thu chi trong phạm vi chi nhánh được phép.', 'View finance settings within authorized branches.', 'HIGH', 50, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.settings.manage', 'Quản lý cấu hình thu chi', 'finance', 'settings', 'manage', 'Quản lý cấu hình thu chi', 'Manage finance settings', 'Quản lý cấu hình thu chi trong phạm vi chi nhánh được phép.', 'Manage finance settings within authorized branches.', 'CRITICAL', 60, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.audit.read', 'Xem lịch sử danh mục thu chi', 'finance', 'audit', 'read', 'Xem lịch sử danh mục thu chi', 'View finance catalog history', 'Xem lịch sử danh mục thu chi trong phạm vi chi nhánh được phép.', 'View finance catalog history within authorized branches.', 'HIGH', 70, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.overview.read', 'Xem tổng quan thu chi', 'finance', 'overview', 'read', 'Xem tổng quan thu chi', 'View finance overview', 'Xem tổng quan thu chi trong phạm vi chi nhánh được phép.', 'View finance overview within authorized branches.', 'HIGH', 80, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.ledger.read', 'Xem sổ quỹ', 'finance', 'ledger', 'read', 'Xem sổ quỹ', 'View cash ledger', 'Xem sổ quỹ trong phạm vi chi nhánh được phép.', 'View cash ledger within authorized branches.', 'HIGH', 90, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.receipt.create', 'Tạo phiếu thu', 'finance', 'receipt', 'create', 'Tạo phiếu thu', 'Create cash receipts', 'Tạo phiếu thu trong phạm vi chi nhánh được phép.', 'Create cash receipts within authorized branches.', 'HIGH', 100, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.expense.create', 'Tạo phiếu chi', 'finance', 'expense', 'create', 'Tạo phiếu chi', 'Create cash expenses', 'Tạo phiếu chi trong phạm vi chi nhánh được phép.', 'Create cash expenses within authorized branches.', 'HIGH', 110, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.document.update', 'Sửa chứng từ nháp', 'finance', 'document', 'update', 'Sửa chứng từ nháp', 'Edit cash drafts', 'Sửa chứng từ nháp trong phạm vi chi nhánh được phép.', 'Edit cash drafts within authorized branches.', 'HIGH', 120, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.document.submit', 'Gửi duyệt chứng từ', 'finance', 'document', 'submit', 'Gửi duyệt chứng từ', 'Submit cash documents', 'Gửi duyệt chứng từ trong phạm vi chi nhánh được phép.', 'Submit cash documents within authorized branches.', 'HIGH', 130, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.document.approve', 'Duyệt hoặc từ chối', 'finance', 'document', 'approve', 'Duyệt hoặc từ chối', 'Approve or reject cash documents', 'Duyệt hoặc từ chối trong phạm vi chi nhánh được phép.', 'Approve or reject cash documents within authorized branches.', 'CRITICAL', 140, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.document.post', 'Ghi sổ chứng từ', 'finance', 'document', 'post', 'Ghi sổ chứng từ', 'Post cash documents', 'Ghi sổ chứng từ trong phạm vi chi nhánh được phép.', 'Post cash documents within authorized branches.', 'CRITICAL', 150, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.document.reverse', 'Đảo chứng từ', 'finance', 'document', 'reverse', 'Đảo chứng từ', 'Reverse cash documents', 'Đảo chứng từ trong phạm vi chi nhánh được phép.', 'Reverse cash documents within authorized branches.', 'CRITICAL', 160, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.transfer.create', 'Chuyển quỹ', 'finance', 'transfer', 'create', 'Chuyển quỹ', 'Transfer funds', 'Chuyển quỹ trong phạm vi chi nhánh được phép.', 'Transfer funds within authorized branches.', 'CRITICAL', 170, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.reconciliation.create', 'Đối soát quỹ', 'finance', 'reconciliation', 'create', 'Đối soát quỹ', 'Reconcile cash', 'Đối soát quỹ trong phạm vi chi nhánh được phép.', 'Reconcile cash within authorized branches.', 'HIGH', 180, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.payable.read', 'Xem công nợ nhà cung cấp', 'finance', 'payable', 'read', 'Xem công nợ nhà cung cấp', 'View supplier payables', 'Xem công nợ nhà cung cấp trong phạm vi chi nhánh được phép.', 'View supplier payables within authorized branches.', 'HIGH', 190, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.payable.pay', 'Thanh toán công nợ', 'finance', 'payable', 'pay', 'Thanh toán công nợ', 'Pay suppliers', 'Thanh toán công nợ trong phạm vi chi nhánh được phép.', 'Pay suppliers within authorized branches.', 'CRITICAL', 200, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.report.read', 'Xem báo cáo thu chi', 'finance', 'report', 'read', 'Xem báo cáo thu chi', 'View finance reports', 'Xem báo cáo thu chi trong phạm vi chi nhánh được phép.', 'View finance reports within authorized branches.', 'HIGH', 210, TRUE, 'ACTIVE');

INSERT INTO permissions (code, name, module, resource, action, name_vi, name_en, description_vi, description_en, risk_level, display_order, is_system, status) VALUES ('finance.report.export', 'Xuất báo cáo thu chi', 'finance', 'report', 'export', 'Xuất báo cáo thu chi', 'Export finance reports', 'Xuất báo cáo thu chi trong phạm vi chi nhánh được phép.', 'Export finance reports within authorized branches.', 'HIGH', 220, TRUE, 'ACTIVE');

INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code='ADMIN' AND p.code IN ('finance.account.read', 'finance.account.manage', 'finance.category.read', 'finance.category.manage', 'finance.settings.read', 'finance.settings.manage', 'finance.audit.read', 'finance.overview.read', 'finance.ledger.read', 'finance.receipt.create', 'finance.expense.create', 'finance.document.update', 'finance.document.submit', 'finance.document.approve', 'finance.document.post', 'finance.document.reverse', 'finance.transfer.create', 'finance.reconciliation.create', 'finance.payable.read', 'finance.payable.pay', 'finance.report.read', 'finance.report.export');

INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code='MANAGER' AND p.code IN ('finance.account.read', 'finance.account.manage', 'finance.category.read', 'finance.category.manage', 'finance.settings.read', 'finance.settings.manage', 'finance.audit.read', 'finance.overview.read', 'finance.ledger.read', 'finance.receipt.create', 'finance.expense.create', 'finance.document.update', 'finance.document.submit', 'finance.document.approve', 'finance.document.post', 'finance.document.reverse', 'finance.transfer.create', 'finance.reconciliation.create', 'finance.payable.read', 'finance.payable.pay', 'finance.report.read', 'finance.report.export');

CREATE TABLE operations_sequences (
 branch_id BIGINT NOT NULL, kind VARCHAR(40) NOT NULL, next_value BIGINT NOT NULL,
 PRIMARY KEY(branch_id, kind), FOREIGN KEY(branch_id) REFERENCES branches(id), CHECK(next_value > 0)
);

CREATE TABLE warehouses (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    branch_id BIGINT NOT NULL,
    code VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    active BOOLEAN NOT NULL,
    note VARCHAR(1000) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_warehouses_code UNIQUE(code),
    FOREIGN KEY(branch_id) REFERENCES branches(id),
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(updated_by) REFERENCES users(id),
    INDEX ix_warehouses_branch_active (branch_id, active, id)
);

CREATE TABLE inventory_categories (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    branch_id BIGINT NOT NULL,
    code VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    active BOOLEAN NOT NULL,
    note VARCHAR(1000) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    CONSTRAINT uk_inventory_categories_code UNIQUE(code),
    FOREIGN KEY(branch_id) REFERENCES branches(id),
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(updated_by) REFERENCES users(id),
    INDEX ix_inventory_categories_branch_active (branch_id, active, id)
);

CREATE TABLE inventory_units (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    branch_id BIGINT NOT NULL,
    code VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    active BOOLEAN NOT NULL,
    note VARCHAR(1000) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    dimension VARCHAR(20) NOT NULL,
    CONSTRAINT uk_inventory_units_code UNIQUE(code),
    FOREIGN KEY(branch_id) REFERENCES branches(id),
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(updated_by) REFERENCES users(id),
    INDEX ix_inventory_units_branch_active (branch_id, active, id),
    CHECK(dimension IN ('COUNT','MASS','VOLUME'))
);

CREATE TABLE suppliers (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    branch_id BIGINT NOT NULL,
    code VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    active BOOLEAN NOT NULL,
    note VARCHAR(1000) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    phone VARCHAR(30) NULL,
    email VARCHAR(150) NULL,
    address VARCHAR(500) NULL,
    tax_number VARCHAR(50) NULL,
    contact_name VARCHAR(150) NULL,
    material_groups VARCHAR(500) NULL,
    CONSTRAINT uk_suppliers_code UNIQUE(code),
    FOREIGN KEY(branch_id) REFERENCES branches(id),
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(updated_by) REFERENCES users(id),
    INDEX ix_suppliers_branch_active (branch_id, active, id)
);

CREATE TABLE inventory_items (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    branch_id BIGINT NOT NULL,
    code VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    active BOOLEAN NOT NULL,
    note VARCHAR(1000) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    base_unit_id BIGINT NOT NULL,
    supplier_id BIGINT NULL,
    description VARCHAR(1000) NULL,
    reference_price DECIMAL(19,2) NULL,
    minimum_stock DECIMAL(19,6) NOT NULL,
    maximum_stock DECIMAL(19,6) NULL,
    track_lots BOOLEAN NOT NULL,
    track_expiry BOOLEAN NOT NULL,
    CONSTRAINT uk_inventory_items_code UNIQUE(code),
    FOREIGN KEY(branch_id) REFERENCES branches(id),
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(updated_by) REFERENCES users(id),
    INDEX ix_inventory_items_branch_active (branch_id, active, id),
    FOREIGN KEY(category_id) REFERENCES inventory_categories(id),
    FOREIGN KEY(base_unit_id) REFERENCES inventory_units(id),
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id),
    CHECK(minimum_stock >= 0),
    CHECK(maximum_stock IS NULL OR maximum_stock >= minimum_stock),
    CHECK(reference_price IS NULL OR reference_price >= 0),
    CHECK(NOT track_expiry OR track_lots)
);

CREATE TABLE inventory_unit_conversions (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    branch_id BIGINT NOT NULL,
    code VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    active BOOLEAN NOT NULL,
    note VARCHAR(1000) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    item_id BIGINT NOT NULL,
    input_unit_id BIGINT NOT NULL,
    factor DECIMAL(19,6) NOT NULL,
    CONSTRAINT uk_inventory_unit_conversions_code UNIQUE(code),
    FOREIGN KEY(branch_id) REFERENCES branches(id),
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(updated_by) REFERENCES users(id),
    INDEX ix_inventory_unit_conversions_branch_active (branch_id, active, id),
    FOREIGN KEY(item_id) REFERENCES inventory_items(id),
    FOREIGN KEY(input_unit_id) REFERENCES inventory_units(id),
    CHECK(factor > 0),
    CONSTRAINT uk_inventory_conversion_name UNIQUE(item_id, name)
);

CREATE TABLE cash_accounts (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    branch_id BIGINT NOT NULL,
    code VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    active BOOLEAN NOT NULL,
    note VARCHAR(1000) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    account_type VARCHAR(20) NOT NULL,
    CONSTRAINT uk_cash_accounts_code UNIQUE(code),
    FOREIGN KEY(branch_id) REFERENCES branches(id),
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(updated_by) REFERENCES users(id),
    INDEX ix_cash_accounts_branch_active (branch_id, active, id),
    CHECK(account_type IN ('CASH','BANK','EWALLET','OTHER'))
);

CREATE TABLE transaction_categories (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    branch_id BIGINT NOT NULL,
    code VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    active BOOLEAN NOT NULL,
    note VARCHAR(1000) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    direction VARCHAR(20) NOT NULL,
    CONSTRAINT uk_transaction_categories_code UNIQUE(code),
    FOREIGN KEY(branch_id) REFERENCES branches(id),
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(updated_by) REFERENCES users(id),
    INDEX ix_transaction_categories_branch_active (branch_id, active, id),
    CHECK(direction IN ('INCOME','EXPENSE'))
);

CREATE TABLE operations_audit (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, branch_id BIGINT NOT NULL,
 module VARCHAR(20) NOT NULL, resource VARCHAR(40) NOT NULL, record_id BIGINT NOT NULL,
 action VARCHAR(20) NOT NULL, actor_id BIGINT NOT NULL, occurred_at TIMESTAMP(6) NOT NULL,
 changed_fields VARCHAR(1000) NOT NULL,
 FOREIGN KEY(branch_id) REFERENCES branches(id), FOREIGN KEY(actor_id) REFERENCES users(id),
 INDEX ix_operations_audit_branch_module (branch_id, module, id)
);

CREATE TABLE inventory_settings (
 branch_id BIGINT NOT NULL PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0,
 approval_required BOOLEAN NOT NULL, approval_threshold DECIMAL(19,2) NOT NULL,
 allow_negative BOOLEAN NOT NULL, default_warehouse_id BIGINT NULL,
 updated_at TIMESTAMP(6) NOT NULL, updated_by BIGINT NOT NULL,
 FOREIGN KEY(branch_id) REFERENCES branches(id), FOREIGN KEY(updated_by) REFERENCES users(id),
 FOREIGN KEY(default_warehouse_id) REFERENCES warehouses(id), CHECK(approval_threshold >= 0)
);

CREATE TABLE finance_settings (
 branch_id BIGINT NOT NULL PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0,
 approval_required BOOLEAN NOT NULL, approval_threshold DECIMAL(19,2) NOT NULL,
 allow_negative BOOLEAN NOT NULL, default_account_id BIGINT NULL,
 updated_at TIMESTAMP(6) NOT NULL, updated_by BIGINT NOT NULL,
 FOREIGN KEY(branch_id) REFERENCES branches(id), FOREIGN KEY(updated_by) REFERENCES users(id),
 FOREIGN KEY(default_account_id) REFERENCES cash_accounts(id), CHECK(approval_threshold >= 0)
);
