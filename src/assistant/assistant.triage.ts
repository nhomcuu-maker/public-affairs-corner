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
  if (recentScam && q.length < 45 && /^(?:qua|chuyen khoan|vao|luc|hom|ngay|so tien|tai khoan|qua facebook|qua zalo)\b/.test(q))
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
  // GDS_QUICKFIX_20261027: external catalog must match the user's real topic, not just common words.
  if (evidence.domain !== 'SCAM') {
    if (evidence.sourceStatus !== 'reference_not_verified_in_sql') return true;
    const q = fold(question);
    const about = fold([evidence.title, evidence.summary].join(' '));
    const intents: Array<[RegExp, RegExp]> = [
      [/\b(?:that nghiep|nghi viec|bhtn)\b/, /\b(?:that nghiep|nghi viec|bhtn)\b/],
      [/\b(?:tam tru|thuong tru|cu tru|chuyen cho o|chuyen noi o)\b/, /\b(?:tam tru|thuong tru|cu tru|noi o)\b/],
      [/\b(?:khai sinh|giay khai sinh)\b/, /\bkhai sinh\b/],
      [/\b(?:ket hon|giay dang ky ket hon)\b/, /\bket hon\b/],
      [/\b(?:can cuoc|cccd)\b/, /\b(?:can cuoc|cccd)\b/],
      [/\b(?:bao hiem y te|bhyt)\b/, /\b(?:bao hiem y te|bhyt)\b/],
      [/\b(?:dat dai|quyen su dung dat|so do|nha dat)\b/, /\b(?:dat dai|quyen su dung dat|so do|nha dat)\b/],
      [/\b(?:mai tang|khai tu|tu tuat)\b/, /\b(?:mai tang|khai tu|tu tuat)\b/],
    ];
    for (const [questionTopic, sourceTopic] of intents) {
      if (questionTopic.test(q) && !sourceTopic.test(about)) return false;
    }
    // Protect against a linked but irrelevant sub-procedure.
    if (/\b(?:mat the|mat bao hiem|cap lai)\b/.test(q) && /\btre em duoi 6 tuoi\b/.test(about)) return false;
    if (/\b(?:ban sao|trich luc)\b/.test(q) && /\bket hon\b/.test(about) && !/\b(?:ban sao|trich luc)\b/.test(about)) return false;
    const stop = new Set('toi ban minh co the nao lam gi can muon hoi xin la duoc khong nhu the o tai o dau khi cho ve tren truoc sau hay phai va cua nhung cac thu tuc ho so giay to dang ky tim hieu thong tin quan trong lien quan'.split(' '));
    const tokens = [...new Set(q.split(/\s+/).filter(w => w.length >= 3 && !stop.has(w)))];
    const words = new Set(about.split(/\s+/));
    const matched = tokens.filter(t => words.has(t));
    return matched.length >= 2 && matched.length / Math.max(tokens.length, 1) >= 0.4;
  }
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
// GDS_QUICKFIX_20261027: ordinary citizen questions should not be dismissed for missing a fixed keyword.
const CITIZEN_EXTRA = /(?:mat the|mat giay to|cap lai|ban sao|trich luc|no luong|bi no luong|chua tra luong|thu phi|tien dien|tien nuoc|mat dien|mat nuoc|day dien|rac thai|dot rac|tien hoc|hoc sinh|hoc nghe|tuyen sinh|lop mot|lop 1|tre bi bao hanh|bao hanh|bat nat|bao ve tre em|tro giup|ho tro|ho ngheo|can ngheo|nguoi khuyet tat|nguoi cao tuoi|dich vu y te|dong bao hiem|phong tro|tien coc|chu tro|via he|tran chap|lan chiem|phan anh|bao tin|bao cao|gop y|nguy hiem|khac phuc|hoa giai|boi thuong|bi de doa|anh rieng tu|gia dinh kho khan|dien thoai thong minh|ho so bi tra|qua ngay hen)/;
const OUT_SCOPE = /(?:cach nau|nau mon|cong thuc nau|mon an|bun ca|pho bo|banh mi|lam banh|thuc don|game|choi game|bong da|doi bong|lich thi dau|ket qua tran|phim anh|dien vien|am nhac|bai hat|tu vi|boi toan|cung hoang dao|lap trinh|debug|javascript|python|nestjs|may tinh choi game|du lich|khach san|dat phong|du bao thoi tiet|thoi tiet hom nay|thoi trang|chon giay|mua dien thoai|iphone|toan hoc|giai phuong trinh|vat ly|hoa hoc)/;
const CONTINUE = /^(?:qua |tren |toi |minh |luc |hom |ngay |roi |vay |the |con |neu |khong |co |o |tai |vua |nguoi do|ho |ben kia|tien |chuyen |da |sau do|huong dan |chi tiet |giai thich |noi ro |lam gi |bay gio |tiep tuc |can lam gi |cac buoc |tung buoc )/;
const GREETING = /^(?:xin chao|chao|hello|hi|alo|ban la ai|tro ly la gi|giup toi|ho tro toi)[ !?.]*$/;
export type ScopeRoute = 'IN_SCOPE' | 'OUT_OF_SCOPE' | 'CLARIFY_SCOPE';
// GDS_QUICKFIX_20261027: immediate non-legal safety directions for narrowly identifiable emergencies.
export function citizenEmergencyFirstAid(question: string): AssistantAnswer | null {
  const q = fold(question);
  const response = (summary: string, nextSteps: string[]): AssistantAnswer => ({
    summary, nextSteps, conditions: [], warnings: ['Nếu có nguy hiểm trực tiếp, ưu tiên bảo vệ an toàn và liên hệ dịch vụ khẩn cấp tại địa phương.'], citationIds: [],
  });
  if (/(?:co giat|bat tinh|kho tho|khong tho duoc)/.test(q)) return response(
    'Đây có thể là tình huống cấp cứu. Hãy gọi cấp cứu 115 hoặc đến cơ sở y tế gần nhất ngay.',
    ['Không trì hoãn để tìm hồ sơ hay quy định.', 'Nếu người bệnh co giật, tránh vật cứng xung quanh, không ghì giữ và không đặt đồ vật vào miệng.']);
  if (/(?:day dien.*(?:dut|roi)|dien giat|day dien tran)/.test(q)) return response(
    'Có nguy cơ điện giật. Không đến gần hay chạm vào dây điện hoặc nước gần dây điện.',
    ['Giữ người khác tránh xa khu vực.', 'Báo ngay đơn vị điện lực và lực lượng cứu hộ theo kênh chính thức; không tự đấu nối.']);
  if (/(?:mui gas|ro ri gas|binh gas.*(?:xi|ro))/.test(q)) return response(
    'Nghi rò rỉ gas là tình huống nguy hiểm: hãy ra khỏi khu vực ngay.',
    ['Không bật/tắt công tắc điện, dùng lửa hoặc tạo tia lửa.', 'Từ nơi an toàn, gọi lực lượng cứu hỏa 114 và đơn vị cung cấp gas.']);
  if (/(?:chay nha|chay chung cu|chay.*tang|co dam chay)/.test(q)) return response(
    'Có nguy cơ cháy: di chuyển khỏi khu vực nguy hiểm theo lối thoát an toàn và gọi 114.',
    ['Không sử dụng thang máy khi thoát khỏi đám cháy.', 'Nếu lối thoát bị khói/lửa chặn, tìm vị trí an toàn và báo vị trí cho lực lượng cứu hộ.']);
  if (/(?:cho can|meo can|dong vat.*can)/.test(q)) return response(
    'Vết động vật cắn, kể cả vết nhỏ, cần được cơ sở y tế đánh giá sớm về nguy cơ nhiễm trùng và bệnh dại.',
    ['Rửa kỹ vết thương dưới vòi nước với xà phòng nếu có thể.', 'Đến cơ sở y tế sớm để được đánh giá và tư vấn dự phòng phù hợp.']);
  if (/(?:dang bi.*(?:danh|bao hanh)|bi bao hanh|tre.*bi bao hanh|de doa.*(?:tung anh|dua tien|ep))/.test(q)) return response(
    'Ưu tiên rời khỏi nơi nguy hiểm và tìm người/cơ quan có thể bảo vệ bạn, thay vì đối đầu trực tiếp.',
    ['Liên hệ công an 113 khi có nguy hiểm tức thời; với trẻ em có thể liên hệ tổng đài bảo vệ trẻ em 111.', 'Giữ bằng chứng nếu an toàn, không chuyển tiền theo lời đe dọa.']);
  return null;
}
export function routeScope(question: string, history: string[] = []): ScopeRoute {
  const q = fold(question);
  // Explicit unrelated requests take precedence, even after a conversation about a legal matter.
  if (OUT_SCOPE.test(q) && !/(?:quy dinh|phap luat|lua dao|an toan thuc pham|giay phep kinh doanh)/.test(q)) return 'OUT_OF_SCOPE';
  if (GREETING.test(q) || DENIAL.test(q)) return 'IN_SCOPE';
  if (IN_SCOPE.test(q) || CITIZEN_TOPICS.test(q) || CITIZEN_EXTRA.test(q)) return 'IN_SCOPE';
  if (history.some(x => (IN_SCOPE.test(fold(x)) || CITIZEN_TOPICS.test(fold(x)))) && (q.length < 100 && CONTINUE.test(q))) return 'IN_SCOPE';
  return 'CLARIFY_SCOPE'; // Ambiguous citizen query: ask, don't incorrectly reject.
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
// GDS_FULLFIX_20261027 - Evidence gates and topic-specific, source-honest guidance.
// Public answers below are navigation/first-response guidance, NOT verified legal determinations.
export function gdsEvidenceFits(question: string, evidence: AssistantEvidence): boolean {
  const q = fold(question);
  const s = fold([evidence.title || '', evidence.summary || '', evidence.excerpt || ''].join(' '));
  // Do not attach a source merely because it shares "giấy tờ", "nghỉ", "chuyển", or "tiền".
  const tests: Array<[RegExp, RegExp]> = [
    [/(?:mang thai|co bau|thai san|bau.*(?:ep nghi|sa thai))/, /(?:mang thai|co bau|thai san|lao dong nu|bao ve thai san)/],
    [/(?:no luong|cham luong|chua tra luong|giu luong|thanh toan luong)/, /(?:luong|tien cong|tra cong|hop dong lao dong|bo luat lao dong)/],
    [/(?:tro cap that nghiep|bao hiem that nghiep|\bbhtn\b)/, /(?:tro cap that nghiep|bao hiem that nghiep|\bbhtn\b)/],
    [/(?:chuyen (?:noi o|cho o).*(?:tro cap)|tro cap.*chuyen (?:noi o|cho o))/, /(?:tro cap|an sinh|bao hiem)/],
    [/(?:chuyen noi o|chuyen cho o|tam tru|thuong tru|dang ky cu tru|thu tuc cu tru)/, /(?:tam tru|thuong tru|cu tru|luat cu tru)/],
    [/(?:mat (?:the )?(?:bao hiem y te|bhyt)|cap lai (?:the )?(?:bao hiem y te|bhyt))/, /(?:cap lai|mat the|su dung the|thay the the)/],
    [/(?:\bbhyt\b|bao hiem y te)/, /(?:\bbhyt\b|bao hiem y te)/],
    [/(?:ban sao|trich luc).*(?:ket hon|dang ky ket hon)/, /(?:ban sao|trich luc|cap ban sao)/],
    [/(?:khai sinh|giay khai sinh|dang ky khai sinh)/, /(?:khai sinh|ho tich)/],
    [/(?:ket hon|dang ky ket hon)/, /(?:ket hon|ho tich)/],
    [/(?:can cuoc|cccd|giay to tuy than)/, /(?:can cuoc|cccd|giay to tuy than|luat can cuoc)/],
    [/(?:mai tang|khai tu|tu tuat)/, /(?:mai tang|khai tu|tu tuat)/],
    [/(?:nha o xa hoi)/, /(?:nha o xa hoi)/],
    [/(?:so do|dat dai|mua nha|mua dat|tranh chap dat|quy hoach dat)/, /(?:dat dai|quyen su dung dat|quy hoach|so do)/],
    [/(?:tuyen sinh|nhap hoc|hoc phi|lop mot|lop 1)/, /(?:giao duc|tuyen sinh|nhap hoc|hoc phi|hoc sinh)/],
  ];
  // Specific cases take precedence over broad shared-category matching.
  for (const [asked, required] of tests) {
    if (!asked.test(q)) continue;
    if (!required.test(s)) return false;
    if (/(?:mat (?:the )?(?:bhyt|bao hiem y te)|cap lai (?:the )?(?:bhyt|bao hiem y te))/.test(q) &&
      /(?:khai sinh|tre em duoi 6 tuoi)/.test(s) && !/(?:cap lai|mat the)/.test(s)) return false;
    if (/(?:ban sao|trich luc).*(?:ket hon)/.test(q) && !/(?:ban sao|trich luc)/.test(s)) return false;
    if (/(?:mang thai|co bau).*?(?:ep nghi|sa thai|nghi viec)/.test(q) && /(?:that nghiep|\bbhtn\b)/.test(s) &&
      !/(?:mang thai|thai san|lao dong nu)/.test(s)) return false;
    return true;
  }
  return true;
}

export function gdsTrustedEvidence(evidence: AssistantEvidence): boolean {
  // SQL publication is distinct from an unreviewed URL. The excerpt must be available to the model.
  if (evidence.sourceStatus !== 'accepted' || evidence.editorialStatus !== 'published') return false;
  if (typeof evidence.excerpt !== 'string' || evidence.excerpt.trim().length < 20) return false;
  const until = evidence.sourceValidUntil || evidence.effectiveTo;
  if (until && /^\d{4}-\d{2}-\d{2}$/.test(until) && until < new Date().toISOString().slice(0,10)) return false;
  return true;
}

export function gdsSafeGuidance(question: string): AssistantAnswer | null {
  const q = fold(question);
  const answer = (summary: string, nextSteps: string[], conditions: string[] = []): AssistantAnswer => ({
    summary, nextSteps, conditions,
    warnings: ['Chưa có nguồn đã kiểm chứng cho trường hợp này; không tự khẳng định điều kiện, danh mục giấy tờ, mức phí hoặc thời hạn.'],
    citationIds: [],
  });
  if (/(?:mang thai|co bau|thai san)/.test(q) && /(?:ep nghi|ap luc.*nghi|buoc nghi|sa thai|cho thoi viec|nghi viec)/.test(q)) return answer(
    'Bạn đang hỏi về việc bị gây áp lực chấm dứt việc làm trong thời gian mang thai. Đây là vấn đề quyền lợi lao động, không phải mặc nhiên là thủ tục hưởng trợ cấp thất nghiệp.',
    ['Giữ hợp đồng lao động, tin nhắn, thư điện tử và các thông báo từ công ty.', 'Không vội ký giấy xin nghỉ hoặc thỏa thuận nếu bạn chưa rõ hậu quả.', 'Đề nghị công ty giải thích yêu cầu bằng văn bản; có thể hỏi tổ chức đại diện người lao động hoặc cơ quan lao động có thẩm quyền.'],
    ['Công ty đã yêu cầu bạn ký văn bản nào chưa?', 'Bạn làm theo loại hợp đồng nào?']);
  if (/tro cap/.test(q) && /(?:chuyen noi o|chuyen cho o|chuyen dia chi)/.test(q)) return answer(
    'Việc chuyển nơi ở có thể ảnh hưởng khác nhau tùy loại trợ cấp. Chưa thể kết luận bạn có phải làm lại hồ sơ khi chưa biết chế độ cụ thể.',
    ['Xác định tên chế độ trợ cấp đang hưởng và cơ quan chi trả.', 'Liên hệ cơ quan quản lý chế độ để hỏi về thay đổi nơi cư trú hoặc chuyển nơi nhận trợ cấp.', 'Kiểm tra hướng dẫn chính thức trước khi nộp lại hồ sơ.'],
    ['Bạn đang hưởng trợ cấp nào?', 'Bạn chuyển đến tỉnh/thành nào?']);
  if (/(?:no luong|cham luong|chua tra luong|khong tra luong|giu luong)/.test(q)) return answer(
    'Bạn có thể yêu cầu công ty làm rõ các khoản lương chưa thanh toán. Mình chưa có văn bản đã kiểm chứng để xác định cụ thể thời hạn hoặc chế tài trong trường hợp của bạn.',
    ['Tập hợp hợp đồng, bảng chấm công, phiếu lương, sao kê và tin nhắn liên quan.', 'Gửi yêu cầu thanh toán bằng văn bản và lưu bằng chứng đã gửi.', 'Nếu không được giải quyết, hỏi tổ chức đại diện người lao động hoặc cơ quan có thẩm quyền về con đường giải quyết tranh chấp.'],
    ['Bạn có hợp đồng và bằng chứng về tiền lương không?']);
  if (/(?:chuyen cho o|chuyen noi o|dang ky cu tru|tam tru|thuong tru|thu tuc cu tru)/.test(q)) return answer(
    'Khi chuyển chỗ ở, bạn cần xác định mình thuộc trường hợp đăng ký tạm trú, thường trú hoặc cập nhật thông tin cư trú. Không thể tự kết luận phải đăng ký trước khi đến hoặc liệt kê giấy tờ khi chưa kiểm chứng.',
    ['Cho biết nơi chuyển đến và dự kiến ở tạm thời hay lâu dài.', 'Tra cứu thủ tục tương ứng tại Cổng Dịch vụ công hoặc cơ quan đăng ký cư trú có thẩm quyền.', 'Kiểm tra thành phần hồ sơ, cách nộp và thời hạn trên trang chính thức trước khi thực hiện.'],
    ['Bạn chuyển đến địa phương nào?', 'Bạn dự kiến ở tạm thời hay lâu dài?']);
  if (/(?:mat (?:the )?(?:bhyt|bao hiem y te)|cap lai (?:the )?(?:bhyt|bao hiem y te))/.test(q)) return answer(
    'Trường hợp mất thẻ BHYT cần kiểm tra thông tin tham gia bảo hiểm và phương thức sử dụng hoặc cấp lại thẻ hiện hành; không dùng thủ tục cấp thẻ cho trẻ mới sinh để thay thế.',
    ['Kiểm tra thông tin BHYT trên kênh chính thức của cơ quan BHXH.', 'Liên hệ cơ quan BHXH hoặc cơ sở khám chữa bệnh để hỏi cách xác minh quyền lợi khi chưa có thẻ.'],
    ['Bạn cần khám ngay hay muốn xin cấp lại thẻ?']);
  if (/(?:dang ky khai sinh|khai sinh cho con|sai ngay sinh.*khai sinh)/.test(q)) return answer(
    'Bạn đang hỏi thủ tục hộ tịch liên quan đến khai sinh. Thành phần hồ sơ và thủ tục đăng ký mới hay cải chính có thể khác nhau.',
    ['Xác định là đăng ký khai sinh lần đầu hay sửa thông tin đã ghi.', 'Tra cứu thủ tục hộ tịch tại cổng dịch vụ công hoặc liên hệ cơ quan hộ tịch có thẩm quyền.'],
    ['Bạn muốn đăng ký mới hay sửa giấy khai sinh?']);
  if (/(?:ban sao|trich luc)/.test(q) && /(?:ket hon|dang ky ket hon)/.test(q)) return answer(
    'Xin bản sao hoặc trích lục đăng ký kết hôn khác với đăng ký kết hôn lần đầu. Mình chưa có nguồn được duyệt để xác nhận hồ sơ cụ thể.',
    ['Tra cứu thủ tục cấp bản sao/trích lục hộ tịch tại cơ quan có thẩm quyền.', 'Chuẩn bị thông tin về việc đã đăng ký kết hôn để hỏi nơi lưu trữ hồ sơ.']);
  if (/(?:mat (?:can cuoc|cccd)|lam lai (?:can cuoc|cccd)|cap lai (?:can cuoc|cccd))/.test(q)) return answer(
    'Bạn cần kiểm tra thủ tục cấp lại thẻ căn cước theo hướng dẫn hiện hành. Khi có việc gấp, hãy hỏi cơ quan tiếp nhận về cách xác minh danh tính trong thời gian chờ xử lý.',
    ['Kiểm tra thông tin trong ứng dụng định danh hợp lệ nếu bạn đang sử dụng.', 'Liên hệ cơ quan giải quyết thủ tục căn cước qua kênh chính thức; không đưa số căn cước thật vào khung chat.'],
    ['Bạn ở tỉnh/thành nào?']);
  if (/(?:that nghiep|\bbhtn\b|tro cap that nghiep)/.test(q)) return answer(
    'Điều kiện hưởng trợ cấp thất nghiệp phụ thuộc hồ sơ và quá trình tham gia bảo hiểm; chưa thể kết luận bạn đủ điều kiện nếu thiếu căn cứ.',
    ['Chuẩn bị thông tin thời gian tham gia bảo hiểm thất nghiệp và thời điểm nghỉ việc.', 'Tra cứu thủ tục trên cổng dịch vụ công hoặc hỏi đơn vị tiếp nhận hồ sơ có thẩm quyền.', 'Đối chiếu các điều kiện và thời hạn theo nguồn đang có hiệu lực.'],
    ['Bạn nghỉ việc từ khi nào?', 'Bạn đã tham gia bảo hiểm thất nghiệp trong bao lâu?']);
  if (/(?:ho ngheo|can ngheo|nguoi cao tuoi|nguoi khuyet tat|gia dinh.*kho khan|ho tro mai tang|ho tro thien tai)/.test(q)) return answer(
    'Đây là yêu cầu hỗ trợ an sinh xã hội. Đối tượng, điều kiện và nơi tiếp nhận phụ thuộc từng chương trình và địa phương.',
    ['Cho biết loại hỗ trợ bạn cần và nơi cư trú.', 'Hỏi bộ phận tiếp nhận chính sách an sinh xã hội tại chính quyền địa phương hoặc cổng dịch vụ công.', 'Chỉ tin mức hỗ trợ sau khi đối chiếu quy định chính thức.'],
    ['Bạn cần hỗ trợ cho đối tượng nào?', 'Bạn đang ở địa phương nào?']);
  if (/(?:hoc phi|nhap hoc|lop mot|lop 1|tuyen sinh|hoc sinh.*kho khan)/.test(q)) return answer(
    'Thủ tục nhập học hoặc chính sách hỗ trợ học sinh phụ thuộc cấp học và địa phương; cần kiểm tra kế hoạch và thông báo chính thức.',
    ['Tra cứu thông báo của cơ quan quản lý giáo dục và nhà trường.', 'Liên hệ nhà trường hoặc đơn vị tiếp nhận để xác nhận hồ sơ và chính sách áp dụng.'],
    ['Bạn hỏi cấp học nào và ở tỉnh/thành nào?']);
  if (/(?:phan anh|khieu nai|khieu kien|to cao|ho so.*qua han|ho so.*tra lai)/.test(q)) return answer(
    'Bạn có thể ghi nhận sự việc và đề nghị đơn vị có thẩm quyền phản hồi bằng văn bản. Mình chưa đủ dữ liệu để xác định cơ quan hoặc thời hạn pháp lý cụ thể.',
    ['Ghi rõ sự việc, địa điểm, thời gian và mã hồ sơ nếu có; tránh gửi thông tin cá nhân nhạy cảm lên kênh công khai.', 'Giữ bản sao tài liệu, chứng cứ và phản hồi đã nhận.', 'Tra cứu kênh tiếp nhận phản ánh/khiếu nại chính thức của cơ quan liên quan.'],
    ['Việc xảy ra ở đâu?', 'Bạn đã nhận phản hồi hoặc văn bản nào chưa?']);
  if (/(?:dat dai|so do|quy hoach|mua nha|tranh chap dat|thue tro|tien coc|chu tro|nha o xa hoi)/.test(q)) return answer(
    'Đây là vấn đề về nhà ở, đất đai hoặc hợp đồng dân sự. Cần làm rõ tình trạng giấy tờ và thỏa thuận trước khi đưa ra kết luận.',
    ['Lưu hợp đồng, giấy tờ hiện có và bằng chứng trao đổi giữa các bên.', 'Tra cứu thông tin tại cơ quan quản lý đất đai hoặc nhà ở có thẩm quyền; nếu tranh chấp, hỏi kênh hòa giải hoặc giải quyết phù hợp.'],
    ['Sự việc xảy ra ở tỉnh/thành nào?']);
  if (/(?:tien dien|tien nuoc|mat dien|mat nuoc|rac thai|dot rac|tieng on|o nhiem|ngap nuoc|cong thoat nuoc|via he)/.test(q)) return answer(
    'Bạn có thể phản ánh sự cố hoặc dịch vụ dân sinh qua đơn vị cung cấp dịch vụ hoặc cơ quan địa phương có thẩm quyền.',
    ['Ghi lại vị trí, thời điểm và ảnh hiện trường nếu an toàn.', 'Liên hệ đơn vị điện, nước, môi trường hoặc kênh phản ánh chính thức tại địa phương.', 'Giữ mã tiếp nhận để theo dõi kết quả.'],
    ['Sự việc xảy ra ở địa phương nào?']);
  return null;
}

// Conservative check for numbers in model-generated statutory detail.
// Not a full entailment check: a number present in a source can still be used incorrectly.
export function gdsUnsupportedClaim(question: string, answer: AssistantAnswer, evidence: AssistantEvidence[]): boolean {
  const q = fold(question);
  if (!/(?:luat|thu tuc|dieu kien|ho so|le phi|thoi han|bao hiem|tro cap|quyen loi|luong|cu tru|dang ky)/.test(q)) return false;
  const text = [answer.summary, ...answer.conditions, ...answer.nextSteps, ...answer.warnings].join(' ');
  const source = evidence.map(x => [x.title, x.summary, x.excerpt].join(' ')).join(' ');
  const nums = text.match(/\b\d{1,4}(?:[.,]\d{1,3})?\b/g) || [];
  return nums.some(n => !new RegExp('(^|[^0-9])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![0-9])').test(source));
}

