/*
GOC DAN SINH - NGHIEM THU BUOC 8 BANG DU LIEU GIA LAP (SQL SERVER 2022)
- CHI DUNG TRONG SSMS TREN DATABASE GocDanSinh. Khong chay song song voi backup/deploy.
- KHONG dung ban nhap ho chieu, KHONG xac minh that bat ky van ban phap luat nao.
- Tao thong tin SCAM TONG HOP trong MOT giao dich, thu reject/revise/submit/approve/publish.
- Nguon chung cu VA nhan 'accepted' la GIA LAP, tao ben trong giao dich va bi ROLLBACK.
- NEU thanh cong: kiem tra ket qua truoc ROLLBACK, sau do khong de lai hang du lieu.
- Identity values co the tang ke ca khi ROLLBACK: day la hanh vi binh thuong cua SQL Server.
- Kiem thu nay xac nhan workflow STORED PROCEDURE + rang buoc SQL, KHONG thay the
  kiem thu cac nut giao dien va phan quyen API tren tai khoan that.
*/
USE [GocDanSinh];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @author BIGINT = (SELECT TOP (1) id FROM dbo.app_user WHERE email = N'editor.demo@example.invalid');
DECLARE @reviewer BIGINT = (SELECT TOP (1) id FROM dbo.app_user WHERE email = N'reviewer.demo@example.invalid');
DECLARE @publisher BIGINT;
SELECT TOP (1) @publisher=u.id FROM dbo.app_user u
JOIN dbo.user_role ur ON ur.user_id=u.id
JOIN dbo.[role] r ON r.id=ur.role_id AND r.role_code=N'admin'
JOIN dbo.auth_credential ac ON ac.user_id=u.id
WHERE u.account_status=N'active' AND u.id NOT IN (@author,@reviewer)
ORDER BY u.id;
DECLARE @domain BIGINT = (SELECT TOP(1) id FROM dbo.[domain] WHERE code=N'SCAM');
DECLARE @category BIGINT = (
 SELECT TOP(1) c.id FROM dbo.category c
 WHERE c.domain_id=@domain AND c.is_active=1 ORDER BY c.id
);
IF DB_NAME()<>N'GocDanSinh' THROW 58700, N'Chi duoc chay trong GocDanSinh',1;
IF @author IS NULL OR @reviewer IS NULL OR @publisher IS NULL OR @domain IS NULL OR @category IS NULL
 THROW 58701,N'Thieu 2 tai khoan demo, tai khoan admin THAT co mat khau hoac danh muc SCAM. Khong tao du lieu kiem thu.',1;
IF @author=@reviewer OR @author=@publisher OR @reviewer=@publisher
 THROW 58702,N'Nguoi tao, reviewer va publisher phai la 3 tai khoan khac nhau.',1;
IF NOT EXISTS (SELECT 1 FROM dbo.user_role ur JOIN dbo.[role] r ON r.id=ur.role_id
 WHERE ur.user_id=@author AND r.role_code IN (N'author',N'editor'))
 THROW 58703,N'Thieu role editor/author cho actor gia lap',1;
IF NOT EXISTS (SELECT 1 FROM dbo.user_role ur JOIN dbo.[role] r ON r.id=ur.role_id
 WHERE ur.user_id=@reviewer AND r.role_code=N'reviewer')
 THROW 58704,N'Thieu role reviewer cho actor gia lap',1;

DECLARE @businessCode NVARCHAR(100)=N'GDS-TEST-ROLLBACK-'+REPLACE(CONVERT(NVARCHAR(36),NEWID()),N'-',N'');
DECLARE @body NVARCHAR(MAX)=N'[GIA LAP - KHONG SU DUNG] Mo phong nhan dien mot tinh huong lua dao do he thong tu sinh de kiem thu quy trinh.';
DECLARE @item BIGINT,@version BIGINT,@source BIGINT,@snapshot BIGINT;

BEGIN TRY
 BEGIN TRAN;
 INSERT dbo.knowledge_item(domain_id,kind,business_code,canonical_title,created_by,created_at)
 VALUES(@domain,N'scam',@businessCode,N'[GIA LAP - ROLLBACK] Bai kiem thu quy trinh',@author,SYSUTCDATETIME());
 SET @item=CONVERT(BIGINT,SCOPE_IDENTITY());
 INSERT dbo.item_category(item_id,category_id,domain_id,is_primary) VALUES (@item,@category,@domain,1);
 INSERT dbo.knowledge_version(item_id,version_no,title,summary,body_markdown,editorial_status,
   effective_from,content_sha256,created_by,created_at)
 VALUES (@item,1,N'[GIA LAP - ROLLBACK] Bai kiem thu quy trinh',
   N'Chi la du lieu gia lap trong giao dich ROLLBACK; khong de lai bai da cong bo.',
   @body,N'draft',CONVERT(date,SYSUTCDATETIME()),
   HASHBYTES('SHA2_256',CONVERT(VARBINARY(MAX),@body)),@author,SYSUTCDATETIME());
 SET @version=CONVERT(BIGINT,SCOPE_IDENTITY());
 INSERT dbo.item_scope(version_id,scope_kind,admin_unit_id,scope_note)
 VALUES (@version,N'nationwide',NULL,N'Pham vi gia lap; chi kiem thu giao dich');
 INSERT dbo.scam_detail(version_id,severity,mechanism,warning_signs,immediate_actions,reporting_guidance)
 VALUES (@version,N'low',N'Mo phong',N'Mo phong',N'Khong ap dung ngoai thuc te',N'Khong ap dung ngoai thuc te');
 INSERT dbo.scam_indicator(version_id,indicator_no,indicator_kind,description,evidence_snapshot_id)
 VALUES (@version,1,N'synthetic',N'Dau hieu gia lap, KHONG phai thong tin canh bao that',NULL);

 -- Nguon, ban chup va quyet dinh accepted hoan toan GIA LAP, trong cung transaction.
 INSERT dbo.[source](organization_id,source_kind,title,canonical_url,url_sha256,trust_tier,created_at)
 VALUES (NULL,N'synthetic',N'[GIA LAP] Nguon kiem thu ROLLBACK',NULL,NULL,3,SYSUTCDATETIME());
 SET @source=CONVERT(BIGINT,SCOPE_IDENTITY());
 INSERT dbo.source_snapshot(source_id,captured_at,content_sha256,file_asset_id,captured_url,capture_method)
 VALUES (@source,DATEADD(SECOND,-2,SYSUTCDATETIME()),HASHBYTES('SHA2_256',CONVERT(VARBINARY(MAX),@body)),NULL,NULL,N'manual');
 SET @snapshot=CONVERT(BIGINT,SCOPE_IDENTITY());
 INSERT dbo.knowledge_version_source(version_id,snapshot_id,evidence_role,locator)
 VALUES (@version,@snapshot,N'synthetic_test',N'SIMULATED/ROLLBACK ONLY');
 INSERT dbo.source_verification(source_snapshot_id,reviewer_id,decision,evidence_note,verified_at,valid_until)
 VALUES (@snapshot,@reviewer,N'accepted',
  N'SYNTHETIC ACCEPTANCE - UNCOMMITTED - AUTOMATIC ROLLBACK - NOT A REAL VERIFICATION',
  DATEADD(SECOND,-1,SYSUTCDATETIME()),DATEADD(DAY,1,SYSUTCDATETIME()));

 -- 1. Tao ban nhap va gui duyet lan thu nhat
 UPDATE dbo.knowledge_version SET editorial_status=N'review' WHERE id=@version AND editorial_status=N'draft';
 INSERT dbo.moderation_event(version_id,actor_id,action,from_status,to_status,reason_note,occurred_at)
 VALUES (@version,@author,N'submit',N'draft',N'review',N'Gui duyet gia lap lan 1',SYSUTCDATETIME());
 -- 2. Reviewer doc lap tra lai (minh hoa thay doi trang thai va ghi lich su)
 UPDATE dbo.knowledge_version SET editorial_status=N'rejected' WHERE id=@version AND editorial_status=N'review';
 INSERT dbo.moderation_event(version_id,actor_id,action,from_status,to_status,reason_note,occurred_at)
 VALUES (@version,@reviewer,N'reject',N'review',N'rejected',N'Tra lai gia lap',SYSUTCDATETIME());
 -- 3. Chinh sua ban nhap va gui duyet lai
 UPDATE dbo.knowledge_version SET editorial_status=N'draft' WHERE id=@version AND editorial_status=N'rejected';
 INSERT dbo.moderation_event(version_id,actor_id,action,from_status,to_status,reason_note,occurred_at)
 VALUES (@version,@author,N'revise',N'rejected',N'draft',N'Chinh sua gia lap',SYSUTCDATETIME());
 UPDATE dbo.knowledge_version SET editorial_status=N'review' WHERE id=@version AND editorial_status=N'draft';
 INSERT dbo.moderation_event(version_id,actor_id,action,from_status,to_status,reason_note,occurred_at)
 VALUES (@version,@author,N'submit',N'draft',N'review',N'Gui duyet gia lap lan 2',SYSUTCDATETIME());
 -- 4. Test stored procedure that: phe duyet va cong bo boi 2 nguoi khac nhau
 EXEC dbo.usp_approve_knowledge_version @version_id=@version,
    @reviewer_user_id=@reviewer,@reason_note=N'Thuc nghiem ROLLBACK voi chung cu gia lap - khong duoc su dung ngoai giao dich';
 EXEC dbo.usp_publish_knowledge_version @version_id=@version,@publisher_user_id=@publisher;

 IF NOT EXISTS (SELECT 1 FROM dbo.knowledge_version WHERE id=@version AND editorial_status=N'published'
                 AND approved_by=@reviewer AND published_at IS NOT NULL)
  THROW 58705,N'LOI: Phien ban gia lap chua dat trang thai published',1;
 IF (SELECT COUNT(*) FROM dbo.moderation_event WHERE version_id=@version)<>6
  THROW 58706,N'LOI: So su kien kiem duyet khong bang 6',1;
 SELECT N'PASS (TRUOC ROLLBACK)' AS TestStatus,
   @businessCode AS TestCode,@author AS TestAuthor,@reviewer AS TestReviewer,
   @publisher AS TestPublisher,editorial_status AS TestFinalStatus,
   (SELECT COUNT(*) FROM dbo.moderation_event WHERE version_id=@version) AS TestEvents
 FROM dbo.knowledge_version WHERE id=@version;
 ROLLBACK TRAN;
 SELECT N'PASS - DA ROLLBACK, KHONG CON BAN GHI GIA LAP' AS TestResult,
   (SELECT COUNT(*) FROM dbo.knowledge_item WHERE business_code=@businessCode) AS RemainingTestItems;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK TRAN;
 THROW;
END CATCH;
GO
