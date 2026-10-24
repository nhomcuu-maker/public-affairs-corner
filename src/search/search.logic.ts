// Rule-based lexical retrieval for the small, reviewed Góc Dân Sinh MVP.
// This is NOT semantic embedding search, an AI assessment, or legal advice.
export type DomainCode = 'LEGAL' | 'ADMIN' | 'SCAM';
export type Intent = 'SAFETY' | 'BENEFIT' | 'PROCEDURE' | 'GENERAL';
export type SearchParams = { question: string; domain: DomainCode | 'ALL'; limit: number };
export type SearchRow = {
  itemId: number; versionId: number; businessCode: string; domain: DomainCode;
  category: string | null; title: string; summary: string; sample: string;
  editorialStatus: string; effectiveFrom: string | null; effectiveTo: string | null;
  publishedAt: string | null;
};
export type SearchLink = {
  fromId: number; toId: number; fromCode: string; toCode: string;
  relationType: string; note: string;
};

const STOP = new Set('toi ban cua la va co khong duoc cho voi mot nhung thi the nao hay gi ve de khi o tai nay kia nguoi can muon vua dau cac da minh bi den tu tren trong duoi theo tim hieu chu xin hoi thong tin nen giup toi hoi dap van de'.split(' '));

export function fold(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function analyze(question: string) {
  const q = fold(question);
  const dangerous = /(?:lua dao|bi lua|lua chuyen|mat tien|chuyen khoan|gia danh|mao danh|chuyen tien|doi tien|nop tien|ma otp|otp|mat khau|duong link la|link la|tai khoan la|chiem doat|phishing)/.test(q);
  const benefits = /(?:tro cap that nghiep|bao hiem that nghiep|bhtn|nghi viec|thoi viec|that nghiep)/.test(q);
  const procedure = /(?:thu tuc|ho so|nop don|nop ho so|giay to|co quan tiep nhan|noi nop|dich vu cong)/.test(q);
  const intent: Intent = dangerous ? 'SAFETY' : procedure ? 'PROCEDURE' : benefits ? 'BENEFIT' : 'GENERAL';
  const terms = q.split(' ').filter(w => w.length >= 3 && !STOP.has(w));
  const phraseTerms: string[] = [];
  // Never seed BHXH, OTP or any named victim/agency into every scam report.
  // Only terms actually supplied by the person can identify a scam subtype.
  if (intent === 'SAFETY') {
    for (const phrase of ['bao hiem xa hoi', 'bhxh', 'cong an', 'tuyen dung', 'dau tu', 'facebook', 'zalo', 'mua hang']) {
      if (q.includes(phrase)) phraseTerms.push(phrase);
    }
  }
  if (intent === 'BENEFIT') phraseTerms.push('tro cap that nghiep', 'bao hiem that nghiep', 'nghi viec', 'bhtn');
  if (intent === 'PROCEDURE') phraseTerms.push('thu tuc', 'ho so', 'nop ho so');
  const unique = [...new Set([...terms, ...phraseTerms])].slice(0, 24);
  const missingInformation = intent === 'BENEFIT'
    ? ['Thời gian và quá trình đóng bảo hiểm thất nghiệp', 'Lý do và thời điểm chấm dứt việc làm', 'Tình trạng việc làm hiện tại']
    : intent === 'SAFETY'
      ? ['Đã chuyển tiền hoặc cung cấp mã OTP hay chưa?', 'Thông tin nào có thể xác minh qua kênh chính thức?']
      : [];
  return { intent, terms: unique, missingInformation, urgentSafety: intent === 'SAFETY' };
}

export function rank(row: SearchRow, terms: string[], intent: Intent): { score: number; hits: string[] } {
  const title = fold(row.title), summary = fold(row.summary), body = fold(row.sample), category = fold(row.category);
  const hits: string[] = [];
  let score = 0;
  for (const term of terms) {
    if (!term) continue;
    let weight = 0;
    if (title.includes(term)) weight = 9;
    else if (summary.includes(term)) weight = 5;
    else if (category.includes(term)) weight = 4;
    else if (body.includes(term)) weight = 2;
    if (weight) { score += weight * (term.includes(' ') ? 2 : 1); hits.push(term); }
  }
  if (!hits.length) return { score: 0, hits: [] };
  if (intent === 'SAFETY' && row.domain === 'SCAM') score += 40;
  if (intent === 'BENEFIT' && row.domain === 'LEGAL') score += 28;
  if (intent === 'PROCEDURE' && row.domain === 'ADMIN') score += 28;
  return { score, hits };
}

export function searchGraph(rows: SearchRow[], links: SearchLink[], params: SearchParams) {
  const analysis = analyze(params.question);
  const scores = rows.map(row => ({ ...row, ...rank(row, analysis.terms, analysis.intent) }));
  const matches = scores.filter(r => r.score > 0 && (params.domain === 'ALL' || r.domain === params.domain))
    .sort((a, b) => b.score - a.score || a.businessCode.localeCompare(b.businessCode));
  const primary = matches.slice(0, params.limit);
  const primaryIds = new Set(primary.map(r => Number(r.itemId)));
  const eligible = new Map(scores.map(r => [Number(r.itemId), r]));
  const relatedIds = new Set<number>();
  const safeLinks = links.filter(link => eligible.has(Number(link.fromId)) && eligible.has(Number(link.toId))
    && (primaryIds.has(Number(link.fromId)) || primaryIds.has(Number(link.toId))));
  for (const link of safeLinks) {
    if (!primaryIds.has(Number(link.fromId))) relatedIds.add(Number(link.fromId));
    if (!primaryIds.has(Number(link.toId))) relatedIds.add(Number(link.toId));
  }
  const related = [...relatedIds].map(id => eligible.get(id)!).filter(Boolean).slice(0, 12);
  return { analysis, primary, related, links: safeLinks, matchedCount: matches.length };
}
