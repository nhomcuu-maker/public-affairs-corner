# Góc Dân Sinh — kiến trúc dữ liệu 34 tỉnh/thành phố

## Nguồn danh mục hành chính

- Quyết định 19/2025/QĐ-TTg, Phụ lục I, áp dụng 01/07/2025.
- Mã tỉnh 2 ký tự (ví dụ `01` Hà Nội, `79` Thành phố Hồ Chí Minh), không ép sang integer.
- Danh mục được quản lý tại `data/tinh_thanh_2025.json`, sử dụng bởi `GET /api/locations/provinces`.
- `sql/Danh_Muc_Tinh_Thanh_2025.sql` chỉ nạp các đơn vị còn thiếu vào bảng `admin_unit`; @Apply=0 ROLLBACK, chạy trong SSMS sau khi sao lưu mới cân nhắc @Apply=1.
- Không tự đổi tên hay đóng hiệu lực những dòng admin_unit có dữ liệu khác với danh mục: yêu cầu đối chiếu lịch sử sáp nhập, không tự động sửa.

## Phân tách dữ liệu tránh trùng lặp

1. `knowledge_item` + `knowledge_version`: nội dung thủ tục/pháp luật/cảnh báo có phiên bản, trạng thái biên tập và chứng cứ.
2. `item_scope`: bản áp dụng toàn quốc (`nationwide`) hoặc cho một `admin_unit` (`unit`). Nội dung dùng chung không sao chép 34 bản theo tỉnh.
3. `admin_unit`: mã, tên, cấp, thời gian có hiệu lực; hỗ trợ đơn vị cũ qua `admin_unit_transition` nếu đã xác minh.
4. `organization`, `organization_jurisdiction`, `procedure_office`: cơ quan, phạm vi thẩm quyền, điểm tiếp nhận của **đúng một thủ tục/phiên bản**. Không tự suy ra 34 cơ quan từ bản thủ tục quốc gia.
5. `source`, `source_snapshot`, `source_verification`, `knowledge_version_source`: dấu vết kiểm chứng theo tài liệu và phiên bản. Không chuyển `draft` thành `published` nếu thiếu xác minh hợp lệ.

## Hành vi hệ thống

- `GET /api/locations/provinces` trả danh mục 34 địa phương có dẫn xuất nguồn.
- `GET /api/procedures?provinceCode=01` lọc các phiên bản **đã công bố và có nguồn được chấp nhận**, có phạm vi `nationwide` hoặc đơn vị cấp tỉnh có đúng mã `01`. Mã sai trả 400.
- `GET /api/procedures/:businessCode?provinceCode=01` áp dụng cùng ràng buộc phạm vi để không mở nhầm thủ tục của tỉnh khác.
- `GET /api/procedures` không có mã vẫn hỗ trợ tương thích ngược.
- Khi không có thủ tục đủ điều kiện công bố, trang sẽ thông báo **chưa có nội dung đã kiểm duyệt**, không tạo dữ liệu giả.
- **Quan trọng:** API công khai tạm ẩn danh sách nơi tiếp nhận vì chưa có bằng chứng riêng cho các cơ quan/địa chỉ. Trường `officeVerificationStatus=not_verified` minh bạch tình trạng; chế độ dev có khóa vẫn đọc dữ liệu gốc.

## Trước khi bật địa chỉ nơi tiếp nhận theo tỉnh

- Thu thập cơ quan tiếp nhận từ cổng chính thức của *từng tỉnh* hoặc Cổng DVCQG có tham chiếu chính xác; lưu URL, thời điểm lấy, SHA-256, hiệu lực, bằng chứng và người duyệt.
- Đối chiếu cơ quan đúng thẩm quyền sau sắp xếp 2025, không dùng danh bạ BHXH 2025 của bài cảnh báo như dữ liệu liên hệ năm 2026.
- Chỉ công bố bản ghi địa phương khi nguồn về **địa chỉ + quyền tiếp nhận + kênh nộp** được duyệt; xác định rõ phiên bản thủ tục và tỉnh, tránh JOIN chéo.
- Không có nguồn đã kiểm duyệt: hiển thị trạng thái thiếu dữ liệu, tuyệt đối không đoán.

## Lộ trình tiếp theo

Chốt chứng cứ 3 bản nháp LEGAL/ADMIN/SCAM; xây quy trình xác minh điểm tiếp nhận riêng theo tỉnh; bổ sung mẫu đơn số 10 được đối chiếu; có dữ liệu đã được xuất bản mới kiểm thử end-to-end UI/API cho nhiều tỉnh.
