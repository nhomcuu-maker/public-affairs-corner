# Kết quả kiểm thử phiên bản chuẩn hóa — 10/10/2026

## Đã chạy và xác nhận

- **Build NestJS:** `npm run build` — thành công, không có lỗi TypeScript.
- **Bộ kiểm thử ngoại tuyến:** `npm run test:offline` — **18/18 nhóm PASS**. Bao gồm rà soát cấu trúc, static/frontend links, authentication/authorization logic, workflow, kho tri thức, tìm kiếm, assistant (mock provider), phản hồi, chứng cứ và các script tự kiểm tra thu thập/xác minh nguồn.
- **Giao diện:** bài smoke test cho 4 trang xác nhận không tự gọi tìm kiếm trong lúc tải và có lời gọi API khi thực hiện tìm kiếm trong môi trường mô phỏng.
- **Tên tệp và assets:** không còn tên file chứa `Buoc/BƯỚC/step<kỳ số>`; các liên kết CSS/JS tĩnh tới file local kiểm tra được 30 tham chiếu.
- **Nguồn:** một chứng cứ luật đối chiếu được hash như báo cáo, ba bản ghi nguồn ở trạng thái chờ; không có nguồn nào tự động được xác minh hoặc công bố.

## Chưa chạy, không được coi là đã nghiệm thu

- Không kết nối SQL Server thật của người dùng trong môi trường đóng gói; không xác nhận migration thực tế hoặc trạng thái 52 bảng.
- Không thực hiện live HTTP E2E trên website do backend khởi chạy yêu cầu CSDL thật.
- Không kiểm tra tài khoản thật theo vai trò author/editor/reviewer/publisher/admin.
- Không kiểm thử tích hợp API cơ quan nhà nước hoặc cấp quyền sử dụng dữ liệu; không có cron đồng bộ production.
- Không xác nhận các điều kiện vận hành thực tế: HTTPS, DNS, backup/restore, recovery và giám sát.

## Cảnh báo từ kiểm tra nguồn

Tệp `evidence/review/canh_bao_mao_danh_bhxh.html` có SHA-256 **không trùng** hash kỳ vọng trong `data/source_capture_report.json`; kết quả được bảo lưu và chuyển sang `PENDING`. Bản kiểm duyệt ngoại tuyến cũng chưa xác nhận nội dung cảnh báo. Không dùng bản HTML này làm nguồn đã xác minh; cần tải lại bản gốc từ trang chính thức và đối chiếu nội dung, ngày đăng, đường dẫn và file hash.

## Cách chạy lại ở máy Windows

```powershell
npm ci
npm run build
npm run test:offline
npm run dev
```

Sau khi backend đã kết nối SQL Server, chạy từng bộ `npm run test:*-http` theo README và tự kiểm tra các trang `/tim-kiem-tri-thuc.html`, `/tro-ly-ai.html`, `/admin.html` với các tài khoản phù hợp.
