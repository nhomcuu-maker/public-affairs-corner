-- GOC DAN SINH - OPTIONAL STAFF ROLE GRANT
-- Run ONLY when another real registered account needs editor / reviewer / publisher role.
-- This script DOES NOT create tables, publish content, or change the draft passport.
-- Require an explicit email and confirmation string. Backup DB before role changes.
USE [GocDanSinh];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @Email NVARCHAR(254) = N'';                    -- THAY BANG EMAIL THUC
DECLARE @RoleCode NVARCHAR(30) = N'';                  -- editor / reviewer / publisher
DECLARE @XacNhan NVARCHAR(32) = N'CHUA_XAC_NHAN';      -- doi thanh CAP_QUYEN_NHAN_SU

IF @Email=N'' OR @RoleCode NOT IN (N'editor',N'reviewer',N'publisher')
   OR @XacNhan<>N'CAP_QUYEN_NHAN_SU'
  THROW 58601,N'Can dien email, vai tro editor/reviewer/publisher va xac nhan. Chua thay doi gi.',1;
IF @Email LIKE N'%@example.invalid'
  THROW 58602,N'Khong duoc cap quyen cho tai khoan demo.',1;
IF NOT EXISTS (SELECT 1 FROM dbo.app_user AS u
               JOIN dbo.auth_credential AS c ON c.user_id=u.id
               WHERE u.email=@Email AND u.account_status=N'active')
  THROW 58603,N'Email phai la tai khoan da dang ky mat khau va dang hoat dong.',1;
IF NOT EXISTS (SELECT 1 FROM dbo.[role] WHERE role_code=@RoleCode)
  THROW 58604,N'Vai tro khong ton tai trong CSDL.',1;

BEGIN TRY
  BEGIN TRAN;
  INSERT INTO dbo.user_role(user_id,role_id,granted_at)
  SELECT u.id,r.id,SYSUTCDATETIME()
  FROM dbo.app_user u CROSS JOIN dbo.[role] r
  WHERE u.email=@Email AND u.account_status=N'active' AND r.role_code=@RoleCode
    AND NOT EXISTS (SELECT 1 FROM dbo.user_role ur WITH(UPDLOCK,HOLDLOCK)
                    WHERE ur.user_id=u.id AND ur.role_id=r.id);
  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRAN;
  THROW;
END CATCH;
SELECT u.id AS UserID, u.display_name AS TenNguoiDung, u.email, r.role_code AS RoleCode
FROM dbo.app_user u
JOIN dbo.user_role ur ON ur.user_id=u.id
JOIN dbo.[role] r ON r.id=ur.role_id
WHERE u.email=@Email AND r.role_code=@RoleCode;
GO
