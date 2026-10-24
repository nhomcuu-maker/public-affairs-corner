# Sửa lỗi HTTP 400 khi chạy bộ kiểm thử công khai

Lỗi thuộc công cụ `tools/test-public-live-http.cjs`: hàm `request()` ghi đè `headers` của POST, làm mất `Content-Type: application/json`, nên NestJS không đọc được body và trả 400.

## Cài đặt

1. Sao lưu file `tools\test-public-live-http.cjs` đang dùng.
2. Giải nén ZIP vào thư mục gốc `D:\trường\Đồ án\GocDanSinh` và cho phép thay thế đúng file đó.
3. Giữ backend `npm run dev` chạy tại cổng 3001. Chạy:

```powershell
Set-Location -LiteralPath "D:\trường\Đồ án\GocDanSinh"
node .\tools\test-public-live-http.cjs
```

Bản vá chỉ sửa header HTTP của script kiểm thử và thông báo lỗi. Không đụng tới backend, SQL, dữ liệu, RSS hoặc giao diện. Kết quả mong đợi khi kho công khai còn trống: `PASS ASSISTANT: INSUFFICIENT_EVIDENCE; published-only` và `LOCAL PUBLIC API SMOKE: PASS, no SQL writes`.

Nếu vẫn trả về HTTP 400, script mới sẽ in `message` từ server, dùng thông báo đó để xác định tiếp.
