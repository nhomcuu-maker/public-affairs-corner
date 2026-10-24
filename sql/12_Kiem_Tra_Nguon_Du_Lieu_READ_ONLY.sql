/*
GOC DAN SINH - STEP 14 - READ ONLY diagnostics.
Run in SSMS against EXISTING GocDanSinh database, not in a new DB.
Contains no INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, or EXEC.
Does not mark any evidence accepted or change publication statuses.
*/
USE [GocDanSinh];
GO
SET NOCOUNT ON;
IF DB_NAME() <> N'GocDanSinh'
 THROW 59140, N'Wrong database. Stop.', 1;
IF OBJECT_ID(N'dbo.knowledge_item',N'U') IS NULL
 OR OBJECT_ID(N'dbo.knowledge_version',N'U') IS NULL
 OR OBJECT_ID(N'dbo.source_snapshot',N'U') IS NULL
 OR OBJECT_ID(N'dbo.source_verification',N'U') IS NULL
 OR OBJECT_ID(N'dbo.knowledge_version_source',N'U') IS NULL
 THROW 59141, N'Missing base ERD tables. Stop.', 1;

-- 1. Snapshot of all versions for each MVP business code.
SELECT d.code AS domain, i.business_code, i.id AS item_id,
       v.id AS version_id, v.version_no, v.title, v.editorial_status,
       v.effective_from, v.effective_to, v.approved_at, v.published_at,
       v.withdrawn_at
FROM dbo.knowledge_item i
JOIN dbo.[domain] d ON d.id=i.domain_id
JOIN dbo.knowledge_version v ON v.item_id=i.id
WHERE i.business_code IN (N'GDS-MVP-LEGAL-BHTN',
 N'GDS-MVP-ADMIN-TCTN', N'GDS-MVP-SCAM-MAODANH-BHXH')
ORDER BY d.code,v.version_no DESC;

-- 2. Number of linked snapshots and accepted current checks per version.
SELECT i.business_code, v.id AS version_id, v.editorial_status,
       COUNT(ks.snapshot_id) AS linked_snapshots,
       SUM(CASE WHEN latest.decision=N'accepted'
                AND (latest.valid_until IS NULL OR latest.valid_until>SYSUTCDATETIME())
                THEN 1 ELSE 0 END) AS accepted_current_snapshots,
       SUM(CASE WHEN latest.decision IS NULL OR latest.decision<>N'accepted'
                OR (latest.valid_until IS NOT NULL AND latest.valid_until<=SYSUTCDATETIME())
                THEN 1 ELSE 0 END) AS unaccepted_or_expired_snapshots
FROM dbo.knowledge_item i
JOIN dbo.knowledge_version v ON v.item_id=i.id
LEFT JOIN dbo.knowledge_version_source ks ON ks.version_id=v.id
OUTER APPLY (
 SELECT TOP(1) sv.decision,sv.valid_until
 FROM dbo.source_verification sv
 WHERE sv.source_snapshot_id=ks.snapshot_id
 ORDER BY sv.verified_at DESC,sv.id DESC
) latest
WHERE i.business_code IN (N'GDS-MVP-LEGAL-BHTN',
 N'GDS-MVP-ADMIN-TCTN', N'GDS-MVP-SCAM-MAODANH-BHXH')
GROUP BY i.business_code,v.id,v.editorial_status
ORDER BY i.business_code,v.id;

-- 3. Same public predicate as PUBLIC_VISIBILITY in procedures.queries.ts.
-- A count of 0 does NOT mean the HTTP test is broken.
SELECT i.business_code, d.code AS domain, v.id AS version_id,
 CASE WHEN v.editorial_status=N'published'
  AND v.approved_at IS NOT NULL AND v.approved_by IS NOT NULL
  AND v.published_at IS NOT NULL AND v.published_at <= SYSUTCDATETIME()
  AND v.withdrawn_at IS NULL AND v.effective_from IS NOT NULL
  AND v.effective_from <= CONVERT(date,DATEADD(hour,7,SYSUTCDATETIME()))
  AND (v.effective_to IS NULL OR v.effective_to > CONVERT(date,DATEADD(hour,7,SYSUTCDATETIME())))
  AND EXISTS (SELECT 1 FROM dbo.knowledge_version_source e WHERE e.version_id=v.id)
  AND NOT EXISTS (
    SELECT 1 FROM dbo.knowledge_version_source e
    OUTER APPLY (
      SELECT TOP (1) sv.decision,sv.valid_until
      FROM dbo.source_verification sv WHERE sv.source_snapshot_id=e.snapshot_id
      ORDER BY sv.verified_at DESC,sv.id DESC
    ) verification
    WHERE e.version_id=v.id AND (
      verification.decision IS NULL OR verification.decision<>N'accepted'
      OR (verification.valid_until IS NOT NULL AND verification.valid_until<=SYSUTCDATETIME())
    )
  ) THEN N'ELIGIBLE_PUBLIC' ELSE N'NOT_PUBLIC' END AS public_visibility
FROM dbo.knowledge_item i
JOIN dbo.[domain] d ON d.id=i.domain_id AND d.is_active=1
JOIN dbo.knowledge_version v ON v.item_id=i.id
WHERE i.deleted_at IS NULL
 AND i.business_code IN (N'GDS-MVP-LEGAL-BHTN',
 N'GDS-MVP-ADMIN-TCTN',N'GDS-MVP-SCAM-MAODANH-BHXH')
ORDER BY i.business_code,v.id;

-- 4. Show submitted source URLs still treated as candidates, not evidence.
IF OBJECT_ID(N'dbo.knowledge_source_candidate',N'U') IS NULL
 PRINT N'STEP9 source candidate table missing';
ELSE
 SELECT i.business_code,s.title,s.canonical_url,c.review_status,c.review_note
 FROM dbo.knowledge_source_candidate c
 JOIN dbo.knowledge_item i ON i.id=c.item_id
 JOIN dbo.[source] s ON s.id=c.source_id
 WHERE i.business_code IN (N'GDS-MVP-LEGAL-BHTN',
  N'GDS-MVP-ADMIN-TCTN',N'GDS-MVP-SCAM-MAODANH-BHXH')
 ORDER BY i.business_code,s.id;

-- 5. Cross-module links. The HTTP public view can suppress both endpoints if drafts.
IF OBJECT_ID(N'dbo.knowledge_item_link',N'U') IS NULL
 PRINT N'STEP9 cross-module link table missing';
ELSE
 SELECT a.business_code AS from_code,b.business_code AS to_code,
   l.relation_type,l.relation_note
 FROM dbo.knowledge_item_link l
 JOIN dbo.knowledge_item a ON a.id=l.from_item_id
 JOIN dbo.knowledge_item b ON b.id=l.to_item_id
 WHERE a.business_code LIKE N'GDS-MVP-%'
 ORDER BY a.business_code,b.business_code;
GO
