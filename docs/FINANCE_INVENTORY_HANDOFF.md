# Bàn giao Thu chi & Kho — 07/11/2026

## A. Tổng quan và trạng thái

**PARTIALLY VERIFIED** cho yêu cầu tổng thể. Phase 0 đã có tài liệu kiến trúc. Phần danh mục của Phase 1 đã triển khai bằng database/API thật và kiểm thử; chưa tuyên bố hoàn thành toàn bộ Phase 1 vì các giới hạn UI dưới đây. Phase 2, 3, 4 chưa triển khai.

Đã có: kho; nhóm vật tư; đơn vị; nhà cung cấp; vật tư; nhiều quy cách nhập trên một vật tư; tài khoản quỹ; danh mục thu/chi; cấu hình riêng từng chi nhánh; lịch sử thay đổi; phân quyền API, điều hướng, trang, hành động và trường giá mua. Mỗi danh mục có tạo, xem, tìm kiếm, lọc trạng thái, phân trang, chỉnh sửa theo version và ngừng sử dụng. Không hard delete.

Chưa có: phiếu nhập/xuất/chuyển kho/kiểm kê, stock ledger/balance, giá vốn thực tế, phiếu thu/chi, cash ledger/balance, chuyển/đối soát quỹ, công nợ và thanh toán nhà cung cấp, số dư đầu kỳ, trả hàng/hoàn tiền/đảo chứng từ, khóa kỳ, dashboard/báo cáo/export, ảnh đại diện vật tư và đính kèm chứng từ, thông báo nghiệp vụ mới, adapter Order/Payment/Wash Batch. Không có API giả, chứng từ giả hay số dư giả cho các phần này.

## B. Backend, API và database

Migration mới duy nhất: `V27__create_finance_inventory_foundation.sql`. Không sửa migration cũ. Có 12 bảng mới: warehouses, inventory_categories, inventory_units, suppliers, inventory_items, inventory_unit_conversions, cash_accounts, transaction_categories, inventory_settings, finance_settings, operations_sequences, operations_audit.

Tám collection:

| Module | Collection |
|---|---|
| Inventory | `/api/inventory/warehouses` |
| Inventory | `/api/inventory/categories` |
| Inventory | `/api/inventory/units` |
| Inventory | `/api/inventory/suppliers` |
| Inventory | `/api/inventory/items` |
| Inventory | `/api/inventory/conversions` |
| Finance | `/api/finance/accounts` |
| Finance | `/api/finance/categories` |

Mỗi collection có GET danh sách, GET `/{id}`, POST tạo, PUT `/{id}` cập nhật. Cộng thêm GET/PUT `/api/inventory/settings`, GET/PUT `/api/finance/settings`, GET `/api/inventory/history`, GET `/api/finance/history`: tổng 38 endpoint mới. Không thay hợp đồng endpoint hiện có.

GET nhận `branchId`; danh sách nhận thêm page, size 1–100, search tối đa 150 ký tự, active tùy chọn. POST/PUT nhận branchId trong body, PUT cần version hiện hành. Tiền, số lượng và hệ số trả về dạng chuỗi thập phân chính xác. Giá nhập tham khảo có quyền riêng; bỏ trống giá khi sửa không xóa giá cũ. Khoảng tồn và nhóm đơn vị được kiểm tra ở backend. Số dư không có trong DTO cập nhật danh mục.

Cấp mã khóa chi nhánh và đọc sequence bằng `FOR UPDATE`. Cấu hình lần đầu cũng dùng khóa chi nhánh và locking read. Điều này tránh snapshot cũ của MySQL REPEATABLE READ sau khi chờ khóa. Tham chiếu đang dùng được kiểm tra theo chi nhánh bằng locking read. Version ngăn ghi đè. Thay đổi danh mục, sequence và audit chung một transaction; đã thử lỗi audit và xác minh rollback cả bản ghi lẫn sequence. Quỹ/kho mặc định phải được đổi trước khi ngừng sử dụng bản ghi đó.

## C. Frontend và responsive

12 URL: `/inventory/{items,warehouses,categories,units,conversions,suppliers,settings,history}` và `/finance/{accounts,categories,settings,history}`. `/inventory` và `/finance` tự mở trang đầu tiên có quyền. Các màn dùng chung định nghĩa trường, query/filter/pagination, dialog và thao tác; mobile/desktop không fetch hay quản lý state riêng.

### Mobile

- Danh sách một cột, dữ liệu dài xuống dòng; tab và nút ít nhất 44px.
- Form dùng label, inputMode decimal/tel, tiền qua MoneyInput. Chấp nhận dấu phẩy thập phân và gửi chuỗi chuẩn, không tính tiền bằng số thực JavaScript.
- Dùng OverlayDialog, focus trap, Tab/Shift+Tab/Escape, cảnh báo đóng/rời form đã thay đổi, loading khi lưu, lỗi gần trường.
- Tái sử dụng padding trang và safe area; đã cuộn và xác minh phần phân trang không bị bottom navigation che ở 390×600. Dialog dùng footer riêng, không tạo thanh cố định thứ hai.

### Tablet và desktop

- Tablet bố trí tìm kiếm và lọc thành hai cột.
- Desktop có bảng so sánh và sidebar chung. Màn rộng giới hạn theo token 1440px; form có giới hạn riêng.
- Không đổi Solid Admin sang Liquid Glass; đây là lựa chọn người dùng đã xác nhận. Không cài dependency mới.

### Các trạng thái

Loading, empty, no-results, error/retry, success, validation, stale-version, read-only, permission denied và long content đã có. Tạo danh mục và lưu cấu hình đã thao tác trên trình duyệt với backend H2 riêng. UI có tiếng Việt/Anh; lựa chọn enum có nhãn dịch. Chế độ giảm chuyển động đã thao tác thật.

Giới hạn: theme dùng chung hiện chỉ có Solid Admin sáng; không có dark mode để kiểm chứng. Chưa xác minh được zoom Chrome 125% bằng tín hiệu đáng tin cậy. Browser capability cung cấp viewport, chưa cung cấp touch emulation; thao tác touch giả lập chưa kiểm chứng. Thay chi nhánh từ header khi form cấu hình còn thay đổi có thể làm mất phần chưa lưu; body ghi vẫn luôn gắn đúng branchId ban đầu. Form dialog khóa phần nền nên không có đường đổi chi nhánh thông thường trong lúc nhập danh mục.

## D. Phân quyền và review

Manifest mới: Inventory 29 quyền, Finance 22 quyền. ADMIN/MANAGER được grant tường minh 51 quyền; RECEPTIONIST chỉ có 5 quyền đọc danh mục Inventory không gồm giá mua. Đã generate Java/TypeScript, đăng ký bằng migration và kiểm tra đồng bộ. Các quyền cho phase sau hiện chưa có endpoint/hành động tương ứng.

- Backend review: DTO/validation, FK, precision, transaction, version và rollback đã kiểm tra; không còn lỗi High đã xác định trong các đường danh mục được kiểm thử.
- Security review: kiểm tra effective permissions, DENY vượt role/ALLOW, ALLOW chỉ mở quyền được chọn, ADMIN không bypass, API không đăng nhập, IDOR/cross-branch và quyền giá mua. Audit chỉ lưu định danh, thời gian, thao tác và tên trường đã gửi; không sao chép điện thoại, email, địa chỉ hay note. Không thêm upload, export hoặc URL file công khai. Chưa chạy quét lỗ hổng dependency đầy đủ; không thay dependency.
- Performance review: fixture 25 kho, page 20 bản ghi dùng đúng 3 SQL statement trong application-service transaction: branch lookup, page query, count query. Không có query theo từng dòng. Đã kiểm tra concurrent creation 8 luồng trên H2/MySQL. Đây không phải phép đo tải, p50/p95/p99, throughput hoặc EXPLAIN trên dữ liệu production; chưa đưa ra tuyên bố cải thiện các chỉ số đó. Khóa chi nhánh có thể giới hạn tốc độ tạo danh mục hàng loạt; search chứa chuỗi chưa được benchmark trên dữ liệu lớn.

### Impeccable audit trong phạm vi mới

| Mặt kiểm tra | Điểm /4 | Bằng chứng và giới hạn |
|---|---:|---|
| Accessibility | 3 | Label, focus/keyboard, 44px, lỗi gần trường; chưa chứng nhận toàn bộ contrast/WCAG |
| Performance | 3 | Lazy route, query phân trang, shared primitives, không dependency/effect mới; chưa đo FPS/tải |
| Responsive | 3 | Ma trận viewport và dialog bên dưới đạt; zoom/touch còn thiếu |
| Theming | 2 | Semantic token, không token không tồn tại; theme chung chưa có dark mode |
| Anti-patterns | 4 | Không vật liệu/màu/motion riêng; detector không có finding |
| Tổng | 15/20 | Audit có giới hạn, không phải xác nhận đủ điều kiện phát hành |

Đã sửa: tab ban đầu chỉ cao 23.25px do thiếu class primitive, đọc snapshot MySQL gây trùng sequence/settings, thông báo conflict nhầm với stale version, phân trang thừa trong selector chỉ một trang. Không còn P0/P1 mới được xác định trong luồng danh mục đã kiểm chứng; các giới hạn nêu trên vẫn giữ trạng thái mở.

## E. Kiểm thử đã thực thi

| Bộ kiểm tra | PASS | FAIL | Ghi chú |
|---|---:|---:|---|
| Maven verify, toàn bộ H2 backend | 188 | 0 | Build thành công |
| Foundation trên MySQL 8.4 | 16 | 0 | 12 integration + 4 concurrency/rollback/query-count |
| Frontend Vitest | 203 | 0 | 49 file, tối đa 2 worker |
| Access-control Node tests | 10 | 0 | Generate/validate/drift đều đạt |
| Tổng lượt test tự động trong ma trận trên | 417 | 0 | 16 ca foundation được chạy trên cả hai DB |

Frontend typecheck, lint, production build đạt. `git diff --check` đạt. Impeccable detector trả về `[]`; không có token không tồn tại trong operations.css.

Browser layout kiểm tra 12 trang × 13 viewport = 156 lượt: 390×844, 360×800, 390×600, 768×1024, 1024×768, 1366×768, 1440×900, 320×800, 375×812, 412×915, 1280×720, 1366×600, 1920×1080. Kết quả: không tràn ngang, không nút/tab chính dưới 44px. Kiểm tra 8 dialog × 7 viewport bắt buộc = 56 lượt, panel/footer vừa viewport (dùng dung sai 1px cho tọa độ thập phân). Kiểm tra thêm 38 lượt resize từng bước 60px từ 360 đến 1440 trên hai trang đại diện. Đây là 250 lượt kiểm tra layout, không cộng vào 417 test tự động.

Browser workflows đã chạy: tạo 8 loại danh mục, lưu cấu hình quỹ, xem lịch sử, dữ liệu dài, validation hệ số 0, Tab/Shift+Tab/Escape và giữ dữ liệu khi hủy đóng form, chuyển Việt/Anh, giảm chuyển động, ADMIN/MANAGER có thao tác, RECEPTIONIST chỉ đọc và không thấy giá mua, truy cập Finance bị từ chối.

**BLOCKED: 3 mục kiểm chứng** — dark mode chung chưa có, zoom 125% chưa xác minh, touch emulation chưa có trong capability đã dùng. **NOT RUN: 10 kịch bản số liệu tại mục 38 của yêu cầu gốc** vì các nghiệp vụ nhập/xuất/tiền/công nợ/đảo chứng từ chưa được triển khai; kiểm thử concurrency/rollback danh mục không thay thế những kịch bản này. E2E của phase 2–4, file upload/export/notification và load/security scans đầy đủ cũng chưa thực hiện.

Các lần lỗi do sandbox (loopback, cache rename) đã chạy lại ngoài sandbox và đạt. Lỗi MySQL concurrency đã tái hiện, sửa và kiểm tra lại; không che bằng đổi isolation level. Không thử trên dữ liệu production. Container MySQL riêng không dùng volume ứng dụng; browser server ép H2 in-memory; không restart/update các container ứng dụng đang tồn tại.

## F. Tệp thay đổi

Danh sách chính xác ở cuối tài liệu. Kiến trúc và API target: `FINANCE_INVENTORY_ARCHITECTURE.md`; quy tắc đã được xác nhận bổ sung vào `BUSINESS_RULES.md`.

## G. Kiểm thử thủ công và bước tiếp theo

Chỉ dùng môi trường development/test sau khi áp dụng migration theo quy trình sẵn có. Không áp dụng vào production từ phiên làm việc này.

1. Đăng nhập tài khoản có quyền và chọn chi nhánh. Mở Quản lý kho.
2. Tạo nhóm vật tư Hóa chất, đơn vị Lít thuộc nhóm Thể tích, nhà cung cấp.
3. Tạo Nước giặt, chọn nhóm/đơn vị/nhà cung cấp, tồn tối thiểu và giá tham khảo nếu có quyền. Kiểm tra mã tự sinh và lịch sử.
4. Tạo quy cách Can 5 lít với hệ số 5; thử hệ số 0 hoặc đơn vị khác nhóm để kiểm tra lỗi. Thêm quy cách thứ hai trên cùng vật tư.
5. Sửa hai bản mở cùng một record; bản cũ phải bị từ chối. Thử tham chiếu ID ngoài chi nhánh qua API: phải bị từ chối.
6. Mở Thu chi, tạo Quỹ tiền mặt và danh mục Chi điện nước. Không có trường sửa số dư. Lưu quỹ/kho mặc định trong cấu hình; xem lịch sử.
7. Thử RECEPTIONIST: chỉ đọc danh mục Inventory, không có nút lưu/thêm, không có giá mua hoặc Finance. Thử override DENY: backend vẫn từ chối dù role đã grant.
8. Kiểm tra 390×600, dữ liệu dài, cuộn cuối trang, dialog, bàn phím, tiếng Anh và chế độ giảm chuyển động.

**Chưa thể tiếp tục thao tác nhập kho → xuất kho → thanh toán → báo cáo trên sản phẩm này.** Phase tiếp theo là Inventory Operations: chứng từ và state machine, stock ledger/balance, định giá, chống tồn âm, chuyển kho, kiểm kê và contract tạo công nợ trong cùng transaction. Sau đó mới triển khai Finance Operations và Integration/Hardening như kiến trúc đã ghi. Cần đóng các giới hạn UI và phần cấu hình kỳ/mã chứng từ/đính kèm còn thiếu trước khi đánh dấu toàn bộ yêu cầu hoàn tất.

## H. Bàn giao vận hành

Không commit, push, merge, deploy hoặc sửa dữ liệu production. Các thay đổi ở working tree để review. Maven Wrapper và dependency hiện có được giữ nguyên. Không thay API cũ. Không sửa database ngoài container test tạm. Trạng thái cuối: **PARTIALLY VERIFIED**.

### Danh sách tệp

- `access-control/modules/finance.yml`
- `access-control/modules/inventory.yml`
- `backend/src/main/java/com/laundry/management/auth/security/permission/PermissionCodes.java`
- `backend/src/main/java/com/laundry/management/common/exception/ErrorCode.java`
- `backend/src/main/java/com/laundry/management/finance/api/FinanceCatalogController.java`
- `backend/src/main/java/com/laundry/management/finance/application/FinanceCatalogService.java`
- `backend/src/main/java/com/laundry/management/finance/domain/CashAccount.java`
- `backend/src/main/java/com/laundry/management/finance/domain/FinanceSettings.java`
- `backend/src/main/java/com/laundry/management/finance/domain/TransactionCategory.java`
- `backend/src/main/java/com/laundry/management/finance/infrastructure/CashAccountRepository.java`
- `backend/src/main/java/com/laundry/management/finance/infrastructure/FinanceSettingsRepository.java`
- `backend/src/main/java/com/laundry/management/finance/infrastructure/TransactionCategoryRepository.java`
- `backend/src/main/java/com/laundry/management/inventory/api/InventoryCatalogController.java`
- `backend/src/main/java/com/laundry/management/inventory/application/InventoryCatalogService.java`
- `backend/src/main/java/com/laundry/management/inventory/domain/InventoryCategory.java`
- `backend/src/main/java/com/laundry/management/inventory/domain/InventoryConversion.java`
- `backend/src/main/java/com/laundry/management/inventory/domain/InventoryItem.java`
- `backend/src/main/java/com/laundry/management/inventory/domain/InventorySettings.java`
- `backend/src/main/java/com/laundry/management/inventory/domain/InventoryUnit.java`
- `backend/src/main/java/com/laundry/management/inventory/domain/Supplier.java`
- `backend/src/main/java/com/laundry/management/inventory/domain/Warehouse.java`
- `backend/src/main/java/com/laundry/management/inventory/infrastructure/InventoryCategoryRepository.java`
- `backend/src/main/java/com/laundry/management/inventory/infrastructure/InventoryConversionRepository.java`
- `backend/src/main/java/com/laundry/management/inventory/infrastructure/InventoryItemRepository.java`
- `backend/src/main/java/com/laundry/management/inventory/infrastructure/InventorySettingsRepository.java`
- `backend/src/main/java/com/laundry/management/inventory/infrastructure/InventoryUnitRepository.java`
- `backend/src/main/java/com/laundry/management/inventory/infrastructure/SupplierRepository.java`
- `backend/src/main/java/com/laundry/management/inventory/infrastructure/WarehouseRepository.java`
- `backend/src/main/java/com/laundry/management/operations/api/OperationsDtos.java`
- `backend/src/main/java/com/laundry/management/operations/api/OperationsPolicyController.java`
- `backend/src/main/java/com/laundry/management/operations/api/OperationsValidationHandler.java`
- `backend/src/main/java/com/laundry/management/operations/api/PolicyDtos.java`
- `backend/src/main/java/com/laundry/management/operations/application/CatalogPersistence.java`
- `backend/src/main/java/com/laundry/management/operations/application/OperationsAccess.java`
- `backend/src/main/java/com/laundry/management/operations/application/OperationsPolicyService.java`
- `backend/src/main/java/com/laundry/management/operations/application/OperationsValidationException.java`
- `backend/src/main/java/com/laundry/management/operations/domain/CatalogRecord.java`
- `backend/src/main/java/com/laundry/management/operations/domain/OperationsAudit.java`
- `backend/src/main/java/com/laundry/management/operations/domain/PolicySettings.java`
- `backend/src/main/java/com/laundry/management/operations/infrastructure/CatalogRepository.java`
- `backend/src/main/java/com/laundry/management/operations/infrastructure/OperationsAuditRepository.java`
- `backend/src/main/resources/db/migration/common/V27__create_finance_inventory_foundation.sql`
- `backend/src/test/java/com/laundry/management/operations/OperationsBrowserServer.java`
- `backend/src/test/java/com/laundry/management/operations/OperationsFoundationConcurrencyTest.java`
- `backend/src/test/java/com/laundry/management/operations/OperationsFoundationIntegrationTest.java`
- `docs/BUSINESS_RULES.md`
- `docs/FINANCE_INVENTORY_ARCHITECTURE.md`
- `docs/FINANCE_INVENTORY_HANDOFF.md`
- `frontend/src/App.tsx`
- `frontend/src/auth/permissionCodes.generated.ts`
- `frontend/src/features/operations/OperationsPages.test.tsx`
- `frontend/src/features/operations/OperationsPages.tsx`
- `frontend/src/features/operations/api.ts`
- `frontend/src/features/operations/catalog.ts`
- `frontend/src/features/operations/translations.ts`
- `frontend/src/i18n.ts`
- `frontend/src/layout/AppShell.tsx`
- `frontend/src/styles.css`
- `frontend/src/styles/operations.css`
- `frontend/src/styles/tokens.css`
