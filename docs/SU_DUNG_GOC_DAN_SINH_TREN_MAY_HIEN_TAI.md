# GÓC DÂN SINH — BẢN DÙNG NGAY TRÊN MÁY HIỆN TẠI

## Mục đích và phạm vi

Bản vá này KHÔNG nhập, duyệt hoặc xuất bản tài liệu. Không thay đổi SQL Server và không can thiệp tác vụ RSS 08:00. Thay đổi: trang `/bat-dau.html`, liên kết từ trang chủ, tình huống mẫu của trang tìm kiếm không ép đăng nhập, liên kết tra cứu nguồn chính thức khi chưa có nội dung công khai, và bộ kiểm tra HTTP read-only.

## Cài đặt

1. Sao lưu thư mục `D:\trường\Đồ án\GocDanSinh`.
2. Giải nén ZIP vào đúng thư mục dự án, giữ cấu trúc `public/`, `tools/`, `docs/`; đồng ý thay thế các tệp tương ứng. Không giải nén vào thư mục con mới.
3. Không cần chạy SQL migration, không cần chỉnh `.env`, không cần cài npm package mới.
4. Tại PowerShell:

```powershell
Set-Location -LiteralPath 'D:\trường\Đồ án\GocDanSinh'
node tools/test-public-start.cjs
npm run build
npm run test:offline
```

5. Chỉ dùng **một** phiên website trên `http://127.0.0.1:3001/`. Nếu server đang chạy với watch và đã nhận tệp tĩnh, nhấn `Ctrl+F5` trên trình duyệt. Nếu cần khởi động lại, ngừng phiên cũ trước để tránh `EADDRINUSE`.
6. Mở `http://127.0.0.1:3001/bat-dau.html`, chọn địa phương, tìm kiếm, mở trợ lý.
7. Kiểm tra HTTP read-only:

```powershell
node tools/test-public-live-http.cjs
```

Nếu kết quả ghi `PUBLIC CONTENT PENDING: 0`, trang web vẫn hoạt động về kỹ thuật nhưng chưa có nội dung pháp luật/thủ tục *đã được duyệt để hiển thị*. Không biến 50 RSS metadata thành nội dung đã xác minh.

## Lộ trình xuất bản nội dung đầu tiên, KHÔNG BỎ QUA KIỂM DUYỆT

1. Mở `http://127.0.0.1:3001/admin.html`, đăng nhập bằng tài khoản nội bộ có quyền biên tập. Tập trung trước vào 3 bản nháp MVP: `GDS-MVP-LEGAL-BHTN`, `GDS-MVP-ADMIN-TCTN`, `GDS-MVP-SCAM-MAODANH-BHXH`.
2. Kiểm tra lại điều khoản pháp luật, mốc thời gian, mẫu đơn, phạm vi địa phương và nguồn gốc tài liệu trực tiếp từ cơ quan ban hành. Không coi PDF candidate hay metadata RSS pending là chứng cứ đã chấp nhận.
3. Bổ sung chứng cứ/snapshot nguồn gốc đủ điều kiện và xác minh độc lập theo mô hình cơ sở dữ liệu hiện có. Trước đó, các bản nháp thiếu `accepted` snapshot sẽ không được phép xuất bản.
4. Người soạn/gửi duyệt, người phê duyệt và người công bố phải tách biệt theo guard và stored procedure hiện có. Nếu chỉ có một tài khoản Admin, **không thể bỏ qua bước tách người** để xuất bản nhanh. Không sửa trực tiếp `editorial_status`, `source_verification` hoặc stored procedure nhằm vượt điều kiện.
5. Sau khi xuất bản thành công theo quy trình, chạy lại `node tools/test-public-live-http.cjs` và thử tra cứu một nội dung bằng `bat-dau.html`, `thu-tuc-hanh-chinh.html`, `tim-kiem-tri-thuc.html`, `tro-ly-ai.html`.

## Các giới hạn hiện tại

- Mới phục vụ từ máy cá nhân, chưa truy cập công khai từ Internet.
- Không có câu trả lời pháp lý tự phát khi nguồn công khai còn trống. API trợ lý có thể trả `INSUFFICIENT_EVIDENCE`, đó là ứng xử đúng về an toàn.
- Phần mô tả/thiết kế tĩnh trên các trang chuyên mục không tương đương một bài đã kiểm duyệt. Chỉ kết quả trả từ API công khai và nội dung thực tế được xuất bản mới được xem là nguồn đã qua hệ thống xét duyệt.
- Thao tác kiểm tra HTTP sử dụng đường dẫn localhost; không gửi dữ liệu tài khoản hay đọc bản nháp.
- Đường dẫn đến cổng nhà nước là liên kết tham khảo truy cập trực tiếp; không có nghĩa Góc Dân Sinh đã tự kiểm tra toàn văn/hiệu lực tại thời điểm truy cập.
