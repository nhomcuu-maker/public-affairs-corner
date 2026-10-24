/*
GOC DAN SINH | CAP NHAT CAC TRUONG CO CAU TRUC CUA THU TUC TCTN (2026)
Based on Quyết định 107/QĐ-BNV (22/01/2026), pages 19-23 of the
user-supplied PDF, and Điều 38 Luật Việc làm 74/2025/QH15.

SAFE DEFAULT: @Apply = 0 means PREVIEW ONLY: all changes ROLLBACK.
ONLY after backing up DB and reviewing preview, switch @Apply = 1.
Never modifies knowledge_version editorial_status, source_verification,
source_snapshot, account records, or legal publication status.
Does not verify the public service procedure ID 1.014748. Keeps it unchanged.
Does not insert receiving offices without independent verification.
*/
USE [GocDanSinh];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Apply BIT = 0;  -- 0: xem truoc va ROLLBACK; 1: ghi sau khi da sao luu
DECLARE @BusinessCode NVARCHAR(100) = N'GDS-MVP-ADMIN-TCTN';
DECLARE @V BIGINT;
DECLARE @Status NVARCHAR(24);

IF DB_NAME() <> N'GocDanSinh'
    THROW 59200, N'Khong dung database GocDanSinh. Dung lai.', 1;

IF OBJECT_ID(N'dbo.procedure_detail', N'U') IS NULL OR
   OBJECT_ID(N'dbo.procedure_step', N'U') IS NULL OR
   OBJECT_ID(N'dbo.procedure_requirement', N'U') IS NULL OR
   OBJECT_ID(N'dbo.document_type', N'U') IS NULL OR
   OBJECT_ID(N'dbo.procedure_fee', N'U') IS NULL
    THROW 59201, N'Thieu bang can thiet. Khong ghi du lieu.', 1;

SELECT @V = v.id, @Status = v.editorial_status
FROM dbo.knowledge_item i
INNER JOIN dbo.knowledge_version v ON v.item_id = i.id
WHERE i.business_code = @BusinessCode AND v.version_no = 1;

IF @V IS NULL OR @Status <> N'draft'
    THROW 59202, N'Khong tim thay phien ban 1 dang draft. Khong thay doi gi.', 1;

IF (SELECT COUNT(*) FROM dbo.knowledge_version WHERE item_id =
    (SELECT id FROM dbo.knowledge_item WHERE business_code = @BusinessCode)) <> 1
    THROW 59203, N'Da co nhieu phien ban; can doi chieu thu cong.', 1;

IF (SELECT COUNT(*) FROM dbo.procedure_detail WHERE version_id = @V) <> 1 OR
   (SELECT COUNT(*) FROM dbo.procedure_step WHERE version_id = @V) <> 3 OR
   (SELECT COUNT(*) FROM dbo.procedure_requirement WHERE version_id = @V) <> 3
    THROW 59204, N'Cau truc da thay doi so voi ban MVP. Dung lai va doi chieu.', 1;

IF EXISTS (SELECT 1 FROM dbo.procedure_requirement pr
           JOIN dbo.document_type dt ON dt.id = pr.document_type_id
           WHERE pr.version_id = @V AND dt.code NOT IN
           (N'GDS-MVP-TCTN-DON', N'GDS-MVP-TCTN-CHAMDUT', N'GDS-MVP-TCTN-BHTN'))
    THROW 59205, N'Danh muc giay to khong khop ban MVP. Dung lai.', 1;

IF EXISTS (SELECT 1 FROM dbo.procedure_requirement pr
           JOIN dbo.procedure_requirement otherPr
             ON otherPr.document_type_id = pr.document_type_id AND otherPr.version_id <> @V
           WHERE pr.version_id = @V)
    THROW 59206, N'Loai giay to dang duoc thu tuc khac dung chung. Dung lai.', 1;

IF EXISTS (SELECT 1 FROM dbo.procedure_fee WHERE version_id = @V AND
           (fee_kind <> N'no_fee' OR amount <> 0 OR currency_code <> N'VND'))
    THROW 59207, N'Da co muc phi khac; can xac minh truoc khi sua.', 1;

BEGIN TRY
    BEGIN TRAN;

    -- Khoa theo phien ban va tai kiem tra trang thai trong transaction.
    DECLARE @Current NVARCHAR(24);
    SELECT @Current = editorial_status
    FROM dbo.knowledge_version WITH (UPDLOCK, HOLDLOCK) WHERE id = @V;
    IF @Current <> N'draft'
        THROW 59208, N'Ban ghi khong con draft. Khong thay doi gi.', 1;

    UPDATE dbo.procedure_detail
    SET eligibility_note = N'Người lao động phải đáp ứng Điều 38 Luật Việc làm 74/2025/QH15: chấm dứt hợp đồng/việc làm hợp pháp, không thuộc trường hợp loại trừ; đóng BHTN đủ 12 tháng trong 24 tháng trước khi chấm dứt (riêng hợp đồng từ đủ 01 đến dưới 12 tháng: đủ 12 tháng trong 36 tháng); nộp đủ hồ sơ trong 03 tháng; đáp ứng yêu cầu trong 10 ngày làm việc sau khi nộp đủ hồ sơ, không thuộc trường hợp loại trừ theo luật.',
        result_description = N'Quyết định về việc hưởng trợ cấp thất nghiệp, hoặc thông báo bằng văn bản nêu lý do không được hưởng. Một số trường hợp có quyết định hủy hưởng hoặc bảo lưu thời gian đóng theo quy định.',
        processing_time_text = N'Nộp trong 03 tháng (theo mốc áp dụng). Thời hạn giải quyết: 15 ngày làm việc kể từ ngày nhận đủ hồ sơ. Việc chi trả thực hiện theo mốc 05 ngày làm việc quy định trong Quyết định 107/QĐ-BNV.'
    WHERE version_id = @V;

    UPDATE dbo.procedure_step
    SET step_title = CASE step_no
        WHEN 1 THEN N'Chuẩn bị và nộp hồ sơ'
        WHEN 2 THEN N'Tiếp nhận và giải quyết'
        WHEN 3 THEN N'Nhận quyết định và theo dõi chi trả'
        END,
        instruction = CASE step_no
        WHEN 1 THEN N'Trong thời hạn 03 tháng kể từ mốc luật định, nộp 01 bộ hồ sơ cho tổ chức dịch vụ việc làm công tại địa phương nơi có nhu cầu nhận trợ cấp. Có thể nộp trực tiếp hoặc trực tuyến; việc gửi bưu chính/ủy quyền chỉ thực hiện theo các điều kiện tương ứng tại Quyết định 107/QĐ-BNV.'
        WHEN 2 THEN N'Tổ chức dịch vụ việc làm công tiếp nhận, kiểm tra, hẹn trả kết quả và xem xét trình Giám đốc Sở Nội vụ quyết định trong 15 ngày làm việc kể từ ngày nhận đủ hồ sơ. Khi hồ sơ thiếu thông tin, cơ quan yêu cầu bổ sung. Nếu không được hưởng phải thông báo bằng văn bản, nêu rõ lý do.'
        WHEN 3 THEN N'Nhận quyết định theo lịch hẹn. Cơ quan BHXH thực hiện chi trả trong 05 ngày làm việc kể từ mốc được quy định đối với kỳ đầu hoặc các kỳ tiếp theo. Trong thời gian hưởng, người lao động thực hiện thông báo tìm kiếm việc làm hằng tháng. Có quy định riêng nếu không đến nhận quyết định hoặc không nhận trợ cấp.'
        END
    WHERE version_id = @V AND step_no IN (1,2,3);

    UPDATE dt
    SET name = CASE dt.code
        WHEN N'GDS-MVP-TCTN-DON' THEN N'Đề nghị hưởng trợ cấp thất nghiệp (Mẫu số 10)'
        WHEN N'GDS-MVP-TCTN-CHAMDUT' THEN N'Giấy tờ xác nhận chấm dứt hợp đồng hoặc việc làm'
        WHEN N'GDS-MVP-TCTN-BHTN' THEN N'Sổ bảo hiểm xã hội'
        END
    FROM dbo.document_type dt
    JOIN dbo.procedure_requirement pr ON pr.document_type_id = dt.id
    WHERE pr.version_id = @V AND dt.code IN
      (N'GDS-MVP-TCTN-DON',N'GDS-MVP-TCTN-CHAMDUT',N'GDS-MVP-TCTN-BHTN');

    UPDATE pr
    SET is_required = 1,
        quantity = 1,
        condition_note = CASE dt.code
        WHEN N'GDS-MVP-TCTN-DON' THEN N'Mẫu số 10 tại Phụ lục Nghị định 374/2025/NĐ-CP; chưa gắn file biểu mẫu đã xác minh trong hệ thống.'
        WHEN N'GDS-MVP-TCTN-CHAMDUT' THEN N'Một trong các giấy tờ xác nhận chấm dứt hợp đồng/việc làm hợp lệ, theo hình thức bản chính, bản sao chứng thực, bản để đối chiếu hoặc bản điện tử phù hợp; có ngoại lệ được quy định.'
        WHEN N'GDS-MVP-TCTN-BHTN' THEN N'Sổ bảo hiểm xã hội; đối chiếu thành phần hồ sơ tại Quyết định 107/QĐ-BNV.'
        END
    FROM dbo.procedure_requirement pr
    JOIN dbo.document_type dt ON dt.id = pr.document_type_id
    WHERE pr.version_id = @V AND dt.code IN
      (N'GDS-MVP-TCTN-DON',N'GDS-MVP-TCTN-CHAMDUT',N'GDS-MVP-TCTN-BHTN');

    IF NOT EXISTS (SELECT 1 FROM dbo.procedure_fee WHERE version_id = @V)
        INSERT dbo.procedure_fee(version_id,fee_kind,amount,currency_code,pricing_rule)
        VALUES (@V,N'no_fee',0,N'VND',N'Không thu phí, lệ phí theo mục 4.i của Phụ lục Quyết định 107/QĐ-BNV (22/01/2026).');

    SELECT CASE WHEN @Apply = 1 THEN N'SE_GHI' ELSE N'CHI_XEM_TRUOC_SE_ROLLBACK' END AS CheDo,
           @V AS VersionId, @Current AS TrangThai;
    SELECT * FROM dbo.procedure_detail WHERE version_id = @V;
    SELECT step_no,step_title,instruction FROM dbo.procedure_step WHERE version_id = @V ORDER BY step_no;
    SELECT pr.requirement_no,dt.name,pr.is_required,pr.quantity,pr.condition_note
      FROM dbo.procedure_requirement pr JOIN dbo.document_type dt ON dt.id=pr.document_type_id
      WHERE pr.version_id=@V ORDER BY pr.requirement_no;
    SELECT fee_kind,amount,currency_code,pricing_rule FROM dbo.procedure_fee WHERE version_id=@V;
    SELECT (SELECT COUNT(*) FROM dbo.procedure_office WHERE version_id=@V) AS OfficesLinked,
           (SELECT COUNT(*) FROM dbo.knowledge_version_source WHERE version_id=@V) AS EvidenceLinked;

    IF @Apply = 1
    BEGIN
        COMMIT TRAN;
        PRINT N'DA GHI VAO DATABASE: chi du lieu thu tuc co cau truc cua ban draft duoc cap nhat.';
    END
    ELSE
    BEGIN
        ROLLBACK TRAN;
        PRINT N'CHI XEM TRUOC: toan bo thay doi da ROLLBACK, database giu nguyen.';
    END;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
