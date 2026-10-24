# Sua loi AI mock khi chay Ollama

Nguyen nhan: `start-gds.ps1` dat `AI_PROVIDER=ollama`, trong khi `tools/test-assistant-ai-mock.cjs` mock mot provider su dung `Bearer mock-key`. Test thua huong Ollama env, nhan Bearer ollama nen mock throw; backend bat loi va tra `PROVIDER_UNAVAILABLE`.

## Ban va
- `tools/test-assistant-ai-mock.cjs`: co lap bien `AI_PROVIDER`/`AI_BASE_URL` trong test, khoi phuc bien moi truong sau test.
- `tools/ai/start-gds.ps1`: tu phat hien `ollama.exe` tai thu muc Windows `LOCALAPPDATA\\Programs\\Ollama` neu chua co PATH; them kiem thu mock Ollama.
- Khong sua AI model, SQL, phan quyen, noi dung da cong bo hay RSS.

## Cai
Dung backend cu o cong 3001. Sao luu hai file neu can, giai nen ZIP vao thu muc goc `D:\\trường\\Đồ án\\GocDanSinh`, cho phep thay the file trung ten (ZIP co thu muc goc `tools/`).

PowerShell:

```powershell
Set-Location -LiteralPath 'D:\trường\Đồ án\GocDanSinh'
node tools/test-assistant-ai-mock.cjs
node tools/ai/test-local-provider-mock.cjs
powershell -ExecutionPolicy Bypass -File '.\tools\ai\start-gds.ps1' -Provider Ollama
```

Neu model da tai, khong can `-PullModel`.

Quan sat `AI END TO END: PASS` va `AI_GENERATED` / `modelActive=true` moi duoc ket luan AI da tra loi qua website. Neu chi `AI CONFIG: PASS` thi chua du.

Ban va duoc kiem tra voi moi truong `AI_PROVIDER=ollama` (moi truong gia lap, KHONG co Ollama thuc tren may test): mock OpenAI 7/7, mock Ollama PASS, Nest build PASS, 25/25 offline suites PASS. Can test AI thuc + SQL tren may nguoi dung.
