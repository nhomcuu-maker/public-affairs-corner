/*
  GOC DAN SINH | FILE 03 (MOI): VIEW + HAM LOC DANH MUC CHINH XAC CHO TRANG CONG KHAI
  SQL Server 2022 | DATABASE: [GocDanSinh] | CHAY LAI AN TOAN (CREATE OR ALTER)
  Chi tao view/ham. KHONG sua du lieu, khong dong vao bang nao.

  MUC DICH: sua loi "bam muc Luat dat dai van hien Luat lao dong / Viec lam".
  Gia tri co the gay loi trong DB hien tai:
    - 5/9 danh muc dang RONG (DAN_SU, DAT_DAI, CU_TRU_GIAY_TO, LINK_GIA, TUYEN_DUNG).
    - knowledge_item_link noi 3 bai MVP voi nhau; neu giao dien/ API lay "bai lien quan"
      hoac "bai dau tien" khi danh muc rong thi se hien 3 bai nay o MOI muc.
  QUY TAC DUNG CHO BACKEND (bat buoc de het loi):
    1) Danh sach theo muc = SELECT * FROM dbo.fn_public_items_by_category(@category_id).
       Neu tra ve 0 dong -> hien "Chua co noi dung", TUYET DOI khong fallback sang muc khac.
    2) "Bai lien quan" chi hien o trang CHI TIET bai viet (v_public_related), khong tron
       vao danh sach theo muc.
    3) Muc rong -> an hoac lam mo, dung cot public_item_count cua v_public_category.

  DIEU KIEN CONG KHAI (giong file 12/13/14 cu va PUBLIC_VISIBILITY trong backend):
    published + da duyet + da cong bo + chua rut + trong han hieu luc (gio VN, UTC+7)
    + co chung cu + MOI chung cu deu co ket qua kiem chung moi nhat = 'accepted' con han
    + rieng thu tuc ADMIN: co procedure_detail va pham vi hop le.
  Neu backend da co PUBLIC_VISIBILITY rieng, hay doi chieu voi view nay de chi giu MOT nguon.
*/
USE [GocDanSinh];
GO
SET NOCOUNT ON;
IF DB_NAME() <> N'GocDanSinh' THROW 59810, N'Sai database.', 1;
IF OBJECT_ID(N'dbo.knowledge_item_link',N'U') IS NULL
    THROW 59811, N'Thieu knowledge_item_link. Chay file 02 truoc.', 1;
GO

/* 1. MOI bai viet co ban cong bo HIEN HANH hop le (mot dong / bai) */
CREATE OR ALTER VIEW dbo.v_public_version
AS
WITH eligible AS (
    SELECT v.id AS version_id, v.item_id, ki.business_code, ki.kind, ki.domain_id,
           d.code AS domain_code, v.version_no, v.title, v.summary,
           v.effective_from, v.effective_to, v.published_at,
           ROW_NUMBER() OVER (PARTITION BY v.item_id ORDER BY v.effective_from DESC, v.version_no DESC) AS rn
    FROM dbo.knowledge_version AS v
    JOIN dbo.knowledge_item AS ki ON ki.id = v.item_id AND ki.deleted_at IS NULL
    JOIN dbo.[domain] AS d ON d.id = ki.domain_id AND d.is_active = 1
    WHERE v.editorial_status = N'published'
      AND v.approved_by IS NOT NULL AND v.approved_at IS NOT NULL
      AND v.published_at IS NOT NULL AND v.published_at <= SYSUTCDATETIME()
      AND v.withdrawn_at IS NULL
      AND v.effective_from IS NOT NULL
      AND v.effective_from <= CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME()))
      AND (v.effective_to IS NULL OR v.effective_to > CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME())))
      AND EXISTS (SELECT 1 FROM dbo.knowledge_version_source AS e WHERE e.version_id = v.id)
      AND NOT EXISTS (
            SELECT 1
            FROM dbo.knowledge_version_source AS e
            OUTER APPLY (
                SELECT TOP (1) sv.decision, sv.valid_until
                FROM dbo.source_verification AS sv
                WHERE sv.source_snapshot_id = e.snapshot_id
                ORDER BY sv.verified_at DESC, sv.id DESC
            ) AS lv
            WHERE e.version_id = v.id
              AND (lv.decision IS NULL OR lv.decision <> N'accepted'
                   OR (lv.valid_until IS NOT NULL AND lv.valid_until <= SYSUTCDATETIME()))
      )
      AND (d.code <> N'ADMIN' OR (
            EXISTS (SELECT 1 FROM dbo.procedure_detail AS pd WHERE pd.version_id = v.id)
            AND EXISTS (
                SELECT 1 FROM dbo.item_scope AS s
                WHERE s.version_id = v.id
                  AND (s.scope_kind = N'nationwide'
                       OR (s.scope_kind = N'unit' AND EXISTS (
                             SELECT 1 FROM dbo.admin_unit AS au
                             WHERE au.id = s.admin_unit_id AND au.level = N'province'
                               AND au.valid_from <= CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME()))
                               AND (au.valid_to IS NULL OR au.valid_to > CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME()))))))
            )
      ))
)
SELECT version_id, item_id, business_code, kind, domain_id, domain_code, version_no,
       title, summary, effective_from, effective_to, published_at
FROM eligible
WHERE rn = 1;
GO

/* 2. Cay danh muc: danh muc + moi danh muc con (an toan voi trigger chong vong lap) */
CREATE OR ALTER FUNCTION dbo.fn_category_subtree (@category_id BIGINT)
RETURNS TABLE
AS
RETURN
WITH t AS (
    SELECT c.id, c.domain_id
    FROM dbo.category AS c
    WHERE c.id = @category_id AND c.is_active = 1
    UNION ALL
    SELECT c.id, c.domain_id
    FROM dbo.category AS c
    JOIN t ON c.parent_id = t.id
    WHERE c.is_active = 1
)
SELECT id AS category_id, domain_id FROM t;
GO

/* 3. Bai cong khai cua MOT danh muc (gom ca danh muc con). Rong thi tra 0 dong. */
CREATE OR ALTER FUNCTION dbo.fn_public_items_by_category (@category_id BIGINT)
RETURNS TABLE
AS
RETURN
SELECT pv.item_id, pv.version_id, pv.business_code, pv.kind, pv.domain_code,
       pv.title, pv.summary, pv.published_at
FROM dbo.v_public_version AS pv
WHERE EXISTS (
    SELECT 1
    FROM dbo.item_category AS ic
    JOIN dbo.fn_category_subtree(@category_id) AS s ON s.category_id = ic.category_id
    WHERE ic.item_id = pv.item_id
);
GO

/* 4. Danh sach danh muc kem so bai CONG KHAI (de an/lam mo muc rong) */
CREATE OR ALTER VIEW dbo.v_public_category
AS
SELECT c.id AS category_id, c.domain_id, d.code AS domain_code, c.parent_id,
       c.code AS category_code, c.name AS category_name,
       (SELECT COUNT(*) FROM dbo.fn_public_items_by_category(c.id)) AS public_item_count
FROM dbo.category AS c
JOIN dbo.[domain] AS d ON d.id = c.domain_id AND d.is_active = 1
WHERE c.is_active = 1;
GO

/* 5. Bai lien quan: CHI khi CA HAI dau deu dang cong khai */
CREATE OR ALTER VIEW dbo.v_public_related
AS
SELECT l.from_item_id, l.to_item_id, l.relation_type, l.relation_note,
       t.version_id AS to_version_id, t.business_code AS to_business_code,
       t.domain_code AS to_domain_code, t.title AS to_title, t.summary AS to_summary
FROM dbo.knowledge_item_link AS l
JOIN dbo.v_public_version AS f ON f.item_id = l.from_item_id
JOIN dbo.v_public_version AS t ON t.item_id = l.to_item_id;
GO

/* 6. Quyen doc cho role cong khai (neu role ton tai) */
IF DATABASE_PRINCIPAL_ID(N'gocdansinh_reader') IS NOT NULL
BEGIN
    GRANT SELECT ON OBJECT::dbo.v_public_version TO [gocdansinh_reader];
    GRANT SELECT ON OBJECT::dbo.v_public_category TO [gocdansinh_reader];
    GRANT SELECT ON OBJECT::dbo.v_public_related TO [gocdansinh_reader];
    GRANT SELECT ON OBJECT::dbo.fn_public_items_by_category TO [gocdansinh_reader];
    GRANT SELECT ON OBJECT::dbo.fn_category_subtree TO [gocdansinh_reader];
END;
GO

/* 7. KIEM TRA NHANH (chi doc) */
SELECT domain_code AS module, category_code, category_name, public_item_count,
       CASE WHEN public_item_count = 0 THEN N'RONG - giao dien phai hien "Chua co noi dung"' ELSE N'Co noi dung' END AS ghi_chu
FROM dbo.v_public_category
ORDER BY domain_code, category_code;
SELECT COUNT(*) AS so_bai_cong_khai_hien_tai FROM dbo.v_public_version;
GO
