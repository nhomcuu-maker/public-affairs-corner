/*
  GOC DAN SINH | FILE 01 (BAN SACH): SCHEMA 52 BANG - KHONG CO DU LIEU DEMO
  SQL Server 2022 | Chay trong SSMS (F5) | DATABASE: [GocDanSinh]

  NOI DUNG: 52 bang / 116 khoa ngoai, khoa chinh, UNIQUE, CHECK, index, trigger,
            stored procedure, function, role SQL, seed 3 module (LEGAL/ADMIN/SCAM)
            va 4 vai tro (author/reviewer/publisher/admin).
  KHAC BAN CU: da TACH phan nap du lieu demo (tai khoan example.invalid, ho chieu 26270,
            7 van ban, 8 snapshot) ra khoi file nay. Muon du lieu mau thi dung ban goc.
  CHI CHAY KHI: tao database MOI. KHONG chay len database GocDanSinh dang hoat dong.
  SAU DO CHAY THEO THU TU: 02 -> 03 -> 04 -> 05 -> (06 tuy chon) -> 07.
  Chu y: lenh GO tach batch; kiem tra tab Messages sau khi F5.
*/

-- GÓC DÂN SINH / MICROSOFT SQL SERVER 2022
-- OFFICIAL SCHEMA FOR THE ERD gốc (52 TABLES, 329 COLUMNS, 116 FOREIGN KEYS)
-- ONLY 3 BUSINESS MODULES:
--    1) LEGAL: PHAP LUAT & QUYEN LOI
--    2) ADMIN: THU TUC HANH CHINH
--    3) SCAM: CANH BAO LUA DAO
-- CATEGORY/VERSION, GEO/ORGANIZATION, SOURCES, MODERATION, AI/RAG ARE SHARED SERVICES,
-- NOT ADDITIONAL BUSINESS MODULES.
-- Chay trong SSMS voi database chua ton tai. GO la lenh phan tach batch SSMS.
-- Khong tu dong chay cac kiem thu pha huy du lieu.
-- Can chay thuc te tren SQL Server cua ban de nghiem thu.

-- ==================================================================
-- MUC 00 Create Database: Tao database GocDanSinh
-- ==================================================================
GO
-- Execute from the master database in SSMS (SQL Server 2022).
-- Canh bao: khong su dung de cai dat de len database dang co.
USE [master];
GO
IF DB_ID(N'GocDanSinh') IS NULL
BEGIN
    CREATE DATABASE [GocDanSinh];
END;
-- Chi dung voi database MOI. Neu GocDanSinh da ton tai thi DUNG, khong bam F5 lan 2.
GO
USE [GocDanSinh];
GO
SET XACT_ABORT ON;
GO

GO

-- ==================================================================
-- MUC 01 Schema 52 Tables: Tao bang, khoa va indexes
-- ==================================================================
GO
-- GÓC DÂN SINH: database schema matches the ERD gốc (3 BUSINESS MODULES, 5 SHARED TECHNICAL AREAS).
-- LEGAL = Pháp luật & Quyền lợi; ADMIN = Thủ tục hành chính; SCAM = Cảnh báo lừa đảo.
-- NOT 8 business modules. All table/column/PK/FK definitions come from the same unchanged logical data model.
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO
-- GOC DAN SINH: SQL Server 2022 schema, run in an EMPTY database with dbo schema
-- This is an implementation-oriented schema, NOT a claimed SQL Server execution result.
-- Temporal conflict and publish authorization require stored procedure, see Review_and_Constraints.md.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- BANG domain: Ba module nghiep vu chinh cua he thong.
CREATE TABLE dbo.[domain] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [code] NVARCHAR(24) NOT NULL,
    [name] NVARCHAR(180) NOT NULL,
    [is_active] BIT NOT NULL,
    CONSTRAINT [PK_domain] PRIMARY KEY ([id])
);
GO

-- BANG category: Danh muc phan cap trong tung module.
CREATE TABLE dbo.[category] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [domain_id] BIGINT NOT NULL,
    [parent_id] BIGINT NULL,
    [code] NVARCHAR(64) NOT NULL,
    [name] NVARCHAR(180) NOT NULL,
    [is_active] BIT NOT NULL,
    CONSTRAINT [PK_category] PRIMARY KEY ([id]),
    CONSTRAINT [CK_category_not_own_parent] CHECK (parent_id IS NULL OR parent_id<>id)
);
GO

-- BANG knowledge_item: Ban ghi noi dung goc va ma nghiep vu duy nhat.
CREATE TABLE dbo.[knowledge_item] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [domain_id] BIGINT NOT NULL,
    [kind] NVARCHAR(20) NOT NULL,
    [business_code] NVARCHAR(100) NOT NULL,
    [canonical_title] NVARCHAR(300) NOT NULL,
    [created_by] BIGINT NOT NULL,
    [created_at] DATETIME2(3) NOT NULL,
    [deleted_at] DATETIME2(3) NULL,
    CONSTRAINT [PK_knowledge_item] PRIMARY KEY ([id]),
    CONSTRAINT [CK_item_kind] CHECK (kind IN ('procedure','benefit','scam'))
);
GO

-- BANG knowledge_version: Cac phien ban noi dung va trang thai bien tap.
CREATE TABLE dbo.[knowledge_version] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [item_id] BIGINT NOT NULL,
    [version_no] INT NOT NULL,
    [title] NVARCHAR(300) NOT NULL,
    [summary] NVARCHAR(1600) NOT NULL,
    [body_markdown] NVARCHAR(MAX) NOT NULL,
    [editorial_status] NVARCHAR(24) NOT NULL,
    [effective_from] DATE NULL,
    [effective_to] DATE NULL,
    [approved_at] DATETIME2(3) NULL,
    [approved_by] BIGINT NULL,
    [published_at] DATETIME2(3) NULL,
    [withdrawn_at] DATETIME2(3) NULL,
    [supersedes_version_id] BIGINT NULL,
    [content_sha256] BINARY(32) NOT NULL,
    [created_by] BIGINT NOT NULL,
    [created_at] DATETIME2(3) NOT NULL,
    CONSTRAINT [PK_knowledge_version] PRIMARY KEY ([id]),
    CONSTRAINT [CK_version_status] CHECK (editorial_status IN ('draft','review','rejected','approved','published','archived')),
    CONSTRAINT [CK_version_dates] CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_from<effective_to),
    CONSTRAINT [CK_version_not_self] CHECK (supersedes_version_id IS NULL OR supersedes_version_id<>id),
    CONSTRAINT [CK_approved_fields] CHECK (editorial_status NOT IN ('approved','published') OR (approved_at IS NOT NULL AND approved_by IS NOT NULL)),
    CONSTRAINT [CK_publication_fields] CHECK (published_at IS NULL OR (approved_at IS NOT NULL AND effective_from IS NOT NULL)),
    CONSTRAINT [CK_published_required] CHECK (editorial_status<>'published' OR published_at IS NOT NULL)
);
GO

-- BANG item_category: Gan noi dung vao danh muc, danh dau danh muc chinh.
CREATE TABLE dbo.[item_category] (
    [item_id] BIGINT NOT NULL,
    [category_id] BIGINT NOT NULL,
    [domain_id] BIGINT NOT NULL,
    [is_primary] BIT NOT NULL,
    CONSTRAINT [PK_item_category] PRIMARY KEY ([item_id], [category_id])
);
GO

-- BANG item_scope: Pham vi dia ly ap dung theo phien ban.
CREATE TABLE dbo.[item_scope] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [version_id] BIGINT NOT NULL,
    [scope_kind] NVARCHAR(16) NOT NULL,
    [admin_unit_id] BIGINT NULL,
    [scope_note] NVARCHAR(320) NULL,
    CONSTRAINT [PK_item_scope] PRIMARY KEY ([id]),
    CONSTRAINT [CK_scope_kind] CHECK ((scope_kind='nationwide' AND admin_unit_id IS NULL) OR (scope_kind='unit' AND admin_unit_id IS NOT NULL))
);
GO

-- BANG admin_unit: Don vi hanh chinh va lich su hieu luc.
CREATE TABLE dbo.[admin_unit] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [official_code] NVARCHAR(32) NOT NULL,
    [name] NVARCHAR(180) NOT NULL,
    [level] NVARCHAR(30) NOT NULL,
    [parent_id] BIGINT NULL,
    [valid_from] DATE NOT NULL,
    [valid_to] DATE NULL,
    CONSTRAINT [PK_admin_unit] PRIMARY KEY ([id]),
    CONSTRAINT [CK_admin_dates] CHECK (valid_to IS NULL OR valid_from<valid_to),
    CONSTRAINT [CK_admin_not_self] CHECK (parent_id IS NULL OR parent_id<>id)
);
GO

-- BANG admin_unit_transition: Thong tin thay doi/sap nhap don vi hanh chinh.
CREATE TABLE dbo.[admin_unit_transition] (
    [from_unit_id] BIGINT NOT NULL,
    [to_unit_id] BIGINT NOT NULL,
    [transition_on] DATE NOT NULL,
    [transition_kind] NVARCHAR(30) NOT NULL,
    [basis_note] NVARCHAR(600) NULL,
    CONSTRAINT [PK_admin_unit_transition] PRIMARY KEY ([from_unit_id], [to_unit_id], [transition_on]),
    CONSTRAINT [CK_transition_not_self] CHECK (from_unit_id<>to_unit_id)
);
GO

-- BANG organization: Co quan, don vi, to chuc ban hanh va tiep nhan.
CREATE TABLE dbo.[organization] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [parent_id] BIGINT NULL,
    [organization_code] NVARCHAR(64) NOT NULL,
    [name] NVARCHAR(240) NOT NULL,
    [organization_type] NVARCHAR(40) NOT NULL,
    [official_url] NVARCHAR(1000) NULL,
    [archived_at] DATETIME2(3) NULL,
    CONSTRAINT [PK_organization] PRIMARY KEY ([id]),
    CONSTRAINT [CK_org_parent] CHECK (parent_id IS NULL OR parent_id<>id)
);
GO

-- BANG organization_role: Vai tro cua co quan theo moc thoi gian.
CREATE TABLE dbo.[organization_role] (
    [organization_id] BIGINT NOT NULL,
    [role_code] NVARCHAR(30) NOT NULL,
    [valid_from] DATE NOT NULL,
    [valid_to] DATE NULL,
    CONSTRAINT [PK_organization_role] PRIMARY KEY ([organization_id], [role_code], [valid_from]),
    CONSTRAINT [CK_org_role_dates] CHECK (valid_to IS NULL OR valid_from<valid_to)
);
GO

-- BANG organization_jurisdiction: Dia ban co tham quyen cua co quan.
CREATE TABLE dbo.[organization_jurisdiction] (
    [organization_id] BIGINT NOT NULL,
    [admin_unit_id] BIGINT NOT NULL,
    [valid_from] DATE NOT NULL,
    [valid_to] DATE NULL,
    CONSTRAINT [PK_organization_jurisdiction] PRIMARY KEY ([organization_id], [admin_unit_id], [valid_from]),
    CONSTRAINT [CK_org_geo_dates] CHECK (valid_to IS NULL OR valid_from<valid_to)
);
GO

-- BANG file_asset: Metadata tep luu tru va ma SHA-256.
CREATE TABLE dbo.[file_asset] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [storage_key] NVARCHAR(500) NOT NULL,
    [sha256] BINARY(32) NOT NULL,
    [mime_type] NVARCHAR(120) NOT NULL,
    [size_bytes] BIGINT NOT NULL,
    [uploaded_at] DATETIME2(3) NOT NULL,
    CONSTRAINT [PK_file_asset] PRIMARY KEY ([id])
);
GO

-- BANG source: Nguon tai lieu va URL chinh thuc.
CREATE TABLE dbo.[source] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [organization_id] BIGINT NULL,
    [source_kind] NVARCHAR(30) NOT NULL,
    [title] NVARCHAR(400) NOT NULL,
    [canonical_url] NVARCHAR(1200) NULL,
    [url_sha256] BINARY(32) NULL,
    [trust_tier] INT NOT NULL,
    [created_at] DATETIME2(3) NOT NULL,
    [archived_at] DATETIME2(3) NULL,
    CONSTRAINT [PK_source] PRIMARY KEY ([id]),
    CONSTRAINT [CK_tier] CHECK (trust_tier BETWEEN 1 AND 4)
);
GO

-- BANG source_snapshot: Ban luu bat bien cua nguon tai thoi diem thu thap.
CREATE TABLE dbo.[source_snapshot] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [source_id] BIGINT NOT NULL,
    [captured_at] DATETIME2(3) NOT NULL,
    [content_sha256] BINARY(32) NOT NULL,
    [file_asset_id] BIGINT NULL,
    [captured_url] NVARCHAR(1200) NULL,
    [capture_method] NVARCHAR(25) NOT NULL,
    CONSTRAINT [PK_source_snapshot] PRIMARY KEY ([id])
);
GO

-- BANG source_verification: Lich su xac minh nguon, khong ghi de ket qua cu.
CREATE TABLE dbo.[source_verification] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [source_snapshot_id] BIGINT NOT NULL,
    [reviewer_id] BIGINT NOT NULL,
    [decision] NVARCHAR(20) NOT NULL,
    [evidence_note] NVARCHAR(1000) NOT NULL,
    [verified_at] DATETIME2(3) NOT NULL,
    [valid_until] DATETIME2(3) NULL,
    CONSTRAINT [PK_source_verification] PRIMARY KEY ([id]),
    CONSTRAINT [CK_verification_decision] CHECK (decision IN ('accepted','rejected','needs_review')),
    CONSTRAINT [CK_verification_valid] CHECK (valid_until IS NULL OR verified_at<valid_until)
);
GO

-- BANG knowledge_version_source: Gan chung cu nguon cho phien ban noi dung.
CREATE TABLE dbo.[knowledge_version_source] (
    [version_id] BIGINT NOT NULL,
    [snapshot_id] BIGINT NOT NULL,
    [evidence_role] NVARCHAR(24) NOT NULL,
    [locator] NVARCHAR(400) NULL,
    CONSTRAINT [PK_knowledge_version_source] PRIMARY KEY ([version_id], [snapshot_id])
);
GO

-- BANG legal_document: Thong tin van ban phap luat va thoi han hieu luc.
CREATE TABLE dbo.[legal_document] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [issuing_organization_id] BIGINT NOT NULL,
    [document_number] NVARCHAR(100) NOT NULL,
    [title] NVARCHAR(500) NOT NULL,
    [document_kind] NVARCHAR(60) NOT NULL,
    [issued_on] DATE NOT NULL,
    [effective_from] DATE NULL,
    [effective_to] DATE NULL,
    [official_status_note] NVARCHAR(400) NULL,
    CONSTRAINT [PK_legal_document] PRIMARY KEY ([id]),
    CONSTRAINT [CK_legal_doc_dates] CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_from<effective_to)
);
GO

-- BANG legal_document_source: Bang chung van ban phap luat tu snapshot.
CREATE TABLE dbo.[legal_document_source] (
    [legal_document_id] BIGINT NOT NULL,
    [snapshot_id] BIGINT NOT NULL,
    [evidence_role] NVARCHAR(24) NOT NULL,
    CONSTRAINT [PK_legal_document_source] PRIMARY KEY ([legal_document_id], [snapshot_id])
);
GO

-- BANG legal_document_relation: Quan he sua doi, thay the, bai bo van ban.
CREATE TABLE dbo.[legal_document_relation] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [from_document_id] BIGINT NOT NULL,
    [to_document_id] BIGINT NOT NULL,
    [relation_kind] NVARCHAR(24) NOT NULL,
    [effective_on] DATE NOT NULL,
    [note] NVARCHAR(800) NULL,
    CONSTRAINT [PK_legal_document_relation] PRIMARY KEY ([id]),
    CONSTRAINT [CK_document_relation_not_self] CHECK (from_document_id<>to_document_id)
);
GO

-- BANG legal_provision: Cau truc dieu/khoan/diem cua van ban.
CREATE TABLE dbo.[legal_provision] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [legal_document_id] BIGINT NOT NULL,
    [parent_id] BIGINT NULL,
    [provision_level] NVARCHAR(24) NOT NULL,
    [provision_label] NVARCHAR(60) NOT NULL,
    [locator_path] NVARCHAR(250) NOT NULL,
    [sequence_no] INT NOT NULL,
    CONSTRAINT [PK_legal_provision] PRIMARY KEY ([id]),
    CONSTRAINT [CK_provision_not_self] CHECK (parent_id IS NULL OR parent_id<>id)
);
GO

-- BANG legal_provision_version: Noi dung tung lan sua doi dieu/khoan.
CREATE TABLE dbo.[legal_provision_version] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [provision_id] BIGINT NOT NULL,
    [revision_no] INT NOT NULL,
    [provision_text] NVARCHAR(MAX) NOT NULL,
    [effective_from] DATE NOT NULL,
    [effective_to] DATE NULL,
    [change_document_id] BIGINT NULL,
    [change_kind] NVARCHAR(25) NOT NULL,
    [text_sha256] BINARY(32) NOT NULL,
    CONSTRAINT [PK_legal_provision_version] PRIMARY KEY ([id]),
    CONSTRAINT [CK_provision_version_date] CHECK (effective_to IS NULL OR effective_from<effective_to)
);
GO

-- BANG provision_version_source: Nguon chung minh dieu khoan phien ban.
CREATE TABLE dbo.[provision_version_source] (
    [provision_version_id] BIGINT NOT NULL,
    [snapshot_id] BIGINT NOT NULL,
    CONSTRAINT [PK_provision_version_source] PRIMARY KEY ([provision_version_id], [snapshot_id])
);
GO

-- BANG knowledge_basis_document: Lien ket noi dung voi van ban lam can cu.
CREATE TABLE dbo.[knowledge_basis_document] (
    [knowledge_version_id] BIGINT NOT NULL,
    [legal_document_id] BIGINT NOT NULL,
    [basis_role] NVARCHAR(24) NOT NULL,
    CONSTRAINT [PK_knowledge_basis_document] PRIMARY KEY ([knowledge_version_id], [legal_document_id])
);
GO

-- BANG knowledge_basis_provision: Lien ket noi dung voi dieu khoan cu the.
CREATE TABLE dbo.[knowledge_basis_provision] (
    [knowledge_version_id] BIGINT NOT NULL,
    [provision_version_id] BIGINT NOT NULL,
    [basis_role] NVARCHAR(24) NOT NULL,
    CONSTRAINT [PK_knowledge_basis_provision] PRIMARY KEY ([knowledge_version_id], [provision_version_id])
);
GO

-- BANG document_type: Danh muc cac loai giay to trong thu tuc.
CREATE TABLE dbo.[document_type] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [code] NVARCHAR(60) NOT NULL,
    [name] NVARCHAR(220) NOT NULL,
    CONSTRAINT [PK_document_type] PRIMARY KEY ([id])
);
GO

-- BANG form_template: Mau don/giay to co file va snapshot xac minh.
CREATE TABLE dbo.[form_template] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [document_type_id] BIGINT NOT NULL,
    [file_asset_id] BIGINT NOT NULL,
    [verified_snapshot_id] BIGINT NOT NULL,
    [template_code] NVARCHAR(80) NOT NULL,
    [template_version] INT NOT NULL,
    CONSTRAINT [PK_form_template] PRIMARY KEY ([id])
);
GO

-- BANG procedure_detail: Thong tin chi tiet mot thu tuc hanh chinh.
CREATE TABLE dbo.[procedure_detail] (
    [version_id] BIGINT NOT NULL,
    [procedure_code] NVARCHAR(100) NOT NULL,
    [eligibility_note] NVARCHAR(MAX) NOT NULL,
    [result_description] NVARCHAR(1400) NOT NULL,
    [processing_time_text] NVARCHAR(500) NOT NULL,
    CONSTRAINT [PK_procedure_detail] PRIMARY KEY ([version_id])
);
GO

-- BANG procedure_step: Cac buoc thuc hien thu tuc theo thu tu.
CREATE TABLE dbo.[procedure_step] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [version_id] BIGINT NOT NULL,
    [step_no] INT NOT NULL,
    [step_title] NVARCHAR(300) NOT NULL,
    [instruction] NVARCHAR(MAX) NOT NULL,
    CONSTRAINT [PK_procedure_step] PRIMARY KEY ([id]),
    CONSTRAINT [CK_step_no] CHECK (step_no>=1)
);
GO

-- BANG procedure_requirement: Thanh phan ho so va dieu kien bat buoc.
CREATE TABLE dbo.[procedure_requirement] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [version_id] BIGINT NOT NULL,
    [requirement_no] INT NOT NULL,
    [document_type_id] BIGINT NOT NULL,
    [form_template_id] BIGINT NULL,
    [is_required] BIT NOT NULL,
    [quantity] INT NOT NULL,
    [condition_note] NVARCHAR(1200) NULL,
    CONSTRAINT [PK_procedure_requirement] PRIMARY KEY ([id]),
    CONSTRAINT [CK_requirement_qty] CHECK (quantity>=1)
);
GO

-- BANG procedure_fee: Cac muc phi/le phi co dieu kien ap dung.
CREATE TABLE dbo.[procedure_fee] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [version_id] BIGINT NOT NULL,
    [fee_kind] NVARCHAR(30) NOT NULL,
    [amount] DECIMAL(18,2) NULL,
    [currency_code] NVARCHAR(3) NOT NULL,
    [pricing_rule] NVARCHAR(1000) NULL,
    CONSTRAINT [PK_procedure_fee] PRIMARY KEY ([id]),
    CONSTRAINT [CK_fee_amount] CHECK (amount IS NULL OR amount>=0),
    CONSTRAINT [CK_fee_pricing] CHECK (amount IS NOT NULL OR pricing_rule IS NOT NULL)
);
GO

-- BANG procedure_office: Co quan tiep nhan va kenh nop ho so.
CREATE TABLE dbo.[procedure_office] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [version_id] BIGINT NOT NULL,
    [organization_id] BIGINT NOT NULL,
    [admin_unit_id] BIGINT NULL,
    [office_role] NVARCHAR(30) NOT NULL,
    [submission_channel] NVARCHAR(25) NOT NULL,
    [instructions] NVARCHAR(900) NULL,
    CONSTRAINT [PK_procedure_office] PRIMARY KEY ([id])
);
GO

-- BANG benefit_detail: Noi dung quyen loi va huong dan huong che do.
CREATE TABLE dbo.[benefit_detail] (
    [version_id] BIGINT NOT NULL,
    [beneficiary_group] NVARCHAR(900) NOT NULL,
    [entitlement_text] NVARCHAR(MAX) NOT NULL,
    [claim_guidance] NVARCHAR(MAX) NOT NULL,
    CONSTRAINT [PK_benefit_detail] PRIMARY KEY ([version_id])
);
GO

-- BANG benefit_condition: Dieu kien thu huong quyen loi.
CREATE TABLE dbo.[benefit_condition] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [version_id] BIGINT NOT NULL,
    [condition_no] INT NOT NULL,
    [condition_text] NVARCHAR(1600) NOT NULL,
    [condition_type] NVARCHAR(24) NOT NULL,
    CONSTRAINT [PK_benefit_condition] PRIMARY KEY ([id]),
    CONSTRAINT [CK_benefit_condition_no] CHECK (condition_no>=1)
);
GO

-- BANG scam_detail: Mo ta hinh thuc lua dao va huong dan ung pho.
CREATE TABLE dbo.[scam_detail] (
    [version_id] BIGINT NOT NULL,
    [severity] NVARCHAR(24) NOT NULL,
    [mechanism] NVARCHAR(MAX) NOT NULL,
    [warning_signs] NVARCHAR(MAX) NOT NULL,
    [immediate_actions] NVARCHAR(MAX) NOT NULL,
    [reporting_guidance] NVARCHAR(MAX) NOT NULL,
    CONSTRAINT [PK_scam_detail] PRIMARY KEY ([version_id]),
    CONSTRAINT [CK_scam_severity] CHECK (severity IN ('low','medium','high','critical'))
);
GO

-- BANG scam_indicator: Dau hieu nhan dien lua dao co can cu.
CREATE TABLE dbo.[scam_indicator] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [version_id] BIGINT NOT NULL,
    [indicator_no] INT NOT NULL,
    [indicator_kind] NVARCHAR(30) NOT NULL,
    [description] NVARCHAR(1000) NOT NULL,
    [evidence_snapshot_id] BIGINT NULL,
    CONSTRAINT [PK_scam_indicator] PRIMARY KEY ([id])
);
GO

-- BANG app_user: Danh tinh nguoi dung ung dung (khong luu mat khau).
CREATE TABLE dbo.[app_user] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [display_name] NVARCHAR(180) NOT NULL,
    [email] NVARCHAR(254) NOT NULL,
    [account_status] NVARCHAR(24) NOT NULL,
    [created_at] DATETIME2(3) NOT NULL,
    CONSTRAINT [PK_app_user] PRIMARY KEY ([id])
);
GO

-- BANG role: Danh muc vai tro nguoi dung.
CREATE TABLE dbo.[role] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [role_code] NVARCHAR(30) NOT NULL,
    [role_name] NVARCHAR(100) NOT NULL,
    CONSTRAINT [PK_role] PRIMARY KEY ([id])
);
GO

-- BANG user_role: Quan he nguoi dung va vai tro.
CREATE TABLE dbo.[user_role] (
    [user_id] BIGINT NOT NULL,
    [role_id] BIGINT NOT NULL,
    [granted_at] DATETIME2(3) NOT NULL,
    CONSTRAINT [PK_user_role] PRIMARY KEY ([user_id], [role_id])
);
GO

-- BANG moderation_event: Lich su thay doi trang thai kiem duyet.
CREATE TABLE dbo.[moderation_event] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [version_id] BIGINT NOT NULL,
    [actor_id] BIGINT NOT NULL,
    [action] NVARCHAR(24) NOT NULL,
    [from_status] NVARCHAR(24) NOT NULL,
    [to_status] NVARCHAR(24) NOT NULL,
    [reason_note] NVARCHAR(1000) NULL,
    [occurred_at] DATETIME2(3) NOT NULL,
    CONSTRAINT [PK_moderation_event] PRIMARY KEY ([id])
);
GO

-- BANG audit_log: Dau vet hoat dong bao ve lich su.
CREATE TABLE dbo.[audit_log] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [actor_id] BIGINT NULL,
    [entity_name] NVARCHAR(80) NOT NULL,
    [entity_id] BIGINT NOT NULL,
    [action] NVARCHAR(40) NOT NULL,
    [change_json] NVARCHAR(MAX) NOT NULL,
    [occurred_at] DATETIME2(3) NOT NULL,
    [entry_sha256] BINARY(32) NOT NULL,
    CONSTRAINT [PK_audit_log] PRIMARY KEY ([id])
);
GO

-- BANG content_report: Phan anh ve noi dung tu nguoi dung.
CREATE TABLE dbo.[content_report] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [version_id] BIGINT NOT NULL,
    [reason_kind] NVARCHAR(30) NOT NULL,
    [report_text] NVARCHAR(2000) NOT NULL,
    [report_status] NVARCHAR(24) NOT NULL,
    [created_at] DATETIME2(3) NOT NULL,
    [resolved_by] BIGINT NULL,
    [resolved_at] DATETIME2(3) NULL,
    CONSTRAINT [PK_content_report] PRIMARY KEY ([id])
);
GO

-- BANG content_document: Van ban chuan hoa phuc vu tra cuu RAG.
CREATE TABLE dbo.[content_document] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [source_snapshot_id] BIGINT NOT NULL,
    [normalized_sha256] BINARY(32) NOT NULL,
    [normalized_text] NVARCHAR(MAX) NOT NULL,
    [pipeline_version] NVARCHAR(50) NOT NULL,
    [created_at] DATETIME2(3) NOT NULL,
    CONSTRAINT [PK_content_document] PRIMARY KEY ([id])
);
GO

-- BANG content_chunk: Doan trich de tim kiem nguon va tro ly AI.
CREATE TABLE dbo.[content_chunk] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [content_document_id] BIGINT NOT NULL,
    [source_snapshot_id] BIGINT NOT NULL,
    [chunk_no] INT NOT NULL,
    [chunk_text] NVARCHAR(MAX) NOT NULL,
    [chunk_sha256] BINARY(32) NOT NULL,
    [page_start] INT NULL,
    [page_end] INT NULL,
    [heading_path] NVARCHAR(700) NULL,
    [start_offset] INT NOT NULL,
    [end_offset] INT NOT NULL,
    CONSTRAINT [PK_content_chunk] PRIMARY KEY ([id]),
    CONSTRAINT [CK_chunk_offset] CHECK (start_offset>=0 AND end_offset>start_offset),
    CONSTRAINT [CK_chunk_pages] CHECK (page_start IS NULL OR (page_start>=1 AND page_end IS NOT NULL AND page_end>=page_start))
);
GO

-- BANG knowledge_version_chunk: Lien ket doan trich voi phien ban noi dung.
CREATE TABLE dbo.[knowledge_version_chunk] (
    [version_id] BIGINT NOT NULL,
    [chunk_id] BIGINT NOT NULL,
    [snapshot_id] BIGINT NOT NULL,
    CONSTRAINT [PK_knowledge_version_chunk] PRIMARY KEY ([version_id], [chunk_id])
);
GO

-- BANG provision_version_chunk: Lien ket doan trich voi dieu khoan phap luat.
CREATE TABLE dbo.[provision_version_chunk] (
    [provision_version_id] BIGINT NOT NULL,
    [chunk_id] BIGINT NOT NULL,
    [snapshot_id] BIGINT NOT NULL,
    CONSTRAINT [PK_provision_version_chunk] PRIMARY KEY ([provision_version_id], [chunk_id])
);
GO

-- BANG conversation: Phien hoi thoai voi tro ly.
CREATE TABLE dbo.[conversation] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [user_id] BIGINT NULL,
    [started_at] DATETIME2(3) NOT NULL,
    [retention_until] DATETIME2(3) NOT NULL,
    [closed_at] DATETIME2(3) NULL,
    CONSTRAINT [PK_conversation] PRIMARY KEY ([id])
);
GO

-- BANG message: Cac tin nhan theo thu tu trong hoi thoai.
CREATE TABLE dbo.[message] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [conversation_id] BIGINT NOT NULL,
    [sequence_no] INT NOT NULL,
    [sender_role] NVARCHAR(16) NOT NULL,
    [message_text] NVARCHAR(MAX) NULL,
    [sent_at] DATETIME2(3) NOT NULL,
    CONSTRAINT [PK_message] PRIMARY KEY ([id]),
    CONSTRAINT [CK_message_role] CHECK (sender_role IN ('user','assistant','system')),
    CONSTRAINT [CK_message_sequence] CHECK (sequence_no>=1)
);
GO

-- BANG query_analysis: Phan tich cau hoi nguoi dung va moc hieu luc.
CREATE TABLE dbo.[query_analysis] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [conversation_id] BIGINT NOT NULL,
    [user_message_id] BIGINT NOT NULL,
    [user_role] NVARCHAR(16) NOT NULL,
    [normalized_query] NVARCHAR(MAX) NOT NULL,
    [requested_as_of] DATE NOT NULL,
    [requested_admin_unit_id] BIGINT NULL,
    [analyzed_at] DATETIME2(3) NOT NULL,
    CONSTRAINT [PK_query_analysis] PRIMARY KEY ([id]),
    CONSTRAINT [CK_query_user_role] CHECK (user_role='user')
);
GO

-- BANG retrieval_run: Thong tin moi lan truy xuat du lieu RAG.
CREATE TABLE dbo.[retrieval_run] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [query_id] BIGINT NOT NULL,
    [conversation_id] BIGINT NOT NULL,
    [strategy] NVARCHAR(24) NOT NULL,
    [model_revision] NVARCHAR(120) NULL,
    [index_revision] NVARCHAR(100) NOT NULL,
    [filter_json] NVARCHAR(MAX) NOT NULL,
    [top_k] INT NOT NULL,
    [run_status] NVARCHAR(24) NOT NULL,
    [started_at] DATETIME2(3) NOT NULL,
    [completed_at] DATETIME2(3) NULL,
    CONSTRAINT [PK_retrieval_run] PRIMARY KEY ([id]),
    CONSTRAINT [CK_retrieval_top_k] CHECK (top_k>=1)
);
GO

-- BANG retrieval_result: Danh sach cac doan trich tim duoc va diem.
CREATE TABLE dbo.[retrieval_result] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [run_id] BIGINT NOT NULL,
    [query_id] BIGINT NOT NULL,
    [conversation_id] BIGINT NOT NULL,
    [chunk_id] BIGINT NOT NULL,
    [rank_no] INT NOT NULL,
    [score] DECIMAL(12,6) NOT NULL,
    [eligible] BIT NOT NULL,
    [filter_reason] NVARCHAR(200) NULL,
    CONSTRAINT [PK_retrieval_result] PRIMARY KEY ([id]),
    CONSTRAINT [CK_rank] CHECK (rank_no>=1)
);
GO

-- BANG generated_answer: Cau tra loi AI va trang thai xac thuc.
CREATE TABLE dbo.[generated_answer] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [query_id] BIGINT NOT NULL,
    [conversation_id] BIGINT NOT NULL,
    [assistant_message_id] BIGINT NOT NULL,
    [assistant_role] NVARCHAR(16) NOT NULL,
    [attempt_no] INT NOT NULL,
    [generation_status] NVARCHAR(24) NOT NULL,
    [is_final] BIT NOT NULL,
    [answer_text] NVARCHAR(MAX) NULL,
    [model_code] NVARCHAR(120) NOT NULL,
    [prompt_sha256] NVARCHAR(64) NOT NULL,
    [started_at] DATETIME2(3) NOT NULL,
    [completed_at] DATETIME2(3) NULL,
    CONSTRAINT [PK_generated_answer] PRIMARY KEY ([id]),
    CONSTRAINT [CK_answer_assistant_role] CHECK (assistant_role='assistant'),
    CONSTRAINT [CK_answer_attempt] CHECK (attempt_no>=1),
    CONSTRAINT [CK_answer_final] CHECK (is_final=0 OR (generation_status='succeeded' AND answer_text IS NOT NULL)),
    CONSTRAINT [CK_answer_status] CHECK (generation_status IN ('pending','running','succeeded','failed','rejected'))
);
GO

-- BANG answer_citation: Trich dan chung cu gan voi cau tra loi AI.
CREATE TABLE dbo.[answer_citation] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [answer_id] BIGINT NOT NULL,
    [query_id] BIGINT NOT NULL,
    [conversation_id] BIGINT NOT NULL,
    [retrieval_result_id] BIGINT NOT NULL,
    [chunk_id] BIGINT NOT NULL,
    [snapshot_id] BIGINT NOT NULL,
    [verification_id] BIGINT NOT NULL,
    [citation_no] INT NOT NULL,
    [quote_start] INT NULL,
    [quote_end] INT NULL,
    [display_locator] NVARCHAR(250) NULL,
    CONSTRAINT [PK_answer_citation] PRIMARY KEY ([id]),
    CONSTRAINT [CK_citation_quote] CHECK ((quote_start IS NULL AND quote_end IS NULL) OR (quote_start IS NOT NULL AND quote_end IS NOT NULL AND quote_start>=0 AND quote_end>quote_start))
);
GO

CREATE UNIQUE INDEX [UX_domain_code] ON dbo.[domain] ([code]);
GO
CREATE UNIQUE INDEX [UX_category_domain_id_code] ON dbo.[category] ([domain_id], [code]);
GO
CREATE UNIQUE INDEX [UX_category_id_domain_id] ON dbo.[category] ([id], [domain_id]);
GO
CREATE UNIQUE INDEX [UX_knowledge_item_business_code] ON dbo.[knowledge_item] ([business_code]);
GO
CREATE UNIQUE INDEX [UX_knowledge_item_id_domain_id] ON dbo.[knowledge_item] ([id], [domain_id]);
GO
CREATE UNIQUE INDEX [UX_knowledge_version_item_id_version_no] ON dbo.[knowledge_version] ([item_id], [version_no]);
GO
CREATE UNIQUE INDEX [UX_knowledge_version_id_item_id] ON dbo.[knowledge_version] ([id], [item_id]);
GO
CREATE UNIQUE INDEX [UX_item_scope_version_id_scope_kind_admin_unit_id] ON dbo.[item_scope] ([version_id], [scope_kind], [admin_unit_id]);
GO
CREATE UNIQUE INDEX [UX_admin_unit_official_code_valid_from] ON dbo.[admin_unit] ([official_code], [valid_from]);
GO
CREATE UNIQUE INDEX [UX_organization_organization_code] ON dbo.[organization] ([organization_code]);
GO
CREATE UNIQUE INDEX [UX_file_asset_storage_key] ON dbo.[file_asset] ([storage_key]);
GO
CREATE UNIQUE INDEX [UX_source_snapshot_id_source_id] ON dbo.[source_snapshot] ([id], [source_id]);
GO
CREATE UNIQUE INDEX [UX_source_verification_id_source_snapshot_id] ON dbo.[source_verification] ([id], [source_snapshot_id]);
GO
CREATE UNIQUE INDEX [UX_legal_document_issuing_organization_id_document_number_issued_on] ON dbo.[legal_document] ([issuing_organization_id], [document_number], [issued_on]);
GO
CREATE UNIQUE INDEX [UX_legal_document_relation_from_document_id_to_document_id_relation_kind_effective_on] ON dbo.[legal_document_relation] ([from_document_id], [to_document_id], [relation_kind], [effective_on]);
GO
CREATE UNIQUE INDEX [UX_legal_provision_id_legal_document_id] ON dbo.[legal_provision] ([id], [legal_document_id]);
GO
CREATE UNIQUE INDEX [UX_legal_provision_legal_document_id_locator_path] ON dbo.[legal_provision] ([legal_document_id], [locator_path]);
GO
CREATE UNIQUE INDEX [UX_legal_provision_version_provision_id_revision_no] ON dbo.[legal_provision_version] ([provision_id], [revision_no]);
GO
CREATE UNIQUE INDEX [UX_document_type_code] ON dbo.[document_type] ([code]);
GO
CREATE UNIQUE INDEX [UX_form_template_template_code_template_version] ON dbo.[form_template] ([template_code], [template_version]);
GO
CREATE UNIQUE INDEX [UX_form_template_id_document_type_id] ON dbo.[form_template] ([id], [document_type_id]);
GO
CREATE UNIQUE INDEX [UX_procedure_detail_procedure_code_version_id] ON dbo.[procedure_detail] ([procedure_code], [version_id]);
GO
CREATE UNIQUE INDEX [UX_procedure_step_version_id_step_no] ON dbo.[procedure_step] ([version_id], [step_no]);
GO
CREATE UNIQUE INDEX [UX_procedure_requirement_version_id_requirement_no] ON dbo.[procedure_requirement] ([version_id], [requirement_no]);
GO
CREATE UNIQUE INDEX [UX_procedure_fee_version_id_fee_kind] ON dbo.[procedure_fee] ([version_id], [fee_kind]);
GO
CREATE UNIQUE INDEX [UX_procedure_office_version_id_organization_id_office_role_submission_channel_admin_unit_id] ON dbo.[procedure_office] ([version_id], [organization_id], [office_role], [submission_channel], [admin_unit_id]);
GO
CREATE UNIQUE INDEX [UX_benefit_condition_version_id_condition_no] ON dbo.[benefit_condition] ([version_id], [condition_no]);
GO
CREATE UNIQUE INDEX [UX_scam_indicator_version_id_indicator_no] ON dbo.[scam_indicator] ([version_id], [indicator_no]);
GO
CREATE UNIQUE INDEX [UX_app_user_email] ON dbo.[app_user] ([email]);
GO
CREATE UNIQUE INDEX [UX_role_role_code] ON dbo.[role] ([role_code]);
GO
CREATE UNIQUE INDEX [UX_content_document_id_source_snapshot_id] ON dbo.[content_document] ([id], [source_snapshot_id]);
GO
CREATE UNIQUE INDEX [UX_content_chunk_content_document_id_chunk_no] ON dbo.[content_chunk] ([content_document_id], [chunk_no]);
GO
CREATE UNIQUE INDEX [UX_content_chunk_id_source_snapshot_id] ON dbo.[content_chunk] ([id], [source_snapshot_id]);
GO
CREATE UNIQUE INDEX [UX_message_conversation_id_sequence_no] ON dbo.[message] ([conversation_id], [sequence_no]);
GO
CREATE UNIQUE INDEX [UX_message_id_conversation_id_sender_role] ON dbo.[message] ([id], [conversation_id], [sender_role]);
GO
CREATE UNIQUE INDEX [UX_query_analysis_id_conversation_id] ON dbo.[query_analysis] ([id], [conversation_id]);
GO
CREATE UNIQUE INDEX [UX_retrieval_run_id_query_id_conversation_id] ON dbo.[retrieval_run] ([id], [query_id], [conversation_id]);
GO
CREATE UNIQUE INDEX [UX_retrieval_result_run_id_rank_no] ON dbo.[retrieval_result] ([run_id], [rank_no]);
GO
CREATE UNIQUE INDEX [UX_retrieval_result_run_id_chunk_id] ON dbo.[retrieval_result] ([run_id], [chunk_id]);
GO
CREATE UNIQUE INDEX [UX_retrieval_result_id_query_id_conversation_id_chunk_id] ON dbo.[retrieval_result] ([id], [query_id], [conversation_id], [chunk_id]);
GO
CREATE UNIQUE INDEX [UX_generated_answer_assistant_message_id_attempt_no] ON dbo.[generated_answer] ([assistant_message_id], [attempt_no]);
GO
CREATE UNIQUE INDEX [UX_generated_answer_id_query_id_conversation_id] ON dbo.[generated_answer] ([id], [query_id], [conversation_id]);
GO
CREATE UNIQUE INDEX [UX_answer_citation_answer_id_citation_no] ON dbo.[answer_citation] ([answer_id], [citation_no]);
GO
ALTER TABLE dbo.[category] ADD CONSTRAINT [FK_category_domain_id] FOREIGN KEY ([domain_id]) REFERENCES dbo.[domain]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[category] ADD CONSTRAINT [FK_category_parent_id] FOREIGN KEY ([parent_id]) REFERENCES dbo.[category]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[knowledge_item] ADD CONSTRAINT [FK_knowledge_item_domain_id] FOREIGN KEY ([domain_id]) REFERENCES dbo.[domain]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[knowledge_item] ADD CONSTRAINT [FK_knowledge_item_created_by] FOREIGN KEY ([created_by]) REFERENCES dbo.[app_user]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[knowledge_version] ADD CONSTRAINT [FK_knowledge_version_item_id] FOREIGN KEY ([item_id]) REFERENCES dbo.[knowledge_item]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[knowledge_version] ADD CONSTRAINT [FK_knowledge_version_approved_by] FOREIGN KEY ([approved_by]) REFERENCES dbo.[app_user]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[knowledge_version] ADD CONSTRAINT [FK_knowledge_version_supersedes_version_id] FOREIGN KEY ([supersedes_version_id]) REFERENCES dbo.[knowledge_version]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[knowledge_version] ADD CONSTRAINT [FK_knowledge_version_created_by] FOREIGN KEY ([created_by]) REFERENCES dbo.[app_user]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[knowledge_version] ADD CONSTRAINT [FK_knowledge_version_supersedes_version_id_item_id] FOREIGN KEY ([supersedes_version_id], [item_id]) REFERENCES dbo.[knowledge_version]([id], [item_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[item_category] ADD CONSTRAINT [FK_item_category_item_id] FOREIGN KEY ([item_id]) REFERENCES dbo.[knowledge_item]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[item_category] ADD CONSTRAINT [FK_item_category_category_id] FOREIGN KEY ([category_id]) REFERENCES dbo.[category]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[item_category] ADD CONSTRAINT [FK_item_category_domain_id] FOREIGN KEY ([domain_id]) REFERENCES dbo.[domain]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[item_category] ADD CONSTRAINT [FK_item_category_item_id_domain_id] FOREIGN KEY ([item_id], [domain_id]) REFERENCES dbo.[knowledge_item]([id], [domain_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[item_category] ADD CONSTRAINT [FK_item_category_category_id_domain_id] FOREIGN KEY ([category_id], [domain_id]) REFERENCES dbo.[category]([id], [domain_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[item_scope] ADD CONSTRAINT [FK_item_scope_version_id] FOREIGN KEY ([version_id]) REFERENCES dbo.[knowledge_version]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[item_scope] ADD CONSTRAINT [FK_item_scope_admin_unit_id] FOREIGN KEY ([admin_unit_id]) REFERENCES dbo.[admin_unit]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[admin_unit] ADD CONSTRAINT [FK_admin_unit_parent_id] FOREIGN KEY ([parent_id]) REFERENCES dbo.[admin_unit]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[admin_unit_transition] ADD CONSTRAINT [FK_admin_unit_transition_from_unit_id] FOREIGN KEY ([from_unit_id]) REFERENCES dbo.[admin_unit]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[admin_unit_transition] ADD CONSTRAINT [FK_admin_unit_transition_to_unit_id] FOREIGN KEY ([to_unit_id]) REFERENCES dbo.[admin_unit]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[organization] ADD CONSTRAINT [FK_organization_parent_id] FOREIGN KEY ([parent_id]) REFERENCES dbo.[organization]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[organization_role] ADD CONSTRAINT [FK_organization_role_organization_id] FOREIGN KEY ([organization_id]) REFERENCES dbo.[organization]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[organization_jurisdiction] ADD CONSTRAINT [FK_organization_jurisdiction_organization_id] FOREIGN KEY ([organization_id]) REFERENCES dbo.[organization]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[organization_jurisdiction] ADD CONSTRAINT [FK_organization_jurisdiction_admin_unit_id] FOREIGN KEY ([admin_unit_id]) REFERENCES dbo.[admin_unit]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[source] ADD CONSTRAINT [FK_source_organization_id] FOREIGN KEY ([organization_id]) REFERENCES dbo.[organization]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[source_snapshot] ADD CONSTRAINT [FK_source_snapshot_source_id] FOREIGN KEY ([source_id]) REFERENCES dbo.[source]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[source_snapshot] ADD CONSTRAINT [FK_source_snapshot_file_asset_id] FOREIGN KEY ([file_asset_id]) REFERENCES dbo.[file_asset]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[source_verification] ADD CONSTRAINT [FK_source_verification_source_snapshot_id] FOREIGN KEY ([source_snapshot_id]) REFERENCES dbo.[source_snapshot]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[source_verification] ADD CONSTRAINT [FK_source_verification_reviewer_id] FOREIGN KEY ([reviewer_id]) REFERENCES dbo.[app_user]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[knowledge_version_source] ADD CONSTRAINT [FK_knowledge_version_source_version_id] FOREIGN KEY ([version_id]) REFERENCES dbo.[knowledge_version]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[knowledge_version_source] ADD CONSTRAINT [FK_knowledge_version_source_snapshot_id] FOREIGN KEY ([snapshot_id]) REFERENCES dbo.[source_snapshot]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[legal_document] ADD CONSTRAINT [FK_legal_document_issuing_organization_id] FOREIGN KEY ([issuing_organization_id]) REFERENCES dbo.[organization]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[legal_document_source] ADD CONSTRAINT [FK_legal_document_source_legal_document_id] FOREIGN KEY ([legal_document_id]) REFERENCES dbo.[legal_document]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[legal_document_source] ADD CONSTRAINT [FK_legal_document_source_snapshot_id] FOREIGN KEY ([snapshot_id]) REFERENCES dbo.[source_snapshot]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[legal_document_relation] ADD CONSTRAINT [FK_legal_document_relation_from_document_id] FOREIGN KEY ([from_document_id]) REFERENCES dbo.[legal_document]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[legal_document_relation] ADD CONSTRAINT [FK_legal_document_relation_to_document_id] FOREIGN KEY ([to_document_id]) REFERENCES dbo.[legal_document]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[legal_provision] ADD CONSTRAINT [FK_legal_provision_legal_document_id] FOREIGN KEY ([legal_document_id]) REFERENCES dbo.[legal_document]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[legal_provision] ADD CONSTRAINT [FK_legal_provision_parent_id] FOREIGN KEY ([parent_id]) REFERENCES dbo.[legal_provision]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[legal_provision] ADD CONSTRAINT [FK_legal_provision_parent_id_legal_document_id] FOREIGN KEY ([parent_id], [legal_document_id]) REFERENCES dbo.[legal_provision]([id], [legal_document_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[legal_provision_version] ADD CONSTRAINT [FK_legal_provision_version_provision_id] FOREIGN KEY ([provision_id]) REFERENCES dbo.[legal_provision]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[legal_provision_version] ADD CONSTRAINT [FK_legal_provision_version_change_document_id] FOREIGN KEY ([change_document_id]) REFERENCES dbo.[legal_document]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[provision_version_source] ADD CONSTRAINT [FK_provision_version_source_provision_version_id] FOREIGN KEY ([provision_version_id]) REFERENCES dbo.[legal_provision_version]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[provision_version_source] ADD CONSTRAINT [FK_provision_version_source_snapshot_id] FOREIGN KEY ([snapshot_id]) REFERENCES dbo.[source_snapshot]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[knowledge_basis_document] ADD CONSTRAINT [FK_knowledge_basis_document_knowledge_version_id] FOREIGN KEY ([knowledge_version_id]) REFERENCES dbo.[knowledge_version]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[knowledge_basis_document] ADD CONSTRAINT [FK_knowledge_basis_document_legal_document_id] FOREIGN KEY ([legal_document_id]) REFERENCES dbo.[legal_document]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[knowledge_basis_provision] ADD CONSTRAINT [FK_knowledge_basis_provision_knowledge_version_id] FOREIGN KEY ([knowledge_version_id]) REFERENCES dbo.[knowledge_version]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[knowledge_basis_provision] ADD CONSTRAINT [FK_knowledge_basis_provision_provision_version_id] FOREIGN KEY ([provision_version_id]) REFERENCES dbo.[legal_provision_version]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[form_template] ADD CONSTRAINT [FK_form_template_document_type_id] FOREIGN KEY ([document_type_id]) REFERENCES dbo.[document_type]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[form_template] ADD CONSTRAINT [FK_form_template_file_asset_id] FOREIGN KEY ([file_asset_id]) REFERENCES dbo.[file_asset]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[form_template] ADD CONSTRAINT [FK_form_template_verified_snapshot_id] FOREIGN KEY ([verified_snapshot_id]) REFERENCES dbo.[source_snapshot]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[procedure_detail] ADD CONSTRAINT [FK_procedure_detail_version_id] FOREIGN KEY ([version_id]) REFERENCES dbo.[knowledge_version]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[procedure_step] ADD CONSTRAINT [FK_procedure_step_version_id] FOREIGN KEY ([version_id]) REFERENCES dbo.[procedure_detail]([version_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[procedure_requirement] ADD CONSTRAINT [FK_procedure_requirement_version_id] FOREIGN KEY ([version_id]) REFERENCES dbo.[procedure_detail]([version_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[procedure_requirement] ADD CONSTRAINT [FK_procedure_requirement_document_type_id] FOREIGN KEY ([document_type_id]) REFERENCES dbo.[document_type]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[procedure_requirement] ADD CONSTRAINT [FK_procedure_requirement_form_template_id] FOREIGN KEY ([form_template_id]) REFERENCES dbo.[form_template]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[procedure_requirement] ADD CONSTRAINT [FK_procedure_requirement_form_template_id_document_type_id] FOREIGN KEY ([form_template_id], [document_type_id]) REFERENCES dbo.[form_template]([id], [document_type_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[procedure_fee] ADD CONSTRAINT [FK_procedure_fee_version_id] FOREIGN KEY ([version_id]) REFERENCES dbo.[procedure_detail]([version_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[procedure_office] ADD CONSTRAINT [FK_procedure_office_version_id] FOREIGN KEY ([version_id]) REFERENCES dbo.[procedure_detail]([version_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[procedure_office] ADD CONSTRAINT [FK_procedure_office_organization_id] FOREIGN KEY ([organization_id]) REFERENCES dbo.[organization]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[procedure_office] ADD CONSTRAINT [FK_procedure_office_admin_unit_id] FOREIGN KEY ([admin_unit_id]) REFERENCES dbo.[admin_unit]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[benefit_detail] ADD CONSTRAINT [FK_benefit_detail_version_id] FOREIGN KEY ([version_id]) REFERENCES dbo.[knowledge_version]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[benefit_condition] ADD CONSTRAINT [FK_benefit_condition_version_id] FOREIGN KEY ([version_id]) REFERENCES dbo.[benefit_detail]([version_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[scam_detail] ADD CONSTRAINT [FK_scam_detail_version_id] FOREIGN KEY ([version_id]) REFERENCES dbo.[knowledge_version]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[scam_indicator] ADD CONSTRAINT [FK_scam_indicator_version_id] FOREIGN KEY ([version_id]) REFERENCES dbo.[scam_detail]([version_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[scam_indicator] ADD CONSTRAINT [FK_scam_indicator_evidence_snapshot_id] FOREIGN KEY ([evidence_snapshot_id]) REFERENCES dbo.[source_snapshot]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[scam_indicator] ADD CONSTRAINT [FK_scam_indicator_version_id_evidence_snapshot_id] FOREIGN KEY ([version_id], [evidence_snapshot_id]) REFERENCES dbo.[knowledge_version_source]([version_id], [snapshot_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[user_role] ADD CONSTRAINT [FK_user_role_user_id] FOREIGN KEY ([user_id]) REFERENCES dbo.[app_user]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[user_role] ADD CONSTRAINT [FK_user_role_role_id] FOREIGN KEY ([role_id]) REFERENCES dbo.[role]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[moderation_event] ADD CONSTRAINT [FK_moderation_event_version_id] FOREIGN KEY ([version_id]) REFERENCES dbo.[knowledge_version]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[moderation_event] ADD CONSTRAINT [FK_moderation_event_actor_id] FOREIGN KEY ([actor_id]) REFERENCES dbo.[app_user]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[audit_log] ADD CONSTRAINT [FK_audit_log_actor_id] FOREIGN KEY ([actor_id]) REFERENCES dbo.[app_user]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[content_report] ADD CONSTRAINT [FK_content_report_version_id] FOREIGN KEY ([version_id]) REFERENCES dbo.[knowledge_version]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[content_report] ADD CONSTRAINT [FK_content_report_resolved_by] FOREIGN KEY ([resolved_by]) REFERENCES dbo.[app_user]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[content_document] ADD CONSTRAINT [FK_content_document_source_snapshot_id] FOREIGN KEY ([source_snapshot_id]) REFERENCES dbo.[source_snapshot]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[content_chunk] ADD CONSTRAINT [FK_content_chunk_content_document_id] FOREIGN KEY ([content_document_id]) REFERENCES dbo.[content_document]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[content_chunk] ADD CONSTRAINT [FK_content_chunk_source_snapshot_id] FOREIGN KEY ([source_snapshot_id]) REFERENCES dbo.[source_snapshot]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[content_chunk] ADD CONSTRAINT [FK_content_chunk_content_document_id_source_snapshot_id] FOREIGN KEY ([content_document_id], [source_snapshot_id]) REFERENCES dbo.[content_document]([id], [source_snapshot_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[knowledge_version_chunk] ADD CONSTRAINT [FK_knowledge_version_chunk_version_id] FOREIGN KEY ([version_id]) REFERENCES dbo.[knowledge_version]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[knowledge_version_chunk] ADD CONSTRAINT [FK_knowledge_version_chunk_chunk_id] FOREIGN KEY ([chunk_id]) REFERENCES dbo.[content_chunk]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[knowledge_version_chunk] ADD CONSTRAINT [FK_knowledge_version_chunk_snapshot_id] FOREIGN KEY ([snapshot_id]) REFERENCES dbo.[source_snapshot]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[knowledge_version_chunk] ADD CONSTRAINT [FK_knowledge_version_chunk_version_id_snapshot_id] FOREIGN KEY ([version_id], [snapshot_id]) REFERENCES dbo.[knowledge_version_source]([version_id], [snapshot_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[knowledge_version_chunk] ADD CONSTRAINT [FK_knowledge_version_chunk_chunk_id_snapshot_id] FOREIGN KEY ([chunk_id], [snapshot_id]) REFERENCES dbo.[content_chunk]([id], [source_snapshot_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[provision_version_chunk] ADD CONSTRAINT [FK_provision_version_chunk_provision_version_id] FOREIGN KEY ([provision_version_id]) REFERENCES dbo.[legal_provision_version]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[provision_version_chunk] ADD CONSTRAINT [FK_provision_version_chunk_chunk_id] FOREIGN KEY ([chunk_id]) REFERENCES dbo.[content_chunk]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[provision_version_chunk] ADD CONSTRAINT [FK_provision_version_chunk_snapshot_id] FOREIGN KEY ([snapshot_id]) REFERENCES dbo.[source_snapshot]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[provision_version_chunk] ADD CONSTRAINT [FK_provision_version_chunk_provision_version_id_snapshot_id] FOREIGN KEY ([provision_version_id], [snapshot_id]) REFERENCES dbo.[provision_version_source]([provision_version_id], [snapshot_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[provision_version_chunk] ADD CONSTRAINT [FK_provision_version_chunk_chunk_id_snapshot_id] FOREIGN KEY ([chunk_id], [snapshot_id]) REFERENCES dbo.[content_chunk]([id], [source_snapshot_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[conversation] ADD CONSTRAINT [FK_conversation_user_id] FOREIGN KEY ([user_id]) REFERENCES dbo.[app_user]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[message] ADD CONSTRAINT [FK_message_conversation_id] FOREIGN KEY ([conversation_id]) REFERENCES dbo.[conversation]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[query_analysis] ADD CONSTRAINT [FK_query_analysis_conversation_id] FOREIGN KEY ([conversation_id]) REFERENCES dbo.[conversation]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[query_analysis] ADD CONSTRAINT [FK_query_analysis_user_message_id] FOREIGN KEY ([user_message_id]) REFERENCES dbo.[message]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[query_analysis] ADD CONSTRAINT [FK_query_analysis_requested_admin_unit_id] FOREIGN KEY ([requested_admin_unit_id]) REFERENCES dbo.[admin_unit]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[query_analysis] ADD CONSTRAINT [FK_query_analysis_user_message_id_conversation_id_user_role] FOREIGN KEY ([user_message_id], [conversation_id], [user_role]) REFERENCES dbo.[message]([id], [conversation_id], [sender_role]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[retrieval_run] ADD CONSTRAINT [FK_retrieval_run_query_id] FOREIGN KEY ([query_id]) REFERENCES dbo.[query_analysis]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[retrieval_run] ADD CONSTRAINT [FK_retrieval_run_conversation_id] FOREIGN KEY ([conversation_id]) REFERENCES dbo.[conversation]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[retrieval_run] ADD CONSTRAINT [FK_retrieval_run_query_id_conversation_id] FOREIGN KEY ([query_id], [conversation_id]) REFERENCES dbo.[query_analysis]([id], [conversation_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[retrieval_result] ADD CONSTRAINT [FK_retrieval_result_run_id] FOREIGN KEY ([run_id]) REFERENCES dbo.[retrieval_run]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[retrieval_result] ADD CONSTRAINT [FK_retrieval_result_query_id] FOREIGN KEY ([query_id]) REFERENCES dbo.[query_analysis]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[retrieval_result] ADD CONSTRAINT [FK_retrieval_result_conversation_id] FOREIGN KEY ([conversation_id]) REFERENCES dbo.[conversation]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[retrieval_result] ADD CONSTRAINT [FK_retrieval_result_chunk_id] FOREIGN KEY ([chunk_id]) REFERENCES dbo.[content_chunk]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[retrieval_result] ADD CONSTRAINT [FK_retrieval_result_run_id_query_id_conversation_id] FOREIGN KEY ([run_id], [query_id], [conversation_id]) REFERENCES dbo.[retrieval_run]([id], [query_id], [conversation_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[generated_answer] ADD CONSTRAINT [FK_generated_answer_query_id] FOREIGN KEY ([query_id]) REFERENCES dbo.[query_analysis]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[generated_answer] ADD CONSTRAINT [FK_generated_answer_conversation_id] FOREIGN KEY ([conversation_id]) REFERENCES dbo.[conversation]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[generated_answer] ADD CONSTRAINT [FK_generated_answer_assistant_message_id] FOREIGN KEY ([assistant_message_id]) REFERENCES dbo.[message]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[generated_answer] ADD CONSTRAINT [FK_generated_answer_query_id_conversation_id] FOREIGN KEY ([query_id], [conversation_id]) REFERENCES dbo.[query_analysis]([id], [conversation_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[generated_answer] ADD CONSTRAINT [FK_generated_answer_assistant_message_id_conversation_id_assistant_role] FOREIGN KEY ([assistant_message_id], [conversation_id], [assistant_role]) REFERENCES dbo.[message]([id], [conversation_id], [sender_role]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[answer_citation] ADD CONSTRAINT [FK_answer_citation_answer_id] FOREIGN KEY ([answer_id]) REFERENCES dbo.[generated_answer]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[answer_citation] ADD CONSTRAINT [FK_answer_citation_query_id] FOREIGN KEY ([query_id]) REFERENCES dbo.[query_analysis]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[answer_citation] ADD CONSTRAINT [FK_answer_citation_conversation_id] FOREIGN KEY ([conversation_id]) REFERENCES dbo.[conversation]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[answer_citation] ADD CONSTRAINT [FK_answer_citation_retrieval_result_id] FOREIGN KEY ([retrieval_result_id]) REFERENCES dbo.[retrieval_result]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[answer_citation] ADD CONSTRAINT [FK_answer_citation_chunk_id] FOREIGN KEY ([chunk_id]) REFERENCES dbo.[content_chunk]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[answer_citation] ADD CONSTRAINT [FK_answer_citation_snapshot_id] FOREIGN KEY ([snapshot_id]) REFERENCES dbo.[source_snapshot]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[answer_citation] ADD CONSTRAINT [FK_answer_citation_verification_id] FOREIGN KEY ([verification_id]) REFERENCES dbo.[source_verification]([id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[answer_citation] ADD CONSTRAINT [FK_answer_citation_answer_id_query_id_conversation_id] FOREIGN KEY ([answer_id], [query_id], [conversation_id]) REFERENCES dbo.[generated_answer]([id], [query_id], [conversation_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[answer_citation] ADD CONSTRAINT [FK_answer_citation_retrieval_result_id_query_id_conversation_id_chunk_id] FOREIGN KEY ([retrieval_result_id], [query_id], [conversation_id], [chunk_id]) REFERENCES dbo.[retrieval_result]([id], [query_id], [conversation_id], [chunk_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[answer_citation] ADD CONSTRAINT [FK_answer_citation_chunk_id_snapshot_id] FOREIGN KEY ([chunk_id], [snapshot_id]) REFERENCES dbo.[content_chunk]([id], [source_snapshot_id]) ON DELETE NO ACTION;
GO
ALTER TABLE dbo.[answer_citation] ADD CONSTRAINT [FK_answer_citation_verification_id_snapshot_id] FOREIGN KEY ([verification_id], [snapshot_id]) REFERENCES dbo.[source_verification]([id], [source_snapshot_id]) ON DELETE NO ACTION;
GO

-- Filtered unique indexes and status safeguards
CREATE UNIQUE INDEX UX_item_scope_nationwide ON dbo.item_scope(version_id) WHERE scope_kind=N'nationwide';
GO
CREATE UNIQUE INDEX UX_item_scope_unit ON dbo.item_scope(version_id,admin_unit_id) WHERE scope_kind=N'unit';
GO
CREATE UNIQUE INDEX UX_item_category_primary ON dbo.item_category(item_id) WHERE is_primary=1;
GO
CREATE UNIQUE INDEX UX_generated_answer_final ON dbo.generated_answer(query_id) WHERE is_final=1;
GO

GO

-- ==================================================================
-- MUC 02 Data Guards: Rang buoc va triggers bao ve du lieu
-- ==================================================================
GO
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO
-- Additional SQL Server 2022 checks, guarded histories, and supporting indexes.
-- This script DOES NOT alter the 52-table ERD or change existing FK definitions.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
ALTER TABLE dbo.knowledge_version WITH CHECK ADD CONSTRAINT CK_gds_version_no_positive CHECK (version_no>=1);
GO
ALTER TABLE dbo.knowledge_version WITH CHECK ADD CONSTRAINT CK_gds_publication_chronology
CHECK ((published_at IS NULL OR (approved_at IS NOT NULL AND published_at>=approved_at))
   AND (withdrawn_at IS NULL OR (published_at IS NOT NULL AND withdrawn_at>=published_at)));
GO
ALTER TABLE dbo.legal_provision_version WITH CHECK ADD CONSTRAINT CK_gds_provision_revision CHECK (revision_no>=1);
GO
ALTER TABLE dbo.content_chunk WITH CHECK ADD CONSTRAINT CK_gds_chunk_page_pair
CHECK ((page_start IS NULL AND page_end IS NULL) OR (page_start IS NOT NULL AND page_end IS NOT NULL AND page_start>=1 AND page_end>=page_start));
GO
ALTER TABLE dbo.answer_citation WITH CHECK ADD CONSTRAINT CK_gds_citation_sequence CHECK (citation_no>=1);
GO
ALTER TABLE dbo.retrieval_run WITH CHECK ADD CONSTRAINT CK_gds_retrieval_filter_json CHECK (ISJSON(filter_json)=1);
GO
ALTER TABLE dbo.audit_log WITH CHECK ADD CONSTRAINT CK_gds_audit_json CHECK (ISJSON(change_json)=1);
GO
ALTER TABLE dbo.generated_answer WITH CHECK ADD CONSTRAINT CK_gds_generation_chronology
CHECK (completed_at IS NULL OR started_at<=completed_at);
GO
ALTER TABLE dbo.source_snapshot WITH CHECK ADD CONSTRAINT CK_gds_snapshot_capture_method
CHECK (capture_method IN (N'web',N'upload',N'api',N'manual',N'archive',N'other'));
GO
CREATE INDEX IX_gds_version_current_lookup ON dbo.knowledge_version(item_id,editorial_status,effective_from,effective_to)
INCLUDE (published_at,withdrawn_at);
GO
CREATE INDEX IX_gds_provision_as_of ON dbo.legal_provision_version(provision_id,effective_from,effective_to);
GO
CREATE INDEX IX_gds_knowledge_scope_lookup ON dbo.item_scope(admin_unit_id,scope_kind,version_id);
GO
CREATE INDEX IX_gds_source_snapshot_recent ON dbo.source_snapshot(source_id,captured_at DESC);
GO
CREATE INDEX IX_gds_source_verification_latest ON dbo.source_verification(source_snapshot_id,verified_at DESC,id DESC)
INCLUDE (decision,valid_until);
GO
CREATE INDEX IX_gds_retrieval_eligibility ON dbo.retrieval_result(query_id,eligible,chunk_id);
GO
CREATE INDEX IX_gds_citation_by_chunk ON dbo.answer_citation(chunk_id,verification_id);
GO
-- A historical snapshot is immutable. For changed web content, create a new snapshot.
CREATE TRIGGER dbo.trg_gds_source_snapshot_immutable ON dbo.source_snapshot
AFTER UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted) THROW 53001,N'Historical source_snapshot rows may not be updated or deleted',1;
END;
GO
-- Source verification is an append-only decision history.
CREATE TRIGGER dbo.trg_gds_source_verification_immutable ON dbo.source_verification
AFTER UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted) THROW 53002,N'Historical source_verification rows may not be updated or deleted',1;
END;
GO
-- General audit metadata is append-only (system owners must be separately secured).
CREATE TRIGGER dbo.trg_gds_audit_immutable ON dbo.audit_log
AFTER UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted) THROW 53003,N'Audit log rows may not be updated or deleted',1;
END;
GO
CREATE TRIGGER dbo.trg_gds_moderation_event_immutable ON dbo.moderation_event
AFTER UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted) THROW 53004,N'Moderation event rows may not be updated or deleted',1;
END;
GO
-- Once published, core version content/status/effective-period cannot be overwritten.
-- A separate controlled withdrawal procedure may set withdrawn_at only.
CREATE TRIGGER dbo.trg_gds_knowledge_published_immutable ON dbo.knowledge_version
AFTER UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id=d.id
       WHERE d.editorial_status IN (N'approved',N'published') AND (
          i.id IS NULL OR (d.editorial_status=N'published' AND i.editorial_status<>N'published') OR
          (d.editorial_status=N'approved' AND i.editorial_status NOT IN (N'approved',N'published')) OR
          i.item_id<>d.item_id OR i.version_no<>d.version_no OR
          i.title<>d.title OR i.summary<>d.summary OR i.body_markdown<>d.body_markdown OR
          i.content_sha256<>d.content_sha256 OR
          ISNULL(i.effective_from,CONVERT(date,'00010101'))<>ISNULL(d.effective_from,CONVERT(date,'00010101')) OR
          ISNULL(i.effective_to,CONVERT(date,'00010101'))<>ISNULL(d.effective_to,CONVERT(date,'00010101')) OR
          i.approved_by<>d.approved_by OR i.approved_at<>d.approved_at OR
          i.published_at<>d.published_at OR i.created_by<>d.created_by OR
          i.created_at<>d.created_at OR
          ISNULL(i.supersedes_version_id,-1)<>ISNULL(d.supersedes_version_id,-1)))
        THROW 53005,N'Approved or published knowledge content is immutable',1;
END;
GO
-- Law article/paragraph text may evolve only by a NEW revision.
-- Prevent same provision having two overlapping revision periods even with concurrent writes.
CREATE TRIGGER dbo.trg_gds_provision_no_overlap ON dbo.legal_provision_version
AFTER INSERT,UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @pid BIGINT,@lock_name NVARCHAR(255),@result INT;
    DECLARE rev_ids CURSOR LOCAL FAST_FORWARD FOR
        SELECT DISTINCT provision_id FROM inserted ORDER BY provision_id;
    OPEN rev_ids;
    FETCH NEXT FROM rev_ids INTO @pid;
    WHILE @@FETCH_STATUS=0
    BEGIN
        SET @lock_name=CONCAT(N'gocdansinh:provision:',CONVERT(NVARCHAR(30),@pid));
        EXEC @result=sys.sp_getapplock @Resource=@lock_name,
             @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000;
        IF @result<0
        BEGIN
            CLOSE rev_ids; DEALLOCATE rev_ids;
            THROW 53006,N'Could not serialize provision revision',1;
        END;
        IF EXISTS (
            SELECT 1 FROM dbo.legal_provision_version a WITH (UPDLOCK,HOLDLOCK)
            JOIN dbo.legal_provision_version b ON b.provision_id=a.provision_id AND b.id>a.id
            WHERE a.provision_id=@pid
              AND a.effective_from<ISNULL(b.effective_to,CONVERT(date,'99991231'))
              AND b.effective_from<ISNULL(a.effective_to,CONVERT(date,'99991231'))
        )
        BEGIN
            CLOSE rev_ids; DEALLOCATE rev_ids;
            THROW 53007,N'Overlapping effective intervals for legal provision revisions',1;
        END;
        FETCH NEXT FROM rev_ids INTO @pid;
    END;
    CLOSE rev_ids;
    DEALLOCATE rev_ids;
END;
GO
-- Reject an inconsistent tree (different domain or loops). Apply checks after every category mutation.
CREATE TRIGGER dbo.trg_gds_category_hierarchy ON dbo.category
AFTER INSERT,UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM dbo.category c JOIN dbo.category p ON p.id=c.parent_id
              WHERE c.domain_id<>p.domain_id)
        THROW 53008,N'Category parent belongs to another domain',1;
    DECLARE @id BIGINT;
    DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT DISTINCT id FROM inserted;
    OPEN c; FETCH NEXT FROM c INTO @id;
    WHILE @@FETCH_STATUS=0
    BEGIN
        DECLARE @walker BIGINT=(SELECT parent_id FROM dbo.category WHERE id=@id),@depth INT=0;
        WHILE @walker IS NOT NULL
        BEGIN
            IF @walker=@id OR @depth>1000
            BEGIN
                CLOSE c; DEALLOCATE c;
                THROW 53009,N'Category tree cycle detected',1;
            END;
            SELECT @walker=parent_id FROM dbo.category WHERE id=@walker;
            SET @depth=@depth+1;
        END;
        FETCH NEXT FROM c INTO @id;
    END;
    CLOSE c; DEALLOCATE c;
END;
GO
-- Prevent published-content child tables from later being edited. A new version is required.
-- One trigger per table; version_id must be present in all listed ERD tables.
CREATE TRIGGER dbo.trg_gds_item_scope_published_guard ON dbo.item_scope
AFTER INSERT,UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.knowledge_version v ON v.id=i.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
       OR EXISTS (SELECT 1 FROM deleted d JOIN dbo.knowledge_version v ON v.id=d.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
        THROW 53100,N'Approved/published content relations are immutable; create a new version',1;
END;
GO
CREATE TRIGGER dbo.trg_gds_knowledge_version_source_published_guard ON dbo.knowledge_version_source
AFTER INSERT,UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.knowledge_version v ON v.id=i.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
       OR EXISTS (SELECT 1 FROM deleted d JOIN dbo.knowledge_version v ON v.id=d.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
        THROW 53100,N'Approved/published content relations are immutable; create a new version',1;
END;
GO
CREATE TRIGGER dbo.trg_gds_procedure_detail_published_guard ON dbo.procedure_detail
AFTER INSERT,UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.knowledge_version v ON v.id=i.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
       OR EXISTS (SELECT 1 FROM deleted d JOIN dbo.knowledge_version v ON v.id=d.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
        THROW 53100,N'Approved/published content relations are immutable; create a new version',1;
END;
GO
CREATE TRIGGER dbo.trg_gds_procedure_step_published_guard ON dbo.procedure_step
AFTER INSERT,UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.knowledge_version v ON v.id=i.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
       OR EXISTS (SELECT 1 FROM deleted d JOIN dbo.knowledge_version v ON v.id=d.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
        THROW 53100,N'Approved/published content relations are immutable; create a new version',1;
END;
GO
CREATE TRIGGER dbo.trg_gds_procedure_requirement_published_guard ON dbo.procedure_requirement
AFTER INSERT,UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.knowledge_version v ON v.id=i.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
       OR EXISTS (SELECT 1 FROM deleted d JOIN dbo.knowledge_version v ON v.id=d.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
        THROW 53100,N'Approved/published content relations are immutable; create a new version',1;
END;
GO
CREATE TRIGGER dbo.trg_gds_procedure_fee_published_guard ON dbo.procedure_fee
AFTER INSERT,UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.knowledge_version v ON v.id=i.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
       OR EXISTS (SELECT 1 FROM deleted d JOIN dbo.knowledge_version v ON v.id=d.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
        THROW 53100,N'Approved/published content relations are immutable; create a new version',1;
END;
GO
CREATE TRIGGER dbo.trg_gds_procedure_office_published_guard ON dbo.procedure_office
AFTER INSERT,UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.knowledge_version v ON v.id=i.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
       OR EXISTS (SELECT 1 FROM deleted d JOIN dbo.knowledge_version v ON v.id=d.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
        THROW 53100,N'Approved/published content relations are immutable; create a new version',1;
END;
GO
CREATE TRIGGER dbo.trg_gds_benefit_detail_published_guard ON dbo.benefit_detail
AFTER INSERT,UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.knowledge_version v ON v.id=i.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
       OR EXISTS (SELECT 1 FROM deleted d JOIN dbo.knowledge_version v ON v.id=d.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
        THROW 53100,N'Approved/published content relations are immutable; create a new version',1;
END;
GO
CREATE TRIGGER dbo.trg_gds_benefit_condition_published_guard ON dbo.benefit_condition
AFTER INSERT,UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.knowledge_version v ON v.id=i.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
       OR EXISTS (SELECT 1 FROM deleted d JOIN dbo.knowledge_version v ON v.id=d.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
        THROW 53100,N'Approved/published content relations are immutable; create a new version',1;
END;
GO
CREATE TRIGGER dbo.trg_gds_scam_detail_published_guard ON dbo.scam_detail
AFTER INSERT,UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.knowledge_version v ON v.id=i.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
       OR EXISTS (SELECT 1 FROM deleted d JOIN dbo.knowledge_version v ON v.id=d.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
        THROW 53100,N'Approved/published content relations are immutable; create a new version',1;
END;
GO
CREATE TRIGGER dbo.trg_gds_scam_indicator_published_guard ON dbo.scam_indicator
AFTER INSERT,UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.knowledge_version v ON v.id=i.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
       OR EXISTS (SELECT 1 FROM deleted d JOIN dbo.knowledge_version v ON v.id=d.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
        THROW 53100,N'Approved/published content relations are immutable; create a new version',1;
END;
GO
CREATE TRIGGER dbo.trg_gds_knowledge_basis_document_published_guard ON dbo.knowledge_basis_document
AFTER INSERT,UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.knowledge_version v ON v.id=i.knowledge_version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
       OR EXISTS (SELECT 1 FROM deleted d JOIN dbo.knowledge_version v ON v.id=d.knowledge_version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
        THROW 53100,N'Approved/published content relations are immutable; create a new version',1;
END;
GO
CREATE TRIGGER dbo.trg_gds_knowledge_basis_provision_published_guard ON dbo.knowledge_basis_provision
AFTER INSERT,UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.knowledge_version v ON v.id=i.knowledge_version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
       OR EXISTS (SELECT 1 FROM deleted d JOIN dbo.knowledge_version v ON v.id=d.knowledge_version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
        THROW 53100,N'Approved/published content relations are immutable; create a new version',1;
END;
GO
CREATE TRIGGER dbo.trg_gds_knowledge_version_chunk_published_guard ON dbo.knowledge_version_chunk
AFTER INSERT,UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.knowledge_version v ON v.id=i.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
       OR EXISTS (SELECT 1 FROM deleted d JOIN dbo.knowledge_version v ON v.id=d.version_id
               WHERE v.editorial_status IN (N'approved',N'published'))
        THROW 53100,N'Approved/published content relations are immutable; create a new version',1;
END;
GO

-- Catch indirect hierarchy loops, not only parent_id=id.
CREATE TRIGGER dbo.trg_gds_admin_unit_no_cycles ON dbo.admin_unit
AFTER INSERT,UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @id BIGINT,@ancestor BIGINT,@distance INT;
    DECLARE loop_check CURSOR LOCAL FAST_FORWARD FOR SELECT id FROM inserted ORDER BY id;
    OPEN loop_check;
    FETCH NEXT FROM loop_check INTO @id;
    WHILE @@FETCH_STATUS=0
    BEGIN
        SET @ancestor=(SELECT parent_id FROM dbo.admin_unit WHERE id=@id);
        SET @distance=0;
        WHILE @ancestor IS NOT NULL
        BEGIN
            IF @ancestor=@id OR @distance>1000
            BEGIN
                CLOSE loop_check; DEALLOCATE loop_check;
                THROW 53102,N'Hierarchy cycle or excessive parent depth in admin_unit',1;
            END;
            SELECT @ancestor=parent_id FROM dbo.admin_unit WHERE id=@ancestor;
            SET @distance=@distance+1;
        END;
        FETCH NEXT FROM loop_check INTO @id;
    END;
    CLOSE loop_check;
    DEALLOCATE loop_check;
END;
GO

-- Catch indirect hierarchy loops, not only parent_id=id.
CREATE TRIGGER dbo.trg_gds_organization_no_cycles ON dbo.organization
AFTER INSERT,UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @id BIGINT,@ancestor BIGINT,@distance INT;
    DECLARE loop_check CURSOR LOCAL FAST_FORWARD FOR SELECT id FROM inserted ORDER BY id;
    OPEN loop_check;
    FETCH NEXT FROM loop_check INTO @id;
    WHILE @@FETCH_STATUS=0
    BEGIN
        SET @ancestor=(SELECT parent_id FROM dbo.organization WHERE id=@id);
        SET @distance=0;
        WHILE @ancestor IS NOT NULL
        BEGIN
            IF @ancestor=@id OR @distance>1000
            BEGIN
                CLOSE loop_check; DEALLOCATE loop_check;
                THROW 53102,N'Hierarchy cycle or excessive parent depth in organization',1;
            END;
            SELECT @ancestor=parent_id FROM dbo.organization WHERE id=@ancestor;
            SET @distance=@distance+1;
        END;
        FETCH NEXT FROM loop_check INTO @id;
    END;
    CLOSE loop_check;
    DEALLOCATE loop_check;
END;
GO

-- Catch indirect hierarchy loops, not only parent_id=id.
CREATE TRIGGER dbo.trg_gds_legal_provision_no_cycles ON dbo.legal_provision
AFTER INSERT,UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @id BIGINT,@ancestor BIGINT,@distance INT;
    DECLARE loop_check CURSOR LOCAL FAST_FORWARD FOR SELECT id FROM inserted ORDER BY id;
    OPEN loop_check;
    FETCH NEXT FROM loop_check INTO @id;
    WHILE @@FETCH_STATUS=0
    BEGIN
        SET @ancestor=(SELECT parent_id FROM dbo.legal_provision WHERE id=@id);
        SET @distance=0;
        WHILE @ancestor IS NOT NULL
        BEGIN
            IF @ancestor=@id OR @distance>1000
            BEGIN
                CLOSE loop_check; DEALLOCATE loop_check;
                THROW 53102,N'Hierarchy cycle or excessive parent depth in legal_provision',1;
            END;
            SELECT @ancestor=parent_id FROM dbo.legal_provision WHERE id=@ancestor;
            SET @distance=@distance+1;
        END;
        FETCH NEXT FROM loop_check INTO @id;
    END;
    CLOSE loop_check;
    DEALLOCATE loop_check;
END;
GO

GO

-- ==================================================================
-- MUC 03 Approval Publish: Thu tuc duyet va cong bo co kiem soat
-- ==================================================================
GO
-- SQL Server 2022 reference transaction for controlled publication.
-- Covers core approval, type mapping, snapshot verification, and conflicting intervals.
-- Additional semantic validators and immutable-row privileges remain required.
CREATE OR ALTER PROCEDURE dbo.usp_publish_knowledge_version
    @version_id BIGINT,
    @publisher_user_id BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

    DECLARE @item_id BIGINT, @kind NVARCHAR(20),
            @domain_code NVARCHAR(24),
            @date_from DATE, @date_to DATE,
            @created_by BIGINT, @approved_by BIGINT,
            @status NVARCHAR(24), @approved_at DATETIME2(3),
            @now DATETIME2(3)=SYSUTCDATETIME(), @lock_result INT, @lock_resource NVARCHAR(255);
    BEGIN TRY
        BEGIN TRANSACTION;
        SELECT @item_id=v.item_id, @kind=i.kind, @domain_code=d.code,
               @date_from=v.effective_from, @date_to=v.effective_to,
               @created_by=v.created_by, @approved_by=v.approved_by,
               @approved_at=v.approved_at, @status=v.editorial_status
        FROM dbo.knowledge_version AS v WITH (UPDLOCK,HOLDLOCK)
        JOIN dbo.knowledge_item AS i ON i.id=v.item_id
        JOIN dbo.domain AS d ON d.id=i.domain_id
        WHERE v.id=@version_id;

        IF @item_id IS NULL THROW 52001, 'Missing knowledge version', 1;
        SET @lock_resource=CONCAT(N'gocdansinh:item:',CONVERT(NVARCHAR(30),@item_id));
        EXEC @lock_result=sys.sp_getapplock
             @Resource=@lock_resource,
             @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000;
        IF @lock_result<0 THROW 52002, 'Failed to lock item', 1;
        IF @status<>N'approved' OR @approved_by IS NULL OR @approved_at IS NULL
             THROW 52003, 'Version not approved', 1;
        IF @date_from IS NULL THROW 52004, 'Effective-from required', 1;
        IF @approved_by=@created_by THROW 52005, 'Self-approval forbidden', 1;
        IF @approved_at>@now THROW 52006, 'Approval timestamp is in future', 1;

        IF NOT EXISTS (
            SELECT 1 FROM dbo.user_role ur
            JOIN dbo.role r ON r.id=ur.role_id
            JOIN dbo.app_user u ON u.id=ur.user_id
            WHERE ur.user_id=@publisher_user_id AND r.role_code IN (N'publisher',N'admin')
              AND u.account_status=N'active'
        ) THROW 52007, 'Publisher role missing', 1;

        IF (@kind=N'procedure' AND @domain_code<>N'ADMIN') OR
           (@kind=N'benefit' AND @domain_code<>N'LEGAL') OR
           (@kind=N'scam' AND @domain_code<>N'SCAM')
             THROW 52008, 'Kind/domain mismatch', 1;
        IF NOT EXISTS (
            SELECT 1 FROM dbo.item_category ic
            WHERE ic.item_id=@item_id AND ic.is_primary=1
        ) THROW 52009, 'Primary category missing', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.item_scope WHERE version_id=@version_id)
             THROW 52010, 'Scope missing', 1;

        IF (@kind=N'procedure' AND (
               NOT EXISTS (SELECT 1 FROM dbo.procedure_detail WHERE version_id=@version_id) OR
               NOT EXISTS (SELECT 1 FROM dbo.procedure_step WHERE version_id=@version_id) OR
               NOT EXISTS (SELECT 1 FROM dbo.procedure_office WHERE version_id=@version_id)))
           OR (@kind=N'benefit' AND (
               NOT EXISTS (SELECT 1 FROM dbo.benefit_detail WHERE version_id=@version_id) OR
               NOT EXISTS (SELECT 1 FROM dbo.benefit_condition WHERE version_id=@version_id)))
           OR (@kind=N'scam' AND (
               NOT EXISTS (SELECT 1 FROM dbo.scam_detail WHERE version_id=@version_id) OR
               NOT EXISTS (SELECT 1 FROM dbo.scam_indicator WHERE version_id=@version_id)))
             THROW 52011, 'Required subtype/detail missing', 1;
        IF (@kind<>N'procedure' AND EXISTS(SELECT 1 FROM dbo.procedure_detail WHERE version_id=@version_id))
           OR (@kind<>N'benefit' AND EXISTS(SELECT 1 FROM dbo.benefit_detail WHERE version_id=@version_id))
           OR (@kind<>N'scam' AND EXISTS(SELECT 1 FROM dbo.scam_detail WHERE version_id=@version_id))
             THROW 52012, 'Wrong subtype', 1;
        IF @kind IN (N'procedure',N'benefit') AND
           NOT EXISTS (SELECT 1 FROM dbo.knowledge_basis_document WHERE knowledge_version_id=@version_id) AND
           NOT EXISTS (SELECT 1 FROM dbo.knowledge_basis_provision WHERE knowledge_version_id=@version_id)
             THROW 52013, 'Legal basis missing', 1;

        IF NOT EXISTS (SELECT 1 FROM dbo.knowledge_version_source WHERE version_id=@version_id)
             THROW 52014, 'Evidence snapshots missing', 1;
        IF @kind IN (N'procedure',N'benefit') AND NOT EXISTS (
            SELECT 1 FROM dbo.knowledge_version_source ks
            JOIN dbo.source_snapshot ss ON ss.id=ks.snapshot_id
            JOIN dbo.source src ON src.id=ss.source_id
            WHERE ks.version_id=@version_id AND src.trust_tier<=2
        ) THROW 52018, 'Official-level source required for legal guidance', 1;
        IF EXISTS (
            SELECT 1 FROM dbo.knowledge_version_source ks
            OUTER APPLY (
               SELECT TOP (1) sv.decision,sv.valid_until
               FROM dbo.source_verification sv
               WHERE sv.source_snapshot_id=ks.snapshot_id AND sv.verified_at<=@now
               ORDER BY sv.verified_at DESC, sv.id DESC
            ) recent
            WHERE ks.version_id=@version_id AND
              (recent.decision IS NULL OR recent.decision<>N'accepted' OR
               (recent.valid_until IS NOT NULL AND recent.valid_until<=@now))
        ) THROW 52015, 'Evidence not currently verified', 1;

        -- For one item, equal-scope versions may not overlap in legal-time.
        -- Overlapping nationwide vs. local scopes are permitted; local takes precedence.
        IF EXISTS (
           SELECT 1
           FROM dbo.item_scope s
           JOIN dbo.knowledge_version v2 ON v2.item_id=@item_id AND v2.id<>@version_id
              AND v2.editorial_status=N'published' AND v2.withdrawn_at IS NULL
           JOIN dbo.item_scope s2 ON s2.version_id=v2.id
              AND s2.scope_kind=s.scope_kind
              AND (s2.admin_unit_id=s.admin_unit_id OR
                   (s2.admin_unit_id IS NULL AND s.admin_unit_id IS NULL))
           WHERE s.version_id=@version_id
              AND (@date_to IS NULL OR v2.effective_from<@date_to)
              AND (v2.effective_to IS NULL OR @date_from<v2.effective_to)
        ) THROW 52016, 'Effective period overlaps existing published version', 1;

        UPDATE dbo.knowledge_version
           SET editorial_status=N'published', published_at=@now
         WHERE id=@version_id AND editorial_status=N'approved';
        IF @@ROWCOUNT<>1 THROW 52017, 'Concurrent state modification', 1;
        INSERT dbo.moderation_event(version_id,actor_id,action,from_status,to_status,reason_note,occurred_at)
        VALUES (@version_id,@publisher_user_id,N'publish',N'approved',N'published',N'Published through controlled transaction',@now);
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- Separate author/reviewer approval; publisher transaction requires approved state.
CREATE OR ALTER PROCEDURE dbo.usp_approve_knowledge_version
    @version_id BIGINT,
    @reviewer_user_id BIGINT,
    @reason_note NVARCHAR(1000)=NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @item_id BIGINT,@created_by BIGINT,@status NVARCHAR(24),@kind NVARCHAR(20),@domain_code NVARCHAR(24),
            @now DATETIME2(3)=SYSUTCDATETIME(),@lock_result INT,@lock_resource NVARCHAR(255);
    BEGIN TRY
        BEGIN TRANSACTION;
        SELECT @item_id=item_id,@created_by=created_by,@status=editorial_status
        FROM dbo.knowledge_version WITH (UPDLOCK,HOLDLOCK)
        WHERE id=@version_id;
        IF @item_id IS NULL THROW 52020,'Version does not exist',1;
        SET @lock_resource=CONCAT(N'gocdansinh:item:',CONVERT(NVARCHAR(30),@item_id));
        EXEC @lock_result=sys.sp_getapplock
             @Resource=@lock_resource,
             @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000;
        IF @lock_result<0 THROW 52021,'Could not acquire item lock',1;
        IF @status<>N'review' THROW 52022,'Only submitted version can be approved',1;
        IF @created_by=@reviewer_user_id THROW 52023,'Reviewer must differ from author',1;
        IF NOT EXISTS (
            SELECT 1 FROM dbo.user_role ur
            JOIN dbo.role r ON r.id=ur.role_id
            JOIN dbo.app_user u ON u.id=ur.user_id
            WHERE ur.user_id=@reviewer_user_id AND r.role_code IN (N'reviewer',N'admin')
              AND u.account_status=N'active'
        ) THROW 52024,'Reviewer authorization missing',1;
        SELECT @kind=i.kind,@domain_code=d.code
        FROM dbo.knowledge_item i JOIN dbo.domain d ON d.id=i.domain_id
        WHERE i.id=@item_id;
        IF (@kind=N'procedure' AND @domain_code<>N'ADMIN') OR
           (@kind=N'benefit' AND @domain_code<>N'LEGAL') OR
           (@kind=N'scam' AND @domain_code<>N'SCAM')
            THROW 52026,N'Incorrect item domain for its kind',1;
        IF NOT EXISTS (SELECT 1 FROM dbo.item_category WHERE item_id=@item_id AND is_primary=1)
           OR NOT EXISTS (SELECT 1 FROM dbo.item_scope WHERE version_id=@version_id)
            THROW 52027,N'Primary category and item scope required before approval',1;
        IF (@kind=N'procedure' AND (
                NOT EXISTS(SELECT 1 FROM dbo.procedure_detail WHERE version_id=@version_id) OR
                NOT EXISTS(SELECT 1 FROM dbo.procedure_step WHERE version_id=@version_id) OR
                NOT EXISTS(SELECT 1 FROM dbo.procedure_office WHERE version_id=@version_id)))
           OR (@kind=N'benefit' AND (
                NOT EXISTS(SELECT 1 FROM dbo.benefit_detail WHERE version_id=@version_id) OR
                NOT EXISTS(SELECT 1 FROM dbo.benefit_condition WHERE version_id=@version_id)))
           OR (@kind=N'scam' AND (
                NOT EXISTS(SELECT 1 FROM dbo.scam_detail WHERE version_id=@version_id) OR
                NOT EXISTS(SELECT 1 FROM dbo.scam_indicator WHERE version_id=@version_id)))
            THROW 52028,N'Incomplete subtype content cannot be approved',1;
        IF (@kind<>N'procedure' AND EXISTS(SELECT 1 FROM dbo.procedure_detail WHERE version_id=@version_id))
           OR (@kind<>N'benefit' AND EXISTS(SELECT 1 FROM dbo.benefit_detail WHERE version_id=@version_id))
           OR (@kind<>N'scam' AND EXISTS(SELECT 1 FROM dbo.scam_detail WHERE version_id=@version_id))
            THROW 52029,N'Wrong subtype cannot be approved',1;
        IF @kind IN (N'procedure',N'benefit') AND
           NOT EXISTS(SELECT 1 FROM dbo.knowledge_basis_document WHERE knowledge_version_id=@version_id) AND
           NOT EXISTS(SELECT 1 FROM dbo.knowledge_basis_provision WHERE knowledge_version_id=@version_id)
            THROW 52030,N'Missing legal basis',1;
        IF NOT EXISTS(SELECT 1 FROM dbo.knowledge_version_source WHERE version_id=@version_id)
            THROW 52031,N'No evidence snapshot',1;
        IF @kind IN(N'procedure',N'benefit') AND NOT EXISTS(
           SELECT 1 FROM dbo.knowledge_version_source ks
           JOIN dbo.source_snapshot ss ON ss.id=ks.snapshot_id
           JOIN dbo.source src ON src.id=ss.source_id
           WHERE ks.version_id=@version_id AND src.trust_tier<=2)
            THROW 52032,N'Legal guidance requires an authoritative source',1;
        IF EXISTS(
           SELECT 1 FROM dbo.knowledge_version_source ks
           OUTER APPLY (SELECT TOP (1) v.decision,v.valid_until FROM dbo.source_verification v
              WHERE v.source_snapshot_id=ks.snapshot_id AND v.verified_at<=@now
              ORDER BY v.verified_at DESC,v.id DESC) last_v
           WHERE ks.version_id=@version_id AND
              (last_v.decision IS NULL OR last_v.decision<>N'accepted' OR
               (last_v.valid_until IS NOT NULL AND last_v.valid_until<=@now)))
            THROW 52033,N'Unverified snapshot in evidence set',1;

        UPDATE dbo.knowledge_version
          SET editorial_status=N'approved',approved_at=@now,approved_by=@reviewer_user_id
          WHERE id=@version_id AND editorial_status=N'review';
        IF @@ROWCOUNT<>1 THROW 52025,'Approval state conflict',1;
        INSERT dbo.moderation_event(version_id,actor_id,action,from_status,to_status,reason_note,occurred_at)
        VALUES(@version_id,@reviewer_user_id,N'approve',N'review',N'approved',@reason_note,@now);
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

GO

-- ==================================================================
-- MUC 04 Query and AI: Ham tra cuu va ham RAG
-- ==================================================================
GO
-- Query-time helpers and RAG answer finalization, Microsoft SQL Server 2022.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER VIEW dbo.v_latest_snapshot_verification
AS
WITH verification_ordered AS (
 SELECT v.id,v.source_snapshot_id,v.decision,v.verified_at,v.valid_until,
        ROW_NUMBER() OVER(PARTITION BY v.source_snapshot_id ORDER BY v.verified_at DESC,v.id DESC) AS rn
 FROM dbo.source_verification v
)
SELECT id,source_snapshot_id,decision,verified_at,valid_until
FROM verification_ordered WHERE rn=1;
GO
-- A real SQL Server view cannot accept parameters; use an inline table-valued function.
CREATE OR ALTER FUNCTION dbo.fn_legal_provision_as_of(@legal_date DATE)
RETURNS TABLE
AS
RETURN
 (
   SELECT lp.legal_document_id,lp.id AS provision_id,lp.locator_path,
          v.id AS provision_version_id,v.revision_no,v.provision_text,
          v.effective_from,v.effective_to,v.change_kind
   FROM dbo.legal_provision lp
   JOIN dbo.legal_provision_version v ON v.provision_id=lp.id
   WHERE v.effective_from<=@legal_date AND (v.effective_to IS NULL OR @legal_date<v.effective_to)
 );
GO
-- Returns the best scoped version(s). A tie returns CONFLICT, not an arbitrary version.
-- @observed_at means what had been published at the query moment; @legal_date
-- means the legal applicability date. These are distinct timelines.
CREATE OR ALTER FUNCTION dbo.fn_knowledge_for_date_and_unit(
 @legal_date DATE,@admin_unit_id BIGINT,@observed_at DATETIME2(3))
RETURNS TABLE
AS
RETURN
 (
  WITH ancestors AS (
   SELECT a.id,a.parent_id,CONVERT(INT,0) AS distance
   FROM dbo.admin_unit a
   WHERE a.id=@admin_unit_id AND a.valid_from<=@legal_date
     AND (a.valid_to IS NULL OR @legal_date<a.valid_to)
   UNION ALL
   SELECT p.id,p.parent_id,anc.distance+1
   FROM dbo.admin_unit p JOIN ancestors anc ON p.id=anc.parent_id
   WHERE p.valid_from<=@legal_date AND (p.valid_to IS NULL OR @legal_date<p.valid_to)
  ), scoped AS (
    SELECT v.id AS version_id,v.item_id,v.version_no,v.title,s.id AS scope_id,
           CASE WHEN s.scope_kind=N'nationwide' THEN 100000 ELSE a.distance END AS priority
    FROM dbo.knowledge_version v
    JOIN dbo.item_scope s ON s.version_id=v.id
    LEFT JOIN ancestors a ON a.id=s.admin_unit_id
    WHERE v.editorial_status=N'published' AND v.published_at<=@observed_at
      AND (v.withdrawn_at IS NULL OR @observed_at<v.withdrawn_at)
      AND v.effective_from<=@legal_date AND (v.effective_to IS NULL OR @legal_date<v.effective_to)
      AND (s.scope_kind=N'nationwide' OR a.id IS NOT NULL)
  ), ranked AS (
    SELECT s.*,MIN(priority) OVER(PARTITION BY item_id) AS best_priority
    FROM scoped s
  ), best AS (
    SELECT *,COUNT(*) OVER(PARTITION BY item_id) AS tied_candidates
    FROM ranked WHERE priority=best_priority
  )
  SELECT item_id,version_id,version_no,title,scope_id,priority,
     CASE WHEN tied_candidates>1 THEN N'CONFLICT' ELSE N'OK' END AS resolution_status
  FROM best
 );
GO
-- This procedure finalizes a generated answer only after all stored citations
-- correspond to eligible retrievals and the currently accepted snapshot decision.
CREATE OR ALTER PROCEDURE dbo.usp_finalize_generated_answer
    @answer_id BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @query_id BIGINT,@status NVARCHAR(24),@is_final BIT,@text NVARCHAR(MAX);
    DECLARE @now DATETIME2(3)=SYSUTCDATETIME();
    BEGIN TRY
      BEGIN TRANSACTION;
      SELECT @query_id=query_id,@status=generation_status,@is_final=is_final,@text=answer_text
      FROM dbo.generated_answer WITH (UPDLOCK,HOLDLOCK) WHERE id=@answer_id;
      IF @query_id IS NULL THROW 54001,N'Generated answer does not exist',1;
      IF @is_final=1 THROW 54002,N'Generated answer already final',1;
      IF @status<>N'succeeded' OR @text IS NULL
          THROW 54003,N'Only successful nonempty answers may be final',1;
      IF NOT EXISTS(SELECT 1 FROM dbo.answer_citation WITH (UPDLOCK,HOLDLOCK) WHERE answer_id=@answer_id)
          THROW 54004,N'Final answer requires at least one grounded citation',1;
      IF EXISTS(
         SELECT 1
         FROM dbo.answer_citation ac
         JOIN dbo.retrieval_result rr ON rr.id=ac.retrieval_result_id
         JOIN dbo.content_chunk cc ON cc.id=ac.chunk_id
         JOIN dbo.source_verification sv ON sv.id=ac.verification_id
         OUTER APPLY (
           SELECT TOP(1) v.id,v.decision,v.valid_until
           FROM dbo.source_verification v
           WHERE v.source_snapshot_id=ac.snapshot_id AND v.verified_at<=@now
           ORDER BY v.verified_at DESC,v.id DESC
         ) lv
         WHERE ac.answer_id=@answer_id AND (
             rr.eligible=0 OR lv.id IS NULL OR lv.id<>ac.verification_id OR
             lv.decision<>N'accepted' OR
             (lv.valid_until IS NOT NULL AND lv.valid_until<=@now) OR
             sv.decision<>N'accepted' OR
             (ac.quote_end IS NOT NULL AND CONVERT(BIGINT,ac.quote_end)>DATALENGTH(cc.chunk_text)/2)
         )
      ) THROW 54005,N'Citation has ineligible chunk, invalid offset, or stale verification',1;
      -- Link each cited chunk back to eligible published content or to a
      -- non-repealed provision revision valid on the requested legal date.
      IF EXISTS (
         SELECT 1
         FROM dbo.answer_citation ac
         JOIN dbo.query_analysis qa ON qa.id=ac.query_id
         WHERE ac.answer_id=@answer_id
           AND NOT EXISTS (
             SELECT 1 FROM dbo.fn_knowledge_for_date_and_unit(qa.requested_as_of,qa.requested_admin_unit_id,@now) AS rv
             JOIN dbo.knowledge_version_chunk kvc ON rv.version_id=kvc.version_id
             WHERE kvc.chunk_id=ac.chunk_id AND rv.resolution_status=N'OK'
           )
           AND NOT EXISTS (
             SELECT 1 FROM dbo.provision_version_chunk pvc
             JOIN dbo.legal_provision_version lpv ON lpv.id=pvc.provision_version_id
             WHERE pvc.chunk_id=ac.chunk_id
               AND lpv.change_kind<>N'repealed'
               AND lpv.effective_from<=qa.requested_as_of
               AND (lpv.effective_to IS NULL OR qa.requested_as_of<lpv.effective_to)
           )
      ) THROW 54014,N'Citation chunk is not attached to valid published knowledge or legal provision',1;
      UPDATE dbo.generated_answer SET is_final=1
      WHERE id=@answer_id AND is_final=0;
      IF @@ROWCOUNT<>1 THROW 54006,N'Finalization concurrency conflict',1;
      COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
      IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
      THROW;
    END CATCH;
END;
GO
-- Historical final answers are immutable. Attempt rows can be retried via new attempt_no.
CREATE TRIGGER dbo.trg_gds_final_answer_immutable ON dbo.generated_answer
AFTER UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id=d.id
              WHERE d.is_final=1 AND (i.id IS NULL OR i.is_final<>1 OR
                     i.query_id<>d.query_id OR i.conversation_id<>d.conversation_id OR
                     i.assistant_message_id<>d.assistant_message_id OR
                     i.answer_text<>d.answer_text OR i.generation_status<>d.generation_status OR
                     i.model_code<>d.model_code OR i.prompt_sha256<>d.prompt_sha256))
        THROW 54007,N'Final generated answer is immutable',1;
END;
GO
CREATE TRIGGER dbo.trg_gds_final_answer_citations_immutable ON dbo.answer_citation
AFTER INSERT,UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.generated_answer a ON a.id=i.answer_id WHERE a.is_final=1)
      OR EXISTS(SELECT 1 FROM deleted d JOIN dbo.generated_answer a ON a.id=d.answer_id WHERE a.is_final=1)
        THROW 54008,N'Citations of a final answer cannot be changed',1;
END;
GO
-- Historical withdrawal is a separate controlled event rather than a destructive update.
CREATE OR ALTER PROCEDURE dbo.usp_withdraw_knowledge_version
    @version_id BIGINT,@publisher_user_id BIGINT,@reason NVARCHAR(1000)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @item_id BIGINT,@already DATETIME2(3),@status NVARCHAR(24),
            @now DATETIME2(3)=SYSUTCDATETIME(),@lock_result INT,@resource NVARCHAR(255);
    BEGIN TRY
      BEGIN TRANSACTION;
      SELECT @item_id=item_id,@already=withdrawn_at,@status=editorial_status
      FROM dbo.knowledge_version WITH (UPDLOCK,HOLDLOCK) WHERE id=@version_id;
      IF @item_id IS NULL THROW 54009,N'Knowledge version missing',1;
      IF @status<>N'published' OR @already IS NOT NULL
          THROW 54010,N'Only active published versions can be withdrawn',1;
      IF NULLIF(LTRIM(RTRIM(@reason)),N'') IS NULL
          THROW 54011,N'Withdrawal reason required',1;
      SET @resource=CONCAT(N'gocdansinh:item:',CONVERT(NVARCHAR(30),@item_id));
      EXEC @lock_result=sys.sp_getapplock @Resource=@resource,
           @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000;
      IF @lock_result<0 THROW 54012,N'Item lock unavailable',1;
      IF NOT EXISTS (
         SELECT 1 FROM dbo.user_role ur JOIN dbo.role r ON r.id=ur.role_id
         JOIN dbo.app_user u ON u.id=ur.user_id
         WHERE ur.user_id=@publisher_user_id AND u.account_status=N'active'
           AND r.role_code IN (N'publisher',N'admin')
      ) THROW 54013,N'Publisher authorization required',1;
      UPDATE dbo.knowledge_version SET withdrawn_at=@now WHERE id=@version_id;
      INSERT dbo.moderation_event(version_id,actor_id,action,from_status,to_status,reason_note,occurred_at)
      VALUES (@version_id,@publisher_user_id,N'withdraw',N'published',N'published',@reason,@now);
      COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
      IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
      THROW;
    END CATCH;
END;
GO

GO

-- ==================================================================
-- MUC 05 Security Roles: Quyen truy cap SQL Server
-- ==================================================================
GO
-- Principle of least privilege, SQL Server 2022.
-- Do not add application logins to db_owner or db_datawriter.
-- Grant table DML for authoring through separately reviewed write procedures, not here.
IF DATABASE_PRINCIPAL_ID(N'gocdansinh_reader') IS NULL
    CREATE ROLE [gocdansinh_reader] AUTHORIZATION [dbo];
IF DATABASE_PRINCIPAL_ID(N'gocdansinh_workflow') IS NULL
    CREATE ROLE [gocdansinh_workflow] AUTHORIZATION [dbo];
GO
GRANT SELECT ON SCHEMA::dbo TO [gocdansinh_reader];
GO
GRANT SELECT ON SCHEMA::dbo TO [gocdansinh_workflow];
GO
GRANT EXECUTE ON OBJECT::dbo.usp_approve_knowledge_version TO [gocdansinh_workflow];
GRANT EXECUTE ON OBJECT::dbo.usp_publish_knowledge_version TO [gocdansinh_workflow];
GRANT EXECUTE ON OBJECT::dbo.usp_withdraw_knowledge_version TO [gocdansinh_workflow];
GRANT EXECUTE ON OBJECT::dbo.usp_finalize_generated_answer TO [gocdansinh_workflow];
GO
-- Ownership chaining lets these procedures update dbo tables while an ordinary
-- role member has no direct INSERT/UPDATE/DELETE rights on tables.
-- This alone does not implement authentication or a full content-authoring API.

GO

-- ==================================================================
-- MUC 06 Seed Reference: Seed module/role co so
-- ==================================================================
GO
-- Seed business CODEs only; does not claim any real legal data.
-- Chay sau khi tao bang (tu dong trong File 01).
IF NOT EXISTS (SELECT 1 FROM dbo.domain WHERE code=N'LEGAL')
 INSERT dbo.domain(code,name,is_active) VALUES (N'LEGAL',N'Pháp luật & Quyền lợi',1);
IF NOT EXISTS (SELECT 1 FROM dbo.domain WHERE code=N'ADMIN')
 INSERT dbo.domain(code,name,is_active) VALUES (N'ADMIN',N'Thủ tục hành chính',1);
IF NOT EXISTS (SELECT 1 FROM dbo.domain WHERE code=N'SCAM')
 INSERT dbo.domain(code,name,is_active) VALUES (N'SCAM',N'Cảnh báo lừa đảo',1);
GO
IF NOT EXISTS (SELECT 1 FROM dbo.role WHERE role_code=N'author')
 INSERT dbo.role(role_code,role_name) VALUES (N'author',N'Biên tập viên');
IF NOT EXISTS (SELECT 1 FROM dbo.role WHERE role_code=N'reviewer')
 INSERT dbo.role(role_code,role_name) VALUES (N'reviewer',N'Kiểm duyệt viên');
IF NOT EXISTS (SELECT 1 FROM dbo.role WHERE role_code=N'publisher')
 INSERT dbo.role(role_code,role_name) VALUES (N'publisher',N'Người công bố');
IF NOT EXISTS (SELECT 1 FROM dbo.role WHERE role_code=N'admin')
 INSERT dbo.role(role_code,role_name) VALUES (N'admin',N'Quản trị hệ thống');
GO

GO

-- ==================================================================
-- MUC 06a Module Boundary Guards: Gioi han dung ba module
-- ==================================================================
GO
-- GÓC DÂN SINH: MODULE BOUNDARY GUARDS
-- Strictly the 3 business modules. Shared tables remain shared technical components.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
ALTER TABLE dbo.[domain] WITH CHECK
  ADD CONSTRAINT CK_gds_only_3_business_modules
  CHECK (code IN (N'LEGAL',N'ADMIN',N'SCAM'));
GO
-- Every knowledge item belongs to exactly the correct domain (even in draft state).
CREATE OR ALTER TRIGGER dbo.trg_gds_item_kind_domain
ON dbo.knowledge_item
AFTER INSERT, UPDATE
AS
BEGIN
   SET NOCOUNT ON;
   IF EXISTS (
      SELECT 1
      FROM inserted i
      JOIN dbo.[domain] d ON d.id=i.domain_id
      WHERE NOT ((i.kind=N'benefit' AND d.code=N'LEGAL') OR
                 (i.kind=N'procedure' AND d.code=N'ADMIN') OR
                 (i.kind=N'scam' AND d.code=N'SCAM'))
   ) THROW 57001,N'Invalid module mapping: benefit=LEGAL, procedure=ADMIN, scam=SCAM',1;
END;
GO
-- Business module codes must not be reassigned after being created.
CREATE OR ALTER TRIGGER dbo.trg_gds_domain_code_locked
ON dbo.[domain]
AFTER UPDATE
AS
BEGIN
   SET NOCOUNT ON;
   IF EXISTS (
      SELECT 1 FROM inserted i JOIN deleted d ON d.id=i.id
      WHERE i.code<>d.code
   ) THROW 57002,N'Business module code is immutable',1;
END;
GO

GO
