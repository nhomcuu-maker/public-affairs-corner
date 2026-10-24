/*
 GOC DAN SINH - BUOC 8.2: CAP QUYEN QUAN TRI LAN DAU
 CHI CHAY TRONG SSMS BANG CHINH BAN. KHONG CHAY KHI CHUA SUA 2 BIEN BEN DUOI.
 Chi cap quyen cho MOT tai khoan that, da dang ky bang mat khau tai Buoc 8.1.
 Khong tao moi, xoa bang, khong sua noi dung ho chieu va KHONG cong bo du lieu.
 Sao luu database truoc khi chay. Khong de file nay o thu muc public/.
*/
USE [GocDanSinh];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

-- 1. THAY EMAIL bang email ban da dang ky thanh cong o Buoc 8.1.

DECLARE @Email NVARCHAR(254) = N'gocdansinh@gmail.com';
DECLARE @XacNhan NVARCHAR(30) = N'CAP_QUYEN_8_2';

IF @Email = N'' OR @XacNhan <> N'CAP_QUYEN_8_2'
    THROW 58201, N'Chua dien email va xac nhan. Chua co quyen nao duoc cap.', 1;
IF @Email LIKE N'%@example.invalid'
    THROW 58202, N'Khong cap quyen cho tai khoan demo.', 1;
IF OBJECT_ID(N'dbo.auth_credential',N'U') IS NULL
    THROW 58203, N'Chua cai dat Bang xac thuc Buoc 8.1.', 1;

DECLARE @UserId BIGINT;
DECLARE @RoleId BIGINT;
SELECT @UserId = u.id
FROM dbo.app_user u
JOIN dbo.auth_credential c ON c.user_id = u.id
WHERE u.email = LOWER(LTRIM(RTRIM(@Email)))
  AND u.account_status = N'active';
SELECT @RoleId = id FROM dbo.[role] WHERE role_code = N'admin';

IF @UserId IS NULL THROW 58204, N'Khong tim thay tai khoan ACTIVE da dat mat khau. Dung lai.', 1;
IF @RoleId IS NULL THROW 58205, N'Vai tro admin chua ton tai. Dung lai.', 1;

BEGIN TRY
    BEGIN TRAN;
    IF NOT EXISTS (SELECT 1 FROM dbo.user_role WITH (UPDLOCK, HOLDLOCK)
                   WHERE user_id = @UserId AND role_id = @RoleId)
       INSERT INTO dbo.user_role(user_id,role_id,granted_at)
       VALUES (@UserId,@RoleId,SYSUTCDATETIME());
    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;

-- KET QUA: can thay role_code=admin cho email vua nhap.
SELECT u.id AS UserID, u.display_name AS DisplayName, u.email,
       r.role_code AS RoleCode, ur.granted_at AS GrantedAt
FROM dbo.app_user u
JOIN dbo.user_role ur ON ur.user_id=u.id
JOIN dbo.[role] r ON r.id=ur.role_id
WHERE u.id=@UserId
ORDER BY r.role_code;
GO
