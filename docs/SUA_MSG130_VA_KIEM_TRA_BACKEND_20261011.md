# Dân Sinh AI - sửa SQL Msg 130 và chẩn đoán API localhost (11/10/2026)

## Phạm vi bản vá

- `sql/13_ChanDoan_HTTP500_TrangCongKhai_READ_ONLY.sql`: sửa lỗi Msg 130 do biểu thức có `EXISTS`/`NOT EXISTS` nằm trực tiếp trong `SUM(CASE ...)`. Bản mới tách phép tính thành bảng tạm `#gds_version_audit`, sau đó mới `SUM` các cột 0/1. Không thay đổi dữ liệu hoặc trạng thái kiểm duyệt trong các bảng gốc.
- `tools/diagnostics/check-public-api.cjs`: kiểm tra kết nối HTTP đến `127.0.0.1:3001` (hoặc cổng tùy chỉnh). Phân biệt `NO HTTP RESPONSE` với trạng thái 500; báo `ECONNREFUSED` nếu không có server lắng nghe.
- `tools/diagnostics/test-public-diagnostics.cjs`: kiểm thử hồi quy cấu trúc script. Đây là kiểm thử ngoại tuyến, **không thay thế việc chạy script trong SSMS**.

## Thực hiện trên Windows

1. Sao lưu thư mục `D:\trường\Đồ án\GocDanSinh`.
2. Giải nén ZIP vào thư mục chứa `package.json`, ghi đè đúng các tệp trong `sql`, `tools/diagnostics`, và `docs`. Không xóa `.env`, `data` hoặc SQL Server.
3. Mở **PowerShell thứ nhất**:

```powershell
cd 'D:\trường\Đồ án\GocDanSinh'
npm run dev
```

Giữ nguyên cửa sổ này. Chờ xuất hiện `Website: http://127.0.0.1:3001/`. Nếu ứng dụng thoát hoặc in lỗi `Unable to connect`, `Login failed`, `ConnectionError`, hãy xử lý lỗi này trước khi kiểm tra API.

4. Mở **PowerShell thứ hai**:

```powershell
cd 'D:\trường\Đồ án\GocDanSinh'
Test-NetConnection 127.0.0.1 -Port 3001
node tools/diagnostics/test-public-diagnostics.cjs
node tools/diagnostics/check-public-api.cjs
```

Nếu dự án cấu hình một cổng khác, dùng ví dụ:

```powershell
$env:GDS_DIAG_PORT = '3002'
node tools/diagnostics/check-public-api.cjs
```

5. Trong **SSMS** (đúng instance đang dùng cho ứng dụng), mở và chạy:

```
sql/13_ChanDoan_HTTP500_TrangCongKhai_READ_ONLY.sql
```

Gửi kết quả các hàng `PRESENT/MISSING`, bảng `domain/all_items/all_versions/marked_published/eligible_published_versions`, và lỗi từ cửa sổ NestJS nếu có. Không gửi mật khẩu, chuỗi kết nối có thông tin bí mật hoặc OTP.

## Cách đọc kết quả

- `NO HTTP RESPONSE`/`ECONNREFUSED`: chưa kết nối được tới NestJS trên cổng đó. Mở server, kiểm tra cổng và log khởi động.
- HTTP `200 /library-catalog.json` nhưng HTTP `500 /api/health`: server có phản hồi; kiểm tra cấu hình SQL Server và log NestJS.
- HTTP `200 /api/health` nhưng HTTP `500 /api/content?...`: kiểm tra lỗi truy vấn thực tế trong log NestJS, đồng thời đối chiếu lược đồ.
- HTTP `200` và mảng rỗng `[]`: endpoint đang hoạt động nhưng chưa có bản ghi đáp ứng điều kiện công bố. `pending_review` không được coi là đã xác minh và không được tự chuyển sang `published`.

Tài liệu PDF được đưa vào vùng chờ RAG trước đó **chưa được xác minh hoặc công bố**. Bản vá này không phê duyệt tài liệu và không biến PDF tham khảo thành căn cứ pháp lý đã kiểm duyệt.
