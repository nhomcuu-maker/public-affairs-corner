/*
  GOC DAN SINH | FILE 06 (TUY CHON): 6 BAI CANH BAO LUA DAO O TRANG THAI DRAFT
  SQL Server 2022 | CHAY MOT LAN (neu da du 6 bai thi tu bo qua)

  VI SAO TRANG LUA DAO TRONG: trang cong khai chi hien bai da published, co chung cu da
  duoc kiem chung 'accepted'. DB hien chi co 1 bai lua dao (BHXH) va no chua published
  (ban #4 da 'approved' nhung thieu effective_from nen khong cong bo duoc; ban #6 la ban
  ke nhiem dang o draft). Chua co bai nao cho cac muc "Lien ket gia" va "Tuyen dung, dau tu".

  FILE NAY LAM GI: tao 6 bai DRAFT de dua vao hang cho kiem duyet, phu 3 danh muc lua dao.
  KHONG LAM GI: khong tao chung cu, khong kiem chung, khong duyet, khong cong bo.
  => Noi dung la tong hop cac thu doan pho bien, CHUA co nguon chinh thuc di kem. Muon
     hien tren web, nhan su phai: (1) dinh kem nguon chinh thuc (BHXH, Bo Cong an, Ngan hang
     Nha nuoc, Cuc An toan thong tin...) -> (2) reviewer kiem chung -> (3) reviewer KHAC duyet
     -> (4) publisher dat effective_from va cong bo. Hay doc lai tung bai, sua cho dung
     voi nguon chinh thuc truoc khi gui duyet.

  YEU CAU: da co it nhat 1 tai khoan admin ACTIVE co mat khau (file 05); da chay file 04.
*/
USE [GocDanSinh];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME() <> N'GocDanSinh' THROW 59830, N'Sai database.', 1;

DECLARE @Author BIGINT = (
    SELECT TOP (1) u.id FROM dbo.app_user u
    JOIN dbo.auth_credential ac ON ac.user_id = u.id
    JOIN dbo.user_role ur ON ur.user_id = u.id
    JOIN dbo.[role] r ON r.id = ur.role_id AND r.role_code = N'admin'
    WHERE u.account_status = N'active' ORDER BY u.id);
IF @Author IS NULL THROW 59831, N'Chua co tai khoan admin that. Chay file 05 truoc.', 1;
IF (SELECT COUNT(*) FROM dbo.category c JOIN dbo.[domain] d ON d.id=c.domain_id
    WHERE d.code=N'SCAM' AND c.code IN (N'GIA_DANH',N'LINK_GIA',N'TUYEN_DUNG') AND c.is_active=1) <> 3
    THROW 59832, N'Thieu 3 danh muc SCAM. Chay file 04 truoc.', 1;

DECLARE @Items TABLE (
    code NVARCHAR(100) PRIMARY KEY, category NVARCHAR(64), title NVARCHAR(300), summary NVARCHAR(1600),
    severity NVARCHAR(24), mechanism NVARCHAR(MAX), warning_signs NVARCHAR(MAX),
    immediate_actions NVARCHAR(MAX), reporting NVARCHAR(MAX));

INSERT @Items VALUES
(N'GDS-SCAM-GIADANH-CONGAN', N'GIA_DANH',
 N'Cảnh báo giả danh công an, viện kiểm sát, tòa án gọi điện đe dọa',
 N'Đối tượng tự xưng cơ quan chức năng, nói bạn liên quan vụ án rồi ép chuyển tiền để "xác minh". Cúp máy và không chuyển tiền.',
 N'critical',
 N'Đối tượng gọi điện, nhắn Zalo hoặc gọi video, tự xưng là cán bộ công an, viện kiểm sát hoặc tòa án. Chúng nói người nhận liên quan một vụ án (rửa tiền, ma túy, nợ cước, danh tính bị lợi dụng), đe dọa bắt giữ, yêu cầu giữ bí mật rồi bắt chuyển tiền vào tài khoản chỉ định "để xác minh" hoặc cài ứng dụng giả để kiểm soát điện thoại.',
 N'Gọi bằng số lạ hoặc số có đầu số bất thường. Bắt giữ bí mật, không được nói với người thân. Dọa bắt khẩn cấp và ép làm ngay. Gửi "lệnh bắt", "giấy triệu tập" dưới dạng ảnh hoặc đường link. Yêu cầu chuyển tiền vào tài khoản cá nhân hoặc "tài khoản giám sát".',
 N'Cúp máy ngay. KHÔNG chuyển tiền, KHÔNG cài ứng dụng theo hướng dẫn, KHÔNG cung cấp số căn cước, số tài khoản, mã OTP. Cơ quan chức năng không yêu cầu người dân chuyển tiền vào tài khoản cá nhân để xác minh. Tự gọi lại cơ quan qua số điện thoại công bố chính thức để kiểm tra.',
 N'Báo công an xã/phường nơi cư trú; gọi 113 nếu bị đe dọa khẩn cấp. Lưu số điện thoại, ảnh chụp màn hình, số tài khoản nhận tiền. Nếu đã chuyển tiền: gọi ngay ngân hàng để yêu cầu tra soát, phong tỏa giao dịch.'),
(N'GDS-SCAM-GIADANH-NGANHANG', N'GIA_DANH',
 N'Cảnh báo giả danh ngân hàng: đòi OTP, cập nhật sinh trắc học, nâng hạn mức',
 N'Tin nhắn hoặc cuộc gọi tự xưng ngân hàng yêu cầu OTP hoặc bấm link để "xác thực sinh trắc học" thực chất nhằm chiếm tài khoản.',
 N'high',
 N'Đối tượng gửi tin nhắn, gọi điện hoặc gửi email giả danh ngân hàng, báo tài khoản sắp bị khóa, cần cập nhật sinh trắc học hoặc nâng hạn mức. Chúng dẫn người dùng vào trang web, ứng dụng giả hoặc xin mã OTP để chiếm tài khoản và rút tiền.',
 N'Yêu cầu cung cấp OTP, mật khẩu, mã PIN. Dẫn tới đường link hoặc ứng dụng ngoài kho ứng dụng chính thức. Tạo áp lực "khóa tài khoản trong hôm nay". Người gọi biết một vài thông tin cá nhân để tạo lòng tin.',
 N'KHÔNG cung cấp OTP, mật khẩu, mã PIN cho bất kỳ ai, kể cả người xưng nhân viên ngân hàng. Không bấm link trong tin nhắn. Tự mở ứng dụng ngân hàng chính thức hoặc gọi số hotline in ở mặt sau thẻ để kiểm tra.',
 N'Gọi hotline ngân hàng để khóa tạm thời thẻ/tài khoản và tra soát giao dịch. Báo công an nếu đã mất tiền. Lưu tin nhắn, số điện thoại, đường link làm bằng chứng.'),
(N'GDS-SCAM-LINKGIA-DICHVUCONG', N'LINK_GIA',
 N'Cảnh báo trang web, ứng dụng giả mạo cổng dịch vụ công, VNeID, cơ quan nhà nước',
 N'Trang web hoặc ứng dụng mô phỏng giao diện cơ quan nhà nước để lấy thông tin cá nhân và thu phí không có thật.',
 N'high',
 N'Đối tượng dựng trang web, ứng dụng hoặc quảng cáo tìm kiếm giả mạo giao diện cổng dịch vụ công, ứng dụng định danh, trang của cơ quan nhà nước. Người dùng khai thông tin, tải ảnh giấy tờ hoặc trả "phí xử lý nhanh" là bị lấy dữ liệu, bị chiếm đoạt tiền.',
 N'Tên miền gần giống tên cơ quan nhưng sai chính tả hoặc khác đuôi. Thu phí "xử lý nhanh", "giữ lịch hẹn" qua tài khoản cá nhân. Yêu cầu chụp giấy tờ, khuôn mặt qua link lạ. Ứng dụng phải cài từ file cài đặt gửi qua tin nhắn.',
 N'Kiểm tra kỹ tên miền; cổng của cơ quan nhà nước thường dùng đuôi .gov.vn. Chỉ cài ứng dụng từ kho ứng dụng chính thức. Không gửi ảnh giấy tờ hoặc khuôn mặt qua đường link lạ. Dừng ngay nếu bị yêu cầu chuyển phí vào tài khoản cá nhân.',
 N'Báo cơ quan quản lý cổng dịch vụ hoặc công an địa phương. Nếu đã nhập thông tin: đổi mật khẩu các tài khoản liên quan, báo ngân hàng nếu có giao dịch, theo dõi dấu hiệu giả mạo danh tính.'),
(N'GDS-SCAM-LINKGIA-SMS', N'LINK_GIA',
 N'Cảnh báo tin nhắn có đường link lạ: trúng thưởng, nợ cước, phạt nguội, hoàn thuế',
 N'Tin nhắn SMS hoặc Zalo gắn link báo trúng thưởng, nợ cước, phạt nguội hoặc hoàn thuế nhằm lấy thông tin và tiền.',
 N'high',
 N'Đối tượng gửi hàng loạt tin nhắn mạo danh thương hiệu hoặc cơ quan, báo bạn trúng thưởng, nợ cước, bị phạt giao thông hoặc được hoàn thuế. Đường link dẫn tới trang giả để lấy thông tin thẻ, OTP hoặc cài phần mềm độc hại.',
 N'Tin nhắn từ số lạ nhưng mạo danh tên cơ quan hoặc thương hiệu. Có link rút gọn hoặc tên miền khác thường. Hứa thưởng hoặc hoàn tiền nếu làm ngay. Yêu cầu nhập số thẻ, OTP.',
 N'Không bấm link, không gọi lại số trong tin nhắn. Xóa tin nhắn. Muốn kiểm tra thì tự truy cập trang hoặc tổng đài chính thức. Nếu lỡ nhập thông tin thẻ: khóa thẻ ngay.',
 N'Gọi ngân hàng khóa thẻ nếu đã nhập số thẻ hoặc OTP. Chuyển tiếp tin nhắn cho nhà mạng theo hướng dẫn chính thức của nhà mạng. Báo công an nếu đã bị mất tiền.'),
(N'GDS-SCAM-TUYENDUNG-VIECNHE', N'TUYEN_DUNG',
 N'Cảnh báo tuyển dụng việc nhẹ lương cao, làm nhiệm vụ online, nạp tiền nhận hoa hồng',
 N'Lời mời việc nhẹ lương cao bằng nhiệm vụ online, bắt nạp tiền trước rồi chiếm đoạt dần.',
 N'high',
 N'Đối tượng mời làm việc nhẹ lương cao như đặt đơn, thả tim, đánh giá sản phẩm. Ban đầu trả vài khoản nhỏ để tạo lòng tin, sau đó yêu cầu nạp khoản lớn hơn "để hoàn thành nhiệm vụ" rồi chặn liên lạc hoặc đòi thêm tiền mới được rút.',
 N'Lương rất cao so với công việc đơn giản. Không có hợp đồng lao động, không có địa chỉ công ty rõ ràng. Yêu cầu nạp tiền, đặt cọc hoặc mua hàng trước. Liên lạc qua Telegram, Zalo, kèm áp lực làm nhanh. Không cho rút tiền nếu chưa nạp thêm.',
 N'Dừng chuyển tiền ngay, kể cả khi bị nói "mất tiền đã nạp". Không nạp thêm để "lấy lại". Kiểm tra công ty qua thông tin đăng ký chính thức. Không cung cấp bản sao giấy tờ tùy thân khi chưa xác minh đơn vị tuyển dụng.',
 N'Báo công an xã/phường hoặc công an cấp tỉnh. Lưu toàn bộ tin nhắn, số tài khoản nhận tiền, ảnh chụp màn hình, lịch sử chuyển khoản. Báo ngân hàng để tra soát nếu mới chuyển.'),
(N'GDS-SCAM-TUYENDUNG-DAUTU', N'TUYEN_DUNG',
 N'Cảnh báo mời đầu tư tài chính, tiền ảo, sàn giao dịch cam kết lợi nhuận cao',
 N'Lời mời đầu tư hứa lãi cao cố định, dẫn vào sàn hoặc nhóm kín rồi khóa tài khoản khi rút tiền.',
 N'high',
 N'Đối tượng làm quen qua mạng xã hội hoặc nhóm kín, mời đầu tư tiền ảo, ngoại hối, chứng khoán qua sàn hoặc ứng dụng riêng. Chúng cam kết lợi nhuận cao, cho thấy "lãi" trên màn hình rồi chặn rút tiền, đòi thêm phí hoặc thuế mới cho rút.',
 N'Cam kết lợi nhuận cao, an toàn, không rủi ro. Người lạ làm quen rồi giới thiệu đầu tư. Sàn hoặc ứng dụng không có giấy phép rõ ràng. Phải nạp thêm "phí", "thuế" mới được rút. Thúc ép quyết định nhanh.',
 N'Không chuyển tiền cho người lạ hoặc sàn không xác minh được giấy phép. Không tin lời cam kết lãi cao cố định. Không nạp thêm phí để rút tiền. Tham khảo người thân và tổ chức tài chính được cấp phép trước khi đầu tư.',
 N'Báo công an địa phương, lưu bằng chứng chuyển tiền và tin nhắn. Báo ngân hàng nơi chuyển tiền để tra soát. Cảnh báo người thân đang bị mời tham gia.');

DECLARE @Ind TABLE (code NVARCHAR(100), seq INT, kind NVARCHAR(30), descr NVARCHAR(1000));
INSERT @Ind VALUES
(N'GDS-SCAM-GIADANH-CONGAN',1,N'impersonation',N'Tự xưng công an, viện kiểm sát, tòa án nhưng làm việc qua điện thoại, Zalo hoặc video.'),
(N'GDS-SCAM-GIADANH-CONGAN',2,N'secrecy',N'Yêu cầu giữ bí mật, cấm nói với người thân hoặc cơ quan khác.'),
(N'GDS-SCAM-GIADANH-CONGAN',3,N'payment',N'Yêu cầu chuyển tiền vào tài khoản cá nhân để "xác minh" hoặc "chứng minh trong sạch".'),
(N'GDS-SCAM-GIADANH-CONGAN',4,N'link',N'Gửi lệnh bắt, giấy triệu tập qua ảnh hoặc đường link, hoặc bắt cài ứng dụng.'),
(N'GDS-SCAM-GIADANH-NGANHANG',1,N'impersonation',N'Tự xưng nhân viên ngân hàng và biết sẵn một số thông tin cá nhân.'),
(N'GDS-SCAM-GIADANH-NGANHANG',2,N'otp',N'Xin mã OTP, mật khẩu hoặc mã PIN.'),
(N'GDS-SCAM-GIADANH-NGANHANG',3,N'urgency',N'Dọa khóa tài khoản trong thời gian ngắn nếu không làm theo.'),
(N'GDS-SCAM-GIADANH-NGANHANG',4,N'phishing',N'Dẫn vào link hoặc ứng dụng ngoài kho ứng dụng chính thức.'),
(N'GDS-SCAM-LINKGIA-DICHVUCONG',1,N'link',N'Tên miền gần giống cổng chính thức nhưng sai chính tả hoặc khác đuôi.'),
(N'GDS-SCAM-LINKGIA-DICHVUCONG',2,N'payment',N'Thu "phí xử lý nhanh" hoặc phí giữ lịch qua tài khoản cá nhân.'),
(N'GDS-SCAM-LINKGIA-DICHVUCONG',3,N'phishing',N'Yêu cầu chụp giấy tờ hoặc khuôn mặt qua đường link lạ.'),
(N'GDS-SCAM-LINKGIA-DICHVUCONG',4,N'link',N'Ứng dụng phải cài từ file gửi qua tin nhắn thay vì kho chính thức.'),
(N'GDS-SCAM-LINKGIA-SMS',1,N'impersonation',N'Tin nhắn từ số lạ nhưng mạo danh cơ quan hoặc thương hiệu.'),
(N'GDS-SCAM-LINKGIA-SMS',2,N'link',N'Có link rút gọn hoặc tên miền khác thường.'),
(N'GDS-SCAM-LINKGIA-SMS',3,N'urgency',N'Hứa thưởng hoặc hoàn tiền nếu làm ngay.'),
(N'GDS-SCAM-LINKGIA-SMS',4,N'otp',N'Yêu cầu nhập số thẻ hoặc OTP trên trang lạ.'),
(N'GDS-SCAM-TUYENDUNG-VIECNHE',1,N'too_good',N'Lương rất cao cho công việc đơn giản, không cần kinh nghiệm.'),
(N'GDS-SCAM-TUYENDUNG-VIECNHE',2,N'payment',N'Yêu cầu nạp tiền, đặt cọc hoặc mua hàng trước khi nhận hoa hồng.'),
(N'GDS-SCAM-TUYENDUNG-VIECNHE',3,N'impersonation',N'Không có hợp đồng lao động, không có địa chỉ công ty rõ ràng.'),
(N'GDS-SCAM-TUYENDUNG-VIECNHE',4,N'urgency',N'Chỉ liên lạc qua ứng dụng nhắn tin, thúc làm nhanh, không cho rút nếu chưa nạp thêm.'),
(N'GDS-SCAM-TUYENDUNG-DAUTU',1,N'too_good',N'Cam kết lợi nhuận cao, an toàn, không rủi ro.'),
(N'GDS-SCAM-TUYENDUNG-DAUTU',2,N'impersonation',N'Người lạ làm quen qua mạng rồi giới thiệu đầu tư.'),
(N'GDS-SCAM-TUYENDUNG-DAUTU',3,N'payment',N'Đòi nạp thêm "phí" hoặc "thuế" mới cho rút tiền.'),
(N'GDS-SCAM-TUYENDUNG-DAUTU',4,N'link',N'Sàn hoặc ứng dụng không có giấy phép, không xác minh được pháp nhân.');

DECLARE @Existing INT = (SELECT COUNT(*) FROM dbo.knowledge_item WHERE business_code IN (SELECT code FROM @Items));
IF @Existing = 6
BEGIN
    PRINT N'Da du 6 bai canh bao, bo qua.';
END
ELSE IF @Existing <> 0
BEGIN
    THROW 59833, N'Dang ton tai mot phan 6 bai. Dung de kiem tra thu cong, khong nhap de.', 1;
END
ELSE
BEGIN
    BEGIN TRY
        BEGIN TRAN;
        DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();

        INSERT dbo.knowledge_item(domain_id, kind, business_code, canonical_title, created_by, created_at, deleted_at)
        SELECT d.id, N'scam', i.code, i.title, @Author, @Now, NULL
        FROM @Items i JOIN dbo.[domain] d ON d.code = N'SCAM';

        INSERT dbo.item_category(item_id, category_id, domain_id, is_primary)
        SELECT ki.id, c.id, c.domain_id, 1
        FROM @Items i
        JOIN dbo.knowledge_item ki ON ki.business_code = i.code
        JOIN dbo.[domain] d ON d.code = N'SCAM'
        JOIN dbo.category c ON c.domain_id = d.id AND c.code = i.category;

        INSERT dbo.knowledge_version(item_id, version_no, title, summary, body_markdown, editorial_status,
               effective_from, content_sha256, created_by, created_at)
        SELECT ki.id, 1, i.title, i.summary,
               b.body, N'draft', NULL,
               HASHBYTES('SHA2_256', CONVERT(VARBINARY(MAX), b.body)), @Author, @Now
        FROM @Items i
        JOIN dbo.knowledge_item ki ON ki.business_code = i.code
        CROSS APPLY (SELECT CONCAT(N'# ', i.title, NCHAR(10), NCHAR(10),
              N'**Cơ chế:** ', i.mechanism, NCHAR(10), NCHAR(10),
              N'**Dấu hiệu nhận biết:** ', i.warning_signs, NCHAR(10), NCHAR(10),
              N'**Cần làm ngay:** ', i.immediate_actions, NCHAR(10), NCHAR(10),
              N'**Trình báo:** ', i.reporting, NCHAR(10), NCHAR(10),
              N'*Bản nháp tổng hợp các thủ đoạn phổ biến, chưa kèm nguồn chính thức. Chưa công bố.*') AS body) b;

        INSERT dbo.item_scope(version_id, scope_kind, admin_unit_id, scope_note)
        SELECT kv.id, N'nationwide', NULL, N'Toàn quốc; bản nháp chờ kiểm chứng nguồn'
        FROM @Items i JOIN dbo.knowledge_item ki ON ki.business_code = i.code
        JOIN dbo.knowledge_version kv ON kv.item_id = ki.id AND kv.version_no = 1;

        INSERT dbo.scam_detail(version_id, severity, mechanism, warning_signs, immediate_actions, reporting_guidance)
        SELECT kv.id, i.severity, i.mechanism, i.warning_signs, i.immediate_actions, i.reporting
        FROM @Items i JOIN dbo.knowledge_item ki ON ki.business_code = i.code
        JOIN dbo.knowledge_version kv ON kv.item_id = ki.id AND kv.version_no = 1;

        INSERT dbo.scam_indicator(version_id, indicator_no, indicator_kind, description, evidence_snapshot_id)
        SELECT kv.id, x.seq, x.kind, x.descr, NULL
        FROM @Ind x JOIN dbo.knowledge_item ki ON ki.business_code = x.code
        JOIN dbo.knowledge_version kv ON kv.item_id = ki.id AND kv.version_no = 1;

        IF (SELECT COUNT(*) FROM dbo.knowledge_item WHERE business_code IN (SELECT code FROM @Items)) <> 6
           OR (SELECT COUNT(*) FROM dbo.scam_detail sd JOIN dbo.knowledge_version kv ON kv.id = sd.version_id
               JOIN dbo.knowledge_item ki ON ki.id = kv.item_id WHERE ki.business_code IN (SELECT code FROM @Items)) <> 6
           OR (SELECT COUNT(*) FROM dbo.scam_indicator si JOIN dbo.knowledge_version kv ON kv.id = si.version_id
               JOIN dbo.knowledge_item ki ON ki.id = kv.item_id WHERE ki.business_code IN (SELECT code FROM @Items)) <> 24
           OR EXISTS (SELECT 1 FROM dbo.knowledge_version kv JOIN dbo.knowledge_item ki ON ki.id = kv.item_id
               WHERE ki.business_code IN (SELECT code FROM @Items) AND kv.editorial_status <> N'draft')
            THROW 59834, N'Dem 6 bai / 6 chi tiet / 24 dau hieu KHONG dat. Da rollback.', 1;
        COMMIT TRAN;
        PRINT N'DA TAO 6 bai canh bao lua dao o trang thai DRAFT. Hay dinh kem nguon chinh thuc roi gui duyet.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH;
END;
GO
SELECT c.code AS category_code, ki.business_code, kv.editorial_status AS status
FROM dbo.knowledge_item ki
JOIN dbo.[domain] d ON d.id = ki.domain_id AND d.code = N'SCAM'
JOIN dbo.knowledge_version kv ON kv.item_id = ki.id
JOIN dbo.item_category ic ON ic.item_id = ki.id AND ic.is_primary = 1
JOIN dbo.category c ON c.id = ic.category_id
ORDER BY c.code, ki.business_code, kv.version_no;
GO
