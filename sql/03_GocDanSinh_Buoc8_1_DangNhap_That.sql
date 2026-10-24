/*
 GOC DAN SINH - BUOC 8.1: XAC THUC THAT (KHONG DOI 52 BANG GOC)
 Chay DUY NHAT FILE NAY tren database GocDanSinh dang hoat dong.
 Co the chay lai, vi chi tao bang neu chua co. KHONG CHAY FILE 01 LAI.
 Them 2 bang tach rieng: auth_credential, auth_session.
 Khong tao mat khau cho tai khoan demo, khong gan role admin, khong cong bo ban nhap.
*/
USE [GocDanSinh];
GO
SET NOCOUNT ON;
IF OBJECT_ID(N'dbo.app_user',N'U') IS NULL OR OBJECT_ID(N'dbo.user_role',N'U') IS NULL
    THROW 58081,N'Thieu cau truc B1-B6, dung lai.',1;
GO
IF OBJECT_ID(N'dbo.auth_credential',N'U') IS NULL
BEGIN
    CREATE TABLE dbo.auth_credential (
        user_id BIGINT NOT NULL PRIMARY KEY,
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
        token_hash BINARY(32) NOT NULL PRIMARY KEY,
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
-- CHECK READ-ONLY: 2 bang xac thuc moi; khong bao gom 52 bang goc.
SELECT N'GocDanSinh' AS DatabaseName,
       CASE WHEN OBJECT_ID(N'dbo.auth_credential',N'U') IS NOT NULL THEN N'PASS' ELSE N'MISSING' END AS CredentialTable,
       CASE WHEN OBJECT_ID(N'dbo.auth_session',N'U') IS NOT NULL THEN N'PASS' ELSE N'MISSING' END AS SessionTable,
       (SELECT COUNT(*) FROM dbo.app_user WHERE email LIKE N'%@example.invalid') AS DemoAccounts,
       (SELECT COUNT(*) FROM dbo.auth_credential) AS AccountsWithPassword,
       (SELECT COUNT(*) FROM dbo.knowledge_version WHERE editorial_status=N'draft') AS DraftVersions;
GO
