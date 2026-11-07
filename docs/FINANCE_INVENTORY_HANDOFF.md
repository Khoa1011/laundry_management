# Bàn giao Thu chi & Kho — Single-Operator Workflow — 07/11/2026

## Phạm vi lượt thay đổi

Chỉ đơn giản hóa workflow và lưu quy tắc lâu dài. Không triển khai Phase 2–4, không tạo API chứng từ, ledger, công nợ hoặc giao dịch giả. Nền tảng vẫn gồm tám danh mục, hai trang cấu hình và hai trang lịch sử, tổng 38 endpoint.

## FINANCE & INVENTORY — SINGLE-OPERATOR WORKFLOW

Quy tắc chính thức là **Tạo mới → Lưu → Có hiệu lực ngay**. Người có quyền được sửa và hủy chứng từ đã lưu, không giới hạn ở nháp. Các phase sau phải version chứng từ, tính chênh lệch an toàn và thêm bút toán điều chỉnh/đảo có liên kết; không sửa/xóa ledger cũ. Giữ mã phiếu, lịch sử trước/sau, audit, idempotency, concurrency, quyền hiệu lực và phạm vi chi nhánh.

Không có gửi duyệt, duyệt, từ chối, người duyệt, ngưỡng tiền, xác nhận bởi người thứ hai hoặc nút ghi sổ riêng sau Lưu. Không thay thế bằng một workflow tương đương dưới tên khác. Trạng thái thông thường là DRAFT tùy chọn, RECORDED và CANCELLED; trạng thái chuyển/nhận hàng chỉ phản ánh vận hành vật lý. Chỉ phục hồi workflow phê duyệt khi chủ dự án yêu cầu rõ ràng trong tương lai.

Mười một quy tắc bắt buộc đã ghi trong root `AGENTS.md`; `BUSINESS_RULES.md`, `FINANCE_INVENTORY_ARCHITECTURE.md` và hướng dẫn thêm module cũng đã đồng bộ. Tài liệu kiến trúc quy định sửa phiếu 5→7 lít, chi 500.000→450.000đ, xử lý vật tư đã tiêu hao/công nợ đã trả, hoàn/hủy, retry và đồng thời. Đây là acceptance criteria tương lai, không phải chức năng đã triển khai.

## Phân quyền và migration

V27 trước đây đăng ký 51 quyền Finance/Inventory. Danh mục hiện hành có **45 quyền**: ngừng dùng 8 quyền `document.submit`, `document.approve`, `document.post`, `document.reverse` của hai module; thêm `inventory.document.cancel`, `finance.document.cancel`. `document.update` mô tả sửa chứng từ đã lưu, mức rủi ro HIGH cho kho và CRITICAL cho tiền.

Migration mới `V28__simplify_finance_inventory_workflow.sql`:

- Giữ toàn bộ permission/grant/override cũ, chuyển 8 permission sang INACTIVE. Không xóa quyền hay lịch sử.
- Quyền Hủy mới kế thừa grant đảo chứng từ thực tế đang có. Không cấp theo tên role hoặc từ quyền duyệt/ghi sổ cũ. Quyền đã thu hồi không được tự cấp lại.
- Sao chép override từ quyền đảo sang Hủy, giữ effect ALLOW/DENY, thời hạn, status, lý do, thời gian và actor. DENY không mất khi chuyển đổi.
- Tăng version quyền của user/role bị ảnh hưởng để loại bỏ snapshot chỉnh quyền cũ.
- Giữ các cột approval của hai bảng settings và dữ liệu cũ; chỉ đổi default cho insert mới thành false/0. Entity/service hiện tại không map, đọc hay sử dụng chúng.
- Không sửa V27 hoặc migration đã áp dụng; không drop bảng/cột và không sửa ledger.

Generated Java/TypeScript chỉ chứa quyền hiện hành. Ma trận/grouped catalog và effective permissions loại bỏ permission INACTIVE. Lưu ma trận/override giữ nguyên các assignment đã ngừng dùng dưới dạng dữ liệu tương thích, đồng thời từ chối gán mới permission INACTIVE. Tạo/clone role mới chỉ sao chép permission ACTIVE, không sao chép lịch sử quyền đã ngừng dùng. Quy tắc `DENY > ALLOW > ROLE`, phạm vi chi nhánh và kiểm tra quyền backend giữ nguyên; không có ADMIN bypass.

## Backend và hợp đồng API

GET/PUT `/api/inventory/settings` và `/api/finance/settings` giữ nguyên URL, branchId/version, defaultResourceId và allowNegative. Response giữ valuationMethod/currency/updatedAt; loại bỏ approvalRequired/approvalThreshold. Request không cần hai trường này; nếu client cũ còn gửi thì chúng bị bỏ qua, kể cả giá trị không hợp lệ, và không thể kích hoạt workflow cũ hoặc sửa cột lịch sử.

Audit cấu hình mới chỉ ghi `allowNegative,defaultResourceId`. Audit cũ không bị sửa; UI hiển thị các tên trường đã loại bỏ dưới nhãn “Cấu hình cũ (không còn áp dụng)”. Transaction, khóa chi nhánh, locking read chống snapshot cũ MySQL, optimistic version, phân trang, chống lộ giá mua và rollback nền tảng giữ nguyên.

Không có state machine/chứng từ nghiệp vụ thực tế ở Phase 1 để chuyển trạng thái trong lượt này. Quy tắc ledger bất biến áp dụng cho bút toán; không còn quy tắc cấm sửa chứng từ đã lưu trong thiết kế đích.

## Frontend

Đã rà soát 12 trang Phase 1. Chỉ hai trang cấu hình có control liên quan đến duyệt; các control, type và nhãn Việt/Anh đó đã bỏ. Danh mục vẫn dùng Thêm mới/Lưu/Chỉnh sửa/Chi tiết/Lịch sử; không thêm nút duyệt, ghi sổ hay badge/bộ lọc approval.

Form cấu hình và dialog danh mục đăng ký guard đổi chi nhánh dùng chung qua AuthProvider:

- Form sạch đổi chi nhánh ngay, không cảnh báo thừa.
- Form đã thay đổi: cảnh báo trước khi đổi; Hủy giữ chi nhánh và giá trị; xác nhận mới bỏ dữ liệu và chuyển đúng một lần.
- Khi đang lưu, không được đổi chi nhánh hoặc đóng cảnh báo để làm mất thao tác đang xử lý.
- Callback cũ, yêu cầu bị thay thế và form đã unmount không thể đổi chi nhánh về sau. Mất quyền chi nhánh từ backend vẫn buộc đổi phạm vi ngay, không bị guard trì hoãn.
- Cảnh báo đóng/rời route và beforeunload đã có vẫn giữ nguyên.

Tái sử dụng ConfirmDialog/OverlayDialog, Surface, Field, MoneyInput và motion provider. Không thêm CSS, dependency hoặc hệ theme mới. Giữ Solid Admin đã được người dùng chọn; không đưa Liquid Glass vào các trang đặc. Giữ i18n, mobile-first và theme chung hiện có. Theme chung chưa có dark mode; không tuyên bố đã kiểm thử dark mode.

## Kiểm chứng lượt này

| Kiểm tra | Kết quả lượt này |
|---|---|
| Toàn bộ backend H2 + Maven verify | PASS 193, FAIL 0; build thành công |
| Foundation + nâng cấp V27→V28 trên MySQL 8.4 | PASS 21, FAIL 0 |
| Hồi quy query tăng version đúng role trên MySQL | PASS; chỉ user của role đích tăng version |
| Frontend Vitest | PASS 208, FAIL 0; 51 file |
| Typecheck, lint, production build | PASS |
| Permission Node tests | PASS 10, FAIL 0 |
| Generate / validate / generated-file sync | PASS; 140 quyền hiện hành toàn hệ thống |
| git diff --check | PASS |

Browser thật: 12 trang × 7 viewport = 84 lượt kiểm tra layout và không còn UI duyệt; hai cảnh báo đổi chi nhánh × 7 viewport = 14 lượt ở trạng thái mở ổn định. Viewport: 390×844, 360×800, 390×600, 768×1024, 1024×768, 1366×768, 1440×900. Không thấy tràn ngang, control chính dưới 44px hoặc footer cảnh báo vượt viewport. Đã thử Hủy giữ dữ liệu/chi nhánh, xác nhận mới đổi, form sạch đổi ngay, lưu cấu hình trực tiếp, đóng bằng Escape, sửa danh mục đã lưu, Việt/Anh, ADMIN/MANAGER và người thiếu quyền. Trạng thái đang lưu và callback cũ được kiểm tra bằng unit tests. Danh mục và ma trận quyền trên UI hiển thị 26 quyền Kho + 19 quyền Thu chi, có Hủy và không có tám quyền workflow cũ.

### Review và lỗi đã sửa

- Backend/security review: cột legacy không tham gia quyết định; không có API/permission duyệt hoặc ghi sổ riêng. DENY, scope, version, transaction và audit vẫn được thực thi. Ma trận/override không làm mất assignment cũ; tạo/clone role chỉ sao chép permission ACTIVE. Kiểm thử upgrade so sánh đầy đủ effect, lý do, thời hạn, trạng thái, version, timestamp và actor của override gốc/bản chuyển đổi.
- Đã tái hiện lỗi có sẵn MySQL 1093 khi lưu ma trận quyền (HTTP 500): JPQL bulk update đọc lại bảng users đang được cập nhật. Đổi thành một native bulk update chỉ đọc user_roles trong subquery. Regression trên MySQL trả 200, tăng version user thuộc đúng role và giữ nguyên user role khác. Không đổi isolation/locking hay tăng pool; không tuyên bố cải thiện p95/throughput khi chưa đo.
- Query-count của danh mục vẫn đạt test 3 statement cho page 20 trên 25 bản ghi; concurrency 8 luồng và rollback audit vẫn đạt trên H2/MySQL.
- Impeccable detector trả `[]`. Review scoped: accessibility 3/4, responsive 3/4, performance 3/4, theming 2/4, anti-patterns 4/4 (15/20). Dùng shared primitives, không CSS/token/dependency mới; không còn P0/P1 mới được xác định trong phần đã kiểm chứng. Chưa chứng nhận WCAG/contrast đầy đủ.
- Giới hạn kiểm chứng: không có dark mode trong theme chung hiện tại; chưa xác minh zoom 125% và touch emulation. Các giới hạn này không được ghi PASS. Dependency scan đầy đủ và load test chưa chạy.


### Các kịch bản chứng từ — NOT RUN

Không thể chạy tạo/lưu chứng từ tác động tiền/kho, sửa phiếu 5→7 lít, chi 500.000→450.000đ, hủy chứng từ, chống trùng ledger, sửa công nợ sau thanh toán hoặc rollback/concurrency chứng từ vì các nghiệp vụ Phase 2–4 chưa có. Mười kịch bản acceptance trong tài liệu kiến trúc đã cập nhật và đều mang trạng thái NOT RUN. Kiểm thử CRUD danh mục, cấu hình và rollback cấp mã không thay thế chúng.

### Hướng dẫn kiểm thử thủ công

1. Dùng môi trường test/development đã nâng cấp đến V28; không dùng production. Mở Kho → Cấu hình và Thu chi → Cấu hình: không có trường hoặc điều kiện duyệt.
2. Lưu cấu hình chỉ với branchId/version/allowNegative/defaultResourceId. Kiểm tra response và audit không có cấu hình duyệt mới; gửi field legacy không thay đổi workflow.
3. Thay một giá trị rồi chọn chi nhánh khác. Hủy phải giữ dữ liệu và chi nhánh; xác nhận mới chuyển. Thử form sạch, đang lưu, Tab/Shift+Tab/Escape, viewport 390×600.
4. Tạo/sửa danh mục, đóng form đã đổi, mở lại và xem lịch sử. Kiểm tra code/version và quyền trường giá mua như trước.
5. Mở ma trận quyền: không còn 8 quyền workflow cũ; có Hủy chứng từ. Thử DENY, read-only, thiếu quyền và ID khác chi nhánh; backend vẫn phải chặn.
6. Khi triển khai Phase 2 trở đi, chỉ dùng acceptance criteria Single-Operator trong kiến trúc; không phục hồi thiết kế duyệt cũ.

## Rủi ro và giới hạn

Nghiệp vụ vận hành Phase 2–4 vẫn chưa triển khai. Chưa chạy tải/p95/p99, EXPLAIN trên dữ liệu lớn hoặc dependency scan đầy đủ. Giữ giới hạn kiểm chứng theme/touch/zoom được ghi ở kết quả cuối; không suy ra chúng đã đạt từ việc build thành công. Không commit, push, merge, deploy hoặc sửa dữ liệu production.

## Tệp thay đổi trong lượt này

- `AGENTS.md`
- `access-control/modules/finance.yml`
- `access-control/modules/inventory.yml`
- `backend/src/main/java/com/laundry/management/auth/access/application/AccessControlService.java`
- `backend/src/main/java/com/laundry/management/auth/infrastructure/UserAccountRepository.java`
- `backend/src/main/java/com/laundry/management/auth/security/permission/PermissionCodes.java`
- `backend/src/main/java/com/laundry/management/operations/api/PolicyDtos.java`
- `backend/src/main/java/com/laundry/management/operations/application/OperationsPolicyService.java`
- `backend/src/main/java/com/laundry/management/operations/domain/PolicySettings.java`
- `backend/src/main/resources/db/migration/common/V28__simplify_finance_inventory_workflow.sql`
- `backend/src/test/java/com/laundry/management/operations/OperationsBrowserServer.java`
- `backend/src/test/java/com/laundry/management/operations/OperationsFoundationConcurrencyTest.java`
- `backend/src/test/java/com/laundry/management/operations/OperationsFoundationIntegrationTest.java`
- `backend/src/test/java/com/laundry/management/operations/SingleOperatorMigrationTest.java`
- `docs/ADDING_A_NEW_MODULE.md`
- `docs/BUSINESS_RULES.md`
- `docs/FINANCE_INVENTORY_ARCHITECTURE.md`
- `docs/FINANCE_INVENTORY_HANDOFF.md`
- `frontend/AGENTS.md`
- `frontend/src/auth/AuthProvider.test.tsx`
- `frontend/src/auth/AuthProvider.tsx`
- `frontend/src/auth/branchChangeGuards.test.ts`
- `frontend/src/auth/branchChangeGuards.ts`
- `frontend/src/auth/permissionCodes.generated.ts`
- `frontend/src/components/UnsavedBranchDialog.test.tsx`
- `frontend/src/components/UnsavedBranchDialog.tsx`
- `frontend/src/features/operations/OperationsPages.test.tsx`
- `frontend/src/features/operations/OperationsPages.tsx`
- `frontend/src/features/operations/catalog.ts`
- `frontend/src/features/operations/translations.ts`

Trạng thái bàn giao: **PARTIALLY VERIFIED** do giới hạn kiểm chứng zoom/touch/theme nêu trên. Phần đơn giản hóa workflow đã triển khai và kiểm thử; các nghiệp vụ chứng từ Phase 2–4 vẫn NOT RUN. Môi trường kiểm thử tạm đã dừng; không commit/push/deploy hoặc sửa dữ liệu production.
