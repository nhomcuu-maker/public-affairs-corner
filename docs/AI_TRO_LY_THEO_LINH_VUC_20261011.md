# Góc Dân Sinh – Trợ lý AI theo lĩnh vực (bản sửa 11/10/2026)

## Những gì bản vá thực sự làm

- Sửa lỗi mock `unknown ./assistant.triage` khiến script khởi động bị dừng.
- Thực hiện phân loại phạm vi ở backend: pháp luật, thủ tục hành chính, quyền lợi/an sinh, phòng tránh và xử lý lừa đảo. Câu rõ ràng ngoài phạm vi, ví dụ nấu bún cá, được từ chối; câu không rõ được hỏi lại.
- Bỏ nhánh `không có nguồn = không gọi mô hình`. AI Ollama vẫn được gọi khi câu hỏi đúng lĩnh vực nhưng chưa có bài công bố, để cung cấp hướng dẫn chung, không được bịa điều luật/thời hạn/tỷ lệ.
- Có nguồn phù hợp: vẫn yêu cầu trích mã nguồn thật. Không có nguồn: bắt buộc `citationIds: []`, giao diện đánh dấu là hướng dẫn chung chưa có nguồn kiểm chứng.
- Giữ câu hỏi nối tiếp trong bộ nhớ tạm của giao diện, không tự gán BHXH vào mọi trường hợp lừa đảo, bảo vệ thông tin cá nhân.
- Không tự duyệt, sửa, công bố dữ liệu SQL. Không tải hay fine-tune lại trọng số mô hình `llama3.2:3b`.

## Tại sao không fine-tune từ đầu

Llama 3.2 đã được huấn luyện trước. Fine-tuning với một bài BHXH + hai bản nháp không thể đảm bảo trả lời mọi vấn đề pháp luật Việt Nam. Bản vá này thay đổi kiến trúc điều phối, phạm vi câu hỏi, hướng dẫn mô hình và chính sách nguồn. Để đáp ứng các quy định cụ thể theo thời gian, cần một kho văn bản đủ rộng, được cập nhật và đối chiếu định kỳ (RAG), và đánh giá bằng bộ câu hỏi thực tế.

## Triển khai trên Windows

1. Dừng CMD/NestJS đang chạy cổng 3001. Sao lưu dự án; giải nén ZIP này vào `D:\trường\Đồ án\GocDanSinh`, ghi đè đúng tệp.
2. Chạy PowerShell:

```powershell
Set-Location -LiteralPath "D:\trường\Đồ án\GocDanSinh"
node tools/ai/test-local-provider-mock.cjs
node tools/test-domain-assistant.cjs
npm run build
npm run test:offline
powershell -ExecutionPolicy Bypass -File ".\tools\ai\start-gds.ps1" -Provider Ollama
```

3. Mở `http://127.0.0.1:3001/tro-ly-ai.html`, nhấn Ctrl+F5, thử các câu bên dưới.

## Bộ hỏi thử qua giao diện

| Câu hỏi | Kỳ vọng |
|---|---|
| Tôi bị lừa chuyển khoản 2 triệu | Hỏi diễn biến, hướng dẫn ngân hàng và giữ chứng cứ; không nhắc BHXH |
| Qua Facebook (sau câu trên) | Hỏi tiếp các chi tiết còn thiếu; không gán thủ đoạn không có căn cứ |
| Thủ tục làm hộ chiếu như thế nào? | AI đưa hướng dẫn chung khi chưa có nguồn đã duyệt; không khẳng định thời hạn hay mức phí chưa xác minh |
| Tôi nghỉ việc có thể tìm hiểu trợ cấp thất nghiệp ở đâu? | AI trả lời đúng câu hỏi, không sao chép nguyên văn nội dung BHXH |
| Cách nấu bún cá ngon? | Từ chối lịch sự vì ngoài phạm vi |

Nếu `AI END TO END` không PASS, gửi log cụ thể. `OLLAMA LIVE MODEL: PASS` mới chứng minh mô hình chạy riêng, chưa chứng minh đã nối với website.

## Phạm vi dữ liệu

Theo log audit gần nhất: #2 ADMIN và #3 LEGAL ở bản nháp, #6 SCAM đã công bố; 50 feed metadata chưa duyệt. Những bản này đã nhập trước đây, không cần chạy `--apply` lần nữa để bật AI. Nguồn chưa duyệt không tự đưa vào công khai. Hướng dẫn chung không thay thế văn bản mới nhất hoặc cơ quan có thẩm quyền.
