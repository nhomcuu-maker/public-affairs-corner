/*
  GOC DAN SINH | FILE 04 (BAN SACH): SEED DANH MUC + VAI TRO BIEN TAP  (SQL Server 2022)
  CHAY LAI AN TOAN: chi them cai con thieu, khong sua/xoa ban ghi co san.

  PHAN A - luon ap dung (idempotent):
    * Vai tro 'editor' (ban cu chi tao no ngam trong khoi seed demo, nen DB sach thieu
      -> script tao tai khoan nhan su se bao loi 59414).
    * 9 danh muc goc da dung o ban cu + 1 danh muc moi cho ADMIN:
        LAO_DONG_BHXH "Lao dong, viec lam va bao hiem" (dung cho thu tuc tro cap that nghiep).
  PHAN B - CHI XEM TRUOC (mac dinh @ApplyMove = 0 -> ROLLBACK):
    * Chuyen bai thu tuc tro cap that nghiep (GDS-MVP-ADMIN-TCTN) tu danh muc chinh
      "Dich vu cong truc tuyen" sang "Lao dong, viec lam va bao hiem".
      Ly do: "Dich vu cong truc tuyen" la KENH nop ho so, khong phai CHU DE; bai tro cap
      that nghiep thuoc chu de lao dong - bao hiem. Danh muc cu van giu lam danh muc phu.
      Dat @ApplyMove = 1 sau khi da sao luu.
*/
USE [GocDanSinh];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME() <> N'GocDanSinh' THROW 59820, N'Sai database.', 1;
IF (SELECT COUNT(*) FROM dbo.[domain] WHERE code IN (N'LEGAL',N'ADMIN',N'SCAM')) <> 3
    THROW 59821, N'Thieu 3 module. Chay file 01 truoc.', 1;
GO

/* ===== PHAN A: vai tro + danh muc ===== */
IF NOT EXISTS (SELECT 1 FROM dbo.[role] WHERE role_code = N'editor')
    INSERT dbo.[role](role_code, role_name) VALUES (N'editor', N'Biên tập viên nội dung');
GO
DECLARE @Cats TABLE (domain_code NVARCHAR(24), code NVARCHAR(64), name NVARCHAR(180));
INSERT @Cats VALUES
 (N'LEGAL', N'LAO_DONG',         N'Lao động và việc làm'),
 (N'LEGAL', N'DAN_SU',           N'Dân sự và quyền lợi'),
 (N'LEGAL', N'DAT_DAI',          N'Đất đai'),
 (N'ADMIN', N'HO_CHIEU_HO_TICH', N'Hộ chiếu và hộ tịch'),
 (N'ADMIN', N'CU_TRU_GIAY_TO',   N'Cư trú và giấy tờ tùy thân'),
 (N'ADMIN', N'LAO_DONG_BHXH',    N'Lao động, việc làm và bảo hiểm'),
 (N'ADMIN', N'DICH_VU_CONG',     N'Dịch vụ công trực tuyến'),
 (N'SCAM',  N'GIA_DANH',         N'Giả danh cơ quan, tổ chức'),
 (N'SCAM',  N'LINK_GIA',         N'Liên kết và trang web giả mạo'),
 (N'SCAM',  N'TUYEN_DUNG',       N'Lừa đảo tuyển dụng, đầu tư');
INSERT dbo.category(domain_id, parent_id, code, name, is_active)
SELECT d.id, NULL, c.code, c.name, 1
FROM @Cats AS c
JOIN dbo.[domain] AS d ON d.code = c.domain_code
WHERE NOT EXISTS (SELECT 1 FROM dbo.category x WHERE x.domain_id = d.id AND x.code = c.code);
PRINT CONCAT(N'Phan A: da them ', @@ROWCOUNT, N' danh muc con thieu.');
GO

/* ===== PHAN B: chuyen danh muc chinh cua bai TCTN (mac dinh chi xem truoc) ===== */
DECLARE @ApplyMove BIT = 0;   -- 0 = xem truoc va ROLLBACK; 1 = ghi
DECLARE @ItemId BIGINT = (SELECT id FROM dbo.knowledge_item WHERE business_code = N'GDS-MVP-ADMIN-TCTN' AND deleted_at IS NULL);
DECLARE @AdminDomain BIGINT = (SELECT id FROM dbo.[domain] WHERE code = N'ADMIN');
DECLARE @NewCat BIGINT = (SELECT id FROM dbo.category WHERE domain_id = @AdminDomain AND code = N'LAO_DONG_BHXH');
DECLARE @OldCat BIGINT = (SELECT id FROM dbo.category WHERE domain_id = @AdminDomain AND code = N'DICH_VU_CONG');

IF @ItemId IS NULL
BEGIN
    PRINT N'Phan B: khong co bai GDS-MVP-ADMIN-TCTN trong DB nay -> bo qua.';
END
ELSE IF @NewCat IS NULL OR @OldCat IS NULL
BEGIN
    THROW 59822, N'Thieu danh muc LAO_DONG_BHXH hoac DICH_VU_CONG.', 1;
END
ELSE IF EXISTS (SELECT 1 FROM dbo.item_category WHERE item_id = @ItemId AND category_id = @NewCat AND is_primary = 1)
BEGIN
    PRINT N'Phan B: bai TCTN da o danh muc chinh LAO_DONG_BHXH -> khong lam gi.';
END
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRAN;
        SELECT N'TRUOC' AS giai_doan, c.code AS category_code, ic.is_primary
        FROM dbo.item_category ic JOIN dbo.category c ON c.id = ic.category_id WHERE ic.item_id = @ItemId;

        UPDATE dbo.item_category SET is_primary = 0 WHERE item_id = @ItemId AND is_primary = 1;
        IF EXISTS (SELECT 1 FROM dbo.item_category WHERE item_id = @ItemId AND category_id = @NewCat)
            UPDATE dbo.item_category SET is_primary = 1 WHERE item_id = @ItemId AND category_id = @NewCat;
        ELSE
            INSERT dbo.item_category(item_id, category_id, domain_id, is_primary) VALUES (@ItemId, @NewCat, @AdminDomain, 1);

        SELECT N'SAU (trong giao dich)' AS giai_doan, c.code AS category_code, ic.is_primary
        FROM dbo.item_category ic JOIN dbo.category c ON c.id = ic.category_id WHERE ic.item_id = @ItemId;

        IF (SELECT COUNT(*) FROM dbo.item_category WHERE item_id = @ItemId AND is_primary = 1) <> 1
            THROW 59823, N'Sau khi doi phai co dung 1 danh muc chinh.', 1;

        IF @ApplyMove = 1 BEGIN COMMIT TRAN; PRINT N'DA GHI: doi danh muc chinh cua bai TCTN.'; END
        ELSE BEGIN ROLLBACK TRAN; PRINT N'CHI XEM TRUOC: da ROLLBACK. Dat @ApplyMove = 1 de ghi.'; END
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH;
END;
GO
SELECT d.code AS module, c.code AS category_code, c.name, c.is_active
FROM dbo.category c JOIN dbo.[domain] d ON d.id = c.domain_id
ORDER BY d.code, c.code;
GO
