/* GOC DAN SINH - OFFICIAL PROVINCE CATALOG FROM QD 19/2025/QD-TTg.
* SAFE DEFAULT @Apply=0: inserts are ROLLED BACK. DO NOT run CREATE DATABASE.
* No procedure office/contact data is invented. No edit to content/evidence/permissions.
* Backup GocDanSinh before considering @Apply=1.
*/
USE [GocDanSinh];
GO
SET XACT_ABORT ON;
SET NOCOUNT ON;
DECLARE @Apply BIT = 0;
IF DB_NAME() <> N'GocDanSinh' THROW 59601, N'Sai database', 1;
IF OBJECT_ID(N'dbo.admin_unit',N'U') IS NULL THROW 59602, N'Thieu bang dbo.admin_unit', 1;
DECLARE @Catalog TABLE(code NVARCHAR(2) PRIMARY KEY, name NVARCHAR(180) NOT NULL);
INSERT INTO @Catalog(code,name) VALUES
  (N'01',N'Thành phố Hà Nội'),
  (N'04',N'Tỉnh Cao Bằng'),
  (N'08',N'Tỉnh Tuyên Quang'),
  (N'11',N'Tỉnh Điện Biên'),
  (N'12',N'Tỉnh Lai Châu'),
  (N'14',N'Tỉnh Sơn La'),
  (N'15',N'Tỉnh Lào Cai'),
  (N'19',N'Tỉnh Thái Nguyên'),
  (N'20',N'Tỉnh Lạng Sơn'),
  (N'22',N'Tỉnh Quảng Ninh'),
  (N'24',N'Tỉnh Bắc Ninh'),
  (N'25',N'Tỉnh Phú Thọ'),
  (N'31',N'Thành phố Hải Phòng'),
  (N'33',N'Tỉnh Hưng Yên'),
  (N'37',N'Tỉnh Ninh Bình'),
  (N'38',N'Tỉnh Thanh Hóa'),
  (N'40',N'Tỉnh Nghệ An'),
  (N'42',N'Tỉnh Hà Tĩnh'),
  (N'44',N'Tỉnh Quảng Trị'),
  (N'46',N'Thành phố Huế'),
  (N'48',N'Thành phố Đà Nẵng'),
  (N'51',N'Tỉnh Quảng Ngãi'),
  (N'52',N'Tỉnh Gia Lai'),
  (N'56',N'Tỉnh Khánh Hòa'),
  (N'66',N'Tỉnh Đắk Lắk'),
  (N'68',N'Tỉnh Lâm Đồng'),
  (N'75',N'Tỉnh Đồng Nai'),
  (N'79',N'Thành phố Hồ Chí Minh'),
  (N'80',N'Tỉnh Tây Ninh'),
  (N'82',N'Tỉnh Đồng Tháp'),
  (N'86',N'Tỉnh Vĩnh Long'),
  (N'91',N'Tỉnh An Giang'),
  (N'92',N'Thành phố Cần Thơ'),
  (N'96',N'Tỉnh Cà Mau');
IF (SELECT COUNT(*) FROM @Catalog) <> 34 THROW 59603, N'Danh muc khong du 34 dia phuong', 1;
IF EXISTS (
 SELECT 1 FROM dbo.admin_unit a JOIN @Catalog c ON c.code=a.official_code
 WHERE a.valid_to IS NULL AND (a.name<>c.name OR a.level<>N'province')
) THROW 59604, N'Ma tinh dang dung co ten/cap khac; can doi chieu thu cong', 1;
IF EXISTS (
 SELECT 1 FROM dbo.admin_unit a JOIN @Catalog c ON c.code=a.official_code
 WHERE a.valid_to IS NULL GROUP BY a.official_code HAVING COUNT(*)>1
) THROW 59605, N'Ma tinh bi trung o trang thai dang hieu luc', 1;
BEGIN TRY
  BEGIN TRAN;
  INSERT dbo.admin_unit(official_code,name,level,parent_id,valid_from,valid_to)
  SELECT c.code,c.name,N'province',NULL,CONVERT(date,'2025-07-01'),NULL
  FROM @Catalog c
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.admin_unit a WITH (UPDLOCK,HOLDLOCK)
    WHERE a.official_code=c.code AND a.level=N'province' AND a.valid_to IS NULL
  );
  DECLARE @Inserted INT=@@ROWCOUNT;
  SELECT @Apply AS ApplyMode, @Inserted AS NewProvinces,
    (SELECT COUNT(*) FROM @Catalog) AS OfficialCatalogSize,
    (SELECT COUNT(DISTINCT a.official_code)
      FROM dbo.admin_unit a JOIN @Catalog c ON c.code=a.official_code
      WHERE a.level=N'province' AND a.valid_to IS NULL) AS AvailableProvinces;
  SELECT c.code,c.name,CASE WHEN a.id IS NULL THEN N'MISSING' ELSE N'PRESENT' END AS db_state
  FROM @Catalog c LEFT JOIN dbo.admin_unit a ON a.official_code=c.code
    AND a.level=N'province' AND a.valid_to IS NULL ORDER BY c.code;
  IF @Apply=1 BEGIN COMMIT TRAN; PRINT N'DA GHI DANH MUC TINH THANH (KHONG DOI CAC BANG KHAC)'; END
  ELSE BEGIN ROLLBACK TRAN; PRINT N'CHI XEM TRUOC: ROLLBACK, DATABASE KHONG DOI'; END
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK TRAN;
 THROW;
END CATCH;
