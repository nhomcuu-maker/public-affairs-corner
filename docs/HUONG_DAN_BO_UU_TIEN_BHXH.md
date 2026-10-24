# Goc Dan Sinh - bo uu tien bai test BHXH trong trang Canh bao lua dao

## Pham vi

Ban va nay dung cho du an dang chay tai `D:\truong\Do an\GocDanSinh` (duong dan thuc te co dau tieng Viet tren Windows).

- Bo nut rieng "Xem bai canh bao gia danh BHXH" va huong dan rieng ve BHXH.
- Chi giu mot danh sach "Canh bao da duoc cong bo"; bai nao da cong bo thi xuat hien nhu nhau.
- "XEM THEM NHOM THU DOAN" chi mo rong danh muc, khong tai rieng bat ky bai nao.
- Nhom chinh lay tu `dbo.item_category` + `dbo.category`, hien thi qua hai truong API `primaryCategoryCode` va `primaryCategoryName`.
- Khong con hard-code ma nghiep vu `GDS-MVP-SCAM-MAODANH-BHXH`, khong chon nhom bang cach doan tu khoa tieu de/tom tat.
- "Xem chi tiet" va lien ket chia se `?bai=<businessCode>` ap dung chung cho moi bai da cong bo.
- Khong sua SQL schema, RSS, tai khoan, ban ghi da cong bo, hay quy trinh kiem duyet.

## Cach cai

1. Sao luu thu muc du an va database neu co quy trinh sao luu dinh ky; khong xoa file goc.
2. Dung phien `npm run dev` cu (Ctrl+C). Giai nen ZIP vao thu muc GocDanSinh hien co (ghi de chinh xac cac tep trong ZIP).
3. Trong PowerShell tai thu muc du an:

```powershell
node tools/test-scam-categories.cjs
node tools/test-scam-article-flow.cjs
npm run build
npm run test:offline
npm run dev
```

4. Mo `http://127.0.0.1:3001/canh-bao-lua-dao.html`, nhan Ctrl+F5.
5. Ky vong: chi mot nut "Xem tat ca bai da cong bo" o khu vuc gioi thieu; BHXH la mot bai binh thuong trong danh sach. Chon nhom "Gia danh co quan, to chuc" de loc; nhan bai de xem chi tiet.

## Ve danh muc

CSDL hien tai co danh muc chinh `GIA_DANH`, `LINK_GIA`, `TUYEN_DUNG`. Frontend hien thi nhom thu doan va map cac ma nay, khong phan loai theo tu khoa. Neu them ma danh muc moi trong CSDL, can cap nhat bang map nhom hien thi (`categoryToGroup`) hoac bo sung danh muc tren giao dien. Mot bai khong co danh muc chinh van hien thi trong "Xem tat ca" voi nhan "Chua phan loai"; khong duoc tu y suy doan.

## Kiem thu

Da kiem tra offline: `npm run build` PASS; `npm run test:offline` 25/25 PASS, trong do co bai test gia lap bai thuoc nhom Gia danh va bai thuoc nhom Tuyen dung. Chua thuc thi voi SQL Server that tren may Windows nguoi dung.
