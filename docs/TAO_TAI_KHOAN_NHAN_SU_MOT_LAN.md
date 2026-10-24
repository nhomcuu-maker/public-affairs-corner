# Góc Dân Sinh — Tạo đủ tài khoản nhân sự một lần

## Phân công tối thiểu
- **Admin**: quản lý hệ thống; đã có nên KHÔNG tạo mới.
- **Editor** (hoặc author hiện có): chỉnh sửa và gửi duyệt; chỉ tạo nếu cần người biên tập riêng.
- **Reviewer**: xác minh chứng cứ, phê duyệt; tài khoản user #6 đã có nên KHÔNG tạo lại nếu đang hoạt động.
- **Publisher**: phát hành bài đã được phê duyệt; tạo một tài khoản mới nếu chưa có.
- **Người dân (user)**: tự đăng ký; không tạo tài khoản hàng loạt.

**Quan trọng:** Việc tạo ba tài khoản do cùng một người điều khiển không đáp ứng yêu cầu kiểm duyệt độc lập. Người biên tập, kiểm duyệt, công bố phải là những người khác nhau trong thực tế.

## Quy trình một lần
1. Backup SQL Server `GocDanSinh` và thư mục dự án. Copy nội dung ZIP vào `D:\trường\Đồ án\GocDanSinh`.
2. Mở SSMS chạy `sql/Kiem_Tra_VaiTro_TaiKhoan_READ_ONLY.sql`. Tự kiểm tra các tài khoản đang có. Không đăng kết quả chứa email riêng lên mạng.
3. Mở Windows PowerShell tại thư mục gốc, chạy:
   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\tools\accounts\generate-staff-accounts.ps1"
   ```
4. Script mặc định **bỏ qua Editor**, **bỏ qua Reviewer #6**, **tạo Publisher**. Nếu người biên tập riêng chưa có, trả lời Y cho Editor; nếu đã có một Reviewer thật đang hoạt động thì KHÔNG tạo Reviewer mới.
5. Mỗi tài khoản mới cần tên thật, email mới và mật khẩu riêng >=12 ký tự. Mật khẩu ẩn khi nhập, được băm `scrypt` trên máy, sinh salt 32 byte, hash 64 byte, N=16384/r=8/p=1.
6. SSMS mở `sql/Tao_Tai_Khoan_Nhan_Su_Tam.sql`. Chạy lần 1 với `DECLARE @Apply BIT = 0` -> `PREVIEW_WILL_ROLLBACK`; xác minh nhân sự/vai trò/email. Sau backup SQL, chạy lần 2 với `@Apply=1` -> `APPLIED`.
7. Chạy lại `sql/Kiem_Tra_VaiTro_TaiKhoan_READ_ONLY.sql`, xác nhận đúng vai trò. Đăng nhập thử từng người tại `http://127.0.0.1:3001/login.html`.
8. **Xóa** `sql/Tao_Tai_Khoan_Nhan_Su_Tam.sql` trên máy sau khi đã xong; file chứa hash/salt nhạy cảm. Không gửi mật khẩu hoặc file SQL tạm vào ChatGPT. Lưu thông tin đăng nhập riêng trong trình quản lý mật khẩu của từng người.

## An toàn
- Mặc định không tạo tài khoản trùng và không sửa tài khoản đang có. Nếu email đã có trong SQL: toàn bộ transaction bị hủy (không cấp quyền ngầm).
- Không cấp `admin` cho mọi tài khoản. Bộ tạo chỉ cấp duy nhất 1 trong 3 vai trò editor/reviewer/publisher cho mỗi tài khoản mới.
- Không sửa `source_verification`, `knowledge_version` hoặc thực hiện `publish` trong bộ tạo.
- Chế độ `@Apply=0` là transaction xem trước, rollback toàn bộ.
- Nếu muốn cấp một vai trò cho **tài khoản đã đăng ký**, sử dụng `sql/05_GocDanSinh_TuyChon_CapVaiTroNhanSu.sql` có sẵn (sau khi kiểm tra danh tính), không tạo thêm email để tránh trùng.

## Sau khi cài
Bài BHXH #4 đã **approved**; Publisher độc lập mở `admin.html` để kiểm tra lại nội dung/phạm vi chứng cứ, nhập xác nhận phát hành bắt buộc `CONG_BO` và ghi biên bản. Nếu backend từ chối, giữ nguyên dữ liệu và cung cấp lỗi để xác minh nguyên nhân. Sau khi công bố, kiểm tra `/api/content?domain=SCAM`, tìm kiếm và trợ lý AI.
