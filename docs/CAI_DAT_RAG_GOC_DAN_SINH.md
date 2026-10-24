# Nâng cấp thu thập tài liệu và RAG bên trong Góc Dân Sinh

Bản này tích hợp với dự án NestJS sẵn có; **không tạo website thứ hai**. Thao tác `collect` chỉ truy cập URL HTTPS thuộc các cổng nguồn cho phép, do quản trị viên ghi trong `data/law_rag/seeds.csv`. Đối tượng seed phải là **URL của tài liệu cụ thể** được kiểm tra thủ công trước, không phải trang chủ hay trang tìm kiếm. Nhiều website dùng JavaScript, giới hạn truy cập hoặc chặn tự động; các URL đó sẽ báo lỗi, không lách hạn chế.

## Cài đặt Windows PowerShell

Tại thư mục `D:\\trường\\Đồ án\\GocDanSinh`:

```powershell
py -3 -m venv .venv-law
.\\.venv-law\\Scripts\\python.exe -m pip install -r tools/law_rag/requirements.txt
```

Điền file `data/law_rag/seeds.csv` với cột `url,domain,topic,title,doc_number,effective_from`. Ví dụ không chứa URL đoán trước; lấy đường dẫn thực tế tại vbpl.vn/vanban.chinhphu.vn hoặc cổng dịch vụ công. Mỗi văn bản có tiêu đề tiếng Việt dễ hiểu, `domain` là `LEGAL` hoặc `ADMIN`, `topic` phải nằm trong danh mục web.

```powershell
.\\.venv-law\\Scripts\\python.exe tools/law_rag/pipeline.py collect
.\\.venv-law\\Scripts\\python.exe tools/law_rag/pipeline.py process
node tools/catalog/sync-official.cjs
```

Bước cuối nhập metadata tài liệu vào `public/category-index.json`, hiện ngay trong `kho-van-ban.html` theo đúng `domain/topic`. Nó **không** tạo phiên bản `published` giả trong SQL, không làm thay đổi `knowledge_version`.

Nếu muốn bật tìm kiếm ngữ nghĩa trong terminal:

```powershell
.\\.venv-law\\Scripts\\python.exe -m pip install -r tools/law_rag/requirements-rag.txt
.\\.venv-law\\Scripts\\python.exe tools/law_rag/pipeline.py index
.\\.venv-law\\Scripts\\python.exe tools/law_rag/search.py "Điều kiện hưởng trợ cấp thất nghiệp?" --domain LEGAL
```

Trích xuất PDF scan cần OCR tiếng Việt và kiểm định chất lượng riêng. Mục `verified:false` có chủ đích. Đừng hiển thị tài liệu chưa duyệt như thông tin luật chính thức có hiệu lực.

## Phạm vi chưa hoàn thành

- Chưa có crawler phân trang/toàn quốc; không thể cam kết 20 văn bản mỗi chủ đề bằng dữ liệu không có thật.
- Chưa nối ChromaDB vào NestJS `/api/assistant/ask`: đó là thay đổi backend cần thiết kế quyền truy cập, lọc hiệu lực, ranking và dẫn nguồn. Hiện tại đây là pipeline ingest + index + bộ tìm kiếm RAG CLI; Ollama trên website tiếp tục dùng backend hiện tại.
- Danh mục tài liệu website cập nhật từ các nguồn đã ghi trong `seeds.csv`; nguồn trực tuyến cần có quyền truy cập hợp lệ. Không vượt CAPTCHA, giới hạn hoặc robots.
