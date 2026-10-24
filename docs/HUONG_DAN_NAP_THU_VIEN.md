# Thư viện PDF tham khảo – Góc Dân Sinh

## Chức năng
Bản vá tạo một kho PDF tham khảo đọc được ngay, độc lập với bảng `knowledge_version` và quy trình phê duyệt. Hai trang `phap-luat-quyen-loi.html` và `thu-tuc-hanh-chinh.html` có vùng tìm kiếm và mở PDF ở gần cuối trang. Trang `/thu-vien.html` hiển thị toàn bộ.

Đã đóng gói **9 PDF** thực tế từ kho `evidence/` đã có tại thời điểm tạo bản vá. Các tài liệu này mang nhãn **CHƯA ĐƯỢC KIỂM DUYỆT**, không được coi là tư vấn luật được xác minh, không tự động trở thành bài viết đã công bố. Một số mã tài liệu có thể cần kiểm tra lại cơ quan ban hành, hiệu lực và phạm vi áp dụng.

## Cài đặt
1. Sao lưu thư mục dự án. Giải nén ZIP vào thư mục gốc dự án `D:\trường\Đồ án\GocDanSinh`.
2. Giữ nguyên cấu trúc `public/library-files/`, `public/library-catalog.json`, `public/js/gds-library.js`, `tools/library/import-local.cjs`.
3. Chạy `node tools/library/test-library.cjs`.
4. Chạy `npm run dev` (hoặc công cụ khởi động Ollama trước đó), mở `http://127.0.0.1:3001/thu-vien.html` và `http://127.0.0.1:3001/thu-tuc-hanh-chinh.html`.

## Tự cập nhật khi thêm PDF
Đặt PDF không chứa thông tin riêng tư vào `evidence/legal/` (pháp luật), `evidence/new/` (pháp luật) hoặc `evidence/thu-tuc/` (thủ tục). Đối với `evidence/review/`, chỉ hai tên tài liệu đã liệt kê sẵn được cho vào thư viện tham khảo để tránh công khai các chứng cứ nhạy cảm. Chạy:

`node tools/library/import-local.cjs`

Sau đó làm mới trang. Nếu đã cài `pdftotext` vào `PATH`, chương trình trích xuất chữ để tìm kiếm; nếu không, PDF vẫn được liệt kê theo tên nhưng không tìm được toàn văn. Có thể cài Poppler for Windows để có `pdftotext`. Các PDF scan ảnh cũng cần xử lý OCR riêng, không thể tự trích chữ.

**CẢNH BÁO:** các tệp trong `public/library-files/` có thể được mọi người truy cập khi website được đưa lên Internet. Chỉ đưa tài liệu được phép công khai vào các thư mục nhập. Công cụ không tải văn bản trực tiếp từ nguồn Internet và chưa tự thu thập tất cả thủ tục 34 tỉnh. Nó không tự thay đổi SQL, phê duyệt hay gán hiệu lực văn bản.

## Vì sao trước đây các nút không có bài?
API `/api/content` và `/api/procedures` chỉ hiển thị bài đã xác minh, phê duyệt và công bố. Trước đó mới có 1 bài BHXH được công bố. Tải 50 metadata RSS không sinh ra bài hướng dẫn. Thư viện mới giải quyết vấn đề **đọc tài liệu có sẵn ngay**, còn quy trình biên tập nội dung từ PDF thành bài hướng dẫn cần được hoàn thiện riêng.
