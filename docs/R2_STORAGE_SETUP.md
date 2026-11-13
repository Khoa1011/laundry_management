# Lưu ảnh hóa đơn nhập hàng trên Cloudflare R2

## Cấu hình bucket và khóa

1. Dùng bucket R2 `laundry-invoices`. Trong Cloudflare, giữ **Public Development URL** tắt và chỉ dùng S3 API endpoint. Giữ bucket riêng tư, không gắn tên miền công khai hoặc Worker công khai phục vụ object.
2. Tạo bộ thông tin xác thực S3 có quyền **Object Read & Write** giới hạn vào bucket này. Quyền ghi hỗ trợ tải ảnh và dọn object đang chờ. Mỗi môi trường nên dùng bucket và khóa riêng.
3. Ghi giá trị vào nơi quản lý bí mật của môi trường backend. React gửi ảnh đến Spring Boot và nhận ảnh qua API có xác thực. Trình duyệt chỉ dùng URL blob để hiển thị ảnh trong phiên làm việc.

Ứng dụng dùng AWS SDK Java v2, region `auto`, HTTPS, path-style, PUT có độ dài cố định và chỉ dùng checksum giao thức khi bắt buộc. Cloudflare yêu cầu tắt chunked encoding cho cấu hình Java v2. [Cloudflare AWS SDK for Java](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-java/)

## Chạy local và cấu hình Render

| Biến backend | Giá trị |
|---|---|
| `APP_R2_ENABLED` | `true` khi bật. Mặc định `false`. |
| `APP_R2_ACCOUNT_ID` | ID tài khoản Cloudflare dạng 32 ký tự hex. |
| `APP_R2_BUCKET` | `laundry-invoices` hoặc bucket riêng của môi trường test. |
| `APP_R2_ACCESS_KEY_ID` | Access Key ID do Cloudflare cấp. |
| `APP_R2_SECRET_ACCESS_KEY` | Secret Access Key tương ứng. |
| `APP_R2_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com`. Bỏ trống để backend dựng từ Account ID. |

Local dùng Docker Compose có thể điền các biến trong bản `.env` riêng, dựa trên `.env.example`. Khởi động lại backend bằng `docker compose up -d --build backend` để nhận cấu hình. Khi chạy Maven trực tiếp, khai báo các biến trong môi trường tiến trình backend. Maven không tự nạp `.env`.

Trên Render, mở **Environment** của dịch vụ backend và nhập sáu biến. Lưu qua quy trình triển khai của dự án để Flyway chạy V32 trước khi xử lý yêu cầu ảnh. Các khóa chỉ thuộc dịch vụ backend và không dùng tiền tố `VITE_`. [Render environment variables](https://render.com/docs/configure-environment-variables)

## Thử tải ảnh

1. Dùng tài khoản thử nghiệm có quyền xem chứng từ, giá vốn và ảnh. Chuẩn bị ảnh JPEG, PNG hoặc WebP giả, tối đa 10 MB và 25 megapixel.
2. Tạo phiếu nhập ở chi nhánh thử nghiệm, chọn ảnh, mở xem trước và bấm **Lưu và ghi nhận**. Phiếu và tồn kho được ghi trước, sau đó ảnh được liên kết với ID phiếu. Khi tải ảnh lỗi, thử lại từ màn hình kết quả bằng cùng mã yêu cầu.
3. Mở chi tiết phiếu sau khi tải lại trang. Thử xem, thay và gỡ ảnh. Người có quyền audit có thể xem bản đã thay/gỡ trong **Lịch sử ảnh**.
4. Dùng tài khoản thiếu quyền xem giá vốn hoặc chỉ thuộc chi nhánh khác để xác nhận API từ chối truy cập.

## Dữ liệu và vận hành

- MySQL lưu metadata và trạng thái từng phiên bản. R2 lưu bytes dưới `branches/{branchId}/inventory/receipts/{yyyy}/{MM}/{uuid}.{ext}` theo tháng UTC. Mỗi phiên bản có object riêng. Ảnh của phiếu đã hủy vẫn đọc được. Ảnh gỡ hoặc thay vẫn được giữ để đối soát.
- Sao lưu cả MySQL và bucket qua quy trình có quyền riêng. Giữ nguyên object key, metadata và bytes. Đối chiếu SHA-256 và thử khôi phục một phiếu có lịch sử vào môi trường thử nghiệm. Sao lưu dữ liệu ảnh như dữ liệu nghiệp vụ riêng tư.
- Để xoay vòng khóa, tạo bộ khóa mới có cùng phạm vi, cập nhật backend, kiểm thử upload/read/delete bằng ảnh giả, rồi thu hồi bộ khóa cũ.
- Theo dõi dung lượng và số thao tác theo môi trường trong Cloudflare. Form có thể tối ưu ảnh JPEG/WebP lớn trên trình duyệt và giữ nguyên kích thước ảnh. Đối soát ảnh lịch sử khi lập chính sách lưu giữ. Chỉ áp dụng lifecycle tự động vào tiền tố dành riêng cho dữ liệu dùng một lần như `smoke-tests/`. Giữ toàn bộ tiền tố chứng từ theo chính sách lưu chứng từ của cửa hàng.
- Backend ghi một dòng `PENDING` trước khi gửi PUT. Yêu cầu thử lại dùng cùng object key và bytes. Tiến trình dọn kiểm tra hàng đang chờ cũ hơn 24 giờ, tối đa 50 mỗi lượt, mặc định mỗi giờ. Theo dõi cảnh báo dọn thất bại và số hàng `PENDING` tồn lâu. Khi chuyển bucket, sao chép object và xác minh trước khi đổi cấu hình; metadata không tự đổi theo bucket.

## Lỗi thường gặp

| Dấu hiệu | Kiểm tra |
|---|---|
| Kho ảnh chưa cấu hình | Kiểm tra cờ bật, Account ID, tên bucket, hai khóa và endpoint. Backend trả 503 với mã cấu hình. |
| Kho ảnh tạm thời lỗi | Kiểm tra quyền Object Read & Write, endpoint, kết nối và tính hợp lệ của bộ khóa. Đối chiếu trạng thái phiếu trước khi thử lại ảnh. |
| 403 khi xem/tải/gỡ | Kiểm tra quyền hiệu lực, DENY, quyền xem giá vốn và phạm vi chi nhánh. |
| 413 / 415 | Kiểm tra giới hạn 10 MB, cấu hình multipart của proxy/backend, định dạng và khả năng giải mã ảnh. PDF và ảnh HEIC cần được chuyển sang định dạng hỗ trợ trước khi chọn. |
| 409 | Tải lại chi tiết và kiểm tra phiên bản ảnh, trạng thái phiếu hoặc mã yêu cầu đã được dùng với file khác. |

## API và quyền

Tiền tố `/api/inventory/documents/{documentId}/invoice-images`. Gửi `branchId` trong query. Upload và thay dùng multipart part `file` cùng header `Idempotency-Key` dạng UUID.

| Phương thức | Đường dẫn tương đối | Quyền ảnh |
|---|---|---|
| GET | `/` (đường dẫn tiền tố), thêm `history=true` cho phiên bản cũ | `inventory.invoice.read`, thêm `inventory.audit.read` cho lịch sử |
| GET | `/{imageId}/content` | Quyền xem ảnh, thêm quyền audit cho phiên bản cũ |
| POST | `/` (đường dẫn tiền tố) | `inventory.invoice.upload` |
| POST | `/{imageId}/replace` | `inventory.invoice.upload` |
| DELETE | `/{imageId}` | `inventory.invoice.delete` |

Mọi API đều yêu cầu `inventory.document.read`, `inventory.cost.read` và quyền truy cập chi nhánh/phiếu tương ứng. V32 cấp mặc định ba quyền ảnh cho ADMIN và MANAGER qua bảng phân quyền. Quyền hiệu lực tuân theo DENY > ALLOW > ROLE. Tài liệu nhân viên tiếp tục dùng storage local hiện tại. Mỗi ảnh có ID ổn định để Finance có thể tham chiếu khi tích hợp sau.
