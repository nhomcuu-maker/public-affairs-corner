# Goc Dan Sinh - sua cau truc trang Canh bao lua dao

## Muc dich
- Nut "XEM THEM NHOM THU DOAN" chi mo 6 nhom tiep theo (tong cong 12). No khong goi API va khong chen bai BHXH thanh nhom.
- Bam mot nhom se loc cac bai SCAM DA CONG BO tu API `/api/content?domain=SCAM`, dua tren tieu de/tom tat va tu khoa gan voi nhom; KHONG phan loai phap ly tu dong.
- "CANH BAO DA DUOC CONG BO" la khu vuc rieng. Bai BHXH #6 se nam tai day neu API van cho phep hien thi. Ban nhap va metadata RSS khong duoc hien thi.
- O tim kiem trong trang tra ve cac bai da cong bo; khong tu dong chuyen sang tro ly AI. Nut tro ly rieng van hoat dong.

## Cai dat
1. Sao luu cac tep hien co: `public/canh-bao-lua-dao.html`, `public/js/gds-live.js`, `public/js/gds-ai-report-bridge.js`, `tools/ui-smoke-test.cjs`, `tools/run-offline-tests.cjs`.
2. Giai nen vao thu muc goc `D:\truong\Do an\GocDanSinh` (dung duong dan thuc te tren may, vi du `D:\trường\Đồ án\GocDanSinh`). Ghi de dung cac tep cung duong dan.
3. Chay `node tools/test-scam-categories.cjs`, `npm run test:offline`, `npm run build`.
4. Mo `http://127.0.0.1:3001/canh-bao-lua-dao.html`, nhan Ctrl+F5 de tai lai CSS/JS.

## Nghiem thu giao dien
- Lan dau hien 6 nhom; "XEM THEM" mo thanh 12 va doi chu thanh "THU GON".
- Nut "XEM THEM" khong thay doi danh sach bai da cong bo va khong goi API.
- Nhom "Gia danh co quan nha nuoc" hien thi bai canh bao BHXH neu bai nay con cong khai.
- Nhom chua co bai tra ve thong bao "Chua co bai canh bao da cong bo thuoc nhom nay".
- "Xem tat ca bai da cong bo" tra lai tat ca bai SCAM published.
- O tim kiem su dung API công khai, khong chuyen trang sang tro ly AI.

## Gioi han
Bo loc nhom dua vao tu khoa trong tieu de va tom tat cua noi dung published. Day la phan loai tham khao, khong phai danh gia chuyen mon hay bang chung. Chua thay doi backend, database, quyen nguoi dung, lich RSS, va khong tu dong cong bo.
