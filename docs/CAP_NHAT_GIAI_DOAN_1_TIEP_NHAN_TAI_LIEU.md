# Dân Sinh AI — Cập nhật giai đoạn 1: tiếp nhận tài liệu có kiểm soát

## Kết luận kiểm tra thực tế

- Mã nguồn hiện tại dùng **NestJS 11 / TypeScript / SQL Server**, không phải Next.js. Website là HTML/CSS/JS. Không đổi framework.
- Đã có phân quyền, kiểm duyệt, tìm kiếm nội dung có trạng thái công bố, trợ lý AI dùng API/Ollama, công cụ RSS Công báo chỉ tiếp nhận metadata vào vùng chờ, và pipeline CLI RAG Python riêng.
- Phần RAG ChromaDB chạy từ terminal **chưa kết nối với** `/api/assistant/ask`. Kết quả kiểm thử ngoại tuyến không chứng minh nội dung nguồn pháp luật đã được xác minh hoặc server SQL có thể kết nối.

## Sửa lỗi an toàn SQL

Tệp `sql/Nguon_CongBao_Hang_Cho_KiemDuyet.sql` trước đây đặt `@Apply = 1`, tức mở SSMS và chạy có thể tự tạo bảng. Đã sửa mặc định thành `@Apply = 0` (xem trước và `ROLLBACK`). Nếu thực sự cần tạo bảng mới trong SQL Server, quản trị viên **phải sao lưu CSDL**, kiểm tra đúng database và chủ động đổi thành `1` trước khi chạy. Không động chạm dữ liệu Công báo hiện có.

## Nạp tài liệu PDF / DOCX / TXT / HTML / JSON / JSONL / CSV

Chức năng `import-local` **nối trực tiếp vào** `tools/law_rag/pipeline.py` sẵn có, không tạo thêm website hay database. Để kiểm soát nguồn và bảo vệ dữ liệu, quản trị viên chủ động đặt tệp vào một thư mục staging riêng. Bước này là **CLI**, chưa có nút upload web.

1. Tạo một thư mục staging, ví dụ `D:\TaiLieuChoDuyet`.
2. Đặt các tệp cần nhập vào đúng thư mục đó, không dùng đường dẫn con.
3. Cùng thư mục, tạo `manifest.csv` với **ít nhất** các cột: `filename,title,domain,topic`. Có thể thêm `source_url,doc_number,effective_from`. Ví dụ:

   ```csv
   filename,title,domain,topic,source_url,doc_number,effective_from
   van-ban-1.pdf,Tài liệu cần kiểm duyệt về thủ tục,ADMIN,cu-tru,,,
   canh-bao.html,Thông báo cần rà soát về thủ đoạn lừa đảo,SCAM,gia-mao,,,
   ```

   Các tên tệp trong ví dụ là **tệp minh họa**, không phải nguồn pháp luật thật. `source_url` nếu cung cấp phải là HTTPS từ cổng trong allowlist của pipeline. Để trống nếu chưa đối chiếu nguồn. Không bịa ngày hiệu lực.

4. Cài Python 3.10+, sau đó ở thư mục `GocDanSinh` dùng **một môi trường Python thống nhất** (PowerShell):

   ```powershell
   py -3 -m venv .venv-law
   .\.venv-law\Scripts\python.exe -m pip install -r tools/law_rag/requirements.txt
   .\.venv-law\Scripts\python.exe tools/law_rag/test_import_local.py
   .\.venv-law\Scripts\python.exe tools/law_rag/pipeline.py import-local --input-dir "D:\TaiLieuChoDuyet"
   .\.venv-law\Scripts\python.exe tools/law_rag/pipeline.py process
   ```

   Nếu `.venv-law` đã tồn tại, **không cần xóa hoặc tạo lại**: bỏ qua lệnh `py -3 -m venv` và chạy các lệnh dùng `.venv-law\Scripts\python.exe` tiếp theo. `py -3` trỏ tới Python hệ thống, không tự động sử dụng `.venv-law`, nên dễ gây lỗi `ModuleNotFoundError`. Bộ kiểm thử Node.js không nên quét các gói thư viện trong `.venv-law`.

5. Kết quả được lưu **ngoài `public/`** tại `data/law_rag/raw/`, `data/law_rag/text/`, `data/law_rag/processed/documents.jsonl` và `chunks.jsonl`. Dữ liệu đã xử lý có `verified:false`, `published:false`, `intake_status:pending_review`. PDF thiếu lớp văn bản sẽ ghi `requires_ocr`, không tự tạo chunk cho PDF đó. Phải sử dụng quy trình OCR tiếng Việt và kiểm duyệt riêng.

**Không dùng bước này để công bố pháp luật.** Tệp nguồn chỉ được quản trị viên rà soát trước khi đưa qua quy trình nguồn, snapshot, người duyệt độc lập, kiểm tra hiệu lực và trạng thái xuất bản SQL. Đừng sửa trường `verified` thành true bằng tay.

## Kiểm thử đã thực hiện

- `node node_modules/@nestjs/cli/bin/nest.js build`: biên dịch backend thành công trên bản thư viện đi kèm kho mã nguồn.
- `npm run test:offline`: 27/27 bộ kiểm thử ngoại tuyến đạt.
- `python tools/law_rag/test_import_local.py`: kiểm tra import, dedup, bảo vệ đường dẫn, source URL, HTML script, PDF không có text; đều đạt.
- Chưa chạy E2E với SQL Server thật, chưa chạy Ollama/API thật, chưa xác minh cập nhật luật mới tại nguồn chính thức.

## Công việc tiếp theo trước khi công bố

- Nối dữ liệu đã **được thẩm định** từ SQL vào pipeline chunk/index theo phiên bản văn bản, thời điểm áp dụng và phạm vi địa phương; tuyệt đối không để nháp ChromaDB thành căn cứ công khai.
- Hoàn thiện bảng truy xuất và dẫn nguồn gắn với **đúng** snapshot/phiên bản; lọc theo thời gian và trạng thái chấp nhận nguồn.
- Xây dựng trang upload và hàng chờ duyệt cho quản trị viên, bảo vệ quyền và giới hạn tệp ở API; hiện chưa có nút này.
- Chạy thử SQL Server, phân vai tài khoản thật, backup/restore, provider AI và bộ câu hỏi nghiệp vụ có đáp án được người phụ trách kiểm tra.

## Cách áp dụng bản cập nhật này vào dự án Windows cũ

Dừng website và sao lưu thư mục + SQL Server. File ZIP bản bàn giao có **các đường dẫn tương đối tính từ thư mục `GocDanSinh`**, vì vậy giải nén vào đúng thư mục này; chọn ghi đè các tệp mã nguồn khi được hỏi. **Không thay `.env`, `node_modules`, dữ liệu cá nhân hoặc CSDL đang sử dụng.** Chạy `npm ci` trên máy Windows nếu thiếu dependency, sau đó `npm run build` và `npm run test:offline`.
