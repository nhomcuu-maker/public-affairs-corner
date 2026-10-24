/* GOC DAN SINH: audit the 3x3 taxonomy, SQL Server 2022.
   READ ONLY - does not alter records and must not be used as automatic reclassification. */
USE [GocDanSinh];
GO
SET NOCOUNT ON;

-- 1. All categories currently in DB (legacy groups remain intact).
SELECT d.code AS domain_code, c.code AS category_code, c.name AS category_name,
       c.is_active AS is_active
FROM dbo.category AS c
INNER JOIN dbo.[domain] AS d ON d.id=c.domain_id
WHERE d.code IN (N'LEGAL',N'ADMIN',N'SCAM')
ORDER BY d.code,c.code;

-- 2. Identify items not assigned to one of the 3 public categories per domain.
-- The system keeps other categories for internal history. No records are deleted.
SELECT d.code AS domain_code, ki.business_code,
       ic.is_primary, c.code AS primary_category_code, c.name AS primary_category_name
FROM dbo.knowledge_item AS ki
JOIN dbo.[domain] AS d ON d.id=ki.domain_id
LEFT JOIN dbo.item_category AS ic ON ic.item_id=ki.id AND ic.is_primary=1
LEFT JOIN dbo.category AS c ON c.id=ic.category_id AND c.domain_id=ki.domain_id
WHERE ki.deleted_at IS NULL AND d.code IN (N'LEGAL',N'ADMIN',N'SCAM')
AND (
     (d.code=N'LEGAL' AND (c.code IS NULL OR c.code NOT IN (N'LAO_DONG',N'DAN_SU',N'DAT_DAI')))
  OR (d.code=N'ADMIN' AND (c.code IS NULL OR c.code NOT IN (N'DICH_VU_CONG',N'HO_CHIEU_HO_TICH',N'CU_TRU_GIAY_TO')))
  OR (d.code=N'SCAM'  AND (c.code IS NULL OR c.code NOT IN (N'GIA_DANH',N'LINK_GIA',N'TUYEN_DUNG',N'DAU_TU')))
)
ORDER BY d.code,ki.business_code;

-- 3. Review obvious topic conflicts in the latest article title manually.
WITH labeled AS (
 SELECT d.code AS domain_code,ki.business_code,c.code AS category_code,
        kv.title, kv.version_no,
        ROW_NUMBER() OVER(PARTITION BY ki.id ORDER BY kv.version_no DESC,kv.id DESC) rn
 FROM dbo.knowledge_item ki
 JOIN dbo.[domain] d ON d.id=ki.domain_id
 JOIN dbo.knowledge_version kv ON kv.item_id=ki.id
 LEFT JOIN dbo.item_category ic ON ic.item_id=ki.id AND ic.is_primary=1
 LEFT JOIN dbo.category c ON c.id=ic.category_id AND c.domain_id=ki.domain_id
 WHERE ki.deleted_at IS NULL
)
SELECT domain_code,business_code,category_code,title
FROM labeled
WHERE rn=1 AND (
  (domain_code=N'LEGAL' AND title LIKE N'%đất đai%' AND ISNULL(category_code,N'')<>N'DAT_DAI')
  OR (domain_code=N'LEGAL' AND (title LIKE N'%Luật Việc làm%' OR title LIKE N'%Bộ luật Lao động%') AND ISNULL(category_code,N'')<>N'LAO_DONG')
  OR (domain_code=N'ADMIN' AND title LIKE N'%hộ chiếu%' AND ISNULL(category_code,N'')<>N'HO_CHIEU_HO_TICH')
  OR (domain_code=N'ADMIN' AND title LIKE N'%cư trú%' AND ISNULL(category_code,N'')<>N'CU_TRU_GIAY_TO')
);
GO
