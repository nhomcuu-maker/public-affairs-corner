# Goc Dan Sinh: batched local evidence and RSS inbox intake

Purpose: one-run STAGING ONLY. It does not publish unreviewed laws, procedures or warnings.

Current known dataset: three source PDF candidates in `evidence/review/`, local JSON RSS metadata in `data/source_sync/congbao-pending.json`. The one published BHXH article must not be modified. The 34 provinces are a catalog, not 34 sets of verified procedures.

1. Backup SQL Server database GocDanSinh and project directory.
2. Extract this patch into project root. Keep `.env` and all existing data, docs and SQL tables.
3. Check `node tools/bulk/test-bulk-stage.cjs`.
4. Run `node tools/bulk/stage-all-existing.cjs --preview`. It validates local hashes without DB access.
5. Only after confirming backups, run PowerShell:
   `$env:GDS_BULK_STAGE_ACK = 'PENDING_ONLY_CONFIRMED'`
   `node tools/bulk/stage-all-existing.cjs --apply`
6. Then run `node tools/bulk/stage-all-existing.cjs --audit` (SQL read-only).

Behavior:
- Local evidence files: verifies expected SHA256 and PDF signatures before ANY database writes.
- Finds the latest `draft` or `rejected` version for each known business code; skips `approved` and `published` versions.
- Matches the official URL to an existing source candidate; never fabricates a source.
- Reuses existing `file_asset`, `source_snapshot`, and `knowledge_version_source` records; local evidence is committed in one SQL transaction.
- RSS: calls existing pending-only importer after local evidence commit; if this fails, rerun after fixing, since all steps are idempotent.
- Never writes `source_verification`, `editorial_status`, approval or publication fields.
- To stage new materials, they first need reliable local files and a suitable evidence manifest and candidate source relation. This command does not fetch all laws or 34-province procedures from the Internet.

Risks and caveats:
- No live SQL tests were run here. Confirm changes on the Windows machine before using in production.
- `--apply` can partly succeed (local evidence committed; RSS import later fails). Use `--audit` and rerun safely rather than altering historical snapshots.
- PDF hash integrity is not verification of the official document or legal applicability.
- Do not use a separate login to impersonate an independent reviewer or publisher.
