# Goc Dan Sinh - sua dong bo PDF Cong bao va cai lich Windows khong can PowerShell script

## Trang thai xac nhan tu log Windows ngay 11/10/2026

- `npm run build`: thanh cong. `npm run test:offline`: 30/30 bo tai thoi diem nguoi dung gui log.
- RSS: fetched=50, new=0, unchanged=50. `new=0` nghia la da co UID trong danh sach cho, KHONG phai chi co 0 van ban.
- Public source catalog: indexed=50; downloaded=0; failed=12. Co 50 metadata va lien ket nguon, nhung chua luu duoc PDF moi.
- PowerShell `.ps1` bi policy chan (unsigned). Vi script cai task chua chay, `Enable-ScheduledTask` khong tim thay task.

## Ban va nay sua gi?

1. Nhan dien lien ket CDN dang `/api/download/stream?Url=...&file_name=....pdf` (Cong bao dung kieu link nay) thay vi chi nhan duong dan ket thuc `.pdf`.
2. Lua chon tệp PDF theo so hieu / `file_name` khi co the, tranh tai tệp khong dung van ban.
3. Khi Node.js bao `fetch failed`, in them nguyen nhan goc nhu `ENOTFOUND`, `ETIMEDOUT`, `ECONNRESET`, `CERT_HAS_EXPIRED`, `DEPTH_ZERO_SELF_SIGNED_CERT` (neu he thong cung cap). Khong in URL CDN chua token.
4. Them chuong trinh `diagnose-official-download.cjs` chi doc kiem tra DNS + tai HTML cua **mot** trang nguon (khong tai PDF).
5. Them bo cai Task Scheduler bang Node.js + runner `.cmd`, khong thay doi PowerShell ExecutionPolicy; tac vu duoc tao **disabled** cho den khi kiem tra bang tay.
6. Khong thay doi schema SQL, trang thai `knowledge_version`, hay co che duyet van ban.

## Cach cap nhat

Sao luu du an, giai nen ZIP vao thu muc `D:\\truong\\Do an\\GocDanSinh` tren may nguoi dung (duong dan thuc te co dau nhu da su dung), ghi de tep trung ten. KHONG xoa `.env` hoac SQL Server.

```powershell
cd 'D:\trường\Đồ án\GocDanSinh'
npm run build
npm run test:offline
node tools/source/diagnose-official-download.cjs
```

- Neu `DETAIL FETCH FAILED`: gui nguyen dong loi, kem `DNS` cho hai ten mien. Khong khang dinh viec download da duoc sua neu mang may nguoi dung chua truy cap duoc.
- Neu `DETAIL FETCH: OK` nhung `PDF LINKS: 0`: trang HTML tren may co the khac; can lay HTML mau (da loai bo thong tin nhay cam) de dieu chinh bo tach lien ket.
- Neu co link va mang tai duoc, sau khi **doc va dap ung dieu kien RSS** thi chay:

```powershell
$env:GDS_OFFICIAL_RSS_PERMISSION_ACK = 'TERMS_REVIEWED_AND_PERMITTED'
npm run official:sync
```

Kiem tra `indexed`, `downloaded`, `failed` o cuoi log. Dung lenh nay khong dam bao luon luon tai duoc 12 PDF: may chu nguon co the chan truy cap, timeout, redirect, hoac tra ve tệp khac PDF. Khong vuot CAPTCHA, khong tat kiem tra chung chi TLS va khong su dung URL khong ro nguon.

## Cai lich Windows, khong su dung .ps1

Sau khi chu website doc va dap ung dieu kien tai <https://congbao.chinhphu.vn/rss.htm>, ghi ro nguon va cung cap thong tin su dung theo yeu cau cua chu nguon:

```powershell
node tools/source/install-auto-official-library-task.cjs --preview
node tools/source/install-auto-official-library-task.cjs --acknowledge-terms --time 08:15
cmd /d /c .\tools\source\run-auto-official-library.cmd
Get-Content .\data\source_sync\logs\official-library-latest.log -Tail 40
```

Neu chay tay hoan thanh va chap nhan ket qua, bat lich:

```powershell
schtasks /Change /TN "GocDanSinh-PublicOfficialLibrary" /ENABLE
schtasks /Query /TN "GocDanSinh-PublicOfficialLibrary" /V /FO LIST
```

Neu task cu da ton tai, xem lai truoc khi su dung `--replace`. Neu bi `Access is denied`, xem quyen Windows Task Scheduler; khong vo hieu hoa co che bao mat may.

Task su dung tai khoan Windows cua nguoi cai dat, khong luu password, phu thuoc ket noi mang/may dang bat va quy dinh Task Scheduler. Log duoc ghi vao `data/source_sync/logs/official-library-latest.log`. Chi mo thu muc lock `data/source_sync/official-auto-task.lock` de kiem tra; khong xoa neu tac vu van dang chay.

## Quan trong

RSS co 50 muc metadata khong dong nghia 50 PDF da tai. Tuong tu, van ban nguon chinh thuc khong dong nghia moi noi dung con hieu luc. PDF thu thap duoc de nghien cuu se o trang thai cho xac minh; AI khong duoc tu tao ket luan phap ly chua kiem tra.

Kiem thu bo sung duoc chay ngoai tuyen. Chua co bang chung ket noi va download PDF thanh cong tu moi truong Windows cua nguoi dung.
