/*
  GOC DAN SINH | FILE 02 (BAN SACH): CAC BANG BO SUNG NGOAI 52 BANG ERD
  SQL Server 2022 | DATABASE: [GocDanSinh] | CHAY LAI AN TOAN (idempotent)

  GOM (gop tu cac file cu):
    - auth_credential, auth_session ........ tu 03_Thiet_Lap_Dang_Nhap.sql
    - knowledge_item_link ................. tu 07_Nap_Tri_Thuc_MVP_Va_Lien_Ket.sql
    - knowledge_source_candidate .......... tu 07_Nap_Tri_Thuc_MVP_Va_Lien_Ket.sql
    - official_feed_entry/_snapshot ....... tu Nguon_CongBao_Hang_Cho_KiemDuyet.sql
    - assistant_feedback .................. tu 10_Tao_Bang_Phan_Hoi_Tro_Ly.sql
    - site_feedback (MOI) + 4 stored proc . gop y / phan hoi chung + tra cuu ket qua
  KHONG sua, khong xoa bat ky bang nao trong 52 bang goc.

  VI SAO CAN site_feedback: bang content_report cua ERD co version_id NOT NULL
  (chi bao loi cho MOT phien ban noi dung); assistant_feedback chi luu like/dislike
  cua tro ly AI, khong co noi dung chu va khong co ma tra cuu. Nen trang
  "Phan hoi & gop y" khong co noi nao de ghi. site_feedback bu vao cho trong do.

  QUYEN RIENG TU: site_feedback KHONG luu dia chi IP. Email lien he la TUY CHON.
  Ma theo doi chi duoc luu dang bam SHA-256; ma goc chi hien MOT LAN cho nguoi gui.
*/
USE [GocDanSinh];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME() <> N'GocDanSinh' THROW 59800, N'Sai database. Phai la GocDanSinh.', 1;
IF OBJECT_ID(N'dbo.app_user',N'U') IS NULL OR OBJECT_ID(N'dbo.knowledge_item',N'U') IS NULL
    THROW 59801, N'Chua co schema 52 bang. Chay file 01 truoc.', 1;
GO

/* ============ 1. XAC THUC ============ */
IF OBJECT_ID(N'dbo.auth_credential',N'U') IS NULL
BEGIN
    CREATE TABLE dbo.auth_credential (
        user_id BIGINT NOT NULL CONSTRAINT PK_auth_credential PRIMARY KEY,
        password_salt VARBINARY(32) NOT NULL,
        password_hash VARBINARY(64) NOT NULL,
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_auth_credential_created DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_auth_credential_updated DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_auth_credential_user FOREIGN KEY (user_id) REFERENCES dbo.app_user(id)
    );
END;
GO
IF OBJECT_ID(N'dbo.auth_session',N'U') IS NULL
BEGIN
    CREATE TABLE dbo.auth_session (
        token_hash BINARY(32) NOT NULL CONSTRAINT PK_auth_session PRIMARY KEY,
        user_id BIGINT NOT NULL,
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_auth_session_created DEFAULT SYSUTCDATETIME(),
        expires_at DATETIME2(3) NOT NULL,
        revoked_at DATETIME2(3) NULL,
        CONSTRAINT FK_auth_session_user FOREIGN KEY (user_id) REFERENCES dbo.app_user(id),
        CONSTRAINT CK_auth_session_expiration CHECK (expires_at > created_at)
    );
    CREATE INDEX IX_auth_session_user_expiry ON dbo.auth_session(user_id,expires_at) INCLUDE(revoked_at);
END;
GO

/* ============ 2. LIEN KET NOI DUNG & NGUON UNG VIEN ============ */
IF OBJECT_ID(N'dbo.knowledge_item_link',N'U') IS NULL
BEGIN
    CREATE TABLE dbo.knowledge_item_link(
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_gds_item_link PRIMARY KEY,
        from_item_id BIGINT NOT NULL,
        to_item_id BIGINT NOT NULL,
        relation_type NVARCHAR(30) NOT NULL,
        relation_note NVARCHAR(500) NOT NULL,
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_gds_item_link_created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_gds_link_from FOREIGN KEY(from_item_id) REFERENCES dbo.knowledge_item(id),
        CONSTRAINT FK_gds_link_to FOREIGN KEY(to_item_id) REFERENCES dbo.knowledge_item(id),
        CONSTRAINT CK_gds_link_notself CHECK(from_item_id<>to_item_id),
        CONSTRAINT CK_gds_link_type CHECK(relation_type IN (N'guides_procedure',N'warns_related',N'risk_context')),
        CONSTRAINT UQ_gds_link UNIQUE(from_item_id,to_item_id,relation_type)
    );
END;
GO
IF OBJECT_ID(N'dbo.knowledge_source_candidate',N'U') IS NULL
BEGIN
    CREATE TABLE dbo.knowledge_source_candidate(
        item_id BIGINT NOT NULL,
        source_id BIGINT NOT NULL,
        review_status NVARCHAR(24) NOT NULL CONSTRAINT DF_gds_candidate_status DEFAULT N'pending_review',
        review_note NVARCHAR(600) NOT NULL,
        CONSTRAINT PK_gds_source_candidate PRIMARY KEY(item_id,source_id),
        CONSTRAINT FK_gds_candidate_item FOREIGN KEY(item_id) REFERENCES dbo.knowledge_item(id),
        CONSTRAINT FK_gds_candidate_source FOREIGN KEY(source_id) REFERENCES dbo.[source](id),
        CONSTRAINT CK_gds_candidate_status CHECK(review_status=N'pending_review')
    );
END;
GO

/* ============ 3. HOP THU NGUON CONG BAO (RSS) - CHI CHO DUYET ============ */
IF OBJECT_ID(N'dbo.official_feed_entry',N'U') IS NULL
BEGIN
    CREATE TABLE dbo.official_feed_entry(
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_official_feed_entry PRIMARY KEY,
        source_key NVARCHAR(80) NOT NULL,
        entry_uid BINARY(32) NOT NULL,
        canonical_url NVARCHAR(1200) NOT NULL,
        first_seen_at DATETIME2(3) NOT NULL,
        last_seen_at DATETIME2(3) NOT NULL,
        CONSTRAINT UX_gds_official_feed_entry UNIQUE(source_key,entry_uid)
    );
END;
GO
IF OBJECT_ID(N'dbo.official_feed_snapshot',N'U') IS NULL
BEGIN
    CREATE TABLE dbo.official_feed_snapshot(
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_official_feed_snapshot PRIMARY KEY,
        entry_id BIGINT NOT NULL,
        metadata_sha256 BINARY(32) NOT NULL,
        title NVARCHAR(450) NOT NULL,
        description NVARCHAR(1200) NULL,
        published_at DATETIME2(3) NULL,
        captured_at DATETIME2(3) NOT NULL,
        review_status NVARCHAR(20) NOT NULL CONSTRAINT DF_gds_feed_pending DEFAULT N'pending_review',
        CONSTRAINT FK_gds_feed_snapshot_entry FOREIGN KEY(entry_id) REFERENCES dbo.official_feed_entry(id),
        CONSTRAINT CK_gds_feed_review_pending CHECK(review_status=N'pending_review'),
        CONSTRAINT UX_gds_feed_snapshot_unique UNIQUE(entry_id,metadata_sha256)
    );
END;
GO

/* ============ 4. DANH GIA CAU TRA LOI CUA TRO LY AI (khong luu noi dung chat) ============ */
IF OBJECT_ID(N'dbo.assistant_feedback',N'U') IS NULL
BEGIN
    CREATE TABLE dbo.assistant_feedback (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_assistant_feedback PRIMARY KEY,
        receipt_sha256 BINARY(32) NOT NULL,
        vote NVARCHAR(16) NOT NULL,
        reason_kind NVARCHAR(30) NOT NULL,
        answer_scope NVARCHAR(12) NOT NULL,
        answer_status NVARCHAR(32) NOT NULL,
        intent NVARCHAR(16) NOT NULL,
        source_count SMALLINT NOT NULL,
        review_status NVARCHAR(16) NOT NULL CONSTRAINT DF_assistant_feedback_review DEFAULT N'pending',
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_assistant_feedback_created DEFAULT SYSUTCDATETIME(),
        reviewed_by BIGINT NULL,
        reviewed_at DATETIME2(3) NULL,
        CONSTRAINT UQ_assistant_feedback_receipt UNIQUE(receipt_sha256),
        CONSTRAINT CK_assistant_feedback_vote CHECK (vote IN (N'helpful',N'not_helpful')),
        CONSTRAINT CK_assistant_feedback_reason CHECK (reason_kind IN (N'none',N'incorrect',N'outdated',N'missing_source',N'unclear',N'unsafe',N'other')),
        CONSTRAINT CK_assistant_feedback_vote_reason CHECK ((vote=N'helpful' AND reason_kind=N'none') OR (vote=N'not_helpful' AND reason_kind<>N'none')),
        CONSTRAINT CK_assistant_feedback_scope CHECK (answer_scope IN (N'public',N'staff')),
        CONSTRAINT CK_assistant_feedback_status CHECK (answer_status IN (N'AI_GENERATED',N'RETRIEVAL_ONLY',N'PROVIDER_UNAVAILABLE',N'INSUFFICIENT_EVIDENCE')),
        CONSTRAINT CK_assistant_feedback_intent CHECK (intent IN (N'SAFETY',N'BENEFIT',N'PROCEDURE',N'GENERAL')),
        CONSTRAINT CK_assistant_feedback_count CHECK (source_count BETWEEN 0 AND 9),
        CONSTRAINT CK_assistant_feedback_review CHECK (review_status IN (N'pending',N'reviewed')),
        CONSTRAINT FK_assistant_feedback_reviewer FOREIGN KEY (reviewed_by) REFERENCES dbo.app_user(id)
    );
    CREATE INDEX IX_assistant_feedback_queue ON dbo.assistant_feedback(review_status,created_at DESC) INCLUDE(vote,reason_kind,answer_status);
END;
GO

/* ============ 5. GOP Y / PHAN HOI CHUNG CUA NGUOI DAN (MOI) ============ */
IF OBJECT_ID(N'dbo.site_feedback',N'U') IS NULL
BEGIN
    CREATE TABLE dbo.site_feedback (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_site_feedback PRIMARY KEY,
        tracking_hash BINARY(32) NOT NULL,           -- SHA-256 cua ma theo doi da chuan hoa
        feedback_kind NVARCHAR(20) NOT NULL,
        related_item_id BIGINT NULL,                 -- bai nguoi dung dang xem (tuy chon)
        subject NVARCHAR(150) NOT NULL,
        message NVARCHAR(2000) NOT NULL,
        contact_email NVARCHAR(254) NULL,            -- TUY CHON, chi dung de tra loi
        status NVARCHAR(16) NOT NULL CONSTRAINT DF_site_feedback_status DEFAULT N'received',
        public_reply NVARCHAR(1500) NULL,            -- noi dung tra loi nguoi gui se thay khi tra cuu
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_site_feedback_created DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_site_feedback_updated DEFAULT SYSUTCDATETIME(),
        handled_by BIGINT NULL,
        handled_at DATETIME2(3) NULL,
        CONSTRAINT UQ_site_feedback_tracking UNIQUE(tracking_hash),
        CONSTRAINT FK_site_feedback_item FOREIGN KEY(related_item_id) REFERENCES dbo.knowledge_item(id),
        CONSTRAINT FK_site_feedback_handler FOREIGN KEY(handled_by) REFERENCES dbo.app_user(id),
        CONSTRAINT CK_site_feedback_kind CHECK (feedback_kind IN (N'suggestion',N'content_error',N'question',N'scam_tip',N'other')),
        CONSTRAINT CK_site_feedback_status CHECK (status IN (N'received',N'in_review',N'resolved',N'rejected')),
        CONSTRAINT CK_site_feedback_subject CHECK (LEN(LTRIM(RTRIM(subject)))>=3),
        CONSTRAINT CK_site_feedback_message CHECK (LEN(LTRIM(RTRIM(message)))>=10),
        CONSTRAINT CK_site_feedback_email CHECK (contact_email IS NULL OR (contact_email LIKE N'_%@_%._%' AND contact_email NOT LIKE N'% %')),
        CONSTRAINT CK_site_feedback_handled CHECK (status NOT IN (N'resolved',N'rejected') OR handled_by IS NOT NULL)
    );
    CREATE INDEX IX_site_feedback_queue ON dbo.site_feedback(status,created_at DESC) INCLUDE(feedback_kind,related_item_id);
END;
GO

/* --- 5a. Gui gop y: tra ve ma theo doi (hien MOT LAN) --- */
CREATE OR ALTER PROCEDURE dbo.usp_site_feedback_submit
    @feedback_kind NVARCHAR(20),
    @subject NVARCHAR(150),
    @message NVARCHAR(2000),
    @contact_email NVARCHAR(254) = NULL,
    @related_item_id BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET @subject = LTRIM(RTRIM(@subject));
    SET @message = LTRIM(RTRIM(@message));
    SET @contact_email = NULLIF(LOWER(LTRIM(RTRIM(@contact_email))), N'');

    IF @feedback_kind NOT IN (N'suggestion',N'content_error',N'question',N'scam_tip',N'other')
        THROW 59701, N'Loai phan hoi khong hop le.', 1;
    IF @subject IS NULL OR LEN(@subject) < 3
        THROW 59702, N'Tieu de qua ngan (toi thieu 3 ky tu).', 1;
    IF @message IS NULL OR LEN(@message) < 10
        THROW 59703, N'Noi dung qua ngan (toi thieu 10 ky tu).', 1;
    IF @related_item_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.knowledge_item WHERE id=@related_item_id AND deleted_at IS NULL)
        THROW 59704, N'Bai viet lien quan khong ton tai.', 1;

    DECLARE @alphabet NCHAR(32) = N'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- bo I, O, 0, 1 de de doc
    DECLARE @attempt INT = 0, @code NVARCHAR(12), @hash BINARY(32), @rnd VARBINARY(12), @i INT;

    WHILE @attempt < 5
    BEGIN
        SET @attempt += 1;
        SET @rnd = CRYPT_GEN_RANDOM(12);
        SET @code = N'';
        SET @i = 1;
        WHILE @i <= 12
        BEGIN
            -- 256 chia het cho 32 nen khong lech phan bo
            SET @code += SUBSTRING(@alphabet, (CONVERT(INT, SUBSTRING(@rnd, @i, 1)) % 32) + 1, 1);
            SET @i += 1;
        END;
        SET @hash = HASHBYTES('SHA2_256', CONVERT(VARBINARY(100), @code));
        IF NOT EXISTS (SELECT 1 FROM dbo.site_feedback WHERE tracking_hash = @hash) BREAK;
        SET @hash = NULL;
    END;
    IF @hash IS NULL THROW 59705, N'Khong tao duoc ma theo doi, vui long thu lai.', 1;

    INSERT dbo.site_feedback(tracking_hash, feedback_kind, related_item_id, subject, message, contact_email)
    VALUES (@hash, @feedback_kind, @related_item_id, @subject, @message, @contact_email);

    -- Ma goc CHI duoc tra ve o day. DB chi giu ban bam.
    SELECT CONCAT(N'PH-', SUBSTRING(@code,1,4), N'-', SUBSTRING(@code,5,4), N'-', SUBSTRING(@code,9,4)) AS tracking_code;
END;
GO

/* --- 5b. Tra cuu ket qua bang ma theo doi (khong lo noi dung nguoi khac) --- */
CREATE OR ALTER PROCEDURE dbo.usp_site_feedback_track
    @tracking_code NVARCHAR(40)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @norm NVARCHAR(40) = UPPER(REPLACE(REPLACE(LTRIM(RTRIM(@tracking_code)), N'-', N''), N' ', N''));
    IF LEFT(@norm, 2) = N'PH' AND LEN(@norm) = 14 SET @norm = SUBSTRING(@norm, 3, 12);
    IF LEN(@norm) <> 12
    BEGIN
        -- tra ve tap rong, khong tiet lo ly do
        SELECT TOP (0) CAST(NULL AS NVARCHAR(20)) AS feedback_kind, CAST(NULL AS NVARCHAR(150)) AS subject,
               CAST(NULL AS NVARCHAR(16)) AS status, CAST(NULL AS NVARCHAR(1500)) AS public_reply,
               CAST(NULL AS DATETIME2(3)) AS created_at, CAST(NULL AS DATETIME2(3)) AS updated_at;
        RETURN;
    END;
    DECLARE @hash BINARY(32) = HASHBYTES('SHA2_256', CONVERT(VARBINARY(100), @norm));
    SELECT f.feedback_kind, f.subject, f.status, f.public_reply, f.created_at, f.updated_at
    FROM dbo.site_feedback f
    WHERE f.tracking_hash = @hash;
END;
GO

/* --- 5c. Danh sach cho nhan su xu ly (co email lien he -> chi nhan su) --- */
CREATE OR ALTER PROCEDURE dbo.usp_site_feedback_list
    @staff_user_id BIGINT,
    @status NVARCHAR(16) = NULL,
    @top INT = 100
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.user_role ur JOIN dbo.[role] r ON r.id=ur.role_id
                   JOIN dbo.app_user u ON u.id=ur.user_id
                   WHERE ur.user_id=@staff_user_id AND u.account_status=N'active'
                     AND r.role_code IN (N'admin',N'reviewer',N'editor',N'author'))
        THROW 59711, N'Khong co quyen xem hang cho phan hoi.', 1;
    IF @top IS NULL OR @top < 1 OR @top > 500 SET @top = 100;
    SELECT TOP (@top) f.id, f.feedback_kind, f.subject, f.message, f.contact_email, f.status,
           f.related_item_id, ki.business_code AS related_business_code,
           f.public_reply, f.created_at, f.updated_at, f.handled_by, f.handled_at
    FROM dbo.site_feedback f
    LEFT JOIN dbo.knowledge_item ki ON ki.id = f.related_item_id
    WHERE (@status IS NULL OR f.status = @status)
    ORDER BY CASE f.status WHEN N'received' THEN 0 WHEN N'in_review' THEN 1 ELSE 2 END, f.created_at DESC;
END;
GO

/* --- 5d. Nhan su xu ly / tra loi (ghi audit_log) --- */
CREATE OR ALTER PROCEDURE dbo.usp_site_feedback_resolve
    @feedback_id BIGINT,
    @staff_user_id BIGINT,
    @new_status NVARCHAR(16),
    @public_reply NVARCHAR(1500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @new_status NOT IN (N'in_review',N'resolved',N'rejected')
        THROW 59721, N'Trang thai moi khong hop le.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.user_role ur JOIN dbo.[role] r ON r.id=ur.role_id
                   JOIN dbo.app_user u ON u.id=ur.user_id
                   WHERE ur.user_id=@staff_user_id AND u.account_status=N'active'
                     AND r.role_code IN (N'admin',N'reviewer'))
        THROW 59722, N'Chi admin/reviewer duoc xu ly phan hoi.', 1;
    SET @public_reply = NULLIF(LTRIM(RTRIM(@public_reply)), N'');
    IF @new_status IN (N'resolved',N'rejected') AND @public_reply IS NULL
        THROW 59723, N'Dong hoac tu choi phan hoi phai kem noi dung tra loi cho nguoi gui.', 1;

    BEGIN TRY
        BEGIN TRAN;
        DECLARE @old NVARCHAR(16) = (SELECT status FROM dbo.site_feedback WITH (UPDLOCK, HOLDLOCK) WHERE id=@feedback_id);
        IF @old IS NULL THROW 59724, N'Khong tim thay phan hoi.', 1;
        IF @old IN (N'resolved',N'rejected') THROW 59725, N'Phan hoi da dong, khong sua lai.', 1;

        DECLARE @now DATETIME2(3) = SYSUTCDATETIME();
        UPDATE dbo.site_feedback
           SET status=@new_status, public_reply=COALESCE(@public_reply, public_reply),
               updated_at=@now, handled_by=@staff_user_id, handled_at=@now
         WHERE id=@feedback_id;

        DECLARE @json NVARCHAR(MAX) = (
            SELECT @old AS from_status, @new_status AS to_status, CASE WHEN @public_reply IS NULL THEN 0 ELSE 1 END AS has_reply
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        INSERT dbo.audit_log(actor_id,entity_name,entity_id,action,change_json,occurred_at,entry_sha256)
        VALUES (@staff_user_id, N'site_feedback', @feedback_id, N'feedback_status_change', @json, @now,
                HASHBYTES('SHA2_256', CONVERT(VARBINARY(MAX), @json)));
        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT>0 ROLLBACK TRAN;
        THROW;
    END CATCH;
END;
GO

/* --- 5e. Quyen: nguoi dan chi duoc GUI + TRA CUU; nhan su moi xem/xu ly --- */
IF DATABASE_PRINCIPAL_ID(N'gocdansinh_reader') IS NOT NULL
BEGIN
    GRANT EXECUTE ON OBJECT::dbo.usp_site_feedback_submit TO [gocdansinh_reader];
    GRANT EXECUTE ON OBJECT::dbo.usp_site_feedback_track  TO [gocdansinh_reader];
END;
IF DATABASE_PRINCIPAL_ID(N'gocdansinh_workflow') IS NOT NULL
BEGIN
    GRANT EXECUTE ON OBJECT::dbo.usp_site_feedback_submit  TO [gocdansinh_workflow];
    GRANT EXECUTE ON OBJECT::dbo.usp_site_feedback_track   TO [gocdansinh_workflow];
    GRANT EXECUTE ON OBJECT::dbo.usp_site_feedback_list    TO [gocdansinh_workflow];
    GRANT EXECUTE ON OBJECT::dbo.usp_site_feedback_resolve TO [gocdansinh_workflow];
END;
GO
/*
  CANH BAO BAO MAT (khong tu dong ap dung de khong lam hong app dang chay):
  File 01 cap  GRANT SELECT ON SCHEMA::dbo TO gocdansinh_reader  -> role nay doc duoc
  MOI bang, ke ca auth_credential (salt/hash mat khau), auth_session (token hash) va
  site_feedback (email nguoi dan). Neu app cong khai dang dung login thuoc role nay,
  hay chay cac dong sau SAU KHI da chac chan login quan tri dung role/login KHAC:

    -- DENY SELECT ON OBJECT::dbo.auth_credential TO [gocdansinh_reader];
    -- DENY SELECT ON OBJECT::dbo.auth_session    TO [gocdansinh_reader];
    -- DENY SELECT ON OBJECT::dbo.site_feedback   TO [gocdansinh_reader];

  Luu y: DENY thang moi GRANT. Neu mot login vua thuoc reader vua thuoc workflow thi
  DENY se chan ca workflow.
*/
SELECT N'PASS - Da san sang cac bang bo sung (auth, link, candidate, feed, feedback, site_feedback)' AS KetQua;
GO
