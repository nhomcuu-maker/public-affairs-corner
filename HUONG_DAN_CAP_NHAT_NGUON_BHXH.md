# Cap nhat cong cu kiem tra PDF canh bao BHXH

## Pham vi cap nhat

Ban va nho nay chi bo sung nguon chung cu ung vien SCAM2, khong doi code frontend/backend va khong chay SQL:

- `tools/source/review-evidence.cjs`: doc ung vien PDF SCAM2 tu manifest rieng; van giu ket qua `CANDIDATE_NOT_VERIFIED`.
- `data/evidence_manual_candidates.json`: URL goc va SHA-256 cua PDF, tach biet voi bao cao HTML cu.
- `evidence/review/canh_bao_mao_danh_bhxh_2025_v2.pdf`: PDF goc ma nguoi dung da cung cap.
- `docs/HUONG_DAN_KIEM_DUYET_NGUON.md`: cap nhat huong dan duyet.

## Cai vao du an hien tai

1. Sao luu `D:\truong\Do an\GocDanSinh` (duong dan ASCII nay chi de minh hoa; duong dan thuc cua ban la D:\\truong voi dau tieng Viet).
2. Tai ZIP ban va, mo ZIP va chep cac thu muc `tools`, `data`, `evidence`, `docs` vao truc tiep thu muc goc `D:\trường\Đồ án\GocDanSinh`. Khi duoc hoi, cho phep thay file `tools\source\review-evidence.cjs` va `docs\HUONG_DAN_KIEM_DUYET_NGUON.md`.
3. Khong xoa bat ky HTML cu nao; khong chep de file `.env`, `sql` hay `package.json`.
4. Chay:

```powershell
Set-Location -LiteralPath "D:\trường\Đồ án\GocDanSinh"
node .\tools\source\review-evidence.cjs --self-test
node .\tools\source\review-evidence.cjs
```

Ket qua du kien: `candidate=3/3; verified=0; db_changed=false`.

## Dieu khong duoc suy ra tu ket qua

- SHA-256 trung khop chi xac nhan tinh toan ven, khong tu xac nhan nguon goc.
- PDF 1 trang dang anh, chua co lop van ban trich xuat; phan danh sach lien he cuoi bai co the bi thieu.
- 3/3 la ung vien tep, khong phai 3/3 chung cu duoc phe duyet.
- KHONG chay `--make-sql`, KHONG nhan chap nhan/chuyen trang thai/publish truoc khi doi chieu day du nguon va backup database.
