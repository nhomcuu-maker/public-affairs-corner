# Góc Dân Sinh - logic nhóm cảnh báo và đọc bài BHXH

## Bài cảnh báo thuộc nhóm nào?
- Bài `GDS-MVP-SCAM-MAODANH-BHXH` thuộc nhóm chính **Giả danh cơ quan nhà nước**, nhóm phụ **Bảo hiểm xã hội (BHXH)**.
- Các dấu hiệu liên quan OTP/ngân hàng chỉ là phương thức phạm tội; không tự động chuyển bài BHXH sang danh mục **Ngân hàng, OTP, thẻ**.
- Các bài mới chưa được cấu hình nhóm cụ thể sẽ được lọc tạm bằng từ khóa trên tiêu đề/tóm tắt; cần rà soát và bổ sung mã nghiệp vụ vào `knownScamTopics` trong `public/js/gds-live.js` khi xuất bản nhiều bài hơn.

## Cách người dân mở bài BHXH
1. Mở `http://127.0.0.1:3001/canh-bao-lua-dao.html` (không dùng Live Server 5500).
2. Nhấn **Giả danh cơ quan nhà nước** -> thấy thẻ bài BHXH, có nhãn nhóm.
3. Nhấn **Xem chi tiết bài viết và nguồn** trên thẻ. Nội dung Markdown được hiển thị theo đề mục, danh sách; link chứng cứ đã xác minh xuất hiện trong mục riêng.
4. Có thể nhấn **Xem bài cảnh báo giả danh BHXH** ở khu vực bài công bố; nút này chỉ hiện khi API trả về bài công khai.
5. Có thể mở liên kết sâu: `http://127.0.0.1:3001/canh-bao-lua-dao.html?bai=GDS-MVP-SCAM-MAODANH-BHXH`.
6. Nút **XEM THÊM NHÓM THỦ ĐOẠN** chỉ mở từ 6 lên 12 nhóm, không phải nút xem bài.

## Cài đặt
Sao lưu thư mục dự án `D:\trường\Đồ án\GocDanSinh` trước. Dừng backend `npm run dev` đang chạy, giải nén toàn bộ ZIP trực tiếp vào thư mục dự án, chỉ ghi đè tệp trùng tên. Không xóa file khác, không chạy SQL mới.

Trong PowerShell:

```powershell
Set-Location -LiteralPath "D:\trường\Đồ án\GocDanSinh"
node .\tools\test-scam-categories.cjs
node .\tools\test-scam-article-flow.cjs
npm run build
npm run test:offline
npm run dev
```

Mở trang công khai cổng 3001 và nhấn `Ctrl+F5`. Kiểm thử hai đường xem: qua nhóm và qua nút xem nhanh. Câu trả lời vẫn chỉ đọc nội dung `published` từ API công khai. Nếu cần xem nguồn, API chi tiết trả về duy nhất các nguồn gắn với phiên bản đã công bố và có quyết định `accepted` còn hiệu lực.

## Phạm vi sửa
- `public/canh-bao-lua-dao.html`: chỉ dẫn và nút xem bài BHXH, không sửa phần header.
- `public/js/gds-live.js`: gán nhóm chính theo mã bài BHXH, lọc nhóm, xem chi tiết, renderer Markdown an toàn, deep link, trạng thái nguồn.
- `public/css/gds-scam-categories.css`: định dạng nhãn nhóm, nút xem và nguồn.
- `src/content/content.service.ts`: bổ sung `sources` đã xác minh trên API chi tiết; SQL read-only, có tham số.
- `tools/*.cjs`: kiểm thử hồi quy.

**Không tác động**: SQL schema, bản ghi `published` #6, người dùng, vai trò, quy trình phê duyệt, RSS hoặc lịch 08:00.

**Đã kiểm thử ở bản mã nguồn**: `npm run build` thành công, `npm run test:offline` 25/25 suite PASS. **Chưa** kiểm thử trực tiếp SQL Server trên máy Windows; cần làm các bước trên.
