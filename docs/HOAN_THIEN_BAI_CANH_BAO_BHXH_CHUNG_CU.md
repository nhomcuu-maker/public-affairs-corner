# Góc Dân Sinh – Bản vá tiếp nhận chứng cứ và công bố bài BHXH đầu tiên

**Phạm vi:** Chỉ bổ sung luồng chứng cứ trong Admin, không sửa SQL schema, không sửa RSS/Task Scheduler,
không cập nhật dữ liệu người dùng, không phê duyệt tự động.

## Cài đặt an toàn trên Windows

1. Sao lưu SQL Server `GocDanSinh` và thư mục `D:\trường\Đồ án\GocDanSinh`.
2. Dừng `npm run dev` cũ bằng Ctrl+C. Giải nén ZIP này vào thư mục gốc dự án, đồng ý ghi đè các file có trong ZIP. **Không xóa các file hoặc thư mục khác.**
3. Trong PowerShell:

```powershell
Set-Location -LiteralPath 'D:\trường\Đồ án\GocDanSinh'
node tools/test-evidence-intake.cjs
npm run build
npm run test:offline
npm run dev
```

4. Trên trình duyệt, dùng duy nhất `http://127.0.0.1:3001/admin.html` (không dùng Live Server cổng 5500).

## Đưa bài SCAM #4 qua quy trình thật

1. Đăng nhập bằng tài khoản có quyền biên tập, mở `GDS-MVP-SCAM-MAODANH-BHXH`.
2. Kiểm tra Markdown và đặt **ngày bắt đầu áp dụng bài cảnh báo** nếu có căn cứ (đây KHÔNG phải ngày hiệu lực của một luật). Lưu bản nháp.
3. Mở mục **Chứng cứ gốc – tiếp nhận và đối chiếu độc lập**. Chọn nguồn BHXH đúng tài liệu. Ví dụ nguồn cảnh báo 13/06/2025 hiện có trong danh sách ứng viên (thường source_id 13, nhưng nên kiểm tra tên và URL trong giao diện thay vì dựa vào ID).
4. Đảm bảo file `evidence\review\canh_bao_mao_danh_bhxh_2025_v2.pdf` đã có sẵn trong dự án. Chỉ nhập tên tệp `canh_bao_mao_danh_bhxh_2025_v2.pdf`, không nhập đường dẫn đầy đủ. Điền vị trí trích dẫn và **biên bản tiếp nhận** (ít nhất 30 ký tự). Nhấn **Đăng ký snapshot**. Máy chủ đọc file thật, tính SHA-256, ghi metadata và liên kết với phiên bản bài viết. `capture_method=manual`, `captured_url=NULL` vì chưa xác minh nguồn gốc trực tiếp của bản sao; URL chính thức vẫn nằm trong bảng `source`. Trạng thái lúc này **chưa được xác minh**.
5. Nhấn **Gửi duyệt** với biên bản. Sau đó đăng xuất.
6. Đăng nhập bằng một **người/tài khoản reviewer độc lập**, khác người tạo, gửi duyệt và người đăng ký bản lưu. Mở chính URL BHXH và file PDF, so sánh nội dung, SHA-256, ngày và phần thiếu. **Bản PDF SCAM2 một trang có thể thiếu hình danh bạ; KHÔNG bấm xác nhận tính đầy đủ nếu phần thiếu là căn cứ cần dùng.** Khi chưa đủ, chọn **Cần kiểm tra thêm** hoặc **Không đạt**; không chọn accepted cho có.
7. Nếu thực sự kiểm tra đầy đủ phần làm căn cứ, đánh dấu 4 xác nhận, chọn kết quả, ngày kiểm tra lại và nhập biên bản ít nhất 80 ký tự. Hệ thống ghi sự kiện bất biến vào `source_verification`; không phê duyệt bài tự động. Sau khi kết quả là accepted và còn hiệu lực, reviewer mới dùng nút **Phê duyệt** có sẵn, kèm biên bản. Stored procedure SQL vẫn kiểm tra lại toàn bộ điều kiện.
8. Một **người/tài khoản publisher độc lập**, khác người tạo, gửi duyệt và phê duyệt, mở bài đã approved. Sau đối chiếu cuối cùng mới bấm **CÔNG BỐ** và gõ `CONG_BO`. Không cập nhật SQL trực tiếp để bỏ qua quy trình.
9. Kiểm tra bài xuất hiện: `http://127.0.0.1:3001/canh-bao-lua-dao.html`, `http://127.0.0.1:3001/tim-kiem-tri-thuc.html` và thử hỏi trợ lý. Chỉ bài đã published và có snapshot accepted hợp lệ mới đủ điều kiện được trả cho người dân.

## Đặc biệt lưu ý

- **Một file PDF có SHA đúng không chứng minh nguồn gốc hoặc nội dung pháp lý đúng.** Phải kiểm tra độc lập trang BHXH thật.
- Không sử dụng bảng số điện thoại trong bài 2025 như danh bạ BHXH hiện hành.
- Không tự công bố 50 bản ghi RSS đang pending_review.
- Nếu lỗi `EADDRINUSE`, đóng phiên backend cũ; đừng mở hai phiên ở cổng 3001.
- Nếu tài khoản Windows kết nối SQL không có quyền INSERT vào các bảng chứng cứ, dừng lại và kiểm tra quyền tối thiểu của tài khoản DB; không chạy lệnh cấp sysadmin tùy tiện.
- Cần ít nhất các vai trò/người có quyền phù hợp với SQL. Không mượn một tài khoản admin làm toàn bộ quy trình. Không tự xác minh nguồn nếu là người tiếp nhận bản lưu.
- Gói vá **không chứa** `.env`, PDF, dữ liệu RSS, cơ sở dữ liệu, mật khẩu hay `node_modules`.

## Kiểm thử SQL/API cần làm trên chính máy Windows

Sau khi đăng ký chứng cứ (trước xác minh), mở Admin phải thấy số snapshot tăng từ 0 lên 1 và nhãn *CHƯA CÓ XÁC MINH HỢP LỆ*.
Sau khi người khác xác minh thực, nhãn chuyển sang *ĐÃ CÓ XÁC MINH HIỆU LỰC* nếu quyết định mới nhất là `accepted` chưa hết hạn.
Sau khi công bố, chạy:

```powershell
Invoke-RestMethod 'http://127.0.0.1:3001/api/content?domain=SCAM' | ConvertTo-Json -Depth 6
node tools/test-public-live-http.cjs
```

**Kết quả kiểm thử trên môi trường xây dựng:** NestJS build PASS; 23/23 bộ kiểm thử ngoại tuyến PASS; 9/9 unit về chứng cứ PASS. Chưa có quyền truy cập SQL Server thực tế của máy Windows, nên không được coi là đã nghiệm thu E2E hoặc đã công bố bài.
