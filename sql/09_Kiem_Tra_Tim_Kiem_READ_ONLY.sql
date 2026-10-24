/* GOC DAN SINH - STEP 10 - READ_ONLY: no changes to database. */
USE [GocDanSinh];
GO
SET NOCOUNT ON;
SELECT d.code AS domain, v.editorial_status AS editorialStatus,
       COUNT(DISTINCT i.id) AS articles
FROM dbo.knowledge_item i
JOIN dbo.[domain] d ON d.id=i.domain_id
JOIN dbo.knowledge_version v ON v.item_id=i.id
WHERE i.deleted_at IS NULL AND i.business_code LIKE N'GDS-MVP-%'
GROUP BY d.code,v.editorial_status ORDER BY d.code;
SELECT l.relation_type AS relationType,fi.business_code AS fromCode,
       ti.business_code AS toCode, l.relation_note AS note
FROM dbo.knowledge_item_link l
JOIN dbo.knowledge_item fi ON fi.id=l.from_item_id
JOIN dbo.knowledge_item ti ON ti.id=l.to_item_id
WHERE fi.business_code LIKE N'GDS-MVP-%' AND ti.business_code LIKE N'GDS-MVP-%'
ORDER BY l.id;
SELECT i.business_code AS businessCode,COUNT(*) AS pendingSources
FROM dbo.knowledge_source_candidate c
JOIN dbo.knowledge_item i ON i.id=c.item_id
WHERE i.business_code LIKE N'GDS-MVP-%' AND c.review_status=N'pending_review'
GROUP BY i.business_code ORDER BY i.business_code;
-- Public search must never use unverified source_candidates as verified citations.
-- Visibility is enforced at /api/search via PUBLIC_VISIBILITY in backend.
GO
