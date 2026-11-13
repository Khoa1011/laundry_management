# Kiểm thử Chrome E2E Quản lý kho Phase 2

## A. Environment

| Hạng mục | Môi trường |
|---|---|
| Source | `main`, HEAD `d143bd2c98947bca6c59d0d4de309b54eb914ab9`. Working tree sạch lúc bắt đầu. Các ca hồi quy dùng thay đổi cục bộ trong mục G. |
| Browser | Chrome trên Windows qua Codex Computer Use. Binary Chrome cài trên máy báo `157.0.8103.51`. |
| Frontend / backend | React 19.1.0, Vite 7.3.6 trên loopback 15173, proxy đến Spring Boot 3.4.5 trên loopback 18080. Browser thao tác trực tiếp trên UI và API của fixture. |
| Database | MySQL 8.4.11 trên loopback 13319, schema browser `inventory_browser_test`, Flyway V31. Các suite hồi quy dùng schema riêng. Maven verify mặc định dùng H2. |
| Phân quyền fixture | Quản lý, chỉ đọc một chi nhánh, quản lý có DENY giá vốn, quản lý có DENY tạo phiếu nhập. |
| Vòng đời môi trường | Đã đặt lại viewport và đóng tab kiểm thử, dừng hai tiến trình và container cô lập. Ba container ứng dụng đang chạy trên 5173, 8080, 3306 vẫn hiện diện sau khi dọn. |

## B. Test Coverage

Mở **17 route danh sách, báo cáo và danh mục** bằng Chrome. Ngoài các route đó, đã thao tác năm biến thể form chứng từ, chi tiết và lịch sử phiên bản, dialog nhận/hoàn, dialog hủy, form kho và nhà cung cấp.

| Phạm vi | Số ca |
|---|---:|
| Chrome, gồm ca bản gốc, ca hậu sửa và ca chưa chạy | 126 |
| API loopback riêng | 7 |
| SQL đối soát và kế hoạch truy vấn | 3 |
| Tổng dòng kịch bản có ID riêng | 136 |
| Nhãn trường/thao tác khác nhau theo module trong phần Chrome | 112 |

Ma trận đếm các nhãn ghép như “Số lượng / đơn giá” theo cặp module và nhãn. Tổng số trường và nút riêng lẻ trên mọi form chưa được kiểm kê đầy đủ. Các số đo viewport và số lượt click được lưu riêng. [Ma trận chi tiết](INVENTORY_PHASE2_BROWSER_E2E_MATRIX.csv) · [Số đo Chrome](inventory-e2e/browser-measurements.json)

## C. Browser E2E

| Trạng thái | Số ca Chrome | Ghi nhận |
|---|---:|---|
| PASS | 61 | Smoke route, danh mục chọn lọc, ghi nhận tồn, sửa/hủy, nhận/hoàn, xung đột hai tab, phân quyền, hồi quy. |
| FAIL | 3 | Ca tái hiện trên bản gốc. Xem ca hậu sửa và phạm vi đo lại ở mục G. |
| BLOCKED | 1 | Click Xuất CSV hoàn tất. Công cụ browser không trả sự kiện tải xuống hoặc đường dẫn tệp để kiểm tra. |
| NOT RUN | 61 | Ghi rõ từng khoảng trống trong ma trận, gồm các tổ hợp trường chưa chạy và kiểm tra layout chưa kết luận. |

Đã quan sát thành công, lỗi tại trường, xung đột, từ chối truy cập và cảnh báo rời form. Báo cáo hiển thị skeleton trong lúc lọc. Kho không có giao dịch hiển thị các dòng số 0 sau khi áp dụng ngày. Trạng thái danh sách rỗng, offline và retry có ca component hiện hữu. Chưa quét các trạng thái đó trên mọi route bằng Chrome. Mẫu console đọc cuối phiên có một dòng warning/error và không khớp dấu hiệu React runtime trong mẫu đã thu. [Bằng chứng Chrome](inventory-e2e/browser-measurements.json)

## D. Responsive

| Nhóm | Viewport đo trên Chrome |
|---|---|
| Mobile | 320×568, 360×800, 375×667, 390×844, 390×600, 412×915 |
| Tablet | 768×1024, 1024×768 |
| Laptop | 1280×720, 1366×768, 1366×600 |
| Desktop | 1440×900, 1920×1080 |
| Giữa breakpoint | 540×810, 900×750, 1150×710 |

- **Mobile.** 14 route smoke tại 390×600 và ba route cuối tại 390×844. Đã sử dụng layout danh sách dạng thẻ, form một cột và mở bộ lọc báo cáo. Trong form nhập 390×600, thanh lưu có biên dọc 535–600 px. Đã thao tác chuột và dùng Tab, Shift+Tab, Enter, Escape trên form và cảnh báo rời trang. Kho có tên dài tìm được ở 390×600. [Phiếu nhiều dòng](inventory-e2e/receipt-multiline-mobile.jpg) · [Lọc ngày](inventory-e2e/report-filter-mobile.jpg)
- **Tablet và desktop.** Đã đo dashboard, báo cáo và form nhập tại 16 kích thước. Quan sát dashboard bố trí nhiều cột ở desktop và đổi VI → EN → VI. Document không tràn tại 1024×768 và 1150×710, trong khi vùng `main` của form nhập có `scrollWidth` lớn hơn `clientWidth` 8 px. Chưa định vị phần tử gây lệch hoặc xác minh cắt nội dung ở hai kích thước đó. [Dashboard desktop](inventory-e2e/dashboard-desktop-en.jpg) · [Số đo](inventory-e2e/browser-measurements.json)
- **320×568.** Bản đầu có 15 px overflow ngoài ý muốn ở báo cáo và danh sách Điều chỉnh. Sau sửa đã đo lại báo cáo, `main` và document đều 305/305 px trên Chrome có scrollbar 15 px. Danh sách Điều chỉnh chưa được đo lại riêng tại 320×568. [Báo cáo sau sửa](inventory-e2e/report-320-after.jpg)
- **Chưa xác minh.** Zoom Chrome 125%, touch emulation, thiết bị thật, reduced motion, contrast định lượng và toàn bộ hành trình focus trên từng form. Chưa chạy đủ kích thước trên từng route. Audit Impeccable theo thứ tự mobile → tablet → desktop phát hiện INV-BR-03 và đã ghi lại các khoảng trống trên. [Số đo Chrome](inventory-e2e/browser-measurements.json)

## E. Business Verification

| Nghiệp vụ | Kết quả đối chiếu |
|---|---|
| Nhập và sửa | 10 × 40.000 + 5 × 60.000 cho 15 lít và 700.000 đồng. Sửa phiếu thứ hai lên 7 lít cho 17 lít và 820.000 đồng. Mã `TEST-RE-000002` giữ nguyên, API v1 trả 420.000 cho phiếu, ledger có −5/−300.000 và +7/+420.000. Sửa tiếp sau giao dịch phụ thuộc bị chặn với hướng dẫn. |
| Nhập nhiều dòng | `TEST-RE-000003` có 1 × 100,25 và 0,5 × 20, preview 110,25 và MySQL ghi hai dòng đúng số tiền. |
| Xuất, sửa, hủy | `TEST-IS-000001` xuất 3 lít theo bình quân sau khi tồn đạt 17 lít, ledger −144705,882353. Sửa còn 2 lít bằng reversal và forward. Hủy v2 hoàn 2 lít, ledger gốc vẫn có. Lượng 18 và lượng có bảy chữ số thập phân bị chặn. |
| Chuyển | `TEST-TR-000001` gửi 6, nhận 4, hoàn 2, số đang chuyển và giá trị còn lại đều 0. Nhận 7 bị chặn. Đích còn 4 lít, giá trị 192941,176471. |
| Kiểm kê và điều chỉnh | Kiểm kê 13 → 12,5 ghi −0,5. Điều chỉnh +0,5 trả về 13. Sau nhập tiếp, kiểm kê 14 → 14 lưu thành công mà không thêm movement. Hai tab cùng sửa tồn theo luồng đã kiểm làm tab kiểm kê nhận xung đột, giữ số đếm 14. Phiếu xuất của tab còn lại ghi một lần, tồn nguồn cuối là 12. |
| Ledger và audit | MySQL có 9 phiếu, 16 movement, 14 revision và 14 command. Cả hai chiều đối soát ledger và balance đều có 0 lệch. Cả 14 sự kiện audit chứng từ có actor và thời gian. |
| Single-Operator | Năm loại chứng từ được lưu từ giao diện và ghi nhận ngay. Ca sửa/hủy thực tế giữ mã và lịch sử. Chưa chạy mọi tổ hợp sửa/hủy, retry và nháp trên từng loại phiếu. |
| Báo cáo | Đã mở báo cáo, áp dụng bộ lọc kho và chọn ngày. Chưa đối chiếu từng cột, KPI, khoảng ngày hoặc nội dung file tải qua Chrome. |
| Hiệu năng | `EXPLAIN` trên MySQL fixture chọn `ix_stock_ledger_scope` và backward index scan cho truy vấn ledger lọc chi nhánh/kho/vật tư. Số liệu này chỉ mô tả kế hoạch truy vấn tại fixture. |

[Bảng đối soát MySQL](inventory-e2e/mysql-evidence.tsv) · [Kết quả API](inventory-e2e/api-evidence.json)

## F. Security

- Tài khoản chỉ đọc một chi nhánh có thể xem chi tiết, không có Sửa/Hủy và không thấy giá vốn. Chọn chi nhánh khác qua API bị 403.
- Quản lý có DENY xem giá vốn vẫn có hành động nghiệp vụ được cấp. Kiểm tra UI chi tiết/lịch sử và API chi tiết/lịch sử/dashboard đều thấy giá vốn được che. API CSV trả 200 và không chứa các giá vốn mẫu đã đối chiếu.
- Quản lý có DENY tạo phiếu nhập không có nút tạo, route tạo từ chối truy cập và API preview trả 403. API export của tài khoản chỉ đọc trả 403. Yêu cầu không xác thực trả 401.
- Kho ngoài phạm vi truy vấn và ID chứng từ không tồn tại trả 404 trong ca API. Truy cập bản ghi thật của chi nhánh khác, lịch sử hoặc thao tác ghi qua ID vẫn cần kiểm thử Chrome riêng. Kiểm tra văn bản đã xác nhận mẫu HTML trơ được giữ nguyên như văn bản trong form nhà cung cấp.
- Đã rà soát phạm vi thay đổi theo Spring Backend Review, Spring Security Audit và Spring Performance Audit. Không phát sinh permission, endpoint, thay đổi hợp đồng API hay migration production. [Bằng chứng API](inventory-e2e/api-evidence.json) · [Số đo Chrome](inventory-e2e/browser-measurements.json)

## G. Bugs

| ID / mức độ | Tái hiện và nguyên nhân | Sửa và kiểm tra lại |
|---|---|---|
| INV-BR-01 · HIGH | Nhập `-100` vào đơn giá nhập hàng. MoneyInput lọc bỏ dấu âm, thành `100` và cho phép dùng giá đó để preview/lưu. | Form chứng từ giữ chuỗi nhập, kiểm tra định dạng tại trường, chặn lưu và nháp với giá trị sai. Chuyển dấu thập phân bằng chuỗi trước khi gửi backend. Chrome đã xác nhận giá âm bị chặn, giá `100,25` cho tổng `110,25` của hai dòng. Có test component. |
| INV-BR-02 · HIGH | Sau giao dịch chuyển kho, mở kiểm kê và chọn lại kho/vật tư. Form chốt version từ cache trước khi truy vấn mới trả về, gây 409 dù tồn hiển thị đã mới. | Chờ lần fetch thành công rồi chốt version đầu tiên, giữ snapshot đó đến khi người dùng tải lại có chủ đích. Chrome lưu được ca sau nhập và vẫn từ chối ca có giao dịch mới từ tab khác. Có test component. |
| INV-BR-03 · MEDIUM | Ở 320×568, scrollbar Chrome chiếm 15 px. `min-width: 320px` trên html/body đẩy nội dung ra ngoài vùng 305 px. | Bỏ min-width toàn cục. Báo cáo đo lại 305/305 px. Danh sách Điều chỉnh và các module ngoài Kho cần đo lại riêng. |

Các file code thay đổi:

- [OperationsBrowserServer.java](../../backend/src/test/java/com/laundry/management/operations/OperationsBrowserServer.java) thêm chế độ MySQL cô lập và fixture quyền cho E2E.
- [MoneyInput.tsx](../../frontend/src/components/MoneyInput.tsx) thêm lựa chọn giữ nguyên chuỗi nhập và hiển thị gợi ý.
- [StockPages.tsx](../../frontend/src/features/stock/StockPages.tsx) kiểm tra tiền, chuẩn hóa decimal, chờ snapshot và giữ version khi kiểm kê.
- [StockPages.test.tsx](../../frontend/src/features/stock/StockPages.test.tsx) hồi quy giá âm và snapshot cache.
- [translations.ts](../../frontend/src/features/stock/translations.ts) thêm gợi ý và lỗi VI/EN.
- [global.css](../../frontend/src/styles/global.css) sửa min-width của trang.

### Quality gates

| Kiểm tra | Kết quả |
|---|---|
| Maven Wrapper `verify`, H2 mặc định | Exit 0, 254 test trong 34 suite, 0 failures/errors/skips. |
| Maven MySQL integration / concurrency / migration | Exit 0, 81 test trong 5 suite, 0 failures/errors/skips. |
| Vitest | Exit 0, 225 test trong 52 file, gồm hai ca component mới. |
| Frontend typecheck, ESLint, production build | Exit 0 cho cả ba. |
| Permission generator, validator và generated drift check | Pass, 142 permission. Node permission tests 10/10. |
| Impeccable | Kiểm tra theo Solid Admin và các kích thước ở mục D. Phạm vi còn thiếu được ghi ở mục I. |

## H. Screenshots

| Bề mặt | Bằng chứng |
|---|---|
| Dashboard | [Mobile](inventory-e2e/dashboard-mobile.jpg) · [Desktop EN](inventory-e2e/dashboard-desktop-en.jpg) |
| Nhập hàng | [Nút lưu bị tắt ở ca giá âm](inventory-e2e/money-negative-fixed.jpg) · [Hai dòng và tổng tiền](inventory-e2e/receipt-multiline-mobile.jpg) · [Chặn sửa do phụ thuộc](inventory-e2e/dependent-revision.jpg) |
| Chuyển kho | [Phiếu chuyển đã hoàn tất](inventory-e2e/transfer-mobile.jpg) · [Số lượng 6 gửi / 4 nhận / 2 hoàn](inventory-e2e/mysql-evidence.tsv) |
| Kiểm kê | [Lỗi snapshot trước sửa](inventory-e2e/stocktake-stale-before.jpg) · [Kiểm kê thiếu](inventory-e2e/stocktake-mobile.jpg) · [Sau sửa tại 390×600](inventory-e2e/stocktake-fresh-390x600.jpg) · [Xung đột hai tab](inventory-e2e/stocktake-two-tabs.jpg) |
| Nhập xuất tồn | [Desktop](inventory-e2e/report-desktop.jpg) · [320×568 sau sửa](inventory-e2e/report-320-after.jpg) · [Bộ lọc mobile](inventory-e2e/report-filter-mobile.jpg) |
| Quyền chỉ đọc | [Chi tiết chứng từ desktop](inventory-e2e/readonly-desktop.jpg) |

Ảnh full-page ghép vị trí header/footer tại thời điểm chụp. Vị trí thực trong viewport khi thao tác được ghi bằng số đo ở mục D. Số đo trước và sau lỗi 320 px có trong JSON.

## I. Remaining Risks

- Chưa chạy đủ từng trường của danh mục Phase 1, quy đổi, lô/hạn, 100/101 dòng, các kiểu xuất còn lại, lịch sử và mọi biến thể sửa/hủy. Sắp xếp lại dòng bằng kéo thả và ghi sổ/duyệt thủ công nằm ngoài giao diện Phase 2.
- Chưa thử mất kết nối khi lưu/nhận, API 500 có kiểm soát, gửi lặp qua Chrome hoặc hai tab cùng nhận. Suite backend có phạm vi concurrency riêng và component test hiện hữu kiểm tra retry cùng key. Chỉ ca kiểm kê đối đầu xuất đã chạy đồng thời trên hai tab Chrome.
- Chưa xác minh file CSV từ trình duyệt, CSV encoding/giới hạn/từng bộ lọc, IDOR với bản ghi thật từ chi nhánh khác trên Chrome, hết phiên và browser khác.
- Còn thiếu zoom/touch, trạng thái rỗng/chậm/lỗi trên từng route, xác minh 8 px của vùng main ở form nhập và regression UI các module dùng CSS toàn cục. Chưa có benchmark tải lớn hoặc kiểm thử thiết bị POS thật.
- Không có thay đổi API hoặc schema production. Không commit, push, deploy hay triển khai Phase 3.

## J. Final Status

**PARTIALLY VERIFIED**
