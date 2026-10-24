# Chay AI va dong bo du lieu cho khong can tham tac tung bai

Phien ban patch ngay 11/10/2026. Thiet ke tren NestJS + SQL Server + giao dien goc `/tro-ly-ai.html`.

## Kiem tra hien trang

- `/api/assistant/ask` da co tu truoc, nhung neu `AI_API_KEY` hoac `AI_MODEL` chua duoc cau hinh, API chi tra `RETRIEVAL_ONLY`.
- Cong khai CHI lay bai `published` va nguon `accepted` con hieu luc. Hien tai chi co BHXH #6. Chua du thong tin de AI tra loi tat ca linh vuc.
- Staff noi bo dung token dang nhap cua Editor/Reviewer/Admin va tim cac snapshot da lien ket voi version, ke ca `pending_review`. Nhan `CHUA XAC MINH` duoc gan ro rang; khong tu dong dua len cong khai.
- Kich hoat AI va staging KHONG tu phe duyet; khong thay doi trigger/quy tac phan quyen trong SQL.

## Cach 1: local Ollama, khong can API key, mac dinh

Cai Ollama tren Windows https://ollama.com/download/windows (chi cai mot lan).

Dung PowerShell trong thu muc du an:

```powershell
Set-Location -LiteralPath 'D:\trường\Đồ án\GocDanSinh'
Set-ExecutionPolicy -Scope Process Bypass -Force
.\tools\ai\start-gds.ps1 -Provider Ollama -PullModel
```

Chuong trinh se tai `llama3.2:3b` neu chua co. Tai mo hinh co the mat vai GB; tuy RAM/CPU/GPU se mat thoi gian. Neu model da co, bo `-PullModel`.

Neu muon nap them du lieu da co vao khu cho trong CUNG mot lan, them `-StagePending` (co chong trung va log audit; khong auto approve):

```powershell
.\tools\ai\start-gds.ps1 -Provider Ollama -StagePending
```

## Cach 2: OpenAI API

API key tu trang cung cap duoc yeu cau qua input an; script CHI luu trong environment cua process/chau, khong ghi vao .env. Day KHONG phai tai khoan ChatGPT Plus/Team thong thuong.

```powershell
.\tools\ai\start-gds.ps1 -Provider OpenAI -Model gpt-4.1-mini
```

*Luu y:* staff preview da tat cho OpenAI cloud mac dinh, de khong tu dong gui ban nhap chua xac minh cho mot dich vu ben ngoai. Bat thu cong `AI_ALLOW_STAFF_DRAFTS=true` chi khi da danh gia privacy va quyen truy cap.

## Kiem tra thuc su da co AI

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/assistant/status
# Trong cung PowerShell (da chay start-gds.ps1):
node tools/ai/doctor.cjs --api
```

Trang: http://127.0.0.1:3001/tro-ly-ai.html

Dau hieu thanh cong: `AI END TO END: PASS`, ket qua `AI_GENERATED` va `modelActive=true`. Neu `RETRIEVAL_ONLY`, `PROVIDER_UNAVAILABLE`, `INSUFFICIENT_EVIDENCE` thi AI chua tao cau tra loi trong cau hoi do.

De thu 2 bai that nghiep #2/#3 chua kiem duyet: dang nhap tai khoan nhan su, chon **Noi bo – xem ban nhap** tren trang AI. Khong co tai khoan thi khong the truy cap du lieu nhap.

## Pham vi va canh bao

- Khong doi role/SQL account, khong thay doi trang thai approval/review/published, khong lam gia ket qua kiem chung.
- Model co the sai; khong tin du lieu pending de dua loi khuyen phap ly thuc te.
- Hien co 1 bai SCAM published, 2 bai pending va 50 metadata Cong bao pending. Metadata khong tu bien thanh bai viet day du. Du lieu 34 tinh/thanh chua du phu tat ca dich vu.
- Neu cong 3001 dang chay voi cau hinh cu, dung `npm run dev` cu va CHAY LAI script de backend thua huong env AI moi.
- Khong gui API key, mat khau, .env len chat, file ZIP hay Git.
