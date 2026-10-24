# Góc Dân Sinh — Đồng bộ RSS Công báo lúc 08:00 mỗi ngày (Windows)

**Mục tiêu:** đồng bộ metadata của RSS Công báo Chính phủ sang hàng chờ cục bộ rồi nhập SQL Server, chỉ với trạng thái `pending_review`. Không phê duyệt, không xác nhận hiệu lực văn bản và không công bố tự động.

## Phạm vi và điều kiện

- Nguồn: `https://congbao.chinhphu.vn/cac-van-ban-moi-ban-hanh.rss`.
- Điều kiện chính thức: https://congbao.chinhphu.vn/rss.htm. RSS miễn phí cho cá nhân/tổ chức phi lợi nhuận nhưng yêu cầu người sử dụng cung cấp thông tin cần thiết; ghi rõ `congbao.chinhphu.vn` nếu phát hành lại. Đơn vị cung cấp có quyền yêu cầu ngừng sử dụng. Liên hệ công bố: `congbao@chinhphu.vn`.
- Chỉ dùng `-AcknowledgeTerms` **sau khi đã thực hiện phần cung cấp thông tin/đáp ứng yêu cầu với đơn vị cung cấp và xác nhận điều kiện sử dụng**. Cờ này chỉ lưu sự xác nhận của người vận hành, không phải giấy phép được cấp.
- Cần Windows PowerShell 5.1, Node.js, SQL Server và database `GocDanSinh` hoạt động. Hai bảng `official_feed_entry`, `official_feed_snapshot` phải được tạo trước (hiện bạn đã có).
- Task sử dụng **tài khoản Windows hiện tại**, chế độ chỉ chạy khi người dùng đã đăng nhập. Điều này phù hợp với môi trường SQL Server dùng Windows Authentication. Không chọn SYSTEM và không cần quyền Administrator thông thường.
- Windows phải chọn múi giờ `(UTC+07:00) Bangkok, Hanoi, Jakarta` với ID `SE Asia Standard Time` để 08:00 đúng giờ Việt Nam.

## 1. Cài các file

Sao lưu thư mục dự án. Giải nén ZIP vào thư mục gốc `D:\trường\Đồ án\GocDanSinh`; các file mới sẽ nằm trong `tools\source\` và `docs\`. Bản vá **không thay** các file hiện có.

## 2. Tạo task ở trạng thái tắt

Mở **Windows PowerShell 5.1** bằng đúng tài khoản Windows hiện đang kết nối được SQL Server, chạy:

```powershell
Set-Location -LiteralPath 'D:\trường\Đồ án\GocDanSinh'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\tools\source\install-scheduled-rss-task.ps1' -AcknowledgeTerms
```

Nếu script báo đã có tác vụ cùng tên, **không chạy đè ngay**; hãy kiểm tra tác vụ cũ. Nếu đã xác nhận cần thay thế mới dùng `-ReplaceExisting`.

Task sẽ tên `GocDanSinh-CongBao-RSS-0800` và **Disabled**. Installer không kết nối RSS hoặc ghi SQL.

## 3. Kiểm tra toàn bộ bằng chế độ xem trước

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\tools\source\run-scheduled-rss-sync.ps1'
```

Lệnh trên có đọc RSS thật nhưng không sửa JSON hay SQL. Kiểm tra nhật ký:

```powershell
Get-Content -LiteralPath ('.\data\source_sync\logs\rss-scheduler-{0}.log' -f (Get-Date -Format yyyy-MM-dd)) -Tail 60 -Encoding UTF8
```

Kết quả cần có: `PASS rss-collect`, `PASS sql-preview`, `SUCCESS mode=PREVIEW` và `END exit=0`.

## 4. Chạy thử một chu kỳ ghi thật

**Chỉ sau khi** đã sao lưu SQL Server và đủ điều kiện sử dụng nguồn:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\tools\source\run-scheduled-rss-sync.ps1' -Apply
```

Luồng: `rss-collect` ghi JSON/nhật ký -> `sql-preview` kiểm tra JSON không ghi database -> `sql-import` chỉ thêm snapshot `pending_review`. Nếu bước đầu thất bại, bước nhập SQL không chạy. Kiểm tra log `SUCCESS mode=APPLY`, `END exit=0`. Lặp lại một lần có thể xác nhận chống trùng: `new pending snapshots=0` nếu nguồn không đổi.

## 5. Bật tác vụ 08:00 mỗi ngày

```powershell
Enable-ScheduledTask -TaskName 'GocDanSinh-CongBao-RSS-0800'
Get-ScheduledTask -TaskName 'GocDanSinh-CongBao-RSS-0800' | Get-ScheduledTaskInfo
```

Có thể thử tác vụ ngay (thao tác này **ghi thật**, không phải xem trước):

```powershell
Start-ScheduledTask -TaskName 'GocDanSinh-CongBao-RSS-0800'
```

Sau đó xem nhật ký và `LastTaskResult`. `LastTaskResult=0` là thành công. Do dùng `-StartWhenAvailable`, khi máy tắt/ngủ tại 08:00 tác vụ có thể chạy trễ khi hệ thống và tài khoản Windows có thể chạy lại; không bảo đảm thực hiện đúng 08:00 nếu máy không sẵn sàng.

## 6. Kiểm tra trạng thái sau chạy

```powershell
Get-ScheduledTask -TaskName 'GocDanSinh-CongBao-RSS-0800' | Get-ScheduledTaskInfo
Get-Content -LiteralPath ('.\data\source_sync\logs\rss-scheduler-{0}.log' -f (Get-Date -Format yyyy-MM-dd)) -Tail 80 -Encoding UTF8
```

Mã thoát: `0` thành công, `10` lỗi điều kiện/cấu hình, `20` đang có lượt chạy khác (không chạy trùng), `30` lỗi thu thập RSS, `40` lỗi kiểm tra/nhập SQL, `50` lỗi không xác định.

**Kiểm tra riêng trong SSMS:**

```sql
USE [GocDanSinh];
SELECT COUNT(*) AS TotalEntries FROM dbo.official_feed_entry;
SELECT review_status, COUNT(*) AS SnapshotCount
FROM dbo.official_feed_snapshot
GROUP BY review_status;
```

Chỉ dữ liệu chờ kiểm duyệt. Không tự liên kết với `knowledge_version`, không tự xác minh hay công bố.

## 7. Tạm dừng hoặc gỡ lịch

```powershell
Disable-ScheduledTask -TaskName 'GocDanSinh-CongBao-RSS-0800'
# Khi cần gỡ tác vụ (không xóa dữ liệu SQL/JSON):
Unregister-ScheduledTask -TaskName 'GocDanSinh-CongBao-RSS-0800' -Confirm:$false
```

Nếu có yêu cầu ngừng sử dụng RSS từ Cổng Công báo, **tắt tác vụ ngay** và xử lý việc phân phối dữ liệu theo yêu cầu của đơn vị cung cấp.

## 8. Lưu ý kỹ thuật

- Runner thực thi các file Node.js bằng đường dẫn tuyệt đối (không phụ thuộc việc Task Scheduler có tìm được `npm` hay không).
- Có **khóa file độc quyền** `data/source_sync/rss-scheduler.lock`, tự giải phóng khi chương trình kết thúc hoặc bị hủy. File có thể còn tồn tại, không cần xóa. Task Scheduler cũng được cấu hình `IgnoreNew` để không chạy chồng hai phiên.
- Ghi nhật ký UTF-8 theo ngày tại `data/source_sync/logs/rss-scheduler-YYYY-MM-DD.log` và giữ nhật ký thu thập của dự án.
- Nếu importer thất bại giữa chừng, một phần bản ghi có thể đã nhập (mỗi bản ghi là một transaction). Cơ chế idempotent đã được kiểm tra với 50 bản ghi trước đó; có thể chạy lại sau khi khắc phục lỗi, không sửa trực tiếp bảng công khai.
- Nếu đổi người dùng Windows chạy task, đường dẫn Node.js, cấu hình DB hay múi giờ, cần kiểm thử lại; không lưu mật khẩu DB vào task/script.
- Chưa có gửi email/cảnh báo chủ động khi thất bại; theo dõi log và `LastTaskResult`. Nếu cần giám sát tự động, xây dựng thêm sau.
- Script có thể chạy bằng PowerShell 5.1; bản này chưa thể thực thi E2E Task Scheduler trong môi trường Linux của quá trình đóng gói, cần thử trên máy Windows của bạn.
