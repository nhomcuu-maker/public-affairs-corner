# Dân Sinh AI — sửa xử lý OTP, hiển thị thư viện và chẩn đoán HTTP 500 (11/10/2026)

## Những gì thực sự đã sửa

1. Chatbot nhận tình huống có người yêu cầu mã OTP và trả lời hướng dẫn bảo vệ tài khoản **ngay cả khi SQL Server/Ollama không hoạt động**. Câu nối `tôi cung cấp rồi` sử dụng tối đa ba câu hỏi trước trong RAM trình duyệt để đưa ra bước cần làm tiếp theo. Không đoán người gọi chắc chắn là lừa đảo, không xin chính mã OTP.
2. Gắn **thư viện 9 PDF tham khảo** ngay vào trang `phap-luat-quyen-loi.html` và `thu-tuc-hanh-chinh.html`. Người dân có thể thấy và mở bản PDF khi API bài công khai bị lỗi. Các bản PDF này là tài liệu tham khảo **chưa qua quy trình xét duyệt**; không mạo nhận là bài đã công bố.
3. Công cụ `tools/library/import-local.cjs` ưu tiên Poppler `pdftotext` (nếu có) để tránh lỗi thiếu `DOMMatrix` trong một số môi trường Node, sau đó mới dùng `pdf-parse`. Bản catalog chuẩn bị sẵn chứa 9 PDF, **8 có văn bản tìm kiếm được**, 1 tệp Luật Việc làm chủ yếu chỉ trích xuất được dấu ký điện tử và cần OCR/bản có lớp chữ.
4. Công cụ `tools/law_rag/stage_bundled_library.py` đọc các tệp PDF gốc tại `evidence`, **đối chiếu SHA-256** với catalog, nhập vào kho riêng `data/law_rag` và tạo chunk. Không kết nối SQL, không tự công bố. Việc nhập thử trong workspace: 9 PDF, 389 đoạn có thể trích văn bản (1 PDF cần OCR).
5. Bổ sung `sql/13_ChanDoan_HTTP500_TrangCongKhai_READ_ONLY.sql` để kiểm tra **trên SQL Server của bạn** các bảng và số phiên bản đạt điều kiện công bố.

## Cài đặt vào đúng dự án đang hoạt động (Windows)

Sao lưu thư mục `GocDanSinh` trước. Dừng NestJS rồi giải nén bản vá vào **gốc chứa package.json** (không tạo thư mục lồng). Ghi đè các tệp trùng tên, **không xóa `.env`, database hay tài liệu của bạn**.

Chạy tại thư mục gốc dự án:

```powershell
npm run build
npm run test:offline
node tools/library/test-library.cjs
```

Nếu muốn **tiếp nhận 9 PDF vào vùng RAG chờ kiểm duyệt**, chạy Python đã có đủ dependencies:

```powershell
.\.venv-law\Scripts\python.exe tools/law_rag/stage_bundled_library.py
```

Nếu báo thiếu `fitz` hay `bs4`, cài vào **chính môi trường ảo này**:

```powershell
.\.venv-law\Scripts\python.exe -m pip install -r tools/law_rag/requirements.txt
```

Nếu muốn nhập các bản chứng cứ đã được khai báo vào **vùng chờ SQL** (không công bố):

```powershell
node tools/bulk/upload-all-available.cjs --audit
# Chỉ sau khi đã sao lưu SQL Server và nắm rõ dữ liệu hiện tại:
node tools/bulk/upload-all-available.cjs --apply --backup-confirmed
```

**Không tự gán `accepted`, `approved`, `published` hoặc thay đổi ngày hiệu lực**: phải xác minh bản gốc, cơ quan ban hành, trạng thái pháp lý, nội dung, và có người duyệt độc lập theo luồng sẵn có.

## Chẩn đoán HTTP 500

HTTP 500 trên `/api/content?domain=ADMIN` thể hiện truy vấn phía server bị lỗi; không đồng nghĩa hệ thống không có PDF. Không thể suy đoán nguyên nhân cụ thể chỉ từ ảnh chụp.

Khi backend Windows đã khởi động, chạy:

```powershell
node tools/diagnostics/check-public-api.cjs
```

Mở SSMS, chọn đúng SQL Server và chạy file:

```
sql/13_ChanDoan_HTTP500_TrangCongKhai_READ_ONLY.sql
```

Nếu `api/health` lỗi, kiểm tra kết nối, tên instance và tài khoản SQL (không gửi mật khẩu). Nếu `api/health` đạt nhưng `api/content` lỗi 500, kiểm tra lỗi SQL phía cửa sổ NestJS và so sánh schema với file chẩn đoán. Nếu `api/content` trả `200 []` thì **không có bài đáp ứng toàn bộ điều kiện công khai** tại thời điểm truy vấn; phải xem trạng thái phiên bản/chứng cứ và duyệt đúng quy trình, không hạ bỏ bộ lọc công khai.

Sau cập nhật, khởi động lại bằng cách cũ (ví dụ `tools/ai/start-gds.ps1`), mở `http://127.0.0.1:3001/thu-tuc-hanh-chinh.html`, `Ctrl+F5` và nhìn phần **Thư viện văn bản tham khảo**. Thử trong một cuộc chat liên tiếp:

- `nhân viên bhx yêu cầu tôi cung cấp otp`
- `tôi cung cấp rồi`

Mong đợi: lượt sau hướng dẫn bảo vệ tài khoản ngay, không trả kết luận pháp lý khi chưa có nguồn. Với câu hỏi pháp luật thông thường, AI vẫn cần cơ sở dữ liệu đã được xác minh và provider thật. Kiểm thử ngoại tuyến không thay thế việc kiểm thử SQL Server/Ollama trên máy này.
