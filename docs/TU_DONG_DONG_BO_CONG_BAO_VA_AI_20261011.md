# Góc Dân Sinh — Bản nâng cấp tự đồng bộ Công báo và cải thiện trải nghiệm AI

## 1. Trạng thái hiện tại (không nhầm với năng lực sau khi triển khai)

Mã nguồn vẫn dùng NestJS/TypeScript, SQL Server, HTML/JS hiện có. Không xây lại ứng dụng; không thay `.env`, SQL schema hay quyền xuất bản. Bộ kiểm thử ngoại tuyến không chứng minh đồng bộ RSS, Ollama hay SQL Server tại máy người dùng đã chạy thành công.

**Vì sao chỉ có 9 PDF?** `tools/library/import-local.cjs` trước đây chỉ đọc một số thư mục `evidence/` trong mã nguồn. Đây là số tệp hiện có, không phải kích thước kho pháp luật Việt Nam. Thư viện lập trình ở VS Code không chứa dữ liệu pháp luật chính thức.

**Vì sao AI không trả lời khi ngân hàng không đăng nhập được?** Câu hỏi này là tình huống bảo vệ tài khoản. Bản vá mới thêm nhánh xử lý `otpFirstAid()` không phụ thuộc SQL/LLM. Khi mất quyền truy cập sau khi lộ OTP, chatbot hướng dẫn liên hệ ngân hàng qua kênh chính thức, ngăn giao dịch đáng ngờ, lưu chứng cứ và không yêu cầu OTP.

## 2. Nguồn dữ liệu tự động và giới hạn sử dụng

Kênh RSS được công bố tại <https://congbao.chinhphu.vn/rss.htm>, RSS văn bản: <https://congbao.chinhphu.vn/cac-van-ban-moi-ban-hanh.rss>.

Nguồn nêu RSS miễn phí cho cá nhân, tổ chức phi lợi nhuận; yêu cầu cung cấp thông tin cần thiết khi sử dụng, ghi rõ nguồn. Chủ website cần đọc, xác nhận điều kiện, và thực hiện yêu cầu về thông tin sử dụng khi áp dụng. Không dùng tài khoản, CAPTCHA, URL ngoài danh sách, hoặc gọi API không công khai.

**Dữ liệu được mở công khai tự động sau khi đồng bộ:** tiêu đề, trích yếu/mô tả, số hiệu trích xuất từ nguồn, chủ đề **phân loại gợi ý**, ngày RSS, liên kết văn bản chính thức và PDF nếu phát hiện được liên kết tải an toàn. Đây là **thư viện văn bản gốc**, KHÔNG phải bài hướng dẫn của hệ thống đã được phê duyệt hoặc xác nhận văn bản còn hiệu lực.

**Dữ liệu chưa được tự duyệt:** cập nhật hiệu lực, văn bản thay thế, phân tích điều kiện hưởng, thời hạn, số tiền, kết luận pháp lý. SQL `knowledge_version` vẫn theo workflow phê duyệt độc lập. Python RAG giữ `verified=false` và `published=false`.

## 3. Chạy đồng bộ ngay trên máy Windows

Sao lưu website. Giải nén bản vá vào đúng thư mục chứa `package.json` (không giải nén lồng thêm thư mục). Mở PowerShell trong thư mục `GocDanSinh`.

```powershell
npm run build
npm run test:offline
node tools/library/import-local.cjs
```

Sau khi đọc điều kiện RSS tại trang chính thức, bảo đảm dự án phi lợi nhuận đáp ứng và thực hiện yêu cầu nguồn:

```powershell
$env:GDS_OFFICIAL_RSS_PERMISSION_ACK = 'TERMS_REVIEWED_AND_PERMITTED'
npm run official:sync
```

Lệnh tự động: lấy RSS từ Chính phủ → đối chiếu trùng URL/digest → ghi hàng chờ nguồn → sinh `public/official-reference-catalog.json` cho website đọc ngay → cố tải có giới hạn tối đa **12 PDF** từ các liên kết tìm thấy trên trang Công báo. Nếu PDF không truy xuất được, người dân vẫn có liên kết đến nguồn chính thức, không tạo file PDF giả. Các vòng đồng bộ sau sẽ bổ sung dần, tránh tải lại tệp đã có.

**Về dung lượng:** RSS chỉ cung cấp số văn bản có trong feed và thời gian RSS; không bao phủ toàn bộ luật/thủ tục của Việt Nam. Muốn có hàng chục nghìn tài liệu lịch sử cần nguồn dữ liệu chính thức được cấp quyền/API/tập dữ liệu bulk phù hợp; không thể tự hứa số lượng.

Sau khi sync thành công, mở `http://127.0.0.1:3001/thu-vien.html` và `http://127.0.0.1:3001/phap-luat-quyen-loi.html`, nhấn Ctrl+F5. Kho bản nháp pháp luật và thủ tục đã công bố vẫn riêng biệt.

Nếu cần đưa các PDF **đã tự tải** vào vùng nghiên cứu RAG riêng (không công bố):

```powershell
.\.venv-law\Scripts\python.exe tools/law_rag/stage_official_downloads.py
```

Tệp `data/law_rag/processed/chunks.jsonl` sau đó chứa những đoạn đã trích xuất, **nhưng chưa hợp lệ để sử dụng làm nguồn tư vấn công khai** cho đến khi kiểm duyệt nguồn, thời điểm và nội dung.

## 4. Bật tự đồng bộ hằng ngày trên Windows (không cần tải tệp thủ công)

Đầu tiên đọc và đáp ứng điều kiện RSS, sau đó:

```powershell
powershell -NoProfile -File .\tools\source\install-auto-official-library-task.ps1 -AcknowledgeTerms
powershell -NoProfile -File .\tools\source\run-auto-official-library.ps1
```

Kiểm tra nhật ký tại `data\source_sync\logs\public-library-YYYYMMDD.log`. Nếu thành công, **bật** task vừa đăng ký (task được tạo ở trạng thái vô hiệu hóa để an toàn trước lần chạy đầu):

```powershell
Enable-ScheduledTask -TaskName 'GocDanSinh-PublicOfficialLibrary'
```

Mặc định chạy 08:15 mỗi ngày (giờ Windows tại máy); có thể thay bằng `-AtHour` và `-AtMinute` khi tạo task. Task chạy trong phiên người dùng đã đăng nhập; Windows, Node, kết nối mạng và RSS phải sẵn sàng. Máy tắt sẽ không tự tải tài liệu ngay thời điểm đó. Task không tự tạo hoặc xuất bản `knowledge_version`.

## 5. Hiển thị thư viện có chủ đề và nhãn rõ ràng

Các PDF có văn bản được nhận diện tiêu đề ngay trong phần đầu văn bản, tránh hiển thị độc lập chỉ số hiệu. Chẳng hạn, `117/2026/TT-BTC` có tiêu đề về miễn, giảm phí/lệ phí theo bản gốc. Bộ phân loại lĩnh vực hoạt động bằng quy tắc gợi ý trên tiêu đề; nếu không xác định thì ghi `Văn bản khác – cần phân loại`, không bịa đề mục. Mỗi mục có tên văn bản, chủ đề, nguồn, trích yếu và liên kết PDF/website.

Chỉ khi đã đồng bộ RSS thật trên máy Windows thì số lượng mục mới vượt 9. Nếu chưa đồng bộ, giao diện vẫn hiển thị 9 PDF hiện có cùng thông báo thiết lập nguồn chính thức.

## 6. Kiểm tra kết quả và giới hạn

```powershell
npm run build
npm run test:offline
node tools/test-official-public-library.cjs
node tools/library/test-library.cjs
```

Chưa chạy thử ngoài môi trường đối với RSS thật, PDF từ CDN, Task Scheduler Windows, SQL Server thực, Ollama/API thực. Chưa đảm bảo rằng PDF nguồn Chính phủ nào cũng có đường dẫn tải trong HTML. Không dùng thư viện gốc chưa kiểm tra hiệu lực để đưa ra kết luận pháp lý chắc chắn.
