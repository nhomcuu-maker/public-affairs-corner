# Góc Dân Sinh – bản sửa suy diễn AI & tự động nhập nguồn hiện có

## Bản sửa này làm được gì?
- Không gán tình huống lừa mất tiền nói chung vào BHXH chỉ vì bài BHXH đã công bố.
- Với câu hỏi thiếu bối cảnh, chatbot **hỏi diễn biến, kênh liên lạc, thời điểm** và đưa hướng dẫn an toàn cơ bản; không có nguồn/citation gán sai.
- Nếu nêu rõ BHXH, AI vẫn có thể truy xuất bài BHXH; nếu nêu tuyển dụng hoặc Facebook sẽ không gán nhầm nguồn BHXH.
- Nội dung cuộc trò chuyện gần đây chỉ được giữ ở **RAM trình duyệt**, tối đa 3 câu của người dùng; không lưu localStorage, không tự đưa vào DB.
- Một lệnh kiểm tra và nạp lại **các nguồn đã biết** trong dự án, chống trùng.

## Cài đặt
1. Sao lưu dự án Windows và database SQL Server.
2. Giải nén ZIP vào `D:\\trường\\Đồ án\\GocDanSinh`, cho phép ghi đè các file trùng.
3. Tắt NestJS hiện tại, mở PowerShell trong thư mục gốc và chạy:

```powershell
node tools/test-ai-intent.cjs
npm run build
npm run test:offline
node tools/bulk/upload-all-available.cjs --audit
powershell -ExecutionPolicy Bypass -File '.\tools\ai\start-gds.ps1' -Provider Ollama
```

Nạp lại tất cả nguồn địa phương có trong **manifest đã chuẩn bị** và 50 metadata Công báo (nếu có nguồn mới):

```powershell
# Chỉ chạy sau khi đã sao lưu SQL Server
node tools/bulk/upload-all-available.cjs --apply --backup-confirmed
```

## Kiểm tra hành vi
1. "Tôi bị lừa chuyển khoản 2 triệu, giờ sao?" → hỏi tình huống, chỉ dẫn ngân hàng, KHÔNG nhắc BHXH.
2. "Tôi có nói gì liên quan đến BHXH đâu?" → thừa nhận nhầm, hỏi chi tiết.
3. "Có người giả danh BHXH gọi đòi mã OTP" → có thể gợi ra nguồn BHXH đã công bố.
4. "Tôi bị lừa tuyển dụng việc nhẹ lương cao" → KHÔNG đính kèm nguồn BHXH.
5. "Qua Facebook" sau câu bị lừa → tiếp tục hỏi chi tiết thay vì tự suy đoán.

## Giới hạn minh bạch
- Không có cơ sở để nói đã **upload tất cả dữ liệu pháp luật Việt Nam**: theo audit gần đây, dự án mới có 2 chứng cứ thất nghiệp, 1 bài SCAM đã công bố, 50 metadata RSS chưa kiểm chứng và các dữ liệu mồi khác.
- `upload-all-available.cjs` chỉ nhập đúng file/nguồn đã có và đã đăng ký; không tải một kho văn bản toàn quốc từ Internet, không tự sinh bài, không tự công bố.
- Không phải fine-tune/training `llama3.2:3b`: giải pháp là **sửa ý định câu hỏi, lọc nguồn và truy xuất đúng dữ liệu (RAG)**. Chất lượng phải kiểm chứng thêm trên Windows + Ollama + SQL thật.
- Dữ liệu pháp luật chưa được kiểm chứng chỉ dùng nội bộ có đăng nhập; không tự thay đổi workflow Admin, không sửa dữ liệu nguồn trong SQL.
