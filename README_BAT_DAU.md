# CẬP NHẬT BƯỚC 8.1
Xem `README_BUOC_8_1.md` để thiết lập đăng nhập thật. KHÔNG chạy lại SQL File 01 trên database đang có dữ liệu.

# GÓC DÂN SINH — CÁCH CHẠY WEBSITE + SQL SERVER

**Tên database duy nhất:** `GocDanSinh` (không có đuôi `v4`, `v4_1`).

## A. Tạo database mới trong SSMS (MỘT LẦN)

1. Mở SQL Server Management Studio, kết nối `localhost`, **Windows Authentication**.
2. Mở `sql/01_GocDanSinh_Tao_Bang_Va_Nap_Du_Lieu.sql`; nhấn **F5** khi database `GocDanSinh` **chưa tồn tại**. Script này dựng 52 bảng, 116 FK, nạp 3 module / 9 danh mục, thủ tục hộ chiếu bản nháp với 10 hồ sơ, 3 bước, 6 trường hợp lệ phí, 7 căn cứ luật và 8 PDF snapshots. Đọc tab **Messages** kỹ, không mặc định coi F5 là thành công nếu có lỗi.
3. Mở `sql/02_GocDanSinh_Kiem_Tra_Toan_Bo.sql`; nhấn **F5** để kiểm tra. File này chỉ đọc và có thể chạy nhiều lần.
4. **Không chạy lại File 01** khi database đã được tạo, không đổi tên database cũ, không sao chép dữ liệu thủ công từ database cũ.

**Lưu ý:** Có 8 file PDF kèm theo trong thư mục `evidence/`. SHA-256 byte của chúng khớp metadata trong SQL. SQL Server không tự lưu toàn bộ byte PDF; bảng `file_asset` chỉ lưu đường dẫn logic, SHA-256, kích thước và MIME. **Không di chuyển PDF vào `public/`**, vì chúng chưa được xét duyệt để công khai.

## B. Chạy cả Frontend và Backend trong VS Code

1. Mở **thư mục chứa** `package.json`, `public/`, `src/` bằng VS Code → File → Open Folder.
2. Trong Terminal của VS Code chạy các lệnh bên dưới, mỗi lệnh chờ chạy xong rồi mới sang lệnh sau:

```powershell
npm install
npm run setup
npm run build
npm run dev
```

Lệnh `npm run setup` tạo file `.env` với `DB_DATABASE=GocDanSinh` và một khóa dev ngẫu nhiên. Nếu file `.env` đã tồn tại, lệnh **không ghi đè**, chỉ kiểm tra tên database. Nếu đang dùng `.env` từ backend cũ, bạn phải sửa `DB_DATABASE=GocDanSinh` trước. Mặc định dùng **ODBC Driver 17 for SQL Server** và Windows Authentication như máy bạn.

Nếu muốn tiện hơn, sau khi đã tạo database trong SSMS, bạn có thể nhấp đúp `BAT_DAU_WINDOWS.cmd` để tự kiểm tra `.env`, cài npm nếu cần và chạy Backend.

3. Khi Terminal hiện `Connected to SQL Server database GocDanSinh` và `Nest application successfully started`, mở:

**http://127.0.0.1:3001/**

Website và API đều chạy từ **cổng 3001**, **không dùng Go Live / cổng 5500**. Không mở HTML theo dạng `file://`.

## C. Các đường dẫn kiểm tra

- Trang chủ: `http://127.0.0.1:3001/`
- Pháp luật & Quyền lợi: `http://127.0.0.1:3001/phap-luat-quyen-loi.html`
- Thủ tục hành chính: `http://127.0.0.1:3001/thu-tuc-hanh-chinh.html`
- Cảnh báo lừa đảo: `http://127.0.0.1:3001/canh-bao-lua-dao.html`
- **Trang kiểm tra hệ thống riêng:** `http://127.0.0.1:3001/kiem-tra-he-thong.html` (chỉ localhost, development)
- Kiểm tra kết nối API: `http://127.0.0.1:3001/api/health`
- 3 module: `http://127.0.0.1:3001/api/domains`
- Danh mục hành chính: `http://127.0.0.1:3001/api/categories?domain=ADMIN`
- Nội dung được công bố: `http://127.0.0.1:3001/api/content?domain=ADMIN`
- Thủ tục được công bố: `http://127.0.0.1:3001/api/procedures`

`/api/procedures` và `/api/content?domain=ADMIN` **đúng ra sẽ rỗng sau khi chạy SQL File 01** vì thủ tục hộ chiếu có trạng thái `draft` và chứng cứ chưa xác minh. Đó là chính sách bảo vệ nội dung pháp luật, không phải lỗi tích hợp.

## D. Xem thực tế bản nháp hộ chiếu đã nhập vào SQL Server

Mở `http://127.0.0.1:3001/kiem-tra-he-thong.html` → **Xem bản nháp thủ tục hộ chiếu**, hoặc truy cập trực tiếp `http://127.0.0.1:3001/kiem-tra-ban-nhap.html`. Trên các trang giao diện công khai không đặt nút xem bản nháp.

- Mở file `.env` trong VS Code (file này nằm ở root dự án, **không** ở `public/`).
- Sao chép **giá trị** của `DEV_PREVIEW_KEY` (không sao chép chữ `DEV_PREVIEW_KEY=`), dán vào ô mật khẩu của trang kiểm tra.
- Bấm **Đọc bản nháp từ SQL**. Trang sẽ lấy từ API được bảo vệ và hiển thị dữ liệu thật: tên thủ tục, trình tự, hồ sơ, lệ phí, kênh tiếp nhận, 7 văn bản và 8 nguồn.
- Khóa không được lưu trong localStorage hoặc đưa vào JavaScript tĩnh. API chỉ cho phép request từ localhost trong chế độ `NODE_ENV=development`.
- **Không chia sẻ khóa hoặc ảnh chụp `.env`.**

**Bước tiếp theo sau khi xác nhận Backend chạy:**

1. Mở trang chủ `/` và tải lại Ctrl+F5: phải chỉ còn giao diện gốc, không có khung "Kết nối dữ liệu Góc Dân Sinh" hay số đếm `0/0/0`.
2. Mở `/kiem-tra-he-thong.html` để xem API kết nối, 3 module, tổng danh mục và số nội dung **đã công bố**.
3. Từ đó mở `/kiem-tra-ban-nhap.html`, nhập khóa `DEV_PREVIEW_KEY` lấy từ file `.env` tại thư mục gốc của chính dự án đang chạy, bấm **Đọc bản nháp từ SQL**. Đối chiếu số bước/hồ sơ/phí/căn cứ/nguồn. Không cung cấp khóa này trong cuộc trò chuyện.
4. Nếu các con số khớp, quay lại xây dựng API xác thực và quy trình kiểm duyệt; **không** sửa trực tiếp `editorial_status` sang `published`.

## E. Phân biệt phần nào đã thật sự được triển khai

| Chức năng | Trạng thái |
|---|---|
| 6 trang giao diện, banner và điều hướng | Giữ nguyên trên tải trang, không tự chèn bảng kỹ thuật |
| Trang kiểm tra hệ thống nội bộ | Chỉ trên localhost, tách khỏi trang chủ |
| SQL Server GocDanSinh qua NestJS và ODBC 17 | Đã viết cấu hình, cần kiểm thử trên máy của bạn |
| API health, 3 module, danh mục | Đã viết kết nối tới SQL |
| Tìm kiếm dữ liệu **đã công bố** | Đã nối API, không đưa draft ra công khai |
| Kiểm tra hộ chiếu draft tại localhost với khóa dev | Đã nối API nội bộ |
| Đăng nhập / Đăng ký | Chưa có API xác thực thật; biểu mẫu được chặn gửi dữ liệu giả |
| AI hỏi đáp tự động | Chưa có mô hình AI/RAG chạy; chat chỉ tra cứu nội dung đã công bố |
| Gửi báo cáo lừa đảo / tải tài liệu | Chưa có backend upload và file cẩm nang được xác minh |

> Đây là bộ mã nguồn dành cho phát triển tại máy cá nhân, **chưa đủ để triển khai công khai trên Internet**; nội dung lệ phí 0 đồng và phạm vi mã thủ tục tỉnh/trung ương cần thẩm định pháp lý.

## F. Tự kiểm tra mã nguồn (tùy chọn)

```powershell
npm run test:static
npm run test:frontend
npm run test:integration-static
```

Không có lệnh nào của NestJS tự tạo, xóa hoặc chỉnh cấu trúc SQL. Hãy chạy SQL trong SSMS trước.
