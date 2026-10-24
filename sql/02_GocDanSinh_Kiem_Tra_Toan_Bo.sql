/*
  GOC DAN SINH | FILE 02: KIEM TRA CSDL (CHI DOC)
  SQL SERVER 2022 | DATABASE: [GocDanSinh]

  Chay sau File 01, hoac chay lai bat ky luc nao de giam sat du lieu.
  Khong INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, EXEC workflow.
  Du kien sau File 01: 52 bang, 116 khoa ngoai, 3 module, 5 vai tro.
  Du kien co 1 ban nhap ho chieu, 10 giay to, 6 phi, 8 snapshot va 7 luat.

  CAC NHOM KIEM TRA:
  01 ket noi, 02 bang/FK, 03 stored procedure & function,
  04 3 module, 05 nguoi dung/quyen, 06 bai viet/phien ban,
  07 thu tuc hanh chinh, 08 quyen loi, 09 lua dao,
  10 nguon/snapshot, 11 van ban phap ly, 12 toan ven noi dung,
  13 du lieu duoc cong khai, 14 lich su kiem duyet,
  15 AI/RAG, 16 bao cao tong ket, 17 canh bao cau truc, 18 doi chieu B1-B6.
*/

USE [GocDanSinh];  -- Chon dung database moi duoc tao boi File 01.
GO
SET NOCOUNT ON;

-- =====================================================================
-- [01] KẾT NỐI SQL SERVER / DATABASE / TÀI KHOẢN ĐANG THỰC THI
-- =====================================================================
SELECT N'01 - KẾT NỐI DATABASE' AS NhomKiemTra,
       DB_NAME() AS DatabaseName,
       @@SERVERNAME AS ServerName,
       ORIGINAL_LOGIN() AS LoginName,
       SYSTEM_USER AS CurrentSqlIdentity,
       USER_NAME() AS DatabaseUser,
       SYSDATETIME() AS ServerLocalTime,
       SYSUTCDATETIME() AS ServerUtcTime,
       SERVERPROPERTY('ProductVersion') AS SqlServerVersion;
GO

-- =====================================================================
-- [02] CẤU TRÚC ERD: 52 BẢNG - 116 FK - 329 CỘT
-- Lưu ý: bảng sysdiagrams là bảng hỗ trợ SSMS, KHÔNG thuộc ERD.
-- =====================================================================
SELECT N'02 - CẤU TRÚC ERD' AS NhomKiemTra,
       (SELECT COUNT(*) FROM sys.tables t
        WHERE t.schema_id=SCHEMA_ID(N'dbo') AND t.name NOT IN (N'sysdiagrams',N'auth_credential',N'auth_session')) AS SoBangERD,
       52 AS SoBangKyVong,
       (SELECT COUNT(*) FROM sys.columns c JOIN sys.tables t ON c.object_id=t.object_id
        WHERE t.schema_id=SCHEMA_ID(N'dbo') AND t.name NOT IN (N'sysdiagrams',N'auth_credential',N'auth_session')) AS SoCot,
       329 AS SoCotKyVong,
       (SELECT COUNT(*) FROM sys.foreign_keys fk
        WHERE fk.schema_id=SCHEMA_ID(N'dbo') AND OBJECT_NAME(fk.parent_object_id) NOT IN (N'auth_credential',N'auth_session')) AS SoKhoaNgoai,
       116 AS SoKhoaNgoaiKyVong,
       (SELECT COUNT(*) FROM sys.foreign_keys fk
        WHERE fk.schema_id=SCHEMA_ID(N'dbo') AND OBJECT_NAME(fk.parent_object_id) NOT IN (N'auth_credential',N'auth_session') AND (fk.is_disabled=1 OR fk.is_not_trusted=1)) AS FKKhongTinCay,
       (SELECT COUNT(*) FROM sys.check_constraints ck
        JOIN sys.tables t ON ck.parent_object_id=t.object_id
        WHERE t.schema_id=SCHEMA_ID(N'dbo') AND (ck.is_disabled=1 OR ck.is_not_trusted=1)) AS CheckKhongTinCay;
GO

-- Xem tên tất cả các bảng (52 bảng ERD, không bao gồm sysdiagrams).
SELECT t.name AS TenBang,
       (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id=t.object_id) AS SoCot,
       (SELECT COUNT(*) FROM sys.foreign_keys fk WHERE fk.parent_object_id=t.object_id) AS SoFKDi,
       (SELECT COUNT(*) FROM sys.triggers tr WHERE tr.parent_id=t.object_id AND tr.is_disabled=0) AS SoTriggerDangBat
FROM sys.tables t
WHERE t.schema_id=SCHEMA_ID(N'dbo') AND t.name NOT IN (N'sysdiagrams',N'auth_credential',N'auth_session')
ORDER BY t.name;
GO

-- =====================================================================
-- [03] STORED PROCEDURE, VIEW, FUNCTION QUAN TRỌNG
-- ĐÂY CHỈ LÀ KIỂM TRA CHÚNG CÓ TỒN TẠI, KHÔNG GỌI DUYỆT/CÔNG BỐ.
-- =====================================================================
SELECT needed.object_type AS Loai,
       needed.object_name AS TenDoiTuong,
       CASE WHEN OBJECT_ID(needed.object_name,needed.object_type) IS NOT NULL
            THEN N'PASS' ELSE N'MISSING' END AS KetQua
FROM (VALUES
 (N'P',N'dbo.usp_approve_knowledge_version'),
 (N'P',N'dbo.usp_publish_knowledge_version'),
 (N'P',N'dbo.usp_withdraw_knowledge_version'),
 (N'P',N'dbo.usp_finalize_generated_answer'),
 (N'IF',N'dbo.fn_knowledge_for_date_and_unit'),
 (N'IF',N'dbo.fn_legal_provision_as_of'),
 (N'V',N'dbo.v_latest_snapshot_verification')
) AS needed(object_type,object_name);
GO

-- =====================================================================
-- [04] BA MODULE CHÍNH - LEGAL / ADMIN / SCAM
-- =====================================================================
SELECT d.id,d.code,d.name,d.is_active,
       (SELECT COUNT(*) FROM dbo.category c WHERE c.domain_id=d.id) AS SoDanhMuc,
       (SELECT COUNT(*) FROM dbo.knowledge_item i WHERE i.domain_id=d.id AND i.deleted_at IS NULL) AS SoBaiNghiepVu,
       (SELECT COUNT(*) FROM dbo.knowledge_item i
        JOIN dbo.knowledge_version v ON v.item_id=i.id
        WHERE i.domain_id=d.id AND v.editorial_status=N'published'
          AND v.withdrawn_at IS NULL) AS SoPhienBanPublished
FROM dbo.[domain] d
ORDER BY d.id;
GO

-- Xem toàn bộ danh mục con và trạng thái của ba module.
SELECT d.code AS ModuleCode,c.id AS CategoryID,c.code AS CategoryCode,
       c.name AS CategoryName,c.parent_id,c.is_active
FROM dbo.category c JOIN dbo.[domain] d ON d.id=c.domain_id
ORDER BY d.code,c.parent_id,c.name;
GO

-- Cảnh báo nếu knowledge_item được gán sai module so với kind.
SELECT i.id, i.business_code, i.kind, d.code AS ActualDomain,
       N'SAI KIND/MODULE' AS Warning
FROM dbo.knowledge_item i JOIN dbo.[domain] d ON d.id=i.domain_id
WHERE NOT (
 (i.kind=N'benefit' AND d.code=N'LEGAL') OR
 (i.kind=N'procedure' AND d.code=N'ADMIN') OR
 (i.kind=N'scam' AND d.code=N'SCAM')
);
GO

-- =====================================================================
-- [05] NGƯỜI DÙNG / PHÂN QUYỀN ỨNG DỤNG
-- Hai tài khoản demo nếu có KHÔNG phải tài khoản đăng nhập thật của website.
-- =====================================================================
SELECT u.id, u.display_name,u.email,u.account_status,
       STRING_AGG(r.role_code,N', ') AS Roles,
       CASE WHEN u.email LIKE N'%.invalid' OR u.email LIKE N'%demo%'
            THEN N'DEMO - không dùng làm xác minh pháp lý'
            ELSE N'CẦN KIỂM TRA HỆ THỐNG XÁC THỰC' END AS GhiChu
FROM dbo.app_user u
LEFT JOIN dbo.user_role ur ON ur.user_id=u.id
LEFT JOIN dbo.[role] r ON r.id=ur.role_id
GROUP BY u.id,u.display_name,u.email,u.account_status
ORDER BY u.id;
GO

SELECT r.role_code,r.role_name,COUNT(DISTINCT CASE WHEN u.account_status=N'active' THEN u.id END) AS SoNguoiDungActive
FROM dbo.[role] r
LEFT JOIN dbo.user_role ur ON ur.role_id=r.id
LEFT JOIN dbo.app_user u ON u.id=ur.user_id
GROUP BY r.role_code,r.role_name
ORDER BY r.role_code;
GO

-- =====================================================================
-- [06] TẤT CẢ NỘI DUNG VÀ TRẠNG THÁI BIÊN TẬP
-- =====================================================================
SELECT d.code AS ModuleCode,i.id AS ItemID,i.business_code,i.kind,
       v.id AS VersionID,v.version_no,v.title,v.editorial_status,
       v.effective_from,v.effective_to,v.approved_by,v.approved_at,
       v.published_at,v.withdrawn_at,v.created_by,
       CASE WHEN v.content_sha256=HASHBYTES('SHA2_256',CONVERT(VARBINARY(MAX),v.body_markdown))
            THEN N'PASS' ELSE N'FAIL' END AS BodyHashCheck
FROM dbo.knowledge_item i
JOIN dbo.[domain] d ON d.id=i.domain_id
JOIN dbo.knowledge_version v ON v.item_id=i.id
ORDER BY d.code,i.id,v.version_no;
GO

-- Số bản nháp, đang kiểm duyệt, đã duyệt, đã công bố theo từng module.
SELECT d.code AS ModuleCode,v.editorial_status,COUNT(*) AS SoPhienBan
FROM dbo.knowledge_version v
JOIN dbo.knowledge_item i ON i.id=v.item_id
JOIN dbo.[domain] d ON d.id=i.domain_id
GROUP BY d.code,v.editorial_status
ORDER BY d.code,v.editorial_status;
GO

-- =====================================================================
-- [07] MODULE ADMIN: THỦ TỤC HÀNH CHÍNH
-- Số bước, giấy tờ, cách nộp, lệ phí, liên kết chứng cứ cho MỌI thủ tục.
-- =====================================================================
SELECT i.business_code,v.id AS VersionID,v.editorial_status,
       v.title,p.procedure_code,p.processing_time_text,p.result_description,
       (SELECT COUNT(*) FROM dbo.procedure_step s WHERE s.version_id=v.id) AS Steps,
       (SELECT COUNT(*) FROM dbo.procedure_requirement rq WHERE rq.version_id=v.id) AS Requirements,
       (SELECT COUNT(*) FROM dbo.procedure_office ofc WHERE ofc.version_id=v.id) AS Offices,
       (SELECT COUNT(*) FROM dbo.procedure_fee f WHERE f.version_id=v.id) AS FeeCases,
       (SELECT COUNT(*) FROM dbo.knowledge_version_source ks WHERE ks.version_id=v.id) AS LinkedSnapshots,
       (SELECT COUNT(*) FROM dbo.knowledge_basis_document b WHERE b.knowledge_version_id=v.id) AS LinkedLegalDocuments
FROM dbo.procedure_detail p
JOIN dbo.knowledge_version v ON v.id=p.version_id
JOIN dbo.knowledge_item i ON i.id=v.item_id
ORDER BY i.id,v.version_no;
GO

-- Chi tiết trình tự thực hiện.
SELECT i.business_code,v.version_no,s.step_no,s.step_title,s.instruction
FROM dbo.procedure_step s
JOIN dbo.knowledge_version v ON v.id=s.version_id
JOIN dbo.knowledge_item i ON i.id=v.item_id
ORDER BY i.business_code,v.version_no,s.step_no;
GO

-- Giấy tờ cần có và điều kiện áp dụng.
SELECT i.business_code,v.version_no,rq.requirement_no,dt.code AS DocumentCode,
       dt.name AS DocumentName,rq.is_required,rq.quantity,rq.condition_note
FROM dbo.procedure_requirement rq
JOIN dbo.document_type dt ON dt.id=rq.document_type_id
JOIN dbo.knowledge_version v ON v.id=rq.version_id
JOIN dbo.knowledge_item i ON i.id=v.item_id
ORDER BY i.business_code,v.version_no,rq.requirement_no;
GO

-- Các trường hợp tính lệ phí; KHÔNG tự cộng các dòng vì có điều kiện.
SELECT i.business_code,p.procedure_code,v.version_no,f.fee_kind,f.amount,f.currency_code,f.pricing_rule,
       N'CẦN ĐỐI CHIẾU ĐIỀU KIỆN, MỐC HIỆU LỰC VÀ NGUỒN PHÁP LÝ' AS PhapLyCanLuuY
FROM dbo.procedure_fee f
JOIN dbo.procedure_detail p ON p.version_id=f.version_id
JOIN dbo.knowledge_version v ON v.id=f.version_id
JOIN dbo.knowledge_item i ON i.id=v.item_id
ORDER BY i.business_code,v.version_no,f.fee_kind;
GO

-- Cơ quan tiếp nhận và hình thức nộp.
SELECT i.business_code,v.version_no,o.name AS OrganizationName,
       po.office_role,po.submission_channel,po.instructions
FROM dbo.procedure_office po
JOIN dbo.knowledge_version v ON v.id=po.version_id
JOIN dbo.knowledge_item i ON i.id=v.item_id
JOIN dbo.organization o ON o.id=po.organization_id
ORDER BY i.business_code,v.version_no,po.submission_channel;
GO

-- =====================================================================
-- [08] MODULE LEGAL: PHÁP LUẬT & QUYỀN LỢI
-- Bao gồm các nội dung quyền lợi và văn bản pháp luật liên quan.
-- =====================================================================
SELECT i.business_code,v.id AS VersionID,v.editorial_status,v.title,
       b.beneficiary_group,b.entitlement_text,b.claim_guidance,
       (SELECT COUNT(*) FROM dbo.benefit_condition bc WHERE bc.version_id=v.id) AS SoDieuKien
FROM dbo.benefit_detail b
JOIN dbo.knowledge_version v ON v.id=b.version_id
JOIN dbo.knowledge_item i ON i.id=v.item_id
ORDER BY i.business_code,v.version_no;
GO

SELECT i.business_code,v.version_no,bc.condition_no,bc.condition_type,bc.condition_text
FROM dbo.benefit_condition bc
JOIN dbo.knowledge_version v ON v.id=bc.version_id
JOIN dbo.knowledge_item i ON i.id=v.item_id
ORDER BY i.business_code,v.version_no,bc.condition_no;
GO

-- =====================================================================
-- [09] MODULE SCAM: CẢNH BÁO LỪA ĐẢO
-- =====================================================================
SELECT i.business_code,v.id AS VersionID,v.editorial_status,v.title,
       s.severity,s.mechanism,s.warning_signs,s.immediate_actions,s.reporting_guidance,
       (SELECT COUNT(*) FROM dbo.scam_indicator si WHERE si.version_id=v.id) AS SoDauHieu
FROM dbo.scam_detail s
JOIN dbo.knowledge_version v ON v.id=s.version_id
JOIN dbo.knowledge_item i ON i.id=v.item_id
ORDER BY i.business_code,v.version_no;
GO

SELECT i.business_code,v.version_no,si.indicator_no,si.indicator_kind,
       si.description,si.evidence_snapshot_id
FROM dbo.scam_indicator si
JOIN dbo.knowledge_version v ON v.id=si.version_id
JOIN dbo.knowledge_item i ON i.id=v.item_id
ORDER BY i.business_code,v.version_no,si.indicator_no;
GO

-- =====================================================================
-- [10] NGUỒN DỮ LIỆU VÀ BẢN LƯU (SNAPSHOTS)
-- CHÚ Ý: PASS_DB_ONLY chỉ so sánh hai mã băm ĐÃ LƯU trong database.
-- Nó KHÔNG có nghĩa file PDF vật lý trên ổ đĩa đã được kiểm chứng.
-- =====================================================================
SELECT ss.id AS SnapshotID,src.id AS SourceID,src.title AS SourceTitle,
       src.canonical_url,src.trust_tier,ss.captured_at,ss.capture_method,
       fa.storage_key,fa.size_bytes,
       CONVERT(VARCHAR(64),ss.content_sha256,2) AS SnapshotSha256,
       CONVERT(VARCHAR(64),fa.sha256,2) AS FileAssetSha256,
       CASE WHEN fa.id IS NULL THEN N'KHÔNG CÓ FILE_ASSET'
            WHEN ss.content_sha256=fa.sha256 THEN N'PASS_DB_ONLY'
            ELSE N'MISMATCH_DB' END AS HashMetadataCheck,
       COALESCE(latest.decision,N'not_reviewed') AS LatestVerification,
       latest.valid_until AS VerificationValidUntilUTC,
       latest.verified_at AS VerifiedAtUTC
FROM dbo.source_snapshot ss
JOIN dbo.[source] src ON src.id=ss.source_id
LEFT JOIN dbo.file_asset fa ON fa.id=ss.file_asset_id
OUTER APPLY (
    SELECT TOP (1) v.decision,v.verified_at,v.valid_until
    FROM dbo.source_verification v
    WHERE v.source_snapshot_id=ss.id AND v.verified_at<=SYSUTCDATETIME()
    ORDER BY v.verified_at DESC,v.id DESC
) latest
ORDER BY ss.id;
GO

-- Tóm tắt nguồn đang liên kết với từng phiên bản.
SELECT i.business_code,v.version_no,ks.snapshot_id,src.title AS EvidenceTitle,
       ks.evidence_role,ks.locator
FROM dbo.knowledge_version_source ks
JOIN dbo.knowledge_version v ON v.id=ks.version_id
JOIN dbo.knowledge_item i ON i.id=v.item_id
JOIN dbo.source_snapshot ss ON ss.id=ks.snapshot_id
JOIN dbo.[source] src ON src.id=ss.source_id
ORDER BY i.business_code,v.version_no,ks.snapshot_id;
GO

-- =====================================================================
-- [11] VĂN BẢN PHÁP LUẬT VÀ CĂN CỨ CỦA BÀI VIẾT
-- =====================================================================
SELECT ld.id AS LegalDocumentID,ld.document_number,ld.title,ld.document_kind,
       org.name AS IssuingOrganization,ld.issued_on,ld.effective_from,ld.effective_to,
       ld.official_status_note
FROM dbo.legal_document ld
JOIN dbo.organization org ON org.id=ld.issuing_organization_id
ORDER BY ld.id;
GO

SELECT i.business_code,v.version_no,ld.document_number,ld.title AS LegalDocumentTitle,
       kb.basis_role
FROM dbo.knowledge_basis_document kb
JOIN dbo.knowledge_version v ON v.id=kb.knowledge_version_id
JOIN dbo.knowledge_item i ON i.id=v.item_id
JOIN dbo.legal_document ld ON ld.id=kb.legal_document_id
ORDER BY i.business_code,v.version_no,ld.document_number;
GO

-- =====================================================================
-- [12] KIỂM TRA TÍNH HOÀN CHỈNH NỘI DUNG NGHIỆP VỤ (MỌI MODULE)
-- Trên database mới chưa nhập bài viết, kết quả có thể rỗng.
-- Chưa có nguồn được người thật xác minh => không coi là đủ điều kiện công bố.
-- =====================================================================
SELECT i.business_code,i.kind,v.id AS VersionID,v.editorial_status,
       CASE WHEN v.content_sha256=HASHBYTES('SHA2_256',CONVERT(VARBINARY(MAX),v.body_markdown))
            THEN N'PASS' ELSE N'FAIL' END AS BodyHash,
       (SELECT COUNT(*) FROM dbo.knowledge_version_source s WHERE s.version_id=v.id) AS SoNguon,
       (SELECT COUNT(*) FROM dbo.item_scope s WHERE s.version_id=v.id) AS SoPhamVi,
       CASE WHEN i.kind=N'procedure' AND NOT EXISTS(SELECT 1 FROM dbo.procedure_detail p WHERE p.version_id=v.id)
            THEN N'THIẾU CHI TIẾT THỦ TỤC'
            WHEN i.kind=N'benefit' AND NOT EXISTS(SELECT 1 FROM dbo.benefit_detail b WHERE b.version_id=v.id)
            THEN N'THIẾU CHI TIẾT QUYỀN LỢI'
            WHEN i.kind=N'scam' AND NOT EXISTS(SELECT 1 FROM dbo.scam_detail s WHERE s.version_id=v.id)
            THEN N'THIẾU CHI TIẾT CẢNH BÁO'
            ELSE N'ĐÃ CÓ BẢNG CHI TIẾT' END AS KiemTraLoai
FROM dbo.knowledge_version v
JOIN dbo.knowledge_item i ON i.id=v.item_id
ORDER BY i.kind,i.business_code,v.version_no;
GO

-- =====================================================================
-- [13] MÔ PHỎNG TRA CỨU CÔNG KHAI / 3 MODULE TẠI THỜI ĐIỂM HIỆN TẠI
-- Chỉ published + đúng thời gian hiệu lực + không bị thu hồi + không xung đột.
-- Không có dữ liệu công khai là BÌNH THƯỜNG nếu mới có bản nháp draft.
-- Với @admin_unit_id = NULL, chỉ trả lại nội dung phạm vi toàn quốc.
-- =====================================================================
DECLARE @AsOf DATE=CONVERT(DATE,SYSDATETIME()),
        @NowUtc DATETIME2(3)=SYSUTCDATETIME(),
        @AdminUnitID BIGINT=NULL;
SELECT d.code AS ModuleCode,i.business_code,i.kind,r.version_id,
       r.title,r.resolution_status,kv.editorial_status,
       kv.effective_from,kv.effective_to,kv.published_at
FROM dbo.fn_knowledge_for_date_and_unit(@AsOf,@AdminUnitID,@NowUtc) r
JOIN dbo.knowledge_item i ON i.id=r.item_id
JOIN dbo.[domain] d ON d.id=i.domain_id
JOIN dbo.knowledge_version kv ON kv.id=r.version_id
WHERE r.resolution_status=N'OK' AND i.deleted_at IS NULL
ORDER BY d.code,i.business_code;
GO

-- =====================================================================
-- [14] KIỂM TRA LỊCH SỬ DUYỆT/CÔNG BỐ; KHÔNG GỌI STORED PROCEDURE DUYỆT.
-- =====================================================================
SELECT me.id,i.business_code,me.version_id,me.actor_id,u.email AS ActorEmail,
       me.action,me.from_status,me.to_status,me.occurred_at,me.reason_note
FROM dbo.moderation_event me
JOIN dbo.knowledge_version v ON v.id=me.version_id
JOIN dbo.knowledge_item i ON i.id=v.item_id
JOIN dbo.app_user u ON u.id=me.actor_id
ORDER BY me.occurred_at DESC,me.id DESC;
GO

-- =====================================================================
-- [15] AI/RAG CHỈ KIỂM TRA DỮ LIỆU: KHÔNG GỌI MÔ HÌNH AI
-- =====================================================================
SELECT N'conversations' AS DataGroup,COUNT(*) AS SoBanGhi FROM dbo.conversation
UNION ALL SELECT N'messages',COUNT(*) FROM dbo.[message]
UNION ALL SELECT N'content_documents',COUNT(*) FROM dbo.content_document
UNION ALL SELECT N'content_chunks',COUNT(*) FROM dbo.content_chunk
UNION ALL SELECT N'query_analyses',COUNT(*) FROM dbo.query_analysis
UNION ALL SELECT N'retrieval_runs',COUNT(*) FROM dbo.retrieval_run
UNION ALL SELECT N'generated_answers',COUNT(*) FROM dbo.generated_answer
UNION ALL SELECT N'answer_citations',COUNT(*) FROM dbo.answer_citation;
GO

-- =====================================================================
-- [16] TỔNG KẾT KIỂM TRA: Đây là chẩn đoán kỹ thuật, KHÔNG phải giấy xác minh pháp lý.
-- =====================================================================
SELECT N'GÓC DÂN SINH - CHECK SUMMARY' AS Report,
       DB_NAME() AS DatabaseName,
       (SELECT COUNT(*) FROM sys.tables
        WHERE schema_id=SCHEMA_ID(N'dbo') AND name NOT IN (N'sysdiagrams',N'auth_credential',N'auth_session')) AS Tables,
       (SELECT COUNT(*) FROM sys.foreign_keys
        WHERE schema_id=SCHEMA_ID(N'dbo') AND OBJECT_NAME(parent_object_id) NOT IN (N'auth_credential',N'auth_session')) AS ForeignKeys,
       (SELECT COUNT(*) FROM dbo.[domain]) AS Modules,
       (SELECT COUNT(*) FROM dbo.category) AS Categories,
       (SELECT COUNT(*) FROM dbo.knowledge_item) AS KnowledgeItems,
       (SELECT COUNT(*) FROM dbo.knowledge_version) AS KnowledgeVersions,
       (SELECT COUNT(*) FROM dbo.knowledge_version WHERE editorial_status=N'draft') AS DraftVersions,
       (SELECT COUNT(*) FROM dbo.knowledge_version WHERE editorial_status=N'published') AS PublishedVersions,
       (SELECT COUNT(*) FROM dbo.source_snapshot) AS Snapshots,
       (SELECT COUNT(*) FROM dbo.legal_document) AS LegalDocuments,
       (SELECT COUNT(*) FROM dbo.procedure_detail) AS ProcedureDetails,
       (SELECT COUNT(*) FROM dbo.benefit_detail) AS BenefitDetails,
       (SELECT COUNT(*) FROM dbo.scam_detail) AS ScamDetails;
GO


-- =====================================================================
-- [17] KIỂM TRA CHẶT CHẼ: CẤU TRÚC DATABASE PHẢI ĐỦ 52 BẢNG / 116 FK
-- Chỉ thông báo lỗi nếu thiếu cấu trúc; không thay đổi dữ liệu.
-- =====================================================================
DECLARE @TableCount INT = (
    SELECT COUNT(*) FROM sys.tables
    WHERE schema_id=SCHEMA_ID(N'dbo') AND name NOT IN (N'sysdiagrams',N'auth_credential',N'auth_session')
);
DECLARE @FkCount INT = (
    SELECT COUNT(*) FROM sys.foreign_keys WHERE schema_id=SCHEMA_ID(N'dbo') AND OBJECT_NAME(parent_object_id) NOT IN (N'auth_credential',N'auth_session')
);
DECLARE @ActiveDomainCount INT = (
    SELECT COUNT(*) FROM dbo.[domain] WHERE code IN (N'LEGAL',N'ADMIN',N'SCAM') AND is_active=1
);
SELECT N'17 - TỔNG KẾT KIỂM TRA CẤU TRÚC' AS NhomKiemTra,
       @TableCount AS BangThucTe, 52 AS BangMongDoi,
       @FkCount AS FKThucTe, 116 AS FKMongDoi,
       @ActiveDomainCount AS ModuleHoatDong,
       CASE WHEN @TableCount=52 AND @FkCount=116 AND @ActiveDomainCount=3
            THEN N'PASS' ELSE N'FAIL' END AS KetQua;
IF @TableCount<>52 OR @FkCount<>116 OR @ActiveDomainCount<>3
    PRINT N'CANH BAO: Cau truc hoac 3 module chua dat mong doi. Xem tab Results.';
GO


-- =====================================================================
-- [18] KIEM TRA DOI CHIEU DUNG KET QUA BUOC 1-6 DA TAI DUNG
-- =====================================================================
SELECT N'SUMMARY B1-B6' AS NhomKiemTra,
 (SELECT COUNT(*) FROM dbo.category) AS SoDanhMuc,
 (SELECT COUNT(*) FROM dbo.app_user WHERE email LIKE N'%@example.invalid') AS SoTaiKhoanDemo,
 (SELECT COUNT(*) FROM dbo.[source]) AS SoNguon,
 (SELECT COUNT(*) FROM dbo.file_asset) AS SoMetadataPDF,
 (SELECT COUNT(*) FROM dbo.source_snapshot) AS SoSnapshot,
 (SELECT COUNT(*) FROM dbo.legal_document) AS SoVanBanPhapLy,
 (SELECT COUNT(*) FROM dbo.procedure_step) AS SoBuocThuTuc,
 (SELECT COUNT(*) FROM dbo.procedure_requirement) AS SoThanhPhanHoSo,
 (SELECT COUNT(*) FROM dbo.procedure_fee) AS SoQuyTacLePhi,
 (SELECT COUNT(*) FROM dbo.knowledge_basis_document) AS SoCanCuLienKet,
 (SELECT COUNT(*) FROM dbo.knowledge_version_source) AS SoSnapshotLienKet,
 (SELECT COUNT(*) FROM dbo.knowledge_version WHERE editorial_status=N'published') AS SoPhienBanCongBo;
GO

-- Kiem tra 8 ma bam dong thoi tren database (KHONG phai kiem tra byte PDF ngoai o dia).
DECLARE @Expected TABLE(storage_key NVARCHAR(500) PRIMARY KEY, expected_sha BINARY(32), expected_size BIGINT);
INSERT @Expected VALUES
 (N'evidence/thu-tuc/26270/phieu_huong_dan_2026-10-09.pdf',0x95B8C532688CC3709D50DEE120DAA2CFB44F75ADC3EB0E13F4D7C0344CD4F7BE,713167),
 (N'evidence/legal/28-2026-TT-BTC.pdf',0xFA10E2FC490C212BE3EA4D4BED2EB63759500D1C2462FC6F48E09D1E9E92FA67,661231),
 (N'evidence/legal/64-2025-TT-BTC.pdf',0xE7032EFEC4BB4A46EADDBA85F5A971AF5C7D85F9FFA9D5043BE0EBB67267A67A,360730),
 (N'evidence/legal/117-2026-TT-BTC.pdf',0x89C9FA7B24C9DB45314C42AE1B3B2DCCD9EDDAAE795F59BFC33C539FEFD17C41,724902),
 (N'evidence/new/49-2019-QH14.pdf',0x0E81FB4CBA10E2AD6F84EDE03A1C7BB72A7A0CA87A0D84DDBD16EC7083FBFE98,582447),
 (N'evidence/new/23-2023-QH15.pdf',0xD29EDFC88D3B57F5CF0D6FE519C3C80125EFE978ED01F50190D8F32318F92C60,725996),
 (N'evidence/new/118-2025-QH15.pdf',0x5F8D088496958E23D8F86B91876A4A932F92187EF970F176E07869BE97D0AD1D,584142),
 (N'evidence/new/66.22-2026-NQ-CP.pdf',0xFD62B4F1273E3D21AF996F1F76A6130E8A7CEA3BC84FE99698FD03EC2978CD1D,956603);
SELECT e.storage_key,f.size_bytes,
 CASE WHEN f.sha256=e.expected_sha AND f.size_bytes=e.expected_size
            AND ss.content_sha256=e.expected_sha THEN N'PASS_DB_METADATA' ELSE N'FAIL_DB_METADATA' END AS HashMetadataCheck,
 CONVERT(VARCHAR(64),f.sha256,2) AS Sha256
FROM @Expected e LEFT JOIN dbo.file_asset f ON f.storage_key=e.storage_key
LEFT JOIN dbo.source_snapshot ss ON ss.file_asset_id=f.id
ORDER BY e.storage_key;
GO

-- Canh bao can xac minh phap ly truoc khi phe duyet / cong bo.
SELECT kv.id AS VersionID, kv.editorial_status,pd.procedure_code,
 pf.fee_kind,pf.amount,pf.pricing_rule,
 N'CAU HOI CAN DOI CHIEU: NQ 66.22 de cap 1.001456, con ban nhap 1.001471' AS LegalScopeWarning
FROM dbo.procedure_fee pf
JOIN dbo.procedure_detail pd ON pd.version_id=pf.version_id
JOIN dbo.knowledge_version kv ON kv.id=pf.version_id
WHERE pf.fee_kind IN (N'new_citizen_exempt',N'replace_citizen_exempt');
GO

-- Khac voi login website: app_user chi co thong tin tai khoan DEMO, khong co auth.
SELECT N'KET LUAN' AS KiemTra,
 CASE WHEN EXISTS(SELECT 1 FROM dbo.knowledge_version WHERE editorial_status=N'draft')
 THEN N'DA NAP BAN NHAP - CHUA CONG BO' ELSE N'KHONG TIM THAY BAN NHAP' END AS TrangThai,
 N'CHUA luu du trang thu tuc 26270, chua co nguoi that duyet nguon' AS HanChe;
GO

-- Doi chieu CHI TIEU B1-B6 voi du lieu thuc te - fail thi xem lai File 01.
SELECT x.TieuChi,x.SoKyVong,x.SoThucTe,
 CASE WHEN x.SoThucTe=x.SoKyVong THEN N'PASS' ELSE N'NEEDS_CHECK' END AS KetQua
FROM (VALUES
 (N'BA MODULE',3,(SELECT COUNT(*) FROM dbo.domain)),
 (N'DANH MUC',9,(SELECT COUNT(*) FROM dbo.category)),
 (N'TAI KHOAN DEMO',2,(SELECT COUNT(*) FROM dbo.app_user WHERE email LIKE N'%@example.invalid')),
 (N'NGUON',9,(SELECT COUNT(*) FROM dbo.[source])),
 (N'PDF METADATA',8,(SELECT COUNT(*) FROM dbo.file_asset)),
 (N'SNAPSHOT',8,(SELECT COUNT(*) FROM dbo.source_snapshot)),
 (N'VAN BAN PHAP LUAT',7,(SELECT COUNT(*) FROM dbo.legal_document)),
 (N'BUOC THU TUC',3,(SELECT COUNT(*) FROM dbo.procedure_step)),
 (N'HO SO',10,(SELECT COUNT(*) FROM dbo.procedure_requirement)),
 (N'LE PHI',6,(SELECT COUNT(*) FROM dbo.procedure_fee)),
 (N'PHIEN BAN PUBLISHED',0,(SELECT COUNT(*) FROM dbo.knowledge_version WHERE editorial_status=N'published'))
) x(TieuChi,SoKyVong,SoThucTe)
ORDER BY x.TieuChi;
GO

-- [19] B8.1: xac thuc da tach thanh hai bang rieng (khong tinh vao 52 bang goc).
IF OBJECT_ID(N'dbo.auth_credential',N'U') IS NOT NULL AND OBJECT_ID(N'dbo.auth_session',N'U') IS NOT NULL
BEGIN
  SELECT N'19 - XAC THUC BUOC 8.1' AS NhomKiemTra,
    (SELECT COUNT(*) FROM dbo.auth_credential) AS SoTaiKhoanCoMatKhau,
    (SELECT COUNT(*) FROM dbo.auth_session WHERE revoked_at IS NULL AND expires_at>SYSUTCDATETIME()) AS PhienDangNhapConHieuLuc,
    (SELECT COUNT(*) FROM dbo.app_user WHERE email LIKE N'%@example.invalid') AS TaiKhoanDemoConNguyen;
END;
GO
