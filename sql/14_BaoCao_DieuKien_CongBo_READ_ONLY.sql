/* Goc Dan Sinh - chi doc / SQL Server 2022.
   Kiem tra tinh trang xuat ban va nhung dieu kien dang thieu theo tung phien ban.
   KHONG thay doi trang thai, chung cu, quyen nguoi dung hay du lieu nghiep vu.
   An toan voi loi Msg 130: khong co truy van con ben trong bieu thuc aggregate.
*/
USE [GocDanSinh];
GO
SET NOCOUNT ON;
DECLARE @NowUtc datetime2 = SYSUTCDATETIME();
DECLARE @TodayVn date = CONVERT(date, DATEADD(hour, 7, @NowUtc));

SELECT d.code AS domain,
       ki.business_code AS business_code,
       kv.id AS version_id,
       kv.version_no AS version_no,
       kv.title AS title,
       kv.editorial_status AS status,
       kv.effective_from, kv.effective_to,
       kv.approved_at, kv.published_at,
       COALESCE(es.total_sources, 0) AS evidence_links,
       COALESCE(es.accepted_sources, 0) AS accepted_evidence_links,
       COALESCE(pd.has_procedure_detail, 0) AS procedure_details,
       COALESCE(sc.valid_scopes, 0) AS valid_procedure_scopes,
       CASE WHEN kv.editorial_status = N'published'
                  AND kv.approved_by IS NOT NULL AND kv.approved_at IS NOT NULL
                  AND kv.published_at IS NOT NULL AND kv.published_at <= @NowUtc
                  AND kv.withdrawn_at IS NULL
                  AND kv.effective_from <= @TodayVn
                  AND (kv.effective_to IS NULL OR kv.effective_to > @TodayVn)
                  AND COALESCE(es.total_sources, 0) > 0
                  AND es.total_sources = es.accepted_sources
            THEN N'YES' ELSE N'NO' END AS content_api_visible,
       CASE WHEN d.code = N'ADMIN'
                  AND COALESCE(pd.has_procedure_detail, 0) > 0
                  AND COALESCE(sc.valid_scopes, 0) > 0
                  AND kv.editorial_status = N'published'
                  AND kv.approved_by IS NOT NULL AND kv.approved_at IS NOT NULL
                  AND kv.published_at IS NOT NULL AND kv.published_at <= @NowUtc
                  AND kv.withdrawn_at IS NULL
                  AND kv.effective_from <= @TodayVn
                  AND (kv.effective_to IS NULL OR kv.effective_to > @TodayVn)
                  AND COALESCE(es.total_sources, 0) > 0
                  AND es.total_sources = es.accepted_sources
            THEN N'YES' ELSE N'NO' END AS procedure_api_visible,
       CONCAT(
         CASE WHEN kv.editorial_status <> N'published' THEN N'[chua published] ' ELSE N'' END,
         CASE WHEN kv.approved_by IS NULL OR kv.approved_at IS NULL THEN N'[thieu phe duyet] ' ELSE N'' END,
         CASE WHEN kv.published_at IS NULL THEN N'[chua co ngay cong bo] ' ELSE N'' END,
         CASE WHEN kv.withdrawn_at IS NOT NULL THEN N'[da rut lai] ' ELSE N'' END,
         CASE WHEN kv.effective_from IS NULL THEN N'[thieu ngay hieu luc] ' ELSE N'' END,
         CASE WHEN kv.effective_from > @TodayVn THEN N'[chua den ngay hieu luc] ' ELSE N'' END,
         CASE WHEN kv.effective_to IS NOT NULL AND kv.effective_to <= @TodayVn THEN N'[da qua han] ' ELSE N'' END,
         CASE WHEN COALESCE(es.total_sources, 0) = 0 THEN N'[chua lien ket chung cu] ' ELSE N'' END,
         CASE WHEN COALESCE(es.total_sources, 0) > COALESCE(es.accepted_sources, 0)
              THEN N'[co chung cu chua duoc xac minh] ' ELSE N'' END,
         CASE WHEN d.code = N'ADMIN' AND COALESCE(pd.has_procedure_detail, 0) = 0
              THEN N'[thieu procedure_detail] ' ELSE N'' END,
         CASE WHEN d.code = N'ADMIN' AND COALESCE(sc.valid_scopes, 0) = 0
              THEN N'[thieu pham vi thu tuc hop le] ' ELSE N'' END
       ) AS blockers_to_review
FROM dbo.knowledge_version AS kv
JOIN dbo.knowledge_item AS ki ON ki.id = kv.item_id AND ki.deleted_at IS NULL
JOIN dbo.[domain] AS d ON d.id = ki.domain_id
OUTER APPLY (
   SELECT COUNT_BIG(*) AS total_sources,
          SUM(CASE WHEN latest.decision = N'accepted'
                        AND (latest.valid_until IS NULL OR latest.valid_until > @NowUtc)
                   THEN CONVERT(bigint, 1) ELSE CONVERT(bigint, 0) END) AS accepted_sources
   FROM dbo.knowledge_version_source AS kvs
   OUTER APPLY (
      SELECT TOP (1) sv.decision, sv.valid_until
      FROM dbo.source_verification AS sv
      WHERE sv.source_snapshot_id = kvs.snapshot_id
      ORDER BY sv.verified_at DESC, sv.id DESC
   ) AS latest
   WHERE kvs.version_id = kv.id
) AS es
OUTER APPLY (
    SELECT COUNT_BIG(*) AS has_procedure_detail
    FROM dbo.procedure_detail AS p WHERE p.version_id = kv.id
) AS pd
OUTER APPLY (
    SELECT COUNT_BIG(*) AS valid_scopes
    FROM dbo.item_scope AS s
    WHERE s.version_id = kv.id AND (
       s.scope_kind = N'nationwide'
       OR (s.scope_kind = N'unit' AND EXISTS (
           SELECT 1 FROM dbo.admin_unit AS au
           WHERE au.id = s.admin_unit_id
             AND au.level = N'province'
             AND au.valid_from <= @TodayVn
             AND (au.valid_to IS NULL OR au.valid_to > @TodayVn)
       ))
    )
) AS sc
WHERE d.code IN (N'LEGAL', N'ADMIN', N'SCAM')
ORDER BY d.code, ki.business_code, kv.version_no;
GO

-- Chi doc: so luong theo trang thai de quyet dinh lo trinh kiem duyet.
SELECT d.code AS domain, kv.editorial_status AS status, COUNT(*) AS versions
FROM dbo.knowledge_version AS kv
JOIN dbo.knowledge_item AS ki ON ki.id = kv.item_id AND ki.deleted_at IS NULL
JOIN dbo.[domain] AS d ON d.id = ki.domain_id
GROUP BY d.code, kv.editorial_status
ORDER BY d.code, kv.editorial_status;
GO
