/**
 * Privacy-first, evidence-independent first aid for underspecified scam reports.
 * This is not a classifier of guilt, a legal conclusion, or a medical diagnosis.
 * A named scam pattern must NOT be inferred merely from the only published article.
 */
import { fold } from '../search/search.logic';
import type { AssistantAnswer, AssistantEvidence } from './assistant.logic';

const SCAM = /(?:lua dao|bi lua|lua chuyen|chiem doat|chuyen khoan|mat tien|chuyen tien|giat tien|bay tien|lua mat)/;
const MONEY_SENT = /(?:da chuyen|vua chuyen|chuyen khoan|chuyen tien|bi mat|mat\s+\d|bi lua\s+\d)/;
// A context is specific only when the user mentions HOW/WHO, not simply a loss amount.
const SPECIFIC = /(?:bhxh|bao hiem xa hoi|bao hiem y te|cong an|canh sat|co quan thue|vien kiem sat|toa an|ngan hang gia mao|gia danh ngan hang|tuyen dung|xin viec|viec lam online|viec nhe|dau tu|chung khoan|tien ao|crypto|facebook|zalo|tiktok|telegram|mang xa hoi|mua hang|ban hang|dat hang|shipper|giao hang|san thuong mai|link la|duong link|phishing|otp|ma xac minh|mat khau|app gia|website gia|web gia|viec lam tai nha|nguoi yeu qua mang|hen ho)/;
const DENIAL = /(?:toi co noi gi|toi da noi dau|toi khong noi|khong lien quan|chua tung noi|sao lai noi|tai sao lai nhac|khong phai bhxh|khong phai bao hiem)/;
const SUBJECTS: Array<{query: RegExp, evidence: RegExp}> = [
  {query: /(?:bhxh|bao hiem xa hoi)/, evidence: /(?:bhxh|bao hiem xa hoi)/},
  {query: /(?:cong an|canh sat)/, evidence: /(?:cong an|canh sat)/},
  {query: /(?:co quan thue|thue thu nhap)/, evidence: /(?:co quan thue|thue thu nhap)/},
  {query: /(?:tuyen dung|xin viec|viec nhe|viec lam online)/, evidence: /(?:tuyen dung|xin viec|viec nhe|viec lam online)/},
  {query: /(?:dau tu|tien ao|crypto|chung khoan)/, evidence: /(?:dau tu|tien ao|crypto|chung khoan)/},
  {query: /(?:facebook|zalo|tiktok|telegram|mang xa hoi)/, evidence: /(?:facebook|zalo|tiktok|telegram|mang xa hoi)/},
  {query: /(?:mua hang|ban hang|dat hang|shipper|giao hang)/, evidence: /(?:mua hang|ban hang|dat hang|shipper|giao hang)/},
  {query: /(?:phishing|website gia|web gia|duong link la|link la)/, evidence: /(?:phishing|website gia|web gia|duong link la|link la)/},
];

export function readRecentQuestions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-3).filter((x): x is string => typeof x === 'string' && x.length >= 5 && x.length <= 240);
}

export function shouldClarifyScam(question: string, priorQuestions: string[] = []): 'scam' | 'correction' | 'details' | null {
  const q = fold(question);
  if (DENIAL.test(q)) return 'correction';
  if (SCAM.test(q) && !SPECIFIC.test(q)) return 'scam';
  // A short follow-up like "qua chuyển khoản" after a scam report is STILL not a scenario.
  const recentScam = priorQuestions.slice(-2).some(x => SCAM.test(fold(x)));
  if (recentScam && q.length < 75 && /^(?:qua|chuyen|vao|toi|moi|khong|tui|luc|hom|ngay|mot|hai|ba|\d)/.test(q))
    return SPECIFIC.test(q) ? 'details' : 'scam';
  return null;
}

export function scamClarification(question: string, kind: 'scam' | 'correction' | 'details', staff: boolean): AssistantAnswer {
  const q = fold(question);
  const paid = MONEY_SENT.test(q);
  const context = /facebook/.test(q) ? 'qua Facebook' : /zalo/.test(q) ? 'qua Zalo'
    : /telegram/.test(q) ? 'qua Telegram' : /tiktok/.test(q) ? 'qua TikTok' : null;
  const summary = kind === 'correction'
    ? 'Bạn nói đúng: tôi không có căn cứ để gắn trường hợp của bạn với BHXH hay bất kỳ thủ đoạn cụ thể nào. Bạn có thể kể lại mình đã bị lừa như thế nào không?'
    : kind === 'details'
      ? (context ? `Bạn nói vụ việc xảy ra ${context}. Bạn có thể kể rõ người đó đã liên hệ và yêu cầu bạn làm gì không?` : 'Bạn có thể kể rõ người đó đã liên hệ và yêu cầu bạn làm gì không?')
      : 'Mình chưa biết bạn bị lừa bằng hình thức nào chỉ từ số tiền đã mất. Bạn có thể kể lại từ lúc người kia liên hệ đến khi bạn chuyển tiền không?';
  const nextSteps = [
    'Nếu đã chuyển tiền, hãy liên hệ ngay ngân hàng qua số tổng đài hoặc ứng dụng chính thức để báo giao dịch nghi lừa đảo và yêu cầu hướng dẫn tra soát.',
    'Giữ lại biên lai chuyển khoản, đoạn chat, đường link, số điện thoại và các thông tin liên quan; có thể trình báo cơ quan công an.',
  ];
  const conditions = [
    'Bạn gặp người đó qua đâu và họ đã nói hoặc yêu cầu bạn làm gì?',
    paid ? 'Bạn chuyển khoản lúc nào, qua ngân hàng nào? Có giữ biên lai không?' : 'Bạn đã chuyển tiền hay chỉ bị yêu cầu chuyển tiền? Giao dịch xảy ra khi nào?',
  ];
  return {
    summary, conditions, nextSteps,
    warnings: [
      'Không chuyển thêm tiền, không làm theo yêu cầu “nộp phí lấy lại tiền”, không cung cấp OTP hoặc mật khẩu.',
      ...(staff ? ['BẢN NHÁP NỘI BỘ: không sử dụng dữ liệu chưa xác minh làm căn cứ công bố.'] : []),
    ],
    citationIds: [],
  };
}

/** Require an actual named context in the question to use a SCAM source.
 * Do not treat generic shared words like "lừa", "tiền", "OTP" as a match on actors. */
export function evidenceMatchesQuestion(question: string, evidence: AssistantEvidence): boolean {
  if (evidence.domain !== 'SCAM') return true;
  const q = fold(question);
  const about = fold([evidence.title, evidence.summary].join(' '));
  const subjects = SUBJECTS.filter(s => s.query.test(q));
  if (subjects.length > 0) return subjects.some(s => s.evidence.test(about));
  // Specific but uncategorized scam question: do not attach a random case study.
  return false;
}


/** Deterministic first boundary: keep clearly unrelated questions away from the model.
 * Borderline questions are clarified rather than guessed as legal advice.
 * This is a safety/UX boundary, not a claim that classification is perfect. */
const IN_SCOPE = /(?:vi dien tu|vi bi khoa|khong truy cap duoc|tru het tien|giao dich la|tai khoan mat tien|luat|phap ly|phap luat|nghi dinh|thong tu|dieu khoan|xu phat|khieu nai|to cao|tranh chap|quyen loi|bao hiem|bhxh|bhyt|bhtn|tro cap|phuc loi|lao dong|hop dong|sa thai|nghi viec|that nghiep|luong toi thieu|thai san|huu tri|bao luu|ho khau|cu tru|tam tru|tam vang|cccd|can cuoc|dinh danh|vneid|ho chieu|giay khai sinh|giay khai tu|ket hon|ly hon|dat dai|so do|giay phep|dang ky|thu tuc|ho so|cong chung|chung thuc|ubnd|phuong|xa|huyen|tinh|dich vu cong|hanh chinh|nop don|thu phi|le phi|thue|hoan thue|tai san|di san|phong chong lua dao|lua dao|bi lua|lua chuyen|chuyen khoan|mat tien|chiem doat|gia danh|mao danh|phishing|otp|mat khau|ngan hang|tai khoan bi khoa|app gia|duong link la|an ninh mang|bao mat tai khoan|trinh bao|cong an|to giac|boi thuong|tai nan lao dong|an sinh|che do)/;
const CITIZEN_TOPICS = /(?:co con nho|tre em|nuoi con|hoc tap|giao duc|hoc phi|mien giam hoc phi|nhap hoc|truong hoc|viec lam|hon nhan|gia dinh|dien luc|nha o|suc khoe|y te|kham chua benh|phuong tien|nguoi lai|dang ky xe|dang ki xe|dang kiem|bang lai|giay phep lai xe|nguoi than qua doi|khai tu|khieu kien)/;
const OUT_SCOPE = /(?:cach nau|nau mon|cong thuc nau|mon an|bun ca|pho bo|banh mi|lam banh|thuc don|game|choi game|bong da|doi bong|lich thi dau|ket qua tran|phim anh|dien vien|am nhac|bai hat|tu vi|boi toan|cung hoang dao|lap trinh|debug|javascript|python|nestjs|may tinh choi game|du lich|khach san|dat phong|du bao thoi tiet|thoi tiet hom nay|thoi trang|chon giay|mua dien thoai|iphone|toan hoc|giai phuong trinh|vat ly|hoa hoc)/;
const CONTINUE = /^(?:qua |tren |toi |minh |luc |hom |ngay |roi |vay |the |con |neu |khong |co |o |tai |vua |nguoi do|ho |ben kia|tien |chuyen |da |sau do|huong dan |chi tiet |giai thich |noi ro |lam gi |bay gio |tiep tuc |can lam gi |cac buoc |tung buoc )/;
const GREETING = /^(?:xin chao|chao|hello|hi|alo|ban la ai|tro ly la gi|giup toi|ho tro toi)[ !?.]*$/;
export type ScopeRoute = 'IN_SCOPE' | 'OUT_OF_SCOPE' | 'CLARIFY_SCOPE';
export function routeScope(question: string, history: string[] = []): ScopeRoute {
  const q = fold(question);
  // Explicit unrelated requests take precedence, even after a conversation about a legal matter.
  if (OUT_SCOPE.test(q) && !/(?:quy dinh|phap luat|lua dao|an toan thuc pham|giay phep kinh doanh)/.test(q)) return 'OUT_OF_SCOPE';
  if (GREETING.test(q) || DENIAL.test(q)) return 'IN_SCOPE';
  if (IN_SCOPE.test(q) || CITIZEN_TOPICS.test(q)) return 'IN_SCOPE';
  if (history.some(x => (IN_SCOPE.test(fold(x)) || CITIZEN_TOPICS.test(fold(x)))) && (q.length < 100 && CONTINUE.test(q))) return 'IN_SCOPE';
  return q.split(' ').length >= 5 ? 'OUT_OF_SCOPE' : 'CLARIFY_SCOPE';
}
export function scopeReply(route: Exclude<ScopeRoute, 'IN_SCOPE'>): AssistantAnswer {
  if (route === 'OUT_OF_SCOPE') return {
    summary: 'Mình chỉ hỗ trợ các vấn đề về pháp luật, quyền lợi người dân, thủ tục hành chính và phòng tránh hoặc xử lý lừa đảo. Câu hỏi này nằm ngoài phạm vi của Trợ lý Dân Sinh.',
    conditions: [], nextSteps: [], warnings: [], citationIds: [],
  };
  return {
    summary: 'Bạn đang cần hỏi về vấn đề pháp luật, quyền lợi, thủ tục hành chính hay lừa đảo nào? Bạn nói rõ hơn một chút để mình hỗ trợ đúng việc.',
    conditions: [], nextSteps: [], warnings: [], citationIds: [],
  };
}

/** Handle reports of money disappearing after a suspected account takeover BEFORE
 * retrieval, RAG, or the scope filter. Never claim theft is verified from a notification. */
export function financialEmergencyFirstAid(question: string, priorQuestions: string[] = []): AssistantAnswer | null {
  const q = fold(question);
  const history = priorQuestions.slice(-3).map(fold);
  const context = [q, ...history].join(' ');
  const financial = /(?:vi dien tu|ngan hang|tai khoan|chuyen khoan|giao dich|so du|mat tien|rut tien)/.test(context);
  const incident = /(?:tru het tien|tru sach tien|bi tru tien|tru tien|rut het tien|rut sach|mat het tien|mat sach tien|het tien trong|mat tien|bi chuyen het tien|giao dich la|giao dich khong phai|tien trong vi.*bien mat|so du.*ve 0)/.test(q);
  const locked = /(?:khong con truy cap|khong truy cap duoc|khong dang nhap duoc|khong the dang nhap|bi khoa|mat quyen truy cap)/.test(q);
  const wallet = /(?:vi dien tu|vi cua toi|vi cua minh|momo|zalopay|vnpay|shopeepay)/.test(context);
  const otpShared = history.some(x=>/(?:otp|ma xac minh|ma bao mat)/.test(x)) && history.some(x=>/(?:cung cap roi|lo cung cap|da cung cap|lo gui|da gui|doc roi)/.test(x));
  if (!financial || (!incident && !(locked && wallet))) return null;
  const service = wallet ? 'ví điện tử' : 'ngân hàng';
  return {
    summary: incident
      ? `Bạn thông báo ${service} có giao dịch trừ tiền bất thường${locked ? ' và bạn không còn truy cập được tài khoản' : ''}. Đây là tình huống cần xử lý khẩn cấp. Thông báo chưa đủ để xác nhận ai đã thực hiện giao dịch, nhưng bạn không nên chờ thêm. `
      : `Bạn đang mất quyền truy cập ${service}${otpShared ? ' sau khi đã cung cấp OTP' : ''}. Cần khóa nguy cơ truy cập trái phép ngay, kể cả khi chưa xác nhận có thất thoát tiền.`,
    warnings: [
      'Không cung cấp thêm OTP, mã PIN, mật khẩu; không nhấn liên kết khôi phục từ người lạ hay trả phí để lấy lại tiền.',
      'Chỉ sử dụng số điện thoại, website hoặc ứng dụng chính thức của đơn vị cung cấp dịch vụ.',
    ],
    nextSteps: [
      `GỌI NGAY tổng đài chính thức của ${service} từ thiết bị khác nếu cần; báo tài khoản có dấu hiệu bị chiếm quyền${incident ? ', có giao dịch trừ tiền bất thường' : ''}. Yêu cầu khóa tài khoản/phiên đăng nhập và kiểm tra khả năng tạm dừng giao dịch còn xử lý.`,
      'Yêu cầu mở phiếu tra soát/khiếu nại giao dịch không được bạn chấp thuận; xin mã tiếp nhận và lưu thời điểm liên hệ.',
      'Nếu các tài khoản khác dùng chung mật khẩu, đổi mật khẩu từ thiết bị tin cậy; thông báo đơn vị dịch vụ nếu số điện thoại hoặc thiết bị xác thực đã bị thay đổi.',
      'Lưu ảnh thông báo giao dịch, thời gian, số liên hệ, tin nhắn và bằng chứng; trình báo cơ quan công an. Không xóa lịch sử liên lạc.',
    ],
    conditions: [`Bạn dùng ví/ngân hàng nào và đã liên hệ được tổng đài chính thức chưa? (Không gửi số tài khoản, mật khẩu hoặc OTP.)`],
    citationIds: [],
  };
}

/** Immediate, evidence-independent safety advice when a user reports an OTP request.
 * Uses only the user's CURRENT question and explicit recent questions. Never classifies
 * a caller as definitively fraudulent, never asks for the OTP, and never fabricates law.
 */
export function otpFirstAid(question: string, priorQuestions: string[] = []): AssistantAnswer | null {
  const q = fold(question);
  const earlier = priorQuestions.slice(-3).map(fold);
  const otp = /(?:\botp\b|ma xac minh|ma bao mat|ma dang nhap|ma xac thuc)/;
  const requested = /(?:yeu cau|doi|bao|nhan vien|nguoi la|gia danh|mao danh|cung cap|gui|doc|chia se|lay|xin)/;
  const earlierOtp = earlier.some(x => otp.test(x) && requested.test(x));
  // An account inaccessible after a suspected OTP disclosure is urgent account
  // recovery, even though this follow-up no longer contains the word "OTP".
  const bankLocked = /(?:khong the dang nhap|khong dang nhap duoc|khong vao duoc|bi khoa|mat quyen truy cap)/.test(q)
    && /(?:ngan hang|tai khoan|app bank|internet banking|mobile banking)/.test(q);
  if (bankLocked) {
    return {
      summary: earlierOtp
        ? 'Bạn không đăng nhập được vào tài khoản ngân hàng sau khi đã trao đổi về việc cung cấp OTP. Cần liên hệ ngân hàng ngay để kiểm tra và bảo vệ tài khoản; chưa thể khẳng định tài khoản đã bị chiếm đoạt.'
        : 'Bạn không đăng nhập được tài khoản ngân hàng. Cần kiểm tra với ngân hàng qua kênh chính thức; chưa thể xác định nguyên nhân chỉ từ thông tin này.',
      warnings: ['Không gửi OTP, mật khẩu, mã PIN hay thông tin thẻ cho người tự xưng hỗ trợ; không bấm đường dẫn khôi phục do người lạ gửi.',
        'Không trả phí cho người hứa mở khóa hoặc lấy lại tiền.'],
      nextSteps: [
        'Dùng số tổng đài in trên thẻ hoặc website chính thức của ngân hàng để thông báo không đăng nhập được; nếu đã lộ OTP, nói rõ việc này và yêu cầu bảo vệ tài khoản, khóa phiên đăng nhập và kiểm tra giao dịch.',
        'Nếu không thể truy cập ứng dụng chính thức, đến chi nhánh/phòng giao dịch ngân hàng để xác minh và yêu cầu hỗ trợ khôi phục truy cập.',
        'Đề nghị ngân hàng kiểm tra giao dịch, thiết bị đăng nhập và hướng dẫn đổi mật khẩu/cài lại xác thực. Không làm theo hướng dẫn của người đã xin OTP.',
        'Lưu lại thời điểm bị mất truy cập, các tin nhắn OTP và giao dịch lạ; nếu có dấu hiệu mất tiền, yêu cầu tra soát và trình báo cơ quan có thẩm quyền.',
      ],
      conditions: ['Bạn đã nói với ngân hàng qua số chính thức chưa? Có nhận thông báo giao dịch hoặc đăng nhập lạ không? (Không gửi OTP hay số tài khoản tại đây.)'],
      citationIds: [],
    };
  }
  const currentOtp = otp.test(q) && requested.test(q);
  const given = /(?:\bda\b|\bvua\b|\bco\b).{0,32}(?:cung cap|gui|doc|chia se|nhap|dua|cho|bao)(?:\s+(?:ma|otp))?|(?:cung cap|gui|doc|chia se|nhap|dua|cho|bao)(?:\s+\w+){0,3}\s+roi\b/.test(q);
  const negated = /(?:chua|khong|chua tung|khong he).{0,15}(?:cung cap|gui|doc|chia se|nhap|dua|cho|bao)/.test(q);
  const affirmativeFollowUp = earlierOtp && (given || /^(?:toi|minh|em|tui) (?:lam vay roi|tro roi)$/.test(q)) && !negated;
  const detailRequest = /(?:huong dan|chi tiet|cu the|tung buoc|tiep tuc|tiep theo|lam gi|bay gio|giai thich|noi ro|xu ly|giup toi)/.test(q);
  const explicitlySharedEarlier = earlier.some(x =>
    (/(?:da|vua).{0,32}(?:cung cap|gui|doc|chia se|dua|cho|bao)/.test(x) ||
     /(?:cung cap|gui|doc|chia se|dua|cho|bao)(?:\s+\w+){0,3}\s+roi/.test(x)) &&
    !/(?:chua|khong).{0,16}(?:cung cap|gui|doc|chia se|dua|cho|bao)/.test(x));
  const detailAfterOtp = earlierOtp && detailRequest;
  if (!currentOtp && !affirmativeFollowUp && !detailAfterOtp) return null;
  const bhxh = /(?:\bbhxh\b|\bbhx\b|bao hiem xa hoi|vssid)/.test([q, ...earlier.filter(x => otp.test(x))].join(' '));
  if (affirmativeFollowUp || (currentOtp && given && !negated) || (detailAfterOtp && explicitlySharedEarlier)) {
    return {
      summary: 'Bạn cho biết đã cung cấp mã OTP. Đây là rủi ro cần xử lý ngay, kể cả khi chưa thấy giao dịch bất thường. Chỉ từ yêu cầu OTP thì chưa thể xác định người liên hệ có thực sự là nhân viên cơ quan nào.',
      warnings: ['Không gửi thêm OTP, mật khẩu, đường dẫn đăng nhập hay tiền; không làm theo hướng dẫn từ người đã yêu cầu mã.'],
      nextSteps: [
        'Liên hệ ngay đơn vị quản lý tài khoản qua ứng dụng, website hoặc tổng đài chính thức; báo đã lộ OTP để được hướng dẫn khóa phiên đăng nhập, đổi mật khẩu và bảo vệ tài khoản.',
        ...(bhxh ? ['Nếu mã liên quan VssID/BHXH, kiểm tra tài khoản trên kênh chính thức của BHXH Việt Nam và liên hệ BHXH để được hỗ trợ bảo mật.'] : []),
        'Nếu mã liên quan ngân hàng hoặc ví điện tử, gọi ngay tổng đài chính thức để kiểm tra và đề nghị ngăn chặn giao dịch đáng ngờ; theo dõi lịch sử giao dịch.',
        'Giữ lại tin nhắn, số liên hệ và thời điểm cung cấp mã; không gửi mã OTP thật vào khung chat này.',
      ].map((step, index) => detailAfterOtp ? 'B\u01b0\u1edbc ' + (index + 1) + ': ' + step : step),
      conditions: ['Mã OTP đó dùng cho VssID/BHXH, ngân hàng, ví điện tử hay dịch vụ nào? Bạn có còn đăng nhập được tài khoản không?'],
      citationIds: [],
    };
  }
  return {
    summary: 'Yêu cầu cung cấp OTP qua cuộc gọi hoặc tin nhắn là dấu hiệu rủi ro. Chưa thể xác nhận người liên hệ có đúng là nhân viên của đơn vị như họ tự giới thiệu hay không.',
    warnings: ['Không đọc, chuyển tiếp hay nhập OTP theo đường dẫn do người liên hệ cung cấp.'],
    nextSteps: [
      'Dừng trao đổi và tự liên hệ cơ quan/dịch vụ qua kênh chính thức để kiểm tra có yêu cầu xác minh nào hay không.',
      'Nếu đã lỡ cung cấp mã, hãy báo ngay để đơn vị quản lý tài khoản hỗ trợ bảo vệ và kiểm tra đăng nhập, giao dịch.',
    ],
    conditions: ['Bạn đã cung cấp mã OTP chưa? Mã được gửi từ dịch vụ nào? (Không gửi chính mã OTP.)'],
    citationIds: [],
  };
}
