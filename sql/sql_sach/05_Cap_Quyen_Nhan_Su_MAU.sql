/*
  GOC DAN SINH | FILE 05 (BAN SACH): CAP QUYEN CHO TAI KHOAN DA DANG KY  (SQL Server 2022)
  Gop 2 file cu: 04_Phan_Quyen_Quan_Tri.sql (admin) + 05_GocDanSinh_TuyChon_CapVaiTroNhanSu.sql
  (editor / reviewer / publisher). Mot file, doi 2 bien, chay bao nhieu lan cung duoc.

  CACH DUNG:
    1) Tai khoan phai da dang ky tren web (co mat khau) va dang 'active'.
    2) Sua @Email va @RoleCode ben duoi, doi @XacNhan thanh CAP_QUYEN.
    3) Sao luu DB roi bam F5. Moi lan chi cap MOT vai tro cho MOT tai khoan.
  Khong tao tai khoan, khong tao mat khau, khong dong vao noi dung/chung cu/cong bo.
  LUU Y QUY TRINH: nguoi soan, nguoi duyet va nguoi cong bo phai la 3 TAI KHOAN KHAC NHAU
  (thu tuc duyet/cong bo cua he thong chan tu duyet chinh minh).
*/
USE [GocDanSinh];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Email    NVARCHAR(254) = N'';               -- <-- THAY bang email that da dang ky
DECLARE @RoleCode NVARCHAR(30)  = N'';               -- <-- admin | editor | reviewer | publisher
DECLARE @XacNhan  NVARCHAR(30)  = N'CHUA_XAC_NHAN';  -- <-- doi thanh CAP_QUYEN

SET @Email = LOWER(LTRIM(RTRIM(@Email)));
IF DB_NAME() <> N'GocDanSinh' THROW 58201, N'Sai database.', 1;
IF @Email = N'' OR @RoleCode NOT IN (N'admin',N'editor',N'reviewer',N'publisher') OR @XacNhan <> N'CAP_QUYEN'
    THROW 58202, N'Can dien @Email, @RoleCode (admin/editor/reviewer/publisher) va @XacNhan = CAP_QUYEN. Chua thay doi gi.', 1;
IF @Email LIKE N'%@example.invalid'
    THROW 58203, N'Khong cap quyen cho tai khoan demo.', 1;
IF OBJECT_ID(N'dbo.auth_credential', N'U') IS NULL
    THROW 58204, N'Chua co bang xac thuc. Chay file 02 truoc.', 1;

DECLARE @UserId BIGINT, @RoleId BIGINT;
SELECT @UserId = u.id
FROM dbo.app_user u JOIN dbo.auth_credential c ON c.user_id = u.id
WHERE u.email = @Email AND u.account_status = N'active';
SELECT @RoleId = id FROM dbo.[role] WHERE role_code = @RoleCode;

IF @UserId IS NULL THROW 58205, N'Khong thay tai khoan ACTIVE da dat mat khau voi email nay. Dung lai.', 1;
IF @RoleId IS NULL THROW 58206, N'Vai tro chua ton tai. Chay file 04 truoc.', 1;

BEGIN TRY
    BEGIN TRAN;
    IF NOT EXISTS (SELECT 1 FROM dbo.user_role WITH (UPDLOCK, HOLDLOCK) WHERE user_id = @UserId AND role_id = @RoleId)
        INSERT dbo.user_role(user_id, role_id, granted_at) VALUES (@UserId, @RoleId, SYSUTCDATETIME());
    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;

SELECT u.id AS UserID, u.display_name AS DisplayName, u.email, r.role_code AS RoleCode, ur.granted_at AS GrantedAt
FROM dbo.app_user u
JOIN dbo.user_role ur ON ur.user_id = u.id
JOIN dbo.[role] r ON r.id = ur.role_id
WHERE u.id = @UserId
ORDER BY r.role_code;
GO
