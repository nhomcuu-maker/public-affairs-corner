# Dân Sinh AI – cập nhật bố cục, thư viện và hỗ trợ trường hợp khẩn cấp

## Cài đặt bản vá trên máy hiện tại

1. Sao lưu nguyên thư mục `D:\trường\Đồ án\GocDanSinh` (đặc biệt `.env`, `data/` và SQL Server).
2. Giải nén ZIP vào thư mục gốc trên, đồng ý ghi đè các tệp mã nguồn trùng tên. ZIP không có `.env`, cơ sở dữ liệu hoặc node_modules.
3. Trong PowerShell mở từ thư mục dự án, chạy lần lượt:

```powershell
npm run build
npm run test:offline
npm run dev
```

4. Trong trình duyệt bấm `Ctrl+F5` trên `/phap-luat-quyen-loi.html`, `/thu-tuc-hanh-chinh.html`, `/thu-vien.html`; thử tìm từ khóa và chọn một lĩnh vực.
5. Mở trợ lý và hỏi theo ba lượt: "nhân viên ngân hàng yêu cầu tôi cung cấp OTP" → "tôi lỡ cung cấp rồi" → "tôi không còn truy cập vào ví điện tử của tôi nữa và tôi thấy thông báo trừ hết tiền". Câu cuối phải trả hướng dẫn khóa tài khoản, tra soát giao dịch, lưu chứng cứ và trình báo ngay; không được từ chối vì thiếu căn cứ pháp luật.

## Những phần thay đổi

- `public/phap-luat-quyen-loi.html`: loại nội dung luật chỉ là ví dụ, hiển thị thư viện thật ở khu vực nội dung chính.
- `public/thu-tuc-hanh-chinh.html`: bố trí thư viện theo lĩnh vực dưới danh mục thủ tục, trước footer.
- `public/js/gds-library.js` và `public/js/gds-library.css`: chia nhóm lĩnh vực, đếm văn bản, lọc/tìm kiếm, giới hạn số kết quả mặc định và xem thêm. Mọi liên kết ngoại được giới hạn vào nguồn Công báo HTTPS và PDF trong thư mục an toàn.
- `public/css/gds-redesign.css`: giao diện responsive, hệ thống màu và khoảng cách gọn, giảm trùng lặp.
- `public/js/gds-live.js`: không trình bày trùng thư viện; nếu API tra cứu từ khóa thất bại, thử đọc danh sách nội dung đã được công bố trước khi thông báo lỗi; không rò rỉ thông báo kỹ thuật vào giao diện.
- `src/assistant/assistant.triage.ts` và `src/assistant/assistant.service.ts`: ưu tiên xử lý khẩn cấp về mất tiền/mất quyền truy cập ví điện tử, không cần SQL/RAG; giữ tối đa 3 câu hỏi gần nhất.
- `src/assistant/assistant.logic.ts`: cải thiện hướng dẫn chung khi chưa có nguồn đủ điều kiện, không tự tạo điều luật, thời hạn hoặc mức tiền.
- Bổ sung kiểm thử hồi quy tài chính khẩn cấp và giao diện.

## Dữ liệu nguồn chính thức và kiểm duyệt

Metadata/văn bản gốc từ nguồn được phép công khai dưới dạng tài liệu tra cứu ngay khi đồng bộ bằng quy trình hiện có (`npm run official:sync`). Việc lấy được tài liệu từ cổng chính thức không tự xác định rằng văn bản còn hiệu lực, điều khoản chưa sửa đổi, hoặc nội dung giải thích của AI đã được kiểm chứng. Vì vậy hệ thống KHÔNG tự đánh dấu các phiên bản `knowledge_version` đang nháp thành `published`.

Số PDF tải về được vẫn phụ thuộc chứng thư HTTPS của CDN Công báo trên máy Windows. Lỗi từng ghi nhận `UNABLE_TO_VERIFY_LEAF_SIGNATURE` phải được khắc phục bằng CA đáng tin hoặc phía máy chủ; tuyệt đối không dùng `NODE_TLS_REJECT_UNAUTHORIZED=0` để bỏ xác minh.

## Trạng thái kiểm thử

- 33/33 bộ kiểm thử ngoại tuyến: đạt.
- NestJS build/typecheck: đạt.
- Không kết nối được với SQL Server/AI provider trên máy người dùng để kiểm thử end-to-end. Không khẳng định lỗi backend khi tìm bằng từ khóa đã được sửa tận gốc; có phương án dự phòng rõ ràng.
- Chưa kiểm thử trực quan đa trình duyệt do Chromium trong môi trường dựng thử không trả ảnh chụp.
