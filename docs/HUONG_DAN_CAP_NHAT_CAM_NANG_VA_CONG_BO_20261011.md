# Bản sửa cẩm nang, hiện trạng công bố và lỗi cổng 3001

## Tệp thay đổi

- `public/canh-bao-lua-dao.html`: thay nút tải giả bằng liên kết PDF thật; bổ sung sáu hướng dẫn an toàn theo tình huống, không gắn nhãn bài cảnh báo chính thức.
- `public/css/gds-scam-categories.css`: bổ sung giao diện responsive cho cẩm nang.
- `public/js/gds-live.js`: bỏ nhánh vô hiệu hóa tải cẩm nang.
- `public/downloads/cam-nang-phong-chong-lua-dao.pdf`: cẩm nang 3 trang bằng tiếng Việt.
- `tools/handbook/build-scam-handbook.py`: mã nguồn tạo lại PDF, cần `reportlab` và phông Unicode cài đặt tại máy, **không kèm tệp font**.
- `tools/test-scam-handbook.cjs`, `tools/run-offline-tests.cjs`: kiểm thử chức năng tải.

## Vì sao chỉ có một bài cảnh báo được công bố?

Theo kết quả SQL Server do người vận hành gửi, tại thời điểm kiểm tra có **1 bản SCAM** với trạng thái `published` hợp lệ, **1 bản SCAM** `approved` chưa xuất bản, **2 bản ADMIN** `draft` và **1 bản LEGAL** `draft`.

Việc có danh mục hoặc file PDF trong thư viện không tạo ra `knowledge_version` đã được duyệt. Văn bản gốc do nguồn Công báo cung cấp có thể xuất hiện trong thư viện trích dẫn nguồn; *không đồng nghĩa* nội dung được xác minh hiệu lực hay một bài diễn giải đã qua kiểm duyệt.

**Để xuất bản thêm bài cảnh báo SCAM:** truy cập `admin.html` bằng tài khoản được phân quyền, mở bản `approved` và hoàn tất thao tác xuất bản theo quy trình hiện hữu bởi nhân sự độc lập, sau khi xác nhận dữ liệu/nguồn và ngày hiệu lực; không sửa thủ công cột `editorial_status`. Sau đó gọi `/api/content?domain=SCAM` và kiểm tra bản mới có được trả về.

**Để thêm lĩnh vực khác:** nhập tài liệu đúng chủ đề vào kho, tạo/biên tập `knowledge_item` + `knowledge_version` đúng mô hình, liên kết snapshot nguồn, kiểm chứng và phê duyệt độc lập rồi xuất bản. Không công bố hàng loạt `draft` bằng SQL tự động.

## Lỗi `EADDRINUSE` - rất quan trọng

Dấu hiệu `listen EADDRINUSE: address already in use 127.0.0.1:3001` nghĩa là cổng 3001 có một chương trình khác đang giữ. Bản NestJS đang khởi động **không trở thành server mới**; trình duyệt có thể truy cập server cũ.

Chạy PowerShell (không cần thay chính sách script):

```powershell
$owners = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
$owners | Select-Object LocalAddress, LocalPort, OwningProcess
$owners | ForEach-Object { Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)" | Select-Object ProcessId, Name, CommandLine }
```

Chỉ khi xác nhận PID thuộc **Nest/Node server dự án cũ**, dừng PID đó (thay `12345` bằng PID thực):

```powershell
Stop-Process -Id 12345
npm run dev
```

Nếu server đang chạy tại một cửa sổ PowerShell khác, ưu tiên **Ctrl+C ở cửa sổ đó** thay vì `Stop-Process`.

Sau đó nhấn `Ctrl+F5` trong trình duyệt và mở `http://127.0.0.1:3001/downloads/cam-nang-phong-chong-lua-dao.pdf` để xác nhận PDF thật. Nếu cổng vẫn bị chiếm, tuyệt đối không dừng PID chưa xác định rõ.

## Kiểm thử sau khi giải nén vào gốc `GocDanSinh`

```powershell
npm run build
npm run test:offline
node tools/test-scam-handbook.cjs
```

Mong đợi 34/34 nhóm kiểm thử ngoại tuyến đạt. Bản vá **không** đổi SQL, `.env`, trạng thái phê duyệt, logic xuất bản hoặc dữ liệu người dùng. Kết quả kiểm thử không thay thế kiểm thử API/SQL trực tiếp trên máy vận hành.
