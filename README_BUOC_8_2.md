# GÓC DÂN SINH — BƯỚC 8.2: TRANG QUẢN TRỊ NỘI DUNG

**Bản đầy đủ**, giữ nguyên `GocDanSinh`, 54 bảng sau Bước 8.1, không tạo lại database, không nhập lại thủ tục hộ chiếu.

## Chức năng đã tích hợp

- Trang `http://127.0.0.1:3001/admin.html`: tổng quan phiên bản theo ba module, tìm kiếm và lọc theo module/trạng thái, phân trang; mở nội dung nguồn và chi tiết hồ sơ, lệ phí, căn cứ, snapshot, lịch sử kiểm duyệt.
- API chỉ đọc: `GET /api/admin/overview`, `GET /api/admin/content`, `GET /api/admin/content/:versionId`.
- **Backend** xác thực mỗi lần gọi API bằng cookie đăng nhập thực, kiểm tra phiên còn hạn, tài khoản còn hoạt động và quyền lấy mới từ SQL. Không có quyền trả về 403; chưa đăng nhập trả về 401. Việc mở đường dẫn HTML không đồng nghĩa có quyền xem dữ liệu.
- Quyền được phép **xem**: `author`, `editor`, `reviewer`, `publisher`, `admin`. Tài khoản thường mới đăng ký không có các vai trò trên. Chưa có endpoint thay đổi trạng thái/phê duyệt/công bố.
- Văn bản pháp luật và bản nháp tiếp tục giữ ở `draft`, hiển thị cảnh báo *Không công bố*.

## Bước A — sao lưu và mở dự án đúng thư mục

1. Trong SSMS, sao lưu database `GocDanSinh` bằng **Tasks → Back Up**.
2. Nhấn `Ctrl+C` để dừng Backend cũ trong Terminal của VS Code.
3. Giải nén ZIP đầy đủ, mở thư mục **`GocDanSinh`** bên trong bằng **File → Open Folder**. Phải thấy `package.json` và `src/main.ts` ngay trong thư mục đang mở.
4. Sao chép file **`.env` cũ** của Bước 8.1 sang đây (cùng cấp `package.json`). **Không chia sẻ `.env`** và không đặt nó trong `public/`.
5. Không chạy SQL 01, 02 hay 03 để tạo lại bảng. **Bước 8.2 không tạo thêm bảng mới**.

## Bước B — cấp quyền admin cho đúng tài khoản bạn đã đăng ký

1. Mở `sql/04_GocDanSinh_Buoc8_2_Cap_Quyen_Quan_Tri.sql` bằng SSMS.
2. Tại dòng `DECLARE @Email NVARCHAR(254) = N'';` thay chuỗi rỗng bằng **email tài khoản bạn đã đăng ký thật ở Bước 8.1**, ví dụ `N'you@example.com'` (ví dụ, không dùng email demo).
3. Đổi `DECLARE @XacNhan ... = N'CHUA_XAC_NHAN';` thành `N'CAP_QUYEN_8_2'` sau khi đã chắc chắn email chính xác. Lệnh sẽ dừng nếu chưa xác nhận.
4. Nhấn F5. Kết quả phải có `RoleCode = admin` cho đúng email của bạn. Script lặp lại không gán trùng quyền.
5. Không cấp quyền cho `editor.demo@example.invalid` hoặc `reviewer.demo@example.invalid`. Không tự động cấp quyền khi người lạ đăng ký.

## Bước C — chạy dự án

Trong terminal VS Code **đúng thư mục có package.json**, chạy:

```powershell
Test-Path .\package.json
Test-Path .\src\main.ts
npm install
npm run test:admin
npm run test:auth
npm run build
npm run dev
```

Hai lệnh `Test-Path` phải ra `True`. Đợi `Connected to SQL Server database GocDanSinh` và `Nest application successfully started`.

## Bước D — thử trên website

1. Mở `http://127.0.0.1:3001/login.html` để đăng nhập tài khoản vừa cấp quyền admin (nếu chưa đăng nhập).
2. Mở `http://127.0.0.1:3001/admin.html`. Nếu mới cấp quyền khi đang đăng nhập, chỉ cần tải lại trang; vai trò được kiểm tra từ SQL ở mỗi yêu cầu.
3. Trang Tổng quan phải có ba module `LEGAL`, `ADMIN`, `SCAM`. Tại danh sách chọn `ADMIN`, trạng thái `draft`, bấm **Tìm kiếm**. Chọn bản ghi `GDS-ADMIN-HOCHIEU-26270` → **Xem**.
4. Đối chiếu dự kiến: 3 bước, 10 thành phần hồ sơ, 6 trường hợp lệ phí, 7 căn cứ pháp lý, 8 snapshot. Kết quả thực tế theo dữ liệu SQL bạn đã nạp.
5. **Thử bảo vệ**: mở cửa sổ Ẩn danh (chưa đăng nhập), truy cập `http://127.0.0.1:3001/api/admin/overview` → phải trả **401**. Đăng nhập một tài khoản thường không được cấp quyền rồi truy cập API → phải trả **403**.
6. Không đưa khóa `DEV_PREVIEW_KEY` vào trang quản trị, không dùng nó để đăng nhập; trang quản trị sử dụng phiên và vai trò người dùng.

**Chưa có trong Bước 8.2:** chỉnh sửa bản nháp, phê duyệt, công bố, upload PDF, gửi email, đăng nhập bằng email xác thực. Chúng thuộc các bước tiếp theo. Các API Bước 8.2 chỉ GET; không thay đổi dữ liệu nguồn.

**Vận hành:** Phục vụ localhost; để xuất bản Internet cần cấu hình HTTPS, kiểm soát lỗi và nhật ký truy cập, backup, bảo vệ chống CSRF cho các thao tác ghi ở giai đoạn sau và triển khai xác thực email/MFA cho quản trị.
