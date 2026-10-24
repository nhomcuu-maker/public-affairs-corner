# GÓC DÂN SINH – BƯỚC 8.1: ĐĂNG KÝ VÀ ĐĂNG NHẬP THẬT

**Dự án này là bản đầy đủ**, dựa trên bộ fullstack đã chạy được của bạn, không phải bản vá.

## Giữ an toàn dữ liệu
- Không chạy lại `sql/01_GocDanSinh_Tao_Bang_Va_Nap_Du_Lieu.sql` nếu đã có database.
- Trước khi chạy migration hãy sao lưu database bằng SSMS > Tasks > Back Up.
- Chạy **duy nhất** `sql/03_GocDanSinh_Buoc8_1_DangNhap_That.sql` trong SSMS. Nó chỉ thêm `auth_credential` và `auth_session`, không thay 52 bảng gốc, không động tới draft hộ chiếu.
- Hai email `editor.demo@example.invalid` và `reviewer.demo@example.invalid` không có mật khẩu và không đăng nhập được. Không đăng ký trùng tài khoản demo.
- Người dùng đăng ký mới chưa có vai trò nội bộ; **không có đặc quyền admin/reviewer/publisher**. Quy trình cấp quyền sẽ là Bước 8.2.

## Cách chạy ở Windows
1. Dừng backend đang chạy bằng `Ctrl+C` trong Terminal cũ.
2. Giải nén dự án, vào đúng thư mục `GocDanSinh` có `package.json` trong VS Code.
3. **Chỉ chép file `.env` từ thư mục dự án đang chạy trước đó sang thư mục dự án mới** nếu `.env` chưa có. Không gửi `.env` cho người khác và không chép vào `public/`. Không thay `DB_DATABASE=GocDanSinh`.
4. Trong SSMS, mở SQL migration `sql/03_GocDanSinh_Buoc8_1_DangNhap_That.sql`, nhấn `F5`, kết quả hai bảng `PASS`.
5. Trong Terminal của thư mục mới:

```powershell
npm install
npm run test:frontend
npm run build
npm run dev
```

6. Mở `http://127.0.0.1:3001/register.html`. Đăng ký bằng **email của bạn (không phải email demo)** và mật khẩu mới ít nhất 12 ký tự.
7. Mở `http://127.0.0.1:3001/login.html` và đăng nhập. Khi trở về trang chủ, khu vực 'Đăng nhập | Đăng ký' chuyển thành lời chào + Đăng xuất.
8. Có thể kiểm tra trực tiếp API `http://127.0.0.1:3001/api/auth/me`; khi đăng nhập nó trả về email, tên và danh sách vai trò (thường rỗng). Trước khi đăng nhập nó trả 401.
9. Nhấn Đăng xuất; tải lại `/api/auth/me` sẽ trả 401. Session có thời hạn 7 ngày và có thể bị thu hồi khi đăng xuất.

## Cần biết
- SQL Bước 1-6: 52 bảng gốc, 116 FK; Bước 8.1 **cộng 2 bảng và 2 FK**. Tổng sau migration: 54 bảng, 118 FK (không tính sysdiagrams).
- `sql/02_GocDanSinh_Kiem_Tra_Toan_Bo.sql` được chỉnh để kiểm tra **riêng 52 bảng/116 FK gốc** và có mục 19 để kiểm tra authentication; không báo sai vì hai bảng mới.
- Không có dữ liệu nào được đưa từ `draft` sang `published`.
- Mật khẩu được dẫn xuất bằng scrypt + random salt, không lưu mật khẩu thô; phiên đăng nhập dùng cookie HttpOnly, SameSite=Strict, có kiểm tra session ở server và đăng xuất thực sự.
- Đây là bản phục vụ phát triển trên localhost. Khi triển khai lên Internet phải bổ sung HTTPS, quy trình xác minh email, đặt lại mật khẩu, kiểm soát bot và các biện pháp vận hành khác.
- Bước 8.2 mới triển khai trang quản trị và quyền truy cập. Đăng nhập thành công **chưa** cấp quyền quản trị.
