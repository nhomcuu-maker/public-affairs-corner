# Hướng dẫn rà soát và xác minh nguồn dữ liệu

Các tệp trong `evidence/review/` chỉ là **ứng viên chứng cứ, chưa được xác minh tính đúng đắn pháp lý**. Việc kiểm tra định dạng, hash SHA-256 hoặc truy xuất HTTP thành công **không phải** là phê duyệt nội dung. Không tự động chuyển `pending_review` sang `accepted`, không công bố `draft` khi thiếu quy trình duyệt.

## Kiểm tra ngoại tuyến (không kết nối SQL)

Tại thư mục dự án:

```powershell
node .\tools\source\collect-sources.cjs --self-test
node .\tools\source\review-evidence.cjs --self-test
node .\tools\source\review-evidence.cjs
```

Kết quả được ghi ở `data/evidence_review_report.json`. Script kiểm tra chứng cứ không tải Internet, không sửa cơ sở dữ liệu và không thay đổi trạng thái xuất bản. Nếu tệp HTML cảnh báo BHXH không vượt kiểm tra nội dung (đồng thời hash của tệp địa phương không khớp báo cáo thu thập cũ), kết quả là `PENDING`; phải mở nguồn chính thức, kiểm tra đoạn tin thật, ngày đăng và tải bản hợp lệ, thay vì sửa trạng thái bằng tay trong JSON.

## Thu thập nguồn bổ sung

`node .\tools\source\collect-sources.cjs` có thể gửi request tới các địa chỉ đã khai báo trong script. Chỉ thực hiện khi có quyền truy cập và điều khoản cho phép. Script ghi nguồn mới dưới `evidence/review/` và tạo `data/source_capture_report.json`. Những tệp tải từ nguồn khác phải được đối chiếu URL và nội dung; không đồng nhất `downloaded` với `verified`.

Lệnh `node .\tools\source\review-evidence.cjs --make-sql` **chỉ có thể tạo** file SQL nhập snapshot chờ duyệt khi 3 nguồn cơ bản đạt kiểm tra định dạng/nội dung sơ bộ. Bản SQL tự sinh có khóa chặn mặc định `@DaDoiChieuNguon=0`; chỉ sau kiểm duyệt thủ công, sao lưu CSDL, đối chiếu SHA và chính xác hóa các điều khoản mới xem xét bỏ khóa trong môi trường phù hợp. Không chạy SQL có khả năng ghi dữ liệu khi chưa hiểu đầy đủ.

## Kiểm tra từ SQL Server và API

- Mở `sql/12_Kiem_Tra_Nguon_Du_Lieu_READ_ONLY.sql` bằng SSMS và chạy trên đúng CSDL `GocDanSinh`. Đây là truy vấn chỉ đọc.
- Khi backend đang chạy, dùng `node .\tools\test-source-readiness-http.cjs` hoặc `KIEM_TRA_NGUON_HTTP.cmd`.
- Kết quả `PENDING` chứng tỏ thiếu chứng cứ đã xuất bản hoặc thiếu xác minh; **không tự động sửa bằng cách công bố bản nháp**.
- Đối chiếu lần lượt ba mảng LEGAL (quyền lợi), ADMIN (thủ tục có thể khác địa phương), SCAM (cảnh báo nguy cơ OTP/chuyển tiền).

Chi tiết chạy toàn dự án xem [README](../README.md).

## Tệp PDF thay thế cho nguồn cảnh báo SCAM2

Tệp `evidence/review/canh_bao_mao_danh_bhxh_2025_v2.pdf` được giữ dưới dạng **ứng viên**.
`data/evidence_manual_candidates.json` ghi URL nguồn, SHA-256 dự kiến và cách lưu
`browser_print_pdf`; không sửa/xóa `data/source_capture_report.json` và HTML cũ.

Chạy `node .\tools\source\review-evidence.cjs` để kiểm tra 3 ứng viên.
Kết quả `CANDIDATE_NOT_VERIFIED` hay `candidate=3/3` **KHÔNG** cho phép đánh dấu `accepted`,
chạy SQL nhập snapshot hoặc phát hành. PDF hiện chỉ có một trang, không có lớp văn bản
và có thể thiếu danh bạ liên hệ ở cuối bài. Người kiểm duyệt phải xem toàn văn URL gốc,
đối chiếu tiêu đề, ngày đăng, các đoạn nội dung, danh sách liên hệ và tính đầy đủ
của bản lưu. Nếu chưa đủ, tiếp tục đánh dấu `PENDING` về nội dung và lưu lại
chứng cứ đầy đủ trước khi chuyển sang quy trình kiểm duyệt.
