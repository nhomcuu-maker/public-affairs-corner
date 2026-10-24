/* STEP 9 READ-ONLY AUDIT - no INSERT/UPDATE/DELETE/DDL */
USE [GocDanSinh];
GO
SET NOCOUNT ON;
SELECT DB_NAME() AS DatabaseName,
 (SELECT COUNT(*) FROM sys.tables WHERE schema_id=SCHEMA_ID('dbo')) AS TableCount,
 CASE WHEN OBJECT_ID(N'dbo.knowledge_item_link',N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.knowledge_source_candidate',N'U') IS NOT NULL
 THEN N'PASS' ELSE N'FAIL' END AS MVPNewTables;

SELECT d.code AS Module,i.business_code AS BusinessCode,v.editorial_status AS EditorialStatus,
 (SELECT COUNT(*) FROM dbo.knowledge_source_candidate c WHERE c.item_id=i.id) AS SourceCandidates
FROM dbo.knowledge_item i JOIN dbo.domain d ON d.id=i.domain_id
JOIN dbo.knowledge_version v ON v.item_id=i.id AND v.version_no=1
WHERE i.business_code IN (N'GDS-MVP-LEGAL-BHTN',N'GDS-MVP-ADMIN-TCTN',N'GDS-MVP-SCAM-MAODANH-BHXH')
ORDER BY d.code;

SELECT fi.business_code AS FromCode,ti.business_code AS ToCode,l.relation_type AS RelationType
FROM dbo.knowledge_item_link l
JOIN dbo.knowledge_item fi ON fi.id=l.from_item_id
JOIN dbo.knowledge_item ti ON ti.id=l.to_item_id
WHERE fi.business_code IN (N'GDS-MVP-LEGAL-BHTN',N'GDS-MVP-ADMIN-TCTN',N'GDS-MVP-SCAM-MAODANH-BHXH')
ORDER BY l.id;

SELECT i.business_code AS BusinessCode,s.title AS SourceTitle,s.canonical_url AS OfficialUrl,
 c.review_status AS SourceReviewStatus,COUNT(ss.id) AS SnapshotCount
FROM dbo.knowledge_source_candidate c JOIN dbo.knowledge_item i ON i.id=c.item_id
JOIN dbo.[source] s ON s.id=c.source_id
LEFT JOIN dbo.source_snapshot ss ON ss.source_id=s.id
WHERE i.business_code IN (N'GDS-MVP-LEGAL-BHTN',N'GDS-MVP-ADMIN-TCTN',N'GDS-MVP-SCAM-MAODANH-BHXH')
GROUP BY i.business_code,s.title,s.canonical_url,c.review_status ORDER BY i.business_code;

SELECT
 CASE WHEN (SELECT COUNT(*) FROM dbo.knowledge_item WHERE business_code IN
  (N'GDS-MVP-LEGAL-BHTN',N'GDS-MVP-ADMIN-TCTN',N'GDS-MVP-SCAM-MAODANH-BHXH'))=3 THEN N'PASS' ELSE N'FAIL' END AS ThreeMvpRecords,
 CASE WHEN (SELECT COUNT(*) FROM dbo.knowledge_item_link l JOIN dbo.knowledge_item i ON i.id=l.from_item_id
  WHERE i.business_code IN (N'GDS-MVP-LEGAL-BHTN',N'GDS-MVP-ADMIN-TCTN',N'GDS-MVP-SCAM-MAODANH-BHXH'))=3
  THEN N'PASS' ELSE N'FAIL' END AS CrossLinks,
 CASE WHEN (SELECT COUNT(*) FROM dbo.knowledge_source_candidate c JOIN dbo.knowledge_item i ON i.id=c.item_id
  WHERE i.business_code IN (N'GDS-MVP-LEGAL-BHTN',N'GDS-MVP-ADMIN-TCTN',N'GDS-MVP-SCAM-MAODANH-BHXH'))>=4
  THEN N'PASS' ELSE N'FAIL' END AS OfficialReferenceCandidates,
 CASE WHEN NOT EXISTS (
  SELECT 1 FROM dbo.knowledge_version v JOIN dbo.knowledge_item i ON i.id=v.item_id
  WHERE i.business_code IN (N'GDS-MVP-LEGAL-BHTN',N'GDS-MVP-ADMIN-TCTN',N'GDS-MVP-SCAM-MAODANH-BHXH')
  AND v.editorial_status<>N'draft') THEN N'PASS' ELSE N'FAIL' END AS AllMvpDraft,
 CASE WHEN EXISTS(SELECT 1 FROM dbo.knowledge_item i JOIN dbo.knowledge_version v ON v.item_id=i.id
  WHERE i.business_code=N'GDS-ADMIN-HOCHIEU-26270' AND v.editorial_status=N'draft')
  THEN N'PASS' ELSE N'CHECK' END AS PassportDraftPreserved;
GO
