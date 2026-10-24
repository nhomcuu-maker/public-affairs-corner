#!/usr/bin/env python3
"""Create the informational, non-official community scam-safety handbook."""
from pathlib import Path
from html import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, KeepTogether, PageBreak, HRFlowable, ListFlowable, ListItem
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

BASE = Path(__file__).resolve().parents[2]
OUT = BASE / 'public' / 'downloads' / 'cam-nang-phong-chong-lua-dao.pdf'
# Use installed system fonts only; never bundle font files in the project.
font_pairs = [
    ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
    ('C:/Windows/Fonts/arial.ttf', 'C:/Windows/Fonts/arialbd.ttf'),
]
try:
    FONT, FONT_BOLD = next((normal, bold) for normal, bold in font_pairs if Path(normal).exists() and Path(bold).exists())
except StopIteration:
    raise SystemExit('Requires an installed Vietnamese Unicode font pair (DejaVu Sans or Arial).')
pdfmetrics.registerFont(TTFont('VN',FONT))
pdfmetrics.registerFont(TTFont('VN-Bold',FONT_BOLD))
pdfmetrics.registerFontFamily('VN',normal='VN',bold='VN-Bold',italic='VN',boldItalic='VN-Bold')
navy = HexColor('#172554'); slate=HexColor('#334155'); red=HexColor('#991b1b')
styles = {
 'title':ParagraphStyle('T',fontName='VN-Bold',fontSize=18,leading=27,textColor=navy,spaceAfter=10),
 'sub':ParagraphStyle('ST',fontName='VN',fontSize=10.3,leading=16.5,textColor=slate,spaceAfter=12),
 'head':ParagraphStyle('H',fontName='VN-Bold',fontSize=12,leading=19,textColor=navy,spaceBefore=12,spaceAfter=6,keepWithNext=True),
 'body':ParagraphStyle('B',fontName='VN',fontSize=9.2,leading=15.4,textColor=slate,spaceAfter=7),
 'bullet':ParagraphStyle('BU',fontName='VN',fontSize=9.2,leading=15.4,textColor=slate,leftIndent=12,firstLineIndent=-8,spaceAfter=6),
 'alert':ParagraphStyle('A',fontName='VN-Bold',fontSize=10.1,leading=17.5,textColor=red,spaceAfter=11),
 'label':ParagraphStyle('L',fontName='VN-Bold',fontSize=9.5,leading=15,textColor=navy,spaceAfter=7),
}
story=[]
def p(t,style='body'):
 story.append(Paragraph(t,styles[style]))
def b(t): p('• '+escape(t),'bullet')
def h(t): p(escape(t),'head')
def section(title,steps):
 h(title)
 for line in steps: b(line)

def foot(canvas,doc):
 canvas.saveState()
 w,h=A4
 canvas.setStrokeColor(HexColor('#cbd5e1'))
 canvas.line(43,45,w-43,45)
 canvas.setFont('VN',7.6)
 canvas.setFillColor(slate)
 canvas.drawString(43,32,'GÓC DÂN SINH  ·  HƯỚNG DẪN AN TOÀN THÔNG TIN')
 canvas.drawRightString(w-43,32,f'Trang {doc.page}')
 canvas.restoreState()

p('CẨM NANG PHÒNG TRÁNH LỪA ĐẢO TRỰC TUYẾN','title')
p('Hướng dẫn thực hành dành cho người dân · Bản 10/2026. Đây là tài liệu hướng dẫn an toàn do Góc Dân Sinh biên soạn, không phải văn bản pháp luật hoặc thông báo chính thức của cơ quan nhà nước.','sub')
p('NẾU ĐÃ LỘ OTP, MẤT QUYỀN TRUY CẬP HOẶC BỊ TRỪ TIỀN: ƯU TIÊN HÀNH ĐỘNG NGAY','alert')
section('Việc cần làm trong những phút đầu',[
 'Ngừng trao đổi với người yêu cầu mã, không bấm tiếp liên kết và không cung cấp thêm OTP, mã PIN, mật khẩu hoặc ảnh giấy tờ.',
 'Dùng số điện thoại, ứng dụng hoặc website chính thức của ngân hàng/ví điện tử để yêu cầu khóa tài khoản hoặc tạm chặn giao dịch; đề nghị kiểm tra, tra soát giao dịch bất thường.',
 'Nếu không đăng nhập được, gọi tổng đài chính thức bằng thiết bị an toàn hoặc đến điểm giao dịch; không dùng số do người gọi lạ gửi.',
 'Từ thiết bị tin cậy, đổi mật khẩu các tài khoản liên quan nếu còn quyền truy cập, đăng xuất các phiên lạ và bật biện pháp xác thực bổ sung.',
 'Lưu ảnh chụp thông báo trừ tiền, lịch sử giao dịch, số điện thoại, đường dẫn và thời gian xảy ra sự việc; che số thẻ/mã bảo mật khi gửi tài liệu.',
 'Trình báo cơ quan công an theo kênh chính thức, cung cấp bằng chứng và mã tra soát nếu có. Không thể bảo đảm thu hồi tiền; xử lý sớm giúp tăng cơ hội ngăn thiệt hại tiếp diễn.'
])
section('Khi liên quan mã OTP VssID/BHXH',[
 'Ngừng cung cấp OTP và mật khẩu; nếu còn truy cập được, đổi mật khẩu và kiểm tra thông tin đăng nhập liên quan.',
 'Liên hệ cơ quan BHXH qua cổng/kênh chính thức do bạn tự tìm để xác minh và được hỗ trợ bảo vệ tài khoản.',
 'Không nhầm một cuộc gọi tự xưng nhân viên BHXH với xác nhận danh tính người gọi.'
])
section('Những điều không nên làm',[
 'Không chuyển thêm tiền để “mở khóa”, “hoàn tiền”, “xác minh” hoặc “đóng phí lấy lại tiền”.',
 'Không cài ứng dụng điều khiển từ xa, chia sẻ màn hình hoặc cho người lạ thao tác trên điện thoại.',
 'Không đăng công khai bằng chứng chứa số tài khoản đầy đủ, số giấy tờ tùy thân, mã truy cập hoặc OTP.'
])

story.append(PageBreak())
p('NHẬN DIỆN THỦ ĐOẠN THEO TÌNH HUỐNG','title')
section('1. Giả danh ngân hàng, ví điện tử, cơ quan nhà nước',[
 'Dấu hiệu: thúc giục cung cấp OTP; đòi chuyển tiền vào “tài khoản an toàn”; hối thúc bấm link xác thực.',
 'Cách xử lý: dừng tương tác, mở ứng dụng chính thức hoặc tự gọi số liên hệ trên website của đơn vị; không gọi lại số do người lạ gửi.'
])
section('2. Link giả và ứng dụng độc hại',[
 'Dấu hiệu: tên miền có ký tự lạ, yêu cầu nhập mật khẩu/OTP, xin quyền trợ năng, chia sẻ màn hình hoặc cài file APK không rõ nguồn.',
 'Cách xử lý: không nhập thông tin; chỉ cài từ kho ứng dụng chính thức, rà soát quyền truy cập và quét thiết bị khi nghi nhiễm mã độc.'
])
section('3. Mua bán, giao hàng và đơn hàng giả',[
 'Dấu hiệu: yêu cầu chuyển phí lạ trước khi giao, gửi mã QR/link “xác nhận đơn” hoặc báo phải chuyển thêm tiền để nhận lại tiền.',
 'Cách xử lý: kiểm tra trạng thái đơn trên ứng dụng của bên bán/đơn vị vận chuyển, không trả phí qua tài khoản lạ chỉ dựa vào tin nhắn.'
])
section('4. Việc làm và cộng tác viên trực tuyến',[
 'Dấu hiệu: đòi nộp tiền giữ chỗ, ứng trước “nhiệm vụ”, yêu cầu nạp thêm sau khi đã có “hoa hồng”.',
 'Cách xử lý: xác minh tổ chức tuyển dụng, hợp đồng và đầu mối công khai; không chuyển tiền để được nhận việc.'
])
section('5. Đầu tư, tiền ảo, lợi nhuận cam kết',[
 'Dấu hiệu: bảo đảm lợi nhuận cao, tạo áp lực nạp tiền nhanh, không cho rút hoặc yêu cầu nộp “thuế/phí” để rút.',
 'Cách xử lý: ngừng nạp, ghi lại thông tin giao dịch, xác minh tổ chức và tư cách hoạt động qua nguồn có thẩm quyền.'
])
section('6. Kết bạn, tình cảm, trúng thưởng',[
 'Dấu hiệu: thiết lập quan hệ nhanh rồi nhờ chuyển tiền, yêu cầu giữ bí mật hoặc trả phí nhận quà.',
 'Cách xử lý: xác minh qua kênh độc lập, không chuyển tiền hay gửi giấy tờ khi chưa xác định rõ người nhận.'
])

story.append(PageBreak())
p('CHECKLIST & KÊNH XÁC MINH','title')
section('Checklist 5 câu hỏi trước khi làm theo yêu cầu',[
 'Tôi đã tự kiểm tra danh tính người liên hệ bằng kênh chính thức độc lập hay chưa?',
 'Người này có đang yêu cầu OTP, mật khẩu, chuyển tiền hay cài ứng dụng không rõ nguồn không?',
 'Đường dẫn có đúng tên miền chính thức mà tôi tự gõ hoặc tự tìm không?',
 'Tôi có bị thúc giục phải làm ngay, không được hỏi người khác không?',
 'Tôi có thể dừng lại và xác minh qua ngân hàng, ví, doanh nghiệp hoặc cơ quan thực sự quản lý dịch vụ không?'
])
section('Các nơi nên liên hệ theo loại sự việc',[
 'Liên quan ngân hàng hoặc ví điện tử: ứng dụng chính thức, tổng đài chính thức hoặc điểm giao dịch của chính đơn vị quản lý tài khoản.',
 'Liên quan cơ quan nhà nước, BHXH hoặc thủ tục: cổng thông tin chính thức của cơ quan có thẩm quyền; tự tìm tên miền, không dùng liên kết từ người nghi giả mạo.',
 'Có dấu hiệu chiếm đoạt tài sản hoặc đe dọa: cơ quan công an gần nhất hoặc kênh tiếp nhận chính thức theo địa bàn.',
 'Nếu đang nguy hiểm về tính mạng, sức khỏe: ưu tiên gọi dịch vụ khẩn cấp phù hợp tại địa phương.'
])
h('Mẫu ghi nhận sự việc')
for s in [
 'Thời gian phát hiện: ..........................................................................................',
 'Tài khoản/dịch vụ bị ảnh hưởng (không ghi OTP hoặc mật khẩu): .....................................',
 'Số giao dịch / giá trị giao dịch (nếu có): ..................................................................',
 'Đã liên hệ đơn vị nào, lúc nào và được cấp mã tiếp nhận nào: ........................................',
 'Đã lưu những chứng cứ gì: ....................................................................................',
]:p(escape(s))
p('Lưu ý: Đây là hướng dẫn giảm thiểu rủi ro ở mức thông tin chung. Các vấn đề về trách nhiệm pháp lý, thời hạn, thủ tục điều tra hoặc hoàn tiền phụ thuộc từng trường hợp và căn cứ có hiệu lực; cần xác minh với cơ quan hoặc tổ chức có thẩm quyền.','sub')

doc=SimpleDocTemplate(str(OUT),pagesize=A4,rightMargin=44,leftMargin=44,topMargin=49,bottomMargin=62,title='Cẩm nang phòng tránh lừa đảo trực tuyến - Góc Dân Sinh',author='Góc Dân Sinh',pageCompression=1)
doc.build(story,onFirstPage=foot,onLaterPages=foot)
print(OUT, OUT.stat().st_size)
