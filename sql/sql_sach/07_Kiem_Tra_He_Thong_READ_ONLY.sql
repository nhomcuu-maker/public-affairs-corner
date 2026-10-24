/*
  GOC DAN SINH | FILE 07 (BAN SACH): KIEM TRA TOAN HE THONG - CHI DOC  (SQL Server 2022)
  Thay the 9 file kiem tra cu: 02, 08, 09, 11, 12, 13, 14, Kiem_Tra_VaiTro_TaiKhoan,
  SQLQuery1, SQLQuery2.  KHONG INSERT/UPDATE/DELETE/ALTER/EXEC nghiep vu. Chay bat cu luc nao.

  DOC KET QUA THEO THU TU:
    [1] ket noi   [2] cau truc (52 bang ERD + bang bo sung)   [3] doi tuong SQL
    [4] 3 module  [5] TUNG DANH MUC: bao nhieu bai / bao nhieu bai CONG KHAI (muc rong = 0)
    [6] tung phien ban: con thieu gi de cong bo   [7] loi du lieu   [8] lien ket cheo
    [9] tai khoan & phan tach vai tro   [10] phan hoi
  So bang ERD ky vong = 52 (bang bo sung KHONG tinh). Ban cu dem 52 + 5..8 bang nen bao FAIL gia.
*/
USE [GocDanSinh];
GO
SET NOCOUNT ON;

/* ===== [1] KET NOI ===== */
SELECT N'01 KET NOI' AS nhom, DB_NAME() AS database_name, @@SERVERNAME AS server_name,
       SYSDATETIME() AS gio_may_chu, SERVERPROPERTY('ProductVersion') AS sql_version;
GO

/* ===== [2] CAU TRUC ===== */
DECLARE @Ext TABLE (name SYSNAME PRIMARY KEY);
INSERT @Ext VALUES (N'sysdiagrams'),(N'auth_credential'),(N'auth_session'),(N'knowledge_item_link'),
 (N'knowledge_source_candidate'),(N'official_feed_entry'),(N'official_feed_snapshot'),
 (N'assistant_feedback'),(N'site_feedback');

SELECT N'02 CAU TRUC ERD' AS nhom,
  (SELECT COUNT(*) FROM sys.tables t WHERE t.schema_id=SCHEMA_ID(N'dbo') AND t.name NOT IN (SELECT name FROM @Ext)) AS so_bang_erd,
  52 AS ky_vong_bang,
  (SELECT COUNT(*) FROM sys.foreign_keys fk WHERE fk.schema_id=SCHEMA_ID(N'dbo')
      AND OBJECT_NAME(fk.parent_object_id) NOT IN (SELECT name FROM @Ext)) AS so_fk_erd,
  116 AS ky_vong_fk,
  (SELECT COUNT(*) FROM sys.foreign_keys fk WHERE fk.is_disabled=1 OR fk.is_not_trusted=1) AS fk_khong_tin_cay,
  (SELECT COUNT(*) FROM sys.check_constraints ck WHERE ck.is_disabled=1 OR ck.is_not_trusted=1) AS check_khong_tin_cay;

SELECT e.name AS bang_bo_sung,
       CASE WHEN OBJECT_ID(N'dbo.'+e.name,N'U') IS NOT NULL THEN N'CO' ELSE N'CHUA CO' END AS trang_thai,
       CASE e.name WHEN N'sysdiagrams' THEN N'(SSMS tu tao, bo qua)'
         WHEN N'auth_credential' THEN N'file 02 - dang nhap' WHEN N'auth_session' THEN N'file 02 - dang nhap'
         WHEN N'knowledge_item_link' THEN N'file 02 - lien ket bai' WHEN N'knowledge_source_candidate' THEN N'file 02 - nguon ung vien'
         WHEN N'official_feed_entry' THEN N'file 02 - RSS cong bao' WHEN N'official_feed_snapshot' THEN N'file 02 - RSS cong bao'
         WHEN N'assistant_feedback' THEN N'file 02 - danh gia tro ly AI' WHEN N'site_feedback' THEN N'file 02 - gop y / phan hoi' END AS nguon
FROM @Ext e WHERE e.name <> N'sysdiagrams' ORDER BY e.name;
GO

/* ===== [3] DOI TUONG SQL ===== */
SELECT n.loai, n.ten,
       CASE WHEN OBJECT_ID(n.ten) IS NOT NULL THEN N'PASS' ELSE N'THIEU' END AS ket_qua
FROM (VALUES
 (N'proc',N'dbo.usp_approve_knowledge_version'),(N'proc',N'dbo.usp_publish_knowledge_version'),
 (N'proc',N'dbo.usp_withdraw_knowledge_version'),(N'proc',N'dbo.usp_finalize_generated_answer'),
 (N'proc',N'dbo.usp_site_feedback_submit'),(N'proc',N'dbo.usp_site_feedback_track'),
 (N'proc',N'dbo.usp_site_feedback_list'),(N'proc',N'dbo.usp_site_feedback_resolve'),
 (N'ham',N'dbo.fn_knowledge_for_date_and_unit'),(N'ham',N'dbo.fn_legal_provision_as_of'),
 (N'ham',N'dbo.fn_category_subtree'),(N'ham',N'dbo.fn_public_items_by_category'),
 (N'view',N'dbo.v_latest_snapshot_verification'),(N'view',N'dbo.v_public_version'),
 (N'view',N'dbo.v_public_category'),(N'view',N'dbo.v_public_related')
) AS n(loai,ten) ORDER BY n.loai, n.ten;
GO

/* ===== [4] BA MODULE ===== */
SELECT d.code AS module, d.name, d.is_active,
       (SELECT COUNT(*) FROM dbo.category c WHERE c.domain_id=d.id AND c.is_active=1) AS so_danh_muc,
       (SELECT COUNT(*) FROM dbo.knowledge_item i WHERE i.domain_id=d.id AND i.deleted_at IS NULL) AS so_bai,
       (SELECT COUNT(*) FROM dbo.knowledge_item i JOIN dbo.knowledge_version v ON v.item_id=i.id
         WHERE i.domain_id=d.id AND i.deleted_at IS NULL AND v.editorial_status=N'draft') AS ban_draft,
       (SELECT COUNT(*) FROM dbo.knowledge_item i JOIN dbo.knowledge_version v ON v.item_id=i.id
         WHERE i.domain_id=d.id AND i.deleted_at IS NULL AND v.editorial_status IN (N'review',N'approved')) AS ban_cho_duyet_hoac_da_duyet,
       (SELECT COUNT(*) FROM dbo.knowledge_item i JOIN dbo.knowledge_version v ON v.item_id=i.id
         WHERE i.domain_id=d.id AND i.deleted_at IS NULL AND v.editorial_status=N'published' AND v.withdrawn_at IS NULL) AS ban_published
FROM dbo.[domain] d ORDER BY d.code;

IF OBJECT_ID(N'dbo.v_public_version',N'V') IS NOT NULL
    EXEC(N'SELECT domain_code AS module, COUNT(*) AS bai_hien_tren_web FROM dbo.v_public_version GROUP BY domain_code ORDER BY domain_code;');
ELSE PRINT N'(Chua co v_public_version - chay file 03 de xem so bai thuc su hien tren web.)';
GO

/* ===== [5] TUNG DANH MUC: muc rong = nguyen nhan "bam vao ma van thay noi dung muc khac" ===== */
SELECT d.code AS module, c.code AS danh_muc, c.name,
       (SELECT COUNT(*) FROM dbo.item_category ic JOIN dbo.knowledge_item i ON i.id=ic.item_id AND i.deleted_at IS NULL
         WHERE ic.category_id=c.id) AS tong_bai_gan_vao_muc,
       (SELECT COUNT(*) FROM dbo.item_category ic JOIN dbo.knowledge_item i ON i.id=ic.item_id AND i.deleted_at IS NULL
         WHERE ic.category_id=c.id AND ic.is_primary=1) AS bai_co_muc_chinh_la_muc_nay
FROM dbo.category c JOIN dbo.[domain] d ON d.id=c.domain_id
WHERE c.is_active=1 ORDER BY d.code, c.code;

IF OBJECT_ID(N'dbo.v_public_category',N'V') IS NOT NULL
    EXEC(N'SELECT domain_code AS module, category_code AS danh_muc, public_item_count AS bai_cong_khai,
                  CASE WHEN public_item_count=0 THEN N''RONG: giao dien phai hien "Chua co noi dung", khong fallback'' ELSE N''ok'' END AS ghi_chu
           FROM dbo.v_public_category ORDER BY domain_code, category_code;');
GO

/* ===== [6] TUNG PHIEN BAN: con thieu gi de cong bo (tu file 14 cu, rut gon) ===== */
DECLARE @NowUtc DATETIME2 = SYSUTCDATETIME();
DECLARE @TodayVn DATE = CONVERT(DATE, DATEADD(HOUR,7,@NowUtc));
SELECT d.code AS module, ki.business_code, kv.id AS version_id, kv.version_no, kv.editorial_status AS trang_thai,
       kv.effective_from, kv.approved_at, kv.published_at,
       COALESCE(es.total_sources,0) AS so_chung_cu, COALESCE(es.accepted_sources,0) AS chung_cu_hop_le,
       CONCAT(
         CASE WHEN kv.editorial_status<>N'published' THEN N'[chua published] ' ELSE N'' END,
         CASE WHEN kv.approved_by IS NULL OR kv.approved_at IS NULL THEN N'[thieu phe duyet] ' ELSE N'' END,
         CASE WHEN kv.effective_from IS NULL THEN N'[thieu effective_from] ' ELSE N'' END,
         CASE WHEN kv.effective_from>@TodayVn THEN N'[chua den ngay hieu luc] ' ELSE N'' END,
         CASE WHEN kv.effective_to IS NOT NULL AND kv.effective_to<=@TodayVn THEN N'[het han] ' ELSE N'' END,
         CASE WHEN kv.withdrawn_at IS NOT NULL THEN N'[da rut] ' ELSE N'' END,
         CASE WHEN COALESCE(es.total_sources,0)=0 THEN N'[chua lien ket chung cu] ' ELSE N'' END,
         CASE WHEN COALESCE(es.total_sources,0)>COALESCE(es.accepted_sources,0) THEN N'[chung cu chua kiem chung] ' ELSE N'' END,
         CASE WHEN d.code=N'ADMIN' AND COALESCE(pd.n,0)=0 THEN N'[thieu procedure_detail] ' ELSE N'' END,
         CASE WHEN COALESCE(pc.n,0)=0 THEN N'[thieu danh muc chinh] ' ELSE N'' END
       ) AS dang_thieu
FROM dbo.knowledge_version kv
JOIN dbo.knowledge_item ki ON ki.id=kv.item_id AND ki.deleted_at IS NULL
JOIN dbo.[domain] d ON d.id=ki.domain_id
OUTER APPLY (
   SELECT COUNT_BIG(*) AS total_sources,
          SUM(CASE WHEN lv.decision=N'accepted' AND (lv.valid_until IS NULL OR lv.valid_until>@NowUtc) THEN 1 ELSE 0 END) AS accepted_sources
   FROM dbo.knowledge_version_source kvs
   OUTER APPLY (SELECT TOP (1) sv.decision, sv.valid_until FROM dbo.source_verification sv
                WHERE sv.source_snapshot_id=kvs.snapshot_id ORDER BY sv.verified_at DESC, sv.id DESC) lv
   WHERE kvs.version_id=kv.id) es
OUTER APPLY (SELECT COUNT_BIG(*) AS n FROM dbo.procedure_detail p WHERE p.version_id=kv.id) pd
OUTER APPLY (SELECT COUNT_BIG(*) AS n FROM dbo.item_category ic WHERE ic.item_id=ki.id AND ic.is_primary=1) pc
ORDER BY d.code, ki.business_code, kv.version_no;
GO

/* ===== [7] LOI DU LIEU ===== */
SELECT N'bai khong co danh muc chinh' AS loai_loi, i.business_code
FROM dbo.knowledge_item i
WHERE i.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM dbo.item_category ic WHERE ic.item_id=i.id AND ic.is_primary=1)
UNION ALL
SELECT N'phien ban khong co pham vi (item_scope)', i.business_code + N' / v' + CONVERT(NVARCHAR(10), v.version_no)
FROM dbo.knowledge_version v JOIN dbo.knowledge_item i ON i.id=v.item_id
WHERE NOT EXISTS (SELECT 1 FROM dbo.item_scope s WHERE s.version_id=v.id)
UNION ALL
SELECT N'sai module/loai (kind <> domain)', i.business_code
FROM dbo.knowledge_item i JOIN dbo.[domain] d ON d.id=i.domain_id
WHERE NOT ((i.kind=N'benefit' AND d.code=N'LEGAL') OR (i.kind=N'procedure' AND d.code=N'ADMIN') OR (i.kind=N'scam' AND d.code=N'SCAM'))
UNION ALL
SELECT N'2 bai cung tieu de (nghi trung lap)', MIN(i.business_code) + N' & ' + MAX(i.business_code)
FROM dbo.knowledge_item i WHERE i.deleted_at IS NULL
GROUP BY i.canonical_title HAVING COUNT(*) > 1;
-- (khong co dong nao = khong co loi)
GO

/* ===== [8] LIEN KET CHEO: bai lien quan co "ro ri" sang muc khong lien quan khong ===== */
IF OBJECT_ID(N'dbo.knowledge_item_link',N'U') IS NOT NULL
BEGIN
    SELECT a.business_code AS tu_bai, b.business_code AS den_bai, l.relation_type,
           ca.code AS danh_muc_tu, cb.code AS danh_muc_den
    FROM dbo.knowledge_item_link l
    JOIN dbo.knowledge_item a ON a.id=l.from_item_id JOIN dbo.knowledge_item b ON b.id=l.to_item_id
    LEFT JOIN dbo.item_category ia ON ia.item_id=a.id AND ia.is_primary=1 LEFT JOIN dbo.category ca ON ca.id=ia.category_id
    LEFT JOIN dbo.item_category ib ON ib.item_id=b.id AND ib.is_primary=1 LEFT JOIN dbo.category cb ON cb.id=ib.category_id
    ORDER BY a.business_code, b.business_code;
END;
GO

/* ===== [9] TAI KHOAN & PHAN TACH VAI TRO ===== */
SELECT r.role_code,
       COUNT(DISTINCT CASE WHEN u.account_status=N'active' AND c.user_id IS NOT NULL THEN u.id END) AS tai_khoan_dang_nhap_duoc
FROM dbo.[role] r
LEFT JOIN dbo.user_role ur ON ur.role_id=r.id
LEFT JOIN dbo.app_user u ON u.id=ur.user_id
LEFT JOIN dbo.auth_credential c ON c.user_id=u.id
GROUP BY r.role_code ORDER BY r.role_code;

SELECT u.id, u.display_name, u.email, u.account_status,
       STRING_AGG(r.role_code, N', ') AS vai_tro,
       CASE WHEN c.user_id IS NULL THEN N'KHONG co mat khau (khong dang nhap duoc)' ELSE N'co mat khau' END AS dang_nhap,
       CASE WHEN u.email LIKE N'%@example.invalid' THEN N'TAI KHOAN DEMO' ELSE N'' END AS ghi_chu
FROM dbo.app_user u
LEFT JOIN dbo.user_role ur ON ur.user_id=u.id
LEFT JOIN dbo.[role] r ON r.id=ur.role_id
LEFT JOIN dbo.auth_credential c ON c.user_id=u.id
GROUP BY u.id, u.display_name, u.email, u.account_status, c.user_id
ORDER BY u.id;

-- Quy trinh can >= 3 tai khoan THAT khac nhau: nguoi soan, nguoi duyet, nguoi cong bo
SELECT CASE WHEN (SELECT COUNT(DISTINCT u.id) FROM dbo.app_user u JOIN dbo.auth_credential c ON c.user_id=u.id
                  JOIN dbo.user_role ur ON ur.user_id=u.id JOIN dbo.[role] r ON r.id=ur.role_id
                  WHERE u.account_status=N'active' AND u.email NOT LIKE N'%@example.invalid'
                    AND r.role_code IN (N'editor',N'author',N'admin')) >= 1
             AND (SELECT COUNT(DISTINCT u.id) FROM dbo.app_user u JOIN dbo.auth_credential c ON c.user_id=u.id
                  JOIN dbo.user_role ur ON ur.user_id=u.id JOIN dbo.[role] r ON r.id=ur.role_id
                  WHERE u.account_status=N'active' AND r.role_code=N'reviewer') >= 1
             AND (SELECT COUNT(DISTINCT u.id) FROM dbo.app_user u JOIN dbo.auth_credential c ON c.user_id=u.id
                  JOIN dbo.user_role ur ON ur.user_id=u.id JOIN dbo.[role] r ON r.id=ur.role_id
                  WHERE u.account_status=N'active' AND r.role_code IN (N'publisher',N'admin')) >= 1
        THEN N'Du vai tro, nhung phai la 3 NGUOI KHAC NHAU khi duyet/cong bo'
        ELSE N'THIEU vai tro soan / duyet / cong bo' END AS phan_tach_vai_tro;
GO

/* ===== [10] PHAN HOI ===== */
IF OBJECT_ID(N'dbo.site_feedback',N'U') IS NOT NULL
    SELECT N'site_feedback' AS bang, status, COUNT(*) AS so_luong FROM dbo.site_feedback GROUP BY status
    UNION ALL SELECT N'(tong)', N'-', COUNT(*) FROM dbo.site_feedback;
ELSE PRINT N'Chua co site_feedback - chay file 02.';
IF OBJECT_ID(N'dbo.assistant_feedback',N'U') IS NOT NULL
    SELECT N'assistant_feedback' AS bang, review_status, COUNT(*) AS so_luong FROM dbo.assistant_feedback GROUP BY review_status;
GO
