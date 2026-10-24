# Góc Dân Sinh — sửa chatbot thống nhất (11/10/2026)

## Vì sao cần sửa?

1. Các chuyên mục trước đây có chatbot HTML/JS độc lập; một số trả lời giả lập qua `setTimeout`.
2. Launcher của trang chủ và bridge chuyển người dùng sang `tro-ly-ai.html` bằng `location.assign`; câu hỏi chỉ được điền lại, không được tự gửi.
3. Trang AI độc lập lộ quá nhiều trường API kỹ thuật, mã nghiệp vụ, ngày snapshot, checklist và liên kết cross-domain không phù hợp với người dân.

## Bản cập nhật này

- Tạo `public/js/gds-chat.js` + `public/css/gds-chat.css`: chung một UI cho trang chủ, Pháp luật, Thủ tục, Cảnh báo, Biểu mẫu, Tra cứu và Bắt đầu.
- Gỡ các popup HTML chatbot cũ trong 5 trang, bỏ tham chiếu tới các bridge điều hướng/giả lập cũ.
- Trang `public/tro-ly-ai.html` trở thành giao diện chat đầy trang dùng **cùng một component**.
- Gửi POST `/api/assistant/ask` ngay trong popup, không chuyển trang hay yêu cầu nhập lại.
- Mặc định tra cứu mọi lĩnh vực (`domain=ALL`); không giới hạn bởi trang đang xem.
- Kết quả chỉ gồm: phần trả lời, lưu ý/rủi ro khi phù hợp, việc có thể làm, thông tin cần làm rõ, tối đa 3 URL nguồn **được mô hình trích dẫn**. Các trường kỹ thuật vẫn ở API nhưng **không được đưa vào màn hình công khai**.
- Nếu API chưa trả AI thật, sẽ ghi rõ "kết quả tra cứu". Không hiển thị nhãn `AI_GENERATED` hay `PROVIDER_UNAVAILABLE` cho người dân.
- Các phản hồi dùng `textContent`, URL ngoài chỉ `https://`, không lưu câu hỏi vào localStorage/sessionStorage.
- Chế độ bản nháp chỉ mở trong trang trợ lý toàn màn hình > “Tùy chọn thử nghiệm nội bộ”, với endpoint có đăng nhập/phân quyền và cảnh báo rõ nội dung chưa xác minh.
- Điều chỉnh `createSystemPrompt` để yêu cầu mô hình trả lời ngắn gọn, không lặp trường dữ liệu, `conditions` chỉ là thông tin cần làm rõ.
- Giữ nguyên toàn bộ SQL, luồng review/publish, lịch RSS và nguồn đã công bố.

## Cài đặt

1. Sao lưu thư mục dự án trước khi chép đè.
2. Dừng backend/ứng dụng cũ đang chiếm cổng 3001 (`Ctrl+C` trên cửa sổ Node, không tắt Ollama).
3. Giải nén ZIP **vào gốc** `D:\trường\Đồ án\GocDanSinh` và chọn chép đè tệp cùng tên. Không đặt thêm một thư mục lồng nhau.
4. Mở PowerShell ở gốc dự án rồi chạy:

```powershell
node tools/test-unified-chat.cjs
npm run build
npm run test:offline
powershell -ExecutionPolicy Bypass -File ".\tools\ai\start-gds.ps1" -Provider Ollama
```

5. Mở `http://127.0.0.1:3001/canh-bao-lua-dao.html`, nhấn `Ctrl+F5`, bấm **✦ Hỏi trợ lý**, nhập câu hỏi và nhấn **Gửi**. URL trang phải giữ nguyên.
6. Thử `http://127.0.0.1:3001/tro-ly-ai.html` để xem giao diện chat toàn màn hình.

## Kiểm thử đã chạy khi tạo bản vá

- `node tools/test-unified-chat.cjs`: PASS.
- `npm run build`: PASS.
- `npm run test:offline`: **25/25** nhóm PASS.
- Trình duyệt mô phỏng với API giả lập: PASS — gửi một yêu cầu, không chuyển trang, nguồn hiển thị gọn, không rò các trường kỹ thuật, đóng/mở giữ nội dung trong trang, xem được trên mobile.

**Giới hạn:** Chưa kiểm thử Ollama thật và SQL Server thật trên máy Windows của người dùng sau cập nhật. Phản hồi thực tế phụ thuộc vào tình trạng Ollama và chứng cứ có sẵn trong database. AI vẫn không dùng bản nháp để trả lời công khai khi chưa phê duyệt.

## Nếu vẫn còn lỗi

Dùng DevTools > Network > `assistant/ask`: cho biết mã HTTP và trường `status` trong response (không gửi mật khẩu, cookie, token hoặc nội dung nhạy cảm). Đảm bảo chỉ có một backend chạy cổng 3001. Nếu giao diện cũ còn xuất hiện, dùng `Ctrl+F5` hoặc trình duyệt ẩn danh.

## Hoàn tác

Khôi phục các tệp từ bản sao lưu thư mục dự án; không phải hoàn tác database vì không có SQL migration.
