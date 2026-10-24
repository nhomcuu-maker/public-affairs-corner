# Báo cáo kiểm tra và chuẩn hóa Góc Dân Sinh — 10/10/2026

## A. Hiện trạng đầu vào

- File RAR ban đầu có hai cây mã nguồn; cây `GocDanSinh/GocDanSinh` là bản cũ và thiếu module assistant/feedback mới. Có hai thư mục `node_modules` và bản `dist` đã biên dịch.
- Bản gốc có nhóm script `AP_DUNG_BUOC*` chỉ dành cho việc cài bản vá từ thư mục riêng, không an toàn nếu chạy lại trong dự án đã cập nhật. Có một `.env` cá nhân và nhiều tệp chứng cứ trùng.
- Source chính hiện sử dụng NestJS/TypeScript, SQL Server, giao diện tĩnh. Có authentication, role control, workflow, tìm kiếm, trợ lý, feedback và các kiểm thử tĩnh đi kèm.

## B. Quyết định dọn dẹp

- Giữ **bản mới ở gốc**; không trộn các đoạn code cũ từ bản lồng nhau.
- Đổi tên 32 tệp đang gắn số thứ tự giai đoạn sang tên chức năng (SQL, test, evidence, data, script). Tham chiếu trong chương trình và các bài kiểm thử đã được điều chỉnh.
- Bỏ 4 script vá cũ, `.bak` của controller, bản SQL kiểm tra trùng byte, file nguồn JSON trùng byte, lệnh HTTP kiểm tra trùng byte, file ZIP chứa 5 tệp đã có bản riêng với đúng hash, các file liệt kê bản vá cũ và script thu thập lỗi thời.
- Gộp CSS checklist/feedback vào CSS trợ lý, bỏ tệp CSS phụ. Loại bỏ việc nạp CSS trùng.
- Chỉ đóng gói source và chứng cứ; không phát hành `.env`, `dist` hoặc `node_modules`. Cấu hình và dependencies được tái tạo ở máy Windows bằng hướng dẫn.

## C. Mức độ hoàn thành và các rủi ro

| Hạng mục | Trạng thái |
| --- | --- |
| Cấu trúc source, chức năng chính, script và tham chiếu tên tệp | Đã sửa, có thể kiểm tra tĩnh |
| Build NestJS TypeScript | Được kiểm tra trong môi trường đóng gói; xem biên bản kết quả cuối |
| Chạy thực tế với SQL Server cá nhân | Chưa kiểm thử trong môi trường này |
| Đăng nhập/role/workflow end-to-end | Chưa có SQL Server và tài khoản theo từng role để xác nhận |
| Nguồn dữ liệu nhà nước / API thời gian thực | Chưa xác minh được quyền truy cập, endpoint và cơ chế đồng bộ production |
| Phê duyệt LEGAL/ADMIN/SCAM | Chưa hoàn tất; SCAM2 chưa qua kiểm tra đoạn HTML nguồn và SHA-256 trong báo cáo thu thập cũ không khớp với HTML thực tế |
| HTTPS, tên miền, backup-restore, cron, monitoring | Chưa cấu hình trên hạ tầng triển khai |

**Rủi ro ưu tiên cao:** cơ sở dữ liệu phải được sao lưu trước khi áp SQL hoặc thay thế project; nguồn chưa kiểm chứng không được công bố; chỉ chạy khi `.env` và tài khoản SQL được cấu hình an toàn. **Ưu tiên tiếp:** kiểm thử thực tế trang tìm kiếm, chức năng trợ lý và quyền quản trị trên Windows; phân biệt demo với production.

## D. Kiểm thử và phạm vi bàn giao

Các lệnh offline được gom vào `npm run test:offline`, đối chiếu hệ thống tên tệp/HTML, code logic, workflow, bảo vệ nguồn, mã hóa phản hồi và mock provider. Chi tiết trạng thái test và build sau khi đóng gói được lưu tại `docs/KET_QUA_KIEM_THU.md`. Những kiểm thử không thể chạy vì thiếu database/Internet **không được ghi là thành công**.

## E. Việc phải làm ở máy của bạn

1. Backup source, `.env` và database; thay thế thư mục mã nguồn bằng bản gọn; khôi phục `.env` cá nhân.
2. `npm ci`, `npm run build`, `npm run test:offline`, `npm run dev`; chỉnh lỗi kết nối SQL nếu xuất hiện.
3. Kiểm tra đủ 5 hành vi: trang chủ; đăng ký/đăng nhập; tìm kiếm nội dung; hỏi trợ lý; quyền truy cập quản trị bằng tài khoản thường và quản trị.
4. Chạy truy vấn SQL `READ_ONLY`, đọc trạng thái các bản nháp và chứng cứ. Không tự đổi `draft` hay `pending_review` thành published/accepted.
5. Khi chuẩn bị production: cung cấp endpoint chính thức, điều khoản dùng dữ liệu, quyền, key/tài khoản phù hợp; bổ sung HTTPS, monitoring, backup/rollback và kiểm thử bảo mật.
