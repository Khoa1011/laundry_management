# Kiểm thử ảnh hóa đơn R2

Baseline `main` tại `8284f5c3b1a0d8a86e96ca4b800009f3bc6679b3`. Chỉ dùng ảnh và dữ liệu giả.

| Phạm vi | Kết quả |
|---|---|
| Cloudflare R2 thật | Adapter ghi một ảnh PNG vào tiền tố `smoke-tests/`, đọc lại byte trùng khớp và xóa object thử nghiệm. PUT/GET và DELETE xác nhận thành công. |
| HTTP của AWS SDK v2 | Server loopback xác nhận chữ ký dùng region `auto`, PUT không dùng chunked content encoding và GET/DELETE hoạt động. |
| API và MySQL | MySQL 8.4.11 cô lập lên V32. Các ca API dùng storage mock. Đã kiểm JPEG/PNG/WebP, nội dung không hợp lệ, quá cỡ, metadata, quyền, chi nhánh, gỡ/thay, hủy phiếu, retry và dọn object chờ. |
| Chrome với H2 và kho mock | Phiếu có ảnh PNG được chuẩn bị qua API. Chrome xem ảnh 960×640, đóng bằng Escape, gỡ liên kết, mở lịch sử bằng Enter và xem lại ảnh đã gỡ. Chrome cũng tạo phiếu không kèm ảnh và nhận thông báo cập nhật tồn. |
| File picker và camera | Công cụ Chrome bị chặn quyền truy cập file URL. Chưa xác minh chọn và tải ảnh hoàn toàn qua Chrome hoặc camera thiết bị thật. Ca chọn WebP, lưu chứng từ và thử lại ảnh đã chạy bằng component test. |
| Responsive | Chi tiết phiếu được đo tại 360×800, 390×844, 390×600, 412×915, 768×1024, 1024×768, 1280×720, 1366×600, 1366×768, 1440×900, 1920×1080, 900×750 và 1150×710. `scrollWidth` bằng `clientWidth` ở cả 13 kích thước. Form tại 390×600 giữ thanh Lưu ở mép dưới. Tab đi từ Chụp ảnh tới Chọn ảnh. Chưa kiểm zoom 125%, touch emulation hoặc reduced motion bằng Chrome. |

[Form nhập trước thay đổi, từ đợt kiểm thử kho](../inventory-e2e/receipt-multiline-mobile.jpg) · [Form mobile sau thay đổi](after-mobile-capture.jpg) · [Chi tiết desktop sau thay đổi](after-desktop-detail.jpg) · [Số đo Chrome](browser-geometry.json)

Rà soát phạm vi theo Solid Admin, Impeccable, Spring Backend Review và Spring Security Audit. Bộ quét tệp hiện có mặc định báo `UNAVAILABLE`. Backend giới hạn dung lượng và số pixel, giải mã ảnh theo định dạng, kiểm tra MIME và dùng đầu ra riêng tư với `nosniff`. Kiểm thử không xác nhận có phần mềm quét mã độc đang chạy.

Maven Wrapper `verify` qua 263 test, gồm hồi quy tài liệu nhân viên, migration từ V28 và hai ca adapter. Suite API trên MySQL qua 7 test. Vitest qua 227 test trong 52 file. Typecheck, lint, build và kiểm tra đồng bộ 145 quyền đều qua. Bộ kiểm tra quyền có 10 test đạt. Impeccable không báo lỗi tất định ở ba component đã quét.

## Files

- Backend: `ReceiptInvoiceController`, `ReceiptInvoiceService`, `ReceiptInvoiceImageValidator`, `PrivateObjectStorage`, `R2ObjectStorage`, `PrivateFilename`, `ErrorCode`, `GlobalExceptionHandler`, `EmployeeDocumentFileValidator`, `application.yml`, `pom.xml`.
- Migration và quyền: `V32__create_receipt_invoice_images.sql`, `access-control/modules/inventory.yml`, `PermissionCodes.java`, `permissionCodes.generated.ts`.
- Frontend: `StockPages.tsx`, `ReceiptInvoiceImages.tsx`, `receiptInvoiceApi.ts`, `translations.ts`, `EvidenceCaptureField.tsx`, `api/client.ts`.
- Kiểm thử: `ReceiptInvoiceIntegrationTest`, `R2ObjectStorageTest`, `StockMigrationTest`, `OperationsBrowserServer`, `StockPages.test.tsx`.
- Vận hành: `.env.example`, `docker-compose.yml`, [hướng dẫn R2](../../R2_STORAGE_SETUP.md), báo cáo và ảnh trong thư mục này.
