/*
GOC DAN SINH - STEP 9 - TWO MVP SCENARIOS (SQL SERVER 2022)
1) Unemployment benefit: LEGAL <-> ADMIN.
2) Fake social insurance agency payment demand: SCAM <-> LEGAL / ADMIN.
Only DRAFT data, with OFFICIAL SOURCE CANDIDATES awaiting human verification.
NO snapshot, no fabricated file hash, no published status, no old records changed.
Run once in SSMS after backing up GocDanSinh. Re-running is idempotent.
*/
USE [GocDanSinh];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'GocDanSinh' THROW 58900,N'Sai database. Phai la GocDanSinh.',1;
IF OBJECT_ID(N'dbo.auth_credential',N'U') IS NULL OR OBJECT_ID(N'dbo.knowledge_version',N'U') IS NULL
 THROW 58901,N'Thieu schema Buoc 8. Dung, khong tu tao lai database.',1;

DECLARE @Author BIGINT=(
 SELECT TOP(1) u.id FROM dbo.app_user u
 JOIN dbo.auth_credential ac ON ac.user_id=u.id
 JOIN dbo.user_role ur ON ur.user_id=u.id
 JOIN dbo.[role] r ON r.id=ur.role_id AND r.role_code=N'admin'
 WHERE u.account_status=N'active' ORDER BY u.id
);
IF @Author IS NULL THROW 58902,N'Chua co tai khoan admin that, khong nap du lieu.',1;
IF (SELECT COUNT(*) FROM dbo.[domain] WHERE code IN (N'LEGAL',N'ADMIN',N'SCAM'))<>3
 THROW 58903,N'Thieu domain, khong nap.',1;
IF NOT EXISTS (SELECT 1 FROM dbo.category c JOIN dbo.domain d ON d.id=c.domain_id WHERE d.code=N'LEGAL' AND c.code=N'LAO_DONG' AND c.is_active=1)
 OR NOT EXISTS (SELECT 1 FROM dbo.category c JOIN dbo.domain d ON d.id=c.domain_id WHERE d.code=N'ADMIN' AND c.code=N'DICH_VU_CONG' AND c.is_active=1)
 OR NOT EXISTS (SELECT 1 FROM dbo.category c JOIN dbo.domain d ON d.id=c.domain_id WHERE d.code=N'SCAM' AND c.code=N'GIA_DANH' AND c.is_active=1)
 THROW 58904,N'Thieu danh muc MVP, khong nap.',1;

DECLARE @Codes TABLE (code NVARCHAR(100) PRIMARY KEY,domain NVARCHAR(24),kind NVARCHAR(20),category NVARCHAR(64),title NVARCHAR(300),summary NVARCHAR(1600),body NVARCHAR(MAX));
INSERT @Codes VALUES
(N'GDS-MVP-LEGAL-BHTN',N'LEGAL',N'benefit',N'LAO_DONG',
 N'Quyền lợi bảo hiểm thất nghiệp: điều kiện cần kiểm tra',
 N'Bản nháp MVP: hướng dẫn xác định thông tin cần kiểm tra, không tự kết luận cá nhân đủ điều kiện.',
 N'# Bảo hiểm thất nghiệp'+NCHAR(10)+N'Nếu vừa nghỉ việc, cần xác định lịch sử tham gia bảo hiểm thất nghiệp, hình thức chấm dứt việc làm, tình trạng có việc làm và thời điểm nộp hồ sơ.'+NCHAR(10)+N'Cần đối chiếu Luật Việc làm 74/2025/QH15 (hiệu lực từ 01/01/2026) và văn bản hướng dẫn tại thời điểm giải quyết. Chưa được xác minh và công bố.'),
(N'GDS-MVP-ADMIN-TCTN',N'ADMIN',N'procedure',N'DICH_VU_CONG',
 N'Hưởng trợ cấp thất nghiệp (cấp tỉnh) – hướng dẫn chuẩn bị',
 N'Bản nháp MVP liên kết quyền lợi với thủ tục trên Cổng Dịch vụ công; phải kiểm chứng thông tin thực hiện.',
 N'# Hưởng trợ cấp thất nghiệp'+NCHAR(10)+N'Kiểm tra trước: có thuộc đối tượng, tình trạng tham gia BHTN, thời điểm chấm dứt hợp đồng, đang có việc làm hay không.'+NCHAR(10)+N'Chuẩn bị hồ sơ theo danh mục chính thức, nộp tại tổ chức dịch vụ việc làm công theo quy trình được cơ quan quản lý công bố; kiểm tra kênh nộp trực tuyến và quy định địa phương.'+NCHAR(10)+N'Mã thủ tục tham chiếu 1.014748. Chưa xác minh đầy đủ các điều kiện, hồ sơ và thời hạn – KHÔNG CÔNG BỐ.'),
(N'GDS-MVP-SCAM-MAODANH-BHXH',N'SCAM',N'scam',N'GIA_DANH',
 N'Cảnh báo cuộc gọi giả danh bảo hiểm xã hội đòi chuyển tiền',
 N'Bản nháp MVP: nhận diện dấu hiệu đáng ngờ và ưu tiên hướng dẫn an toàn trước.',
 N'# Nghi vấn giả danh cơ quan BHXH'+NCHAR(10)+N'Khi người gọi tự xưng cán bộ bảo hiểm, thúc ép chuyển tiền hay cung cấp OTP, cần coi là dấu hiệu nguy cơ cao, chưa thể xác định danh tính chỉ bằng nội dung cuộc gọi.'+NCHAR(10)+N'Không chuyển tiền, không cung cấp OTP, không mở liên kết lạ. Xác minh bằng kênh công khai chính thức. Nếu đã chuyển tiền, liên hệ ngay ngân hàng và cơ quan có thẩm quyền để trình báo.'+NCHAR(10)+N'Bài nháp, không phải kết luận điều tra cá nhân cụ thể.');

DECLARE @Existing INT=(SELECT COUNT(*) FROM dbo.knowledge_item WHERE business_code IN (SELECT code FROM @Codes));
IF @Existing NOT IN (0,3) THROW 58905,N'Dang ton tai mot phan 3 ban ghi MVP. Dung de kiem tra thu cong, khong nhap de.',1;
IF @Existing=3 AND EXISTS (
 SELECT 1 FROM @Codes c JOIN dbo.knowledge_item i ON i.business_code=c.code
 JOIN dbo.knowledge_version v ON v.item_id=i.id WHERE v.editorial_status<>N'draft')
 THROW 58906,N'Mot ban ghi MVP da thay doi trang thai. Khong can thiep.',1;
IF @Existing=3 AND EXISTS (SELECT 1 FROM @Codes c JOIN dbo.knowledge_item i ON i.business_code=c.code JOIN dbo.domain d ON d.id=i.domain_id WHERE d.code<>c.domain OR i.kind<>c.kind)
 THROW 58908,N'Ma MVP hien co khong dung module/loai. Dung de kiem tra.',1;

BEGIN TRY
 BEGIN TRAN;
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
 IF @Existing=0
 BEGIN
  DECLARE @code NVARCHAR(100),@domain NVARCHAR(24),@kind NVARCHAR(20),@category NVARCHAR(64),
          @title NVARCHAR(300),@summary NVARCHAR(1600),@body NVARCHAR(MAX),@item BIGINT,@version BIGINT;
  DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT code,domain,kind,category,title,summary,body FROM @Codes;
  OPEN cur;
  FETCH NEXT FROM cur INTO @code,@domain,@kind,@category,@title,@summary,@body;
  WHILE @@FETCH_STATUS=0
  BEGIN
   INSERT dbo.knowledge_item(domain_id,kind,business_code,canonical_title,created_by,created_at,deleted_at)
   SELECT d.id,@kind,@code,@title,@Author,SYSUTCDATETIME(),NULL FROM dbo.domain d WHERE d.code=@domain;
   SET @item=CONVERT(BIGINT,SCOPE_IDENTITY());
   INSERT dbo.item_category(item_id,category_id,domain_id,is_primary)
   SELECT @item,c.id,c.domain_id,1 FROM dbo.category c JOIN dbo.domain d ON d.id=c.domain_id
   WHERE d.code=@domain AND c.code=@category;
   INSERT dbo.knowledge_version(item_id,version_no,title,summary,body_markdown,editorial_status,
           effective_from,content_sha256,created_by,created_at)
   VALUES(@item,1,@title,@summary,@body,N'draft',NULL,HASHBYTES('SHA2_256',CONVERT(VARBINARY(MAX),@body)),@Author,SYSUTCDATETIME());
   SET @version=CONVERT(BIGINT,SCOPE_IDENTITY());
   INSERT dbo.item_scope(version_id,scope_kind,admin_unit_id,scope_note)
   VALUES(@version,N'nationwide',NULL,N'MVP noi bo - thong tin phai duoc kiem chung truoc cong bo');
   FETCH NEXT FROM cur INTO @code,@domain,@kind,@category,@title,@summary,@body;
  END;
  CLOSE cur; DEALLOCATE cur;
  DECLARE @vLegal BIGINT=(SELECT v.id FROM dbo.knowledge_version v JOIN dbo.knowledge_item i ON i.id=v.item_id WHERE i.business_code=N'GDS-MVP-LEGAL-BHTN' AND v.version_no=1);
  DECLARE @vAdmin BIGINT=(SELECT v.id FROM dbo.knowledge_version v JOIN dbo.knowledge_item i ON i.id=v.item_id WHERE i.business_code=N'GDS-MVP-ADMIN-TCTN' AND v.version_no=1);
  DECLARE @vScam BIGINT=(SELECT v.id FROM dbo.knowledge_version v JOIN dbo.knowledge_item i ON i.id=v.item_id WHERE i.business_code=N'GDS-MVP-SCAM-MAODANH-BHXH' AND v.version_no=1);
  INSERT dbo.benefit_detail(version_id,beneficiary_group,entitlement_text,claim_guidance)
  VALUES(@vLegal,N'Người lao động muốn tìm hiểu quyền lợi BHTN sau khi nghỉ việc',
         N'Không thể xác nhận đủ điều kiện chỉ từ câu nói vừa nghỉ việc. Cần đối chiếu tình trạng tham gia bảo hiểm, điều kiện pháp lý và mốc thời gian liên quan theo quy định hiện hành.',
         N'Đối chiếu quy định -> tìm hồ sơ chính thức -> chọn nơi tiếp nhận -> kiểm tra kênh nộp, không sử dụng bản nháp này làm tư vấn chính thức.');
  INSERT dbo.benefit_condition(version_id,condition_no,condition_text,condition_type) VALUES
   (@vLegal,1,N'Thời gian và quá trình tham gia BHTN: cần dữ liệu đóng thực tế.',N'information_needed'),
   (@vLegal,2,N'Loại hợp đồng và lý do chấm dứt việc làm: cần kiểm tra điều kiện luật định.',N'information_needed'),
   (@vLegal,3,N'Tình trạng đang có việc làm và đang hưởng chế độ liên quan: cần làm rõ.',N'information_needed'),
   (@vLegal,4,N'Thời điểm nghỉ việc và thời điểm dự kiến nộp hồ sơ: cần kiểm tra hạn.',N'information_needed');
  INSERT dbo.procedure_detail(version_id,procedure_code,eligibility_note,result_description,processing_time_text)
  VALUES(@vAdmin,N'1.014748',N'Bản nháp tham chiếu thủ tục Hưởng trợ cấp thất nghiệp (Cấp tỉnh). Điều kiện chi tiết phải đối chiếu văn bản hiệu lực và trang thủ tục nguồn.',
    N'Quyết định giải quyết chế độ theo hồ sơ và kết quả xử lý thực tế của cơ quan có thẩm quyền.',
    N'Cần kiểm tra thời hạn nộp và giải quyết trên trang thủ tục chính thức phiên bản hiện hành.');
  INSERT dbo.procedure_step(version_id,step_no,step_title,instruction) VALUES
   (@vAdmin,1,N'Đối chiếu điều kiện',N'Kiểm tra quá trình tham gia BHTN, hoàn cảnh nghỉ việc và thời điểm nộp theo nguồn chính thức.'),
   (@vAdmin,2,N'Chuẩn bị và nộp hồ sơ',N'Đối chiếu thành phần hồ sơ và nơi tiếp nhận tại Cổng Dịch vụ công; chỉ nộp qua kênh hợp lệ.'),
   (@vAdmin,3,N'Theo dõi và nhận kết quả',N'Đối chiếu giấy hẹn/thông báo, bổ sung khi có yêu cầu hợp lệ và theo dõi kết quả từ cơ quan xử lý.');
  IF NOT EXISTS(SELECT 1 FROM dbo.document_type WHERE code=N'GDS-MVP-TCTN-DON')
   INSERT dbo.document_type(code,name) VALUES(N'GDS-MVP-TCTN-DON',N'Đơn đề nghị hưởng trợ cấp thất nghiệp (chờ kiểm tra mẫu)');
  IF NOT EXISTS(SELECT 1 FROM dbo.document_type WHERE code=N'GDS-MVP-TCTN-CHAMDUT')
   INSERT dbo.document_type(code,name) VALUES(N'GDS-MVP-TCTN-CHAMDUT',N'Giấy tờ chứng minh việc chấm dứt hợp đồng (chờ kiểm tra)');
  IF NOT EXISTS(SELECT 1 FROM dbo.document_type WHERE code=N'GDS-MVP-TCTN-BHTN')
   INSERT dbo.document_type(code,name) VALUES(N'GDS-MVP-TCTN-BHTN',N'Thông tin quá trình tham gia BHTN (chờ kiểm tra hình thức)');
  INSERT dbo.procedure_requirement(version_id,requirement_no,document_type_id,is_required,quantity,condition_note)
  SELECT @vAdmin,x.n,dt.id,0,1,N'Minh hoa nhom ho so. Bat buoc, mau va truong hop ap dung phai duoc kiem tra tren cong dich vu cong.'
  FROM (VALUES(1,N'GDS-MVP-TCTN-DON'),(2,N'GDS-MVP-TCTN-CHAMDUT'),(3,N'GDS-MVP-TCTN-BHTN')) x(n,c)
  JOIN dbo.document_type dt ON dt.code=x.c;
  INSERT dbo.scam_detail(version_id,severity,mechanism,warning_signs,immediate_actions,reporting_guidance)
  VALUES(@vScam,N'high',
  N'Kẻ xấu có thể mạo danh nhân viên BHXH, viện cớ cập nhật/giải quyết quyền lợi và thúc giục chuyển tiền hoặc cung cấp thông tin nhạy cảm.',
  N'Đòi chuyển tiền vào tài khoản lạ; đòi OTP, mật khẩu; gửi liên kết hoặc ứng dụng không rõ nguồn; gây áp lực thời gian.',
  N'KHÔNG chuyển tiền; KHÔNG cung cấp OTP hoặc mật khẩu. Ngắt liên lạc và xác minh qua cổng hoặc cơ quan BHXH chính thức. Nếu đã chuyển tiền: gọi ngay ngân hàng.',
  N'Lưu bằng chứng và trình báo cơ quan công an theo hướng dẫn chính thức; không gửi thông tin nhạy cảm trong chatbot.');
  INSERT dbo.scam_indicator(version_id,indicator_no,indicator_kind,description,evidence_snapshot_id) VALUES
   (@vScam,1,N'impersonation',N'Người gọi tự xưng cán bộ bảo hiểm nhưng không có kênh xác minh chính thức.',NULL),
   (@vScam,2,N'payment',N'Yêu cầu chuyển tiền để xử lý hồ sơ hoặc mở khóa quyền lợi.',NULL),
   (@vScam,3,N'otp',N'Yêu cầu mã OTP, mật khẩu hoặc thông tin bảo mật.',NULL),
   (@vScam,4,N'phishing',N'Gửi đường dẫn giả hoặc yêu cầu cài ứng dụng không rõ nguồn.',NULL);
 END;
 -- Source URLs are recorded as candidates. NO source_snapshot, no verification, no auto publish.
 DECLARE @Refs TABLE(url NVARCHAR(1200),title NVARCHAR(400),kind NVARCHAR(30),code NVARCHAR(100),role_note NVARCHAR(600));
 INSERT @Refs VALUES
 (N'https://congbao.chinhphu.vn/van-ban/luat-so-74-2025-qh15-45562.htm',N'Luật Việc làm 74/2025/QH15 - Công báo',N'official_legal',N'GDS-MVP-LEGAL-BHTN',N'Chỉ mới ghi URL chính thức; cần tải, kiểm tra văn bản và hiệu lực.'),
 (N'https://vpcp.dichvucong.gov.vn/p/home/dvc-chi-tiet-thu-tuc-hanh-chinh.html?ma_thu_tuc=1.014748',N'Hưởng trợ cấp thất nghiệp (Cấp tỉnh) - Cổng DVC',N'official_procedure',N'GDS-MVP-ADMIN-TCTN',N'Cần kiểm tra nội dung thủ tục, mẫu hồ sơ, thời hạn, hiệu lực.'),
 (N'https://baohiemxahoi.gov.vn/tintuc/Pages/hoat-dong-he-thong-bao-hiem-xa-hoi.aspx?CateID=52&ItemID=25391',N'BHXH TP HCM cảnh báo mạo danh viên chức',N'official_warning',N'GDS-MVP-SCAM-MAODANH-BHXH',N'Tham khảo dấu hiệu; nguồn chưa có snapshot và chưa được xác minh nội bộ.'),
 (N'https://baohiemxahoi.gov.vn/tintuc/Pages/hoat-dong-he-thong-bao-hiem-xa-hoi.aspx?CateID=52&itemID=24971',N'BHXH cảnh báo giả mạo chiếm đoạt tiền ngân hàng',N'official_warning',N'GDS-MVP-SCAM-MAODANH-BHXH',N'Tham khảo cảnh báo; nguồn chưa có snapshot và chưa được xác minh nội bộ.');
 DECLARE @url NVARCHAR(1200),@refTitle NVARCHAR(400),@refKind NVARCHAR(30),@refCode NVARCHAR(100),@refNote NVARCHAR(600),@sid BIGINT,@rid BIGINT;
 DECLARE ref_cur CURSOR LOCAL FAST_FORWARD FOR SELECT url,title,kind,code,role_note FROM @Refs;
 OPEN ref_cur;
 FETCH NEXT FROM ref_cur INTO @url,@refTitle,@refKind,@refCode,@refNote;
 WHILE @@FETCH_STATUS=0
 BEGIN
  SELECT TOP(1) @sid=id FROM dbo.[source] WHERE canonical_url=@url ORDER BY id;
  IF @sid IS NULL
  BEGIN
   INSERT dbo.[source](organization_id,source_kind,title,canonical_url,url_sha256,trust_tier,created_at,archived_at)
   VALUES(NULL,@refKind,@refTitle,@url,HASHBYTES('SHA2_256',CONVERT(VARBINARY(MAX),@url)),1,SYSUTCDATETIME(),NULL);
   SET @sid=CONVERT(BIGINT,SCOPE_IDENTITY());
  END;
  SET @rid=(SELECT id FROM dbo.knowledge_item WHERE business_code=@refCode);
  IF NOT EXISTS(SELECT 1 FROM dbo.knowledge_source_candidate WHERE item_id=@rid AND source_id=@sid)
    INSERT dbo.knowledge_source_candidate(item_id,source_id,review_status,review_note)
    VALUES(@rid,@sid,N'pending_review',@refNote);
  SET @sid=NULL;
  FETCH NEXT FROM ref_cur INTO @url,@refTitle,@refKind,@refCode,@refNote;
 END;
 CLOSE ref_cur;DEALLOCATE ref_cur;
 -- Law metadata: official publication date is known but human-content review is pending.
 DECLARE @qh BIGINT=(SELECT id FROM dbo.organization WHERE organization_code=N'QUOC_HOI');
 DECLARE @doc BIGINT=(SELECT TOP(1) id FROM dbo.legal_document WHERE issuing_organization_id=@qh AND document_number=N'74/2025/QH15' ORDER BY id);
 IF @qh IS NOT NULL AND @doc IS NULL
 BEGIN
  INSERT dbo.legal_document(issuing_organization_id,document_number,title,document_kind,issued_on,effective_from,official_status_note)
  VALUES(@qh,N'74/2025/QH15',N'Luật Việc làm 2025',N'luat','20250616','20260101',N'Metadata nguồn Công báo, CHƯA đối chiếu đầy đủ điều khoản và văn bản hướng dẫn.');
  SET @doc=CONVERT(BIGINT,SCOPE_IDENTITY());
 END;
 IF @doc IS NOT NULL
 BEGIN
  INSERT dbo.knowledge_basis_document(knowledge_version_id,legal_document_id,basis_role)
  SELECT kv.id,@doc,N'legal_basis_pending' FROM dbo.knowledge_item ki
  JOIN dbo.knowledge_version kv ON kv.item_id=ki.id AND kv.version_no=1
  WHERE ki.business_code IN (N'GDS-MVP-LEGAL-BHTN',N'GDS-MVP-ADMIN-TCTN')
   AND NOT EXISTS(SELECT 1 FROM dbo.knowledge_basis_document bd WHERE bd.knowledge_version_id=kv.id AND bd.legal_document_id=@doc);
 END;
 DECLARE @Links TABLE(from_code NVARCHAR(100),to_code NVARCHAR(100),relation_type NVARCHAR(30),note NVARCHAR(500));
 INSERT @Links VALUES
 (N'GDS-MVP-LEGAL-BHTN',N'GDS-MVP-ADMIN-TCTN',N'guides_procedure',N'Quyen loi BHTN lien ket thu tuc giai quyet tro cap that nghiep.'),
 (N'GDS-MVP-SCAM-MAODANH-BHXH',N'GDS-MVP-ADMIN-TCTN',N'warns_related',N'Canh bao goi gia danh nham ho tro thu tuc nhung doi chuyen tien.'),
 (N'GDS-MVP-SCAM-MAODANH-BHXH',N'GDS-MVP-LEGAL-BHTN',N'risk_context',N'Rui ro mao danh khi nguoi lao dong tim hieu quyen loi BHTN.');
 INSERT dbo.knowledge_item_link(from_item_id,to_item_id,relation_type,relation_note)
 SELECT fi.id,ti.id,l.relation_type,l.note FROM @Links l
 JOIN dbo.knowledge_item fi ON fi.business_code=l.from_code
 JOIN dbo.knowledge_item ti ON ti.business_code=l.to_code
 WHERE NOT EXISTS(SELECT 1 FROM dbo.knowledge_item_link x WHERE x.from_item_id=fi.id AND x.to_item_id=ti.id AND x.relation_type=l.relation_type);
 IF (SELECT COUNT(*) FROM dbo.benefit_detail WHERE version_id IN (SELECT v.id FROM dbo.knowledge_item i JOIN dbo.knowledge_version v ON v.item_id=i.id WHERE i.business_code=N'GDS-MVP-LEGAL-BHTN'))<>1
  OR (SELECT COUNT(*) FROM dbo.procedure_detail WHERE version_id IN (SELECT v.id FROM dbo.knowledge_item i JOIN dbo.knowledge_version v ON v.item_id=i.id WHERE i.business_code=N'GDS-MVP-ADMIN-TCTN'))<>1
  OR (SELECT COUNT(*) FROM dbo.scam_detail WHERE version_id IN (SELECT v.id FROM dbo.knowledge_item i JOIN dbo.knowledge_version v ON v.item_id=i.id WHERE i.business_code=N'GDS-MVP-SCAM-MAODANH-BHXH'))<>1
  OR (SELECT COUNT(*) FROM dbo.knowledge_item WHERE business_code IN(SELECT code FROM @Codes))<>3
  OR (SELECT COUNT(*) FROM dbo.knowledge_item_link l JOIN dbo.knowledge_item i ON i.id=l.from_item_id WHERE i.business_code IN(SELECT code FROM @Codes))<>3
  OR (SELECT COUNT(*) FROM dbo.knowledge_source_candidate c JOIN dbo.knowledge_item i ON i.id=c.item_id WHERE i.business_code IN(SELECT code FROM @Codes))<4
  THROW 58907,N'Loi so luong MVP; rollback toan bo.',1;
 COMMIT TRAN;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK TRAN;
 THROW;
END CATCH;

SELECT i.business_code,d.code AS module,v.editorial_status,
  (SELECT COUNT(*) FROM dbo.knowledge_source_candidate c WHERE c.item_id=i.id) AS pendingSourceCandidates
FROM dbo.knowledge_item i JOIN dbo.[domain] d ON d.id=i.domain_id
JOIN dbo.knowledge_version v ON v.item_id=i.id AND v.version_no=1
WHERE i.business_code IN(N'GDS-MVP-LEGAL-BHTN',N'GDS-MVP-ADMIN-TCTN',N'GDS-MVP-SCAM-MAODANH-BHXH')
ORDER BY d.code;
SELECT COUNT(*) AS CrossModuleLinks FROM dbo.knowledge_item_link l
JOIN dbo.knowledge_item i ON i.id=l.from_item_id
WHERE i.business_code IN(N'GDS-MVP-LEGAL-BHTN',N'GDS-MVP-ADMIN-TCTN',N'GDS-MVP-SCAM-MAODANH-BHXH');
GO
