# Frontend Foundations

Các module nghiệp vụ phải ưu tiên dùng những component nền tảng dưới đây thay vì tự xử lý định dạng tiền, camera hoặc preview file.

## MoneyInput

File: `frontend/src/components/MoneyInput.tsx`

Quy ước:

- `value` luôn là chuỗi số chuẩn không có dấu phân cách, ví dụ `1250000`.
- Giao diện tự hiển thị `1,250,000`.
- Với VND, nhãn phụ hiển thị dạng ngắn: `1 triệu 250 nghìn đồng`.
- Payload gửi API dùng `moneyInputToNumber(value)`.
- Không dùng `type="number"` vì trình duyệt không hỗ trợ dấu phân cách hàng nghìn và trải nghiệm mobile không đồng nhất.
- Giá trị tiền nghiệp vụ không được tự định dạng bằng regex riêng trong từng module.

```tsx
const [amount, setAmount] = useState('')

<MoneyInput
  label="Tổng tiền"
  value={amount}
  onValueChange={setAmount}
  currency="VND"
  required
/>
```

## EvidenceCaptureField

File: `frontend/src/components/EvidenceCaptureField.tsx`

Quy ước:

- Dùng cho ảnh kiểm chứng, ảnh tình trạng đồ, biên nhận, giấy tờ và các tệp cần lưu lại.
- Nút chụp ảnh dùng camera sau trên thiết bị hỗ trợ `capture="environment"`.
- Nút chọn tệp hỗ trợ thư viện ảnh và PDF khi `allowPdf` được bật.
- Ảnh được xem trước bằng blob URL tại máy người dùng trước khi upload.
- Component chỉ chọn, kiểm tra sơ bộ và preview; module gọi API chỉ khi người dùng xác nhận lưu.
- Permission và kiểm tra MIME/magic bytes phía backend vẫn là bắt buộc.

```tsx
const [evidence, setEvidence] = useState<File | null>(null)

<EvidenceCaptureField
  value={evidence}
  onChange={setEvidence}
  labels={labels}
  maxImageBytes={10 * 1024 * 1024}
/>
```

## MediaPreview

File: `frontend/src/components/MediaPreview.tsx`

Dùng chung để hiển thị ảnh hoặc PDF từ file cục bộ và blob đã tải qua API có xác thực. Không tạo URL công khai cho tài liệu riêng tư.

## Áp dụng cho Order

Khi triển khai Order:

1. Dùng `MoneyInput` cho đơn giá, giảm giá, phụ thu, tiền cọc, tổng tiền và thanh toán.
2. Giữ state tiền ở dạng chuỗi chuẩn; chỉ chuyển sang số tại ranh giới gọi API.
3. Dùng `EvidenceCaptureField` cho ảnh tình trạng đồ lúc nhận, ảnh kiểm chứng xử lý và ảnh bàn giao.
4. Dùng `MediaPreview` cho xem trước tại form và lịch sử đơn hàng.
5. Không sao chép component vào thư mục Order; mở rộng component nền tảng bằng props khi có nhu cầu dùng chung hợp lệ.
