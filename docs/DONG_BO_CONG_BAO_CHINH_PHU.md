# Đồng bộ RSS Công báo Chính phủ – hàng chờ kiểm duyệt

## Trạng thái
- Đã lập trình bộ nhận RSS *Văn bản mới đăng* của Công báo Chính phủ: `https://congbao.chinhphu.vn/cac-van-ban-moi-ban-hanh.rss`.
- Chỉ thu thập metadata (tiêu đề, link, ngày đăng, mô tả ngắn), không tải lại toàn bộ văn bản pháp luật.
- Chống trùng theo SHA-256 của URL, phát hiện thay đổi metadata theo SHA-256 của các trường dữ liệu.
- Chỉ chấp nhận liên kết chính tên miền `congbao.chinhphu.vn`, nâng cấp liên kết HTTP trong RSS thành HTTPS.
- Dữ liệu thu thập **luôn `PENDING_REVIEW`**, không tự động đưa vào `source_verification`, `knowledge_version_source` hoặc trạng thái `published`.
- Chưa kiểm thử được kết nối tới RSS thật trong môi trường biên soạn này; cần chạy trên Windows có Internet.

## Điều kiện nguồn – đọc trước khi bật
Trang chính thức `https://congbao.chinhphu.vn/rss.htm` ghi rõ RSS được cung cấp miễn phí cho cá nhân và tổ chức phi lợi nhuận; yêu cầu người sử dụng cung cấp thông tin cần thiết và ghi rõ nguồn khi phát hành lại. Nếu website hoạt động thương mại hoặc định dùng dữ liệu ngoài các điều kiện cho phép, hãy liên hệ bên cung cấp để xin phép trước. Việc mở trang công khai không đồng nghĩa cấp phép thu thập, sao chép hoặc phân phối lại vô điều kiện.

## Trên máy Windows: kiểm thử KHÔNG truy cập Internet
Đứng tại `D:\\trường\\Đồ án\\GocDanSinh`:

```powershell
npm run test:source-sync
```

## Kết nối RSS thật (chỉ sau khi đã xác nhận điều kiện sử dụng)
PowerShell, tại thư mục dự án:

```powershell
$env:GDS_OFFICIAL_RSS_PERMISSION_ACK = 'TERMS_REVIEWED_AND_PERMITTED'
npm run source:rss-preview
```

Lệnh trên chỉ tải RSS về bộ nhớ, hiển thị thống kê, **không lưu**. Nếu thành công và nguồn phù hợp, thực hiện:

```powershell
npm run source:rss-collect
```

Lệnh này lưu tệp metadata chờ duyệt ở `data/source_sync/congbao-pending.json` cùng nhật ký ở `data/source_sync/congbao-run-log.jsonl`. Không ghi SQL. Nếu chạy lại, các mục đã có sẽ không nhân đôi.

## Tùy chọn đồng bộ metadata vào SQL Server
Sao lưu database rồi chạy trong SSMS: `sql/Nguon_CongBao_Hang_Cho_KiemDuyet.sql` ở chế độ `@Apply=0` trước (transaction ROLLBACK). Kiểm tra, sau đó đổi `@Apply=1` và chạy lại. Việc này chỉ tạo hai bảng `official_feed_entry` và `official_feed_snapshot` dành cho dữ liệu **đang chờ**.

Kiểm tra bản ghi chờ nhập SQL mà không truy cập SQL Server:

```powershell
npm run source:rss-db-preview
```

Khi thực sự cần ghi metadata vào các bảng hàng chờ mới:

```powershell
$env:GDS_OFFICIAL_RSS_DB_IMPORT = 'PENDING_ONLY_CONFIRMED'
npm run source:rss-db-import
```

Dữ liệu mới không tự biến thành chứng cứ đã xác nhận; phải có người kiểm duyệt độc lập và liên kết snapshot chính thức theo quy trình hiện có. Không chạy các lệnh nhập nguồn này trong `public/` hay tải các file hàng chờ lên web.

## Lên lịch trong Windows (sau khi được phép)
Sử dụng Task Scheduler đặt lịch kiểm tra hợp lý, ví dụ **mỗi ngày một lần**. Mỗi lượt chạy `source:rss-collect`, xem nhật ký và chỉ nhập SQL sau khi xử lý sự cố kiểm tra. Không dùng polling liên tục, không vượt biện pháp chống truy cập của nguồn. Chưa có tác vụ Windows nào được tạo tự động.

## Điều cần kiểm thử trên máy bạn
1. RSS thực sự trả về XML hợp lệ và các link nằm trong tên miền cho phép.
2. Lần đầu trả số lượng `new` lớn hơn 0, lần tiếp theo `new=0` nếu RSS chưa đổi.
3. Tệp JSON và SQL pending không làm nội dung `draft` trở thành `published`.
4. Sao lưu/khôi phục thành công; thông báo khi gặp HTTP 403, 429, 500 hay timeout.
