# Bàn giao Inventory Operations — Phase 2

Ngày kiểm tra: 08/11/2026. Mốc đầu vào: `ddde35aa964f78a3f65c47369e0b73c1ead87d7f` (V28), working tree sạch trước khi thực hiện. Không commit, push, deploy hoặc thao tác database production.

## A. Tổng quan

Đã triển khai 17 endpoint mới cho nhập, xuất theo sáu mục đích, chuyển kho cùng/khác chi nhánh, nhận từng phần, hoàn hàng đang chuyển, kiểm kê có version, điều chỉnh độc lập, sửa/hủy chứng từ, sổ kho, số dư, lô/hạn dùng, bình quân gia quyền di động, tổng quan, nhập xuất tồn, CSV và cảnh báo qua Notification Foundation hiện có.

Lưu chính thức có hiệu lực ngay; nháp tùy chọn. Không có gửi duyệt, duyệt hoặc thao tác ghi sổ riêng. Phiếu đã có biến động phụ thuộc bị chặn sửa lượng/giá và hướng dẫn điều chỉnh/trả hàng; vẫn cho sửa thông tin mô tả an toàn. Chứng từ và lịch sử không bị xóa cứng.

## B. Backend và dữ liệu

- `StockService` là transaction boundary. Phiếu, revision, bút toán, số dư, lô, hàng đang chuyển, audit và kết quả idempotency cùng commit/rollback.
- Khóa hàng chi nhánh theo thứ tự ID; khóa dữ liệu hiện hành và kiểm tra version. Tạo pool chưa tồn tại cũng được tuần tự hóa. Không thực hiện network I/O trong transaction kho.
- Lịch sử insert-only; sửa/hủy tạo bù trừ có liên kết document/revision. `StockQueries.reconciliation` đối chiếu tổng ledger và tổng lô với balance.
- Số lượng 6 chữ số thập phân, giá trị kho 6, giá vốn 8, giá/chiết khấu/thuế/phí chứng từ 2. Java dùng `BigDecimal`; frontend giữ decimal string. Dùng hết pool lấy đúng giá trị còn lại, không để dư làm tròn.
- Nhập có giảm giá/thuế từng dòng và phân bổ phí mua. Không cộng số lượng giữa các đơn vị cơ sở khác nhau, kể cả khi hai đơn vị được đặt cùng tên.
- Ngày nghiệp vụ mô tả chứng từ; thời điểm ghi nhận thực tế quyết định thứ tự giá vốn và kỳ ledger. Biểu đồ nhóm ngày UTC, bộ lọc ngày Việt Nam dùng khoảng đầu bao gồm/cuối không bao gồm.
- V29 tạo tám bảng `stock_*`, index/FK/check constraint và đăng ký hai quyền. V30 snapshot mục đích xuất trên ledger và projection tổng giá trị phiếu. V31 dùng LONGTEXT cho lịch sử/response 100 dòng vượt 64 KiB. Không sửa V1–V28.
- Theo dõi lô/hạn dùng không được đổi sau khi có ledger hoặc hàng đang chuyển tới vật tư. Đọc kiểm tra này dùng locking read để tránh snapshot cũ trên MySQL.

### API bổ sung

Prefix `/api/inventory`:

| API | Quyền |
|---|---|
| GET documents, documents/{id} | inventory.document.read |
| GET documents/{id}/history | inventory.audit.read |
| POST documents/preview | Quyền tạo tương ứng; document.update khi có documentId |
| POST documents | receipt.create / issue.create / transfer.create / stocktake.create / adjustment.create |
| PUT documents/{id} | inventory.document.update |
| POST documents/{id}/cancel | inventory.document.cancel |
| POST documents/{id}/receive, return-transit | inventory.transfer.receive |
| GET balances, lots, ledger, reconciliation | inventory.stock.read |
| GET packages | inventory.unit.read |
| GET dashboard | inventory.overview.read |
| GET reports | inventory.report.read |
| GET reports/export.csv | inventory.report.export |

Command cần `Idempotency-Key` 8–100 ký tự an toàn; sửa/hủy/nhận cần version. Cùng key/payload/actor trả snapshot ban đầu; đổi payload bị 409. Preview lập kế hoạch đầy đủ nhưng không ghi dữ liệu; preview sửa tính sau khi đảo tác động cũ. Danh sách mặc định 20, tối đa 100; tối đa 100 dòng/phiếu và 10.000 dòng/CSV. CSV vô hiệu hóa tiền tố công thức. Bộ lọc thời gian, kho, vật tư, nhóm và chi nhánh dùng dữ liệu thật.

## C. Frontend và responsive

Các trang: tổng quan, nhập, xuất, chuyển, kiểm kê, điều chỉnh, tồn, ledger, báo cáo, editor và chi tiết/lịch sử. Tái sử dụng danh mục Phase 1.

- **Mobile:** mặc định một cột, danh sách card, nhập trực tiếp số thập phân, thêm/bỏ dòng, lọc mở rộng, chọn vật tư/kho theo tên. Editor tập trung ẩn bottom navigation, dùng action bar chung và khoảng đệm safe area. Có bảo vệ rời trang/đổi chi nhánh khi chưa lưu hoặc đang gửi.
- **Tablet/desktop:** mở rộng trường thành hai cột; bảng từ breakpoint hiện hành; editor có phần tổng hợp bên cạnh trên màn rộng. Cùng query, filter và mutation với mobile.
- **Trạng thái:** loading, empty, retry/error, 403, toast thành công, validation từng dòng và conflict được triển khai. Xung đột giữ dữ liệu đã nhập. Retry giữ key khi payload không đổi. Không hiện cảnh báo bỏ dữ liệu sau lưu thành công.
- **Design:** giữ Solid Admin, token, primitives, i18n Việt/Anh và MotionProvider. Không thêm kính trong mờ/blur/ripple. Theme hiện tại không có dark mode.
- Biểu đồ hiển thị số lượng riêng theo đơn vị; `Number` chỉ dùng để chia tỷ lệ thanh meter, nhãn và nghiệp vụ giữ chuỗi decimal chính xác.

## D. Phân quyền và bảo mật

47 quyền Finance/Inventory hiện hành (28 Kho + 19 Thu chi), 142 quyền toàn hệ thống. Hai quyền mới `inventory.document.read` và `inventory.transfer.receive` có grant mặc định tường minh cho ADMIN/MANAGER; không có bypass theo tên role.

Backend kiểm tra effective permission và branch scope độc lập. Chuyển liên chi nhánh yêu cầu cả hai scope, vật tư đích tương thích đơn vị/lô. URL ID không vượt được branch scope. `DENY > ALLOW > ROLE` giữ nguyên. Giá, thuế/phí, giá trị, bình quân vốn và tổng hợp nhạy cảm bị che khỏi response/history/replay/dashboard/report nếu thiếu `inventory.cost.read`; CSV bỏ cột tiền. Không có file upload mới.

## E. Kết quả kiểm thử

Các log thô nằm trong `tmp/` (không bàn giao token/log request). Kết quả dưới đây chỉ áp dụng môi trường cô lập, không suy ra công suất production.

| Nhóm | Trạng thái |
|---|---|
| Backend H2, toàn bộ Maven verify | PASS 254, FAIL/ERROR/SKIP 0; Maven verify và JAR đạt. Đã chạy lại 7 ca concurrency với hai tài khoản khác nhau. |
| MySQL 8.4.11, database/container cô lập | PASS 60 ca kho ở lượt cuối; 20 ca Foundation + 1 ca nâng cấp V28→V31 đã PASS riêng (81 ca duy nhất). FAIL/ERROR 0. |
| Frontend regression | PASS 223, FAIL 0; 52 file |
| Typecheck / lint / build | PASS / PASS (không warning) / PASS |
| Permission generation/validation/drift | PASS, 142 constants đồng bộ |
| Permission Node tests | PASS 10 |
| Browser và responsive thật | BLOCKED: công cụ báo Local browser use is disabled in Work settings |

Không lấy kết quả browser Phase 1 để xác nhận các màn Phase 2. Chưa xác minh các viewport mới: 320, 360×800, 375, 390×844, 390×600, 412×915, 768×1024, 1024×768, 1280×720, 1366×768, 1366×600, 1440×900, 1920×1080; zoom 125%, touch, resize liên tục, keyboard thực tế và long-data thực tế đều NOT RUN khi công cụ còn bị tắt. Component tests không thay thế chúng.

### Audit đã áp dụng

- **Spring Backend Review:** transaction, precision, phụ thuộc khi sửa/hủy, transit, optimistic version, rollback sau ghi ledger, idempotency và request validation.
- **Spring Security Audit:** DENY với role có quyền, user ALLOW không cần role, endpoint read/write/export, branch IDOR, cost redaction trong mọi projection và replay. SQL tham số hóa, sort allowlist.
- **Spring Performance Audit:** list/history/report có giới hạn; aggregate ledger lọc chi nhánh trước khi nhóm; recent-document query dùng EXISTS để tránh một query cho mỗi phiếu. EXPLAIN MySQL trên fixture nhỏ (16 phiếu/17 dòng ledger tại thời điểm đo) chọn `ix_stock_ledger_time` cho danh sách, backward index scan; truy vấn aggregate dùng `ix_stock_ledger_scope` với branch lookup. Đây không phải benchmark dữ liệu lớn. Index scope/time và FK được kiểm tra. Khóa theo chi nhánh là đánh đổi chủ ý cho Single-Operator; không tuyên bố đã chứng minh p95/p99 hoặc công suất production.
- **Impeccable:** rà soát tĩnh mobile trước tablet/desktop, semantic token, shared primitives, focus/error/dirty state, action bar và reduced motion. Kiểm tra trực quan/tương tác còn phụ thuộc browser; chưa cấp chứng nhận hoàn tất responsive.

## F. Đối soát nghiệp vụ

Các integration test kiểm tra trực tiếp database và API:

1. 10 lít × 40.000 + 5 × 60.000 = 15 lít/700.000. Xuất 3 còn 12 lít/560.000.
2. Tồn đầu 10, nhập 5 rồi sửa thành 7: tồn 17; không thành 22. Ledger có bản gốc, bù trừ và phiên bản thay thế.
3. Xuất 3 sửa thành 2 hoàn lại đúng 1; hủy hợp lệ chỉ bù một lần.
4. Chuyển 6, nhận 4, hoàn 2: nguồn/đích/transit bảo toàn lượng và giá trị.
5. Kiểm kê 15 thành 14,5/16/15; snapshot cũ bị chặn nếu có giao dịch mới.
6. Hai lần xuất 8 từ tồn 10: chỉ một lần thành công. Hai retry cùng key chỉ một revision/ledger. Hai lần nhận dùng cùng version chỉ một lần credit.
7. Fault injection sau ghi ledger/balance: rollback cả phiếu, ledger, balance, audit và command key.
8. Lô/hạn, đơn vị quy đổi, giảm giá/thuế/phí, làm tròn cạn pool, phụ thuộc Finance giả lập, phiếu 100 dòng và đối soát tổng ledger/lô.
9. Đối soát SQL sau các transaction MySQL đã commit: **0** sai lệch balance/ledger, **0** sai lệch tổng lô; **40 revision / 40 audit chứng từ**.

## G. Tệp thay đổi

[Danh sách đầy đủ tệp thay đổi](INVENTORY_PHASE2_FILES.md). Các nhóm chính: manifest/generated permissions; package backend `inventory/operations`; guard trong InventoryCatalogService; V29–V31; integration/concurrency/migration tests; frontend `features/stock`; QuantityFlowChart; route/navigation/i18n/styles và các tài liệu bàn giao.

## H. Hướng dẫn test thủ công

1. Dùng database development/test nâng cấp đến V31. Vào Kho → Danh mục: tạo kho nguồn/kho nhận, nhóm, đơn vị Lít, vật tư Nước giặt và quy cách Can 5 lít. Tạo nhà cung cấp nếu cần.
2. Nhập hàng → Tạo phiếu: chọn kho, thêm 10 lít giá 40.000; lưu, kiểm tra thông báo, trạng thái, tồn và giá trị. Nhập thêm 5 lít giá 60.000; xem 15/700.000.
3. Trước khi có xuất, sửa phiếu 5 thành 7, xem tổng 17 và lịch sử bù trừ. Hủy phiếu sửa, xem tồn được hoàn đúng và không có nút hủy lần nữa.
4. Tạo xuất giặt sấy 3 lít. Kiểm tra tồn khả dụng/giá vốn và dữ liệu ledger. Thử vượt tồn; phải chặn tại dòng và backend. Không có giao dịch quỹ phát sinh.
5. Tạo chuyển 6 lít sang kho nhận. Xem đang chuyển; nhận 4 rồi hoàn 2. Không được nhận vượt hoặc sửa/hủy mù sau settlement.
6. Kiểm kê: chọn kho/vật tư, ghi 14,5 và lý do. Tạo một giao dịch khác ở tab thứ hai trước khi lưu để kiểm tra xung đột; tải tồn và kiểm đếm lại. Điều chỉnh độc lập dùng lượng dương + hướng tăng/giảm và lý do.
7. Xem tổng quan, nhóm đơn vị, biểu đồ, top tiêu hao, cảnh báo và phiếu gần đây. Lọc kỳ/kho/nhóm; mở báo cáo rồi ledger đúng vật tư/kho. CSV phải khớp kỳ và quyền đọc giá.
8. Thử MANAGER, nhân viên đủ quyền, chỉ đọc, thiếu quyền và DENY override; thử đổi ID/branchId, sửa phiếu phụ thuộc, retry sau mất kết nối và gửi lặp.
9. Thực hiện toàn bộ ma trận viewport và keyboard/touch/zoom nêu ở mục E trước nghiệm thu responsive. Kiểm tra dữ liệu dài, rỗng, loading, lỗi mạng, 403 và height thấp.

Fixture `OperationsBrowserServer` luôn dùng H2 in-memory ở 18080, không thể nối vào database ứng dụng. Có tài khoản thử manager/admin/readonly/receptionist và danh mục cô lập. Thông tin fixture chỉ nằm trong source test. Không dùng fixture trên production.

## I. Hạn chế và rủi ro

- Browser đang bị tắt trong Work settings; chưa thể chứng minh UI thực tế, overflow, touch và zoom. Trạng thái này là blocker cho nghiệm thu responsive.
- Khóa theo chi nhánh giới hạn throughput của một chi nhánh; chưa có benchmark tải lớn hay dependency scan toàn hệ thống. Không tăng pool hoặc giảm isolation để che lỗi.
- Cảnh báo gần hết hạn hiển thị trên dashboard và phát qua notification khi tăng tồn phù hợp; chưa có job quét hạn hằng ngày. Thông báo là tác vụ sau commit, dùng cơ chế preference/sound/dedup hiện tại; lỗi thông báo không rollback kho đã thành công.
- Danh sách lô đề xuất lấy tối đa 100; vẫn nhập được mã lô trực tiếp. Danh mục quy cách trong editor giới hạn 1.001 dòng. Biểu đồ tổng quan giới hạn kỳ tối đa 366 ngày; CSV tối đa 10.000 dòng; phiếu tối đa 100 dòng.
- Không có đính kèm chứng từ mới; không có giữ chỗ kho. Không hồi tố/revalue toàn bộ chuỗi lịch sử: sửa có phụ thuộc phải dùng điều chỉnh/trả hàng theo thông báo backend.
- Phase 3 vẫn chưa triển khai công nợ/thanh toán/quỹ. `InventoryFinanceContract` chỉ cung cấp dependency guard cho bước tích hợp sau; không tạo cash/payable giả.

## J. Trạng thái

**PARTIALLY VERIFIED**: code và các quality gate tự động đã đạt; nghiệm thu trình duyệt thực tế còn BLOCKED bởi Work settings. Chưa deploy; không được dùng kết quả unit/build để tự đánh dấu responsive VERIFIED.

Môi trường thử tạm đã dọn: dừng fixture H2 18080 và Vite 15173, xóa cấu hình Vite tạm, dừng/xóa container MySQL dùng một lần ở 13319. Ba container ứng dụng hiện có (5173/8080/3306) giữ nguyên. Không commit/push/deploy.
