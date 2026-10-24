# Sua loi INSERT batch evidence vao source_snapshot

## Loi da xac nhan

Trong `tools/bulk/stage-all-existing.cjs` ban truoc:

- `INSERT dbo.source_snapshot` khai bao 6 cot: source_id, captured_at, content_sha256, file_asset_id, captured_url, capture_method.
- `VALUES(...)` chi co 5 gia tri, thieu `@asset` ung voi `file_asset_id`.
- SQL Server tu choi bang thong bao "There are more columns in the INSERT statement than values specified in the VALUES clause".

Ban va nay chi sua cau INSERT thanh:

```sql
INSERT dbo.source_snapshot(source_id,captured_at,content_sha256,file_asset_id,captured_url,capture_method)
VALUES(@source,SYSUTCDATETIME(),@hash,@asset,@url,N'manual');
```

Va bo sung test hoi quy dem du 6 cot/6 gia tri. Khong doi schema SQL, metadata nguon, chu ky kiem duyet hay RSS.

## Cai va kiem tra tren Windows

1. Sao luu du an va database GocDanSinh. Giai nen ZIP vao `D:\truong\Do an\GocDanSinh` (thu muc that co dau la `D:\trường\Đồ án\GocDanSinh`), ghi de file trong `tools/bulk`.
2. Mo PowerShell tai root:

```powershell
Set-Location -LiteralPath 'D:\trường\Đồ án\GocDanSinh'
node tools/bulk/test-bulk-stage.cjs
node tools/bulk/stage-all-existing.cjs --audit
node tools/bulk/stage-all-existing.cjs --preview
```

3. Doi chieu audit. Co the con cac ban ghi tu cac lan nap truoc, khong xoa/chinh truc tiep.
4. Khi da sao luu va audit hop ly:

```powershell
$env:GDS_BULK_STAGE_ACK = 'PENDING_ONLY_CONFIRMED'
node tools/bulk/stage-all-existing.cjs --apply
node tools/bulk/stage-all-existing.cjs --audit
```

5. Khong chay lai `--apply` neu van gap loi; gui toan bo output va audit de doi chieu.

## Ghi chu

`--apply` dung transaction cho chung cu noi bo. Loi SQL trong transaction se rollback phan nay; nhung chi audit tren database that moi cho biet tinh trang cua cac lan nhap truoc. RSS importer chay *sau* transaction nay, va co cac transaction rieng.

`HASH_OK` chi chung minh tep tren may khop manifest, khong co nghia nguon da duoc xac minh. Tai lieu moi van cho kiem duyet, khong tu dong cong bo.
