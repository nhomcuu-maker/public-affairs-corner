# Hồ sơ nguồn bản nháp LEGAL / ADMIN / SCAM — 10/10/2026

Sổ dữ liệu tại `data/ho_so_nguon_doi_chieu.json` chứa đường dẫn bản lưu, SHA-256, nguồn URL, nơi cần đối chiếu, thiếu sót và tình trạng *candidate*.

| Nhóm | Tệp | Đã rà soát | Còn thiếu |
| --- | --- | --- | --- |
| LEGAL | `evidence/review/luat_viec_lam_74_2025.pdf` | Điều 38, điều kiện BHTN được đối chiếu qua ảnh và PDF | Người duyệt xác nhận hiệu lực, lưu snapshot và liên kết phiên bản nội dung |
| ADMIN | `evidence/review/thu_tuc_tro_cap_that_nghiep_2026.pdf` | Quyết định 107/QĐ-BNV, trang 19–23; Mẫu số 10 ở trang 24 | Đối chiếu thủ tục công khai theo từng nơi tiếp nhận và bản lưu snapshot |
| SCAM2 | `evidence/review/canh_bao_mao_danh_bhxh_2025_v2.pdf` | Bài cảnh báo 13/06/2025 | PDF thiếu hình danh bạ; không được coi là bản sao đầy đủ |
| SCAM2 bổ sung | `evidence/review/danh_ba_lien_he_bhxh_2025.jpg` | Bảng liên hệ 24 đơn vị đã đối chiếu với hình trong bài gốc, SHA-256 trùng | Thông tin liên hệ có thể cũ sau sắp xếp địa phương, tuyệt đối không coi là danh bạ hiện tại |

Việc kiểm tra SHA-256 chỉ chứng minh tính toàn vẹn byte giữa các bản, **không chứng minh tài liệu có nguồn gốc xác thực**, không cập nhật bảng `source_verification` và không cấp quyền công bố.

Quy trình thao tác an toàn:

1. Kiểm tra ngày, tên văn bản và điều khoản *trực tiếp tại nguồn chính thức*; lưu biên bản đối chiếu (người đối chiếu, ngày giờ, URL, điều khoản, vấn đề còn tồn đọng).
2. Sao lưu SQL Server và đối chiếu danh sách snapshot theo `sql/12_Kiem_Tra_Nguon_Du_Lieu_READ_ONLY.sql`.
3. Nếu cần đăng ký bản lưu, chạy `node tools/source/review-evidence.cjs` kiểm tra ứng viên; chỉ tạo SQL bằng `--make-sql` sau rà soát độc lập. SQL tạo ra bị khóa `@DaDoiChieuNguon=0` và không tự xác nhận nguồn.
4. Chỉ người có thẩm quyền mới đánh dấu accepted sau khi kiểm tra đầy đủ; tách người biên tập và người phê duyệt nếu hệ thống hỗ trợ.
5. Kiểm tra lại API với `npm run test:source-http`. Cho đến khi có bản được công bố hợp lệ, trạng thái `INSUFFICIENT_EVIDENCE` là **đúng**.

Nguồn mã tỉnh: https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/7/19ttg.signed.pdf
