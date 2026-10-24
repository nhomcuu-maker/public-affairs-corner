# Góc Dân Sinh — mã nguồn đã chuẩn hóa

**Công nghệ:** NestJS 11, Node.js 20+, TypeScript 5.8, SQL Server (`mssql`), giao diện HTML/CSS/JavaScript độc lập. Dự án có ba kho LEGAL, ADMIN và SCAM; tìm kiếm liên kết, trợ lý AI có căn cứ, tài khoản, phân quyền, duyệt nội dung và phản hồi. Các module tồn tại trong source không đồng nghĩa dữ liệu đã đủ hoặc production đã đạt.

## 1. Cập nhật trên Windows, không mất dữ liệu

**BẮT BUỘC:** Sao lưu nguyên thư mục dự án hiện tại, `.env` của bạn và sao lưu CSDL SQL Server trước khi thay đổi. Giải nén file ZIP, bạn sẽ nhận một thư mục `GocDanSinh`. Không chép thêm nội dung vào bản cũ mà không xóa được các script vá lỗi thời — tốt nhất đổi tên bản cũ thành `GocDanSinh_backup`, rồi chuyển thư mục mới vào đúng vị trí cũ.

**Đường dẫn dự án được giữ nguyên** tại máy của bạn. Sau khi thay thế, **chép riêng file `.env` từ bản cũ vào thư mục mới** (không đăng nó lên mạng). Bản bàn giao **không có `.env`**, không có `node_modules/`, không có `dist/`; các file này là bí mật cá nhân hoặc có thể tự tái tạo. Nếu chưa có `.env`, chạy `node tools/setup.cjs` để tạo từ mẫu rồi chỉnh cài đặt SQL Server. Không chạy lại SQL tạo database trên database đang có dữ liệu.

## 2. Cài và chạy

Mở PowerShell tại thư mục có `package.json`:

```powershell
node --version
npm ci
node .\tools\setup.cjs
npm run build
npm run test:offline
npm run dev
```

Mở `http://127.0.0.1:3001/` trên máy chạy backend. `BAT_DAU_WINDOWS.cmd` có thể thiết lập cấu hình và khởi chạy bằng cách nhấp đúp. Windows Authentication cần SQL Server, ODBC phù hợp và phiên bản `msnodesqlv8` khả dụng; nếu không có, cân nhắc SQL Authentication với thông số **chỉ trong `.env`**. Lệnh chạy chỉ thành công khi backend kết nối đúng CSDL `GocDanSinh`.

Các đường dẫn để kiểm thử: `/`, `/register.html`, `/login.html`, `/tim-kiem-tri-thuc.html`, `/tro-ly-ai.html`, `/admin.html`; API: `/api/health`, `/api/search`, `/api/assistant/ask`. Khu vực quản trị bắt buộc có tài khoản được cấp role trên server. Không phát hành các trang kiểm tra nội bộ lên môi trường công khai.

## 3. Kiểm thử

`KIEM_TRA_DU_AN.cmd` hoặc `npm run test:offline` chạy bộ kiểm thử ngoại tuyến, sau đó `npm run build` xác nhận biên dịch. Lệnh **không** xác nhận đã truy cập được SQL Server hay nguồn dữ liệu trực tuyến. Khi backend đã khởi chạy với SQL thật, có thể kiểm tra từng phần:

```powershell
npm run test:auth-http
npm run test:knowledge-http
npm run test:search-http
npm run test:assistant-http
npm run test:feedback-http
npm run test:source-http
```

Dùng SSMS chạy các truy vấn `READ_ONLY` sau khi kiểm tra đúng tên database. SQL trong `sql/` được giữ riêng để bảo toàn trình tự migration và chức năng rollback. **Không chạy lại `sql/01_GocDanSinh_Tao_Bang_Va_Nap_Du_Lieu.sql`** trên hệ thống thật, không chạy script cấp quyền tùy tiện và không tự gỡ khóa kiểm duyệt chỉ để kiểm thử xanh.

## 4. Cấu trúc

- `src/`: NestJS backend và chính sách kiểm soát truy cập.
- `public/`: trang HTML, JavaScript và CSS; CSS trợ lý đã gộp các tiện ích checklist/phản hồi.
- `sql/`: schema, migration và báo cáo kiểm tra; tên tệp mô tả chức năng, vẫn giữ số thứ tự lịch sử.
- `evidence/legal`, `evidence/new`, `evidence/thu-tuc`: 8 tài liệu đã nằm trong cơ sở SQL mẫu với SHA gốc.
- `evidence/review/`: ứng viên nguồn đã thu thập, **chưa được kiểm chứng pháp lý**.
- `data/`: manifest, báo cáo nhận chứng cứ, kết quả rà soát.
- `tools/source/`: tải nguồn cho phép và tạo SQL bị khóa chờ xác minh; không có cơ chế phê duyệt tự động.
- `tools/`: bài kiểm thử mã nguồn, quyền và hành vi; `docs/` có hướng dẫn kiểm duyệt.

## 5. Những phần chưa nghiệm thu

Để vận hành thực tế cần: kiểm thử DB và phân quyền bằng tài khoản thật tách vai trò; kiểm tra tính hợp lệ của 3 nguồn cụ thể và quy định hiện hành, đối chiếu từng địa phương; xác nhận lập lịch đồng bộ hợp pháp/có giới hạn theo API nguồn; kiểm thử backup–restore, HTTPS, CORS, secret, giám sát và bảo vệ dữ liệu cá nhân trong môi trường triển khai. Không coi tệp HTML/PDF lưu cục bộ hoặc bài kiểm tra ngoại tuyến là bằng chứng đã kết nối được cổng dữ liệu nhà nước.

Xem [báo cáo chỉnh sửa](docs/BAO_CAO_CHUAN_HOA_DU_AN.md) và [hướng dẫn kiểm duyệt nguồn](docs/HUONG_DAN_KIEM_DUYET_NGUON.md).

## Cập nhật tiếp nhận tài liệu có kiểm soát (11/10/2026)

Bản hiện tại có lệnh CLI `.\.venv-law\Scripts\python.exe tools/law_rag/pipeline.py import-local --input-dir "D:\TaiLieuChoDuyet"`, nhập PDF/DOCX/TXT/HTML/JSON/JSONL/CSV từ thư mục do quản trị viên chuẩn bị. Tất cả dữ liệu chỉ chờ kiểm duyệt, không tự công bố hay thay thế CSDL. Xem [hướng dẫn chi tiết](docs/CAP_NHAT_GIAI_DOAN_1_TIEP_NHAN_TAI_LIEU.md) và [kiểm thử](tools/law_rag/test_import_local.py).

**Lưu ý Python trên Windows:** tạo `.venv-law` bằng `py -3 -m venv .venv-law`, cài thư viện bằng `.\.venv-law\Scripts\python.exe -m pip install -r tools/law_rag/requirements.txt`, và sử dụng chính tệp `python.exe` đó khi chạy `test_import_local.py`. Không xóa `.venv-law` để khắc phục lỗi kiểm thử tên tệp.
