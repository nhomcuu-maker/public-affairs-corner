# Góc Dân Sinh - Tạo tài khoản Reviewer bằng SQL (đăng nhập được thật)

## Vì sao có hai bước?
Ứng dụng NestJS sử dụng mật khẩu băm `scrypt` với salt ngẫu nhiên 32 byte và hash 64 byte (N=16384, r=8, p=1). SQL Server không có hàm scrypt tương thích tích hợp. Vì vậy công cụ Node.js trên máy người dùng chỉ sinh salt/hash, sau đó một file T-SQL sẽ tạo `app_user`, `auth_credential`, `user_role` cùng trong một transaction. Không lưu mật khẩu rõ.

## Cài và dùng
1. Sao lưu database `GocDanSinh`. Giải nén `tools/reviewer/...` vào đúng thư mục dự án. Không thay thế file cũ.
2. Mở Windows PowerShell dưới quyền người dùng bình thường:
   ```powershell
   Set-Location -LiteralPath "D:\trường\Đồ án\GocDanSinh"
   powershell.exe -NoProfile -File ".\tools\reviewer\generate-reviewer.ps1"
   ```
3. Nhập tên thật, email riêng và mật khẩu đủ 12 ký tự của người kiểm duyệt **khác người tạo/gửi duyệt bản #4**. Không gửi mật khẩu vào chat. Không mượn danh một người khác chỉ để vượt kiểm duyệt.
4. Mở `sql\Tao_Tai_Khoan_Reviewer_Tam.sql` bằng SSMS; giữ `@Apply BIT = 0` và chạy F5. Kết quả hiển thị `PREVIEW_WILL_ROLLBACK`.
5. Kiểm tra email và tên ở Results; sau khi đã sao lưu database, đổi thành `@Apply BIT = 1` rồi F5. Kết quả `WILL_COMMIT`, thông báo `APPLIED`. Không chạy lại bản tạo tài khoản này sau khi COMMIT.
6. Kiểm tra bằng SQL chỉ đọc:
   ```sql
   USE [GocDanSinh];
   SELECT u.id,u.display_name,u.email,u.account_status,
          r.role_code, DATALENGTH(c.password_salt) AS salt_bytes,
          DATALENGTH(c.password_hash) AS hash_bytes
   FROM dbo.app_user u
   JOIN dbo.auth_credential c ON c.user_id=u.id
   JOIN dbo.user_role ur ON ur.user_id=u.id
   JOIN dbo.[role] r ON r.id=ur.role_id
   WHERE u.email=N'EMAIL_REVIEWER_VUA_NHAP';
   ```
   Mong đợi: `reviewer`, `active`, 32, 64.
7. Đăng xuất tài khoản biên tập, đăng nhập reviewer tại `http://127.0.0.1:3001/login.html` với email/mật khẩu vừa nhập.
8. Xóa file tạm `sql\Tao_Tai_Khoan_Reviewer_Tam.sql` khỏi máy, giữ email và mật khẩu trong quản lý mật khẩu của chính reviewer.

## An toàn
- Reviewer chỉ có role `reviewer`; không được cấp `publisher` hoặc `admin`.
- Không cấp quyền cho cùng cá nhân tạo/gửi duyệt với tài khoản khác. Đây phải là một **người kiểm duyệt độc lập thực sự**.
- Reviewer cần đối chiếu snapshot #10 với tài liệu BHXH gốc và quyết định xác minh trước khi phê duyệt. Không tự động `accepted`, `approved`, hay `published`.
- Để công bố cần **một tài khoản publisher độc lập thứ ba**.
