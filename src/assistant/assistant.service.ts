/** Grounded assistant: source-aware retrieval with optional model synthesis. */
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { SearchService } from '../search/search.service';
import { catalogEvidence } from './assistant.catalog';
import {
  AssistantEvidence, createSystemPrompt, enforceSafetyFloor, evidenceFromSearch,
  parseModelAnswer, redactSecrets, retrievalFallback, validateQuestion,
} from './assistant.logic';
import { citizenEmergencyFirstAid, evidenceMatchesQuestion, financialEmergencyFirstAid, otpFirstAid, readRecentQuestions, routeScope, scopeReply, scamClarification, shouldClarifyScam, gdsEvidenceFits, gdsTrustedEvidence, gdsSafeGuidance, gdsUnsupportedClaim } from './assistant.triage';

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  constructor(private readonly search: SearchService) {}

  async ask(body: Record<string, unknown>, staff: boolean) {
    const question = validateQuestion(body.question);
    const domain = body.domain === undefined ? 'ALL' : body.domain;
    if (!['ALL', 'LEGAL', 'ADMIN', 'SCAM'].includes(String(domain)))
      throw new Error('Lĩnh vực không hợp lệ.');
    const safeQuestion = redactSecrets(question);
    const recent = readRecentQuestions(body.history).map(redactSecrets);
    const citizenEmergency = citizenEmergencyFirstAid(safeQuestion);
    if (citizenEmergency) return {
      mode: staff ? 'STAFF_DRAFT_PREVIEW' : 'PUBLISHED_ONLY', status: 'SAFETY_GUIDANCE',
      modelActive: false, intent: 'SAFETY', urgentSafety: true,
      missingInformation: [], evidence: [], links: [], answer: citizenEmergency,
      disclaimer: 'Hướng dẫn an toàn ban đầu, không thay thế cơ quan cứu hộ hoặc nhân viên y tế.',
    };
    const scope = routeScope(safeQuestion, recent);
    // Never depend on SQL Server or a live LLM to provide time-critical OTP first aid.
    const otpSafety = financialEmergencyFirstAid(safeQuestion, recent) || otpFirstAid(safeQuestion, recent);
    if (otpSafety) return {
      mode: staff ? 'STAFF_DRAFT_PREVIEW' : 'PUBLISHED_ONLY', status: 'SAFETY_GUIDANCE',
      modelActive: false, intent: 'SAFETY', urgentSafety: true,
      missingInformation: otpSafety.conditions, evidence: [], links: [], answer: otpSafety,
      disclaimer: 'Hướng dẫn bảo vệ tài khoản ban đầu; không phải kết luận rằng cá nhân hoặc tổ chức đã lừa đảo.',
    };
    if (scope !== 'IN_SCOPE') return {
      mode: staff ? 'STAFF_DRAFT_PREVIEW' : 'PUBLISHED_ONLY',
      status: scope === 'OUT_OF_SCOPE' ? 'OUT_OF_SCOPE' : 'NEEDS_CLARIFICATION',
      modelActive: false, intent: 'GENERAL', urgentSafety: false,
      missingInformation: [], evidence: [], links: [], answer: scopeReply(scope),
      disclaimer: 'Trợ lý chỉ hỗ trợ pháp luật, quyền lợi, thủ tục hành chính và phòng tránh lừa đảo.',
    };
    const clarification = shouldClarifyScam(safeQuestion, recent);
    if (clarification) {
      return {
        mode: staff ? 'STAFF_DRAFT_PREVIEW' : 'PUBLISHED_ONLY',
        status: 'NEEDS_CLARIFICATION', modelActive: false, intent: 'SAFETY',
        urgentSafety: true, missingInformation: [], evidence: [], links: [],
        answer: scamClarification(safeQuestion, clarification, staff),
        disclaimer: 'Đây là hướng dẫn xử lý ban đầu; không suy đoán thủ đoạn hay kết luận pháp lý.',
      };
    }
    const result = await this.search.search({ q: safeQuestion, domain, limit: '5' }, staff);
    const all = [...result.results, ...result.related];
    const excerpts = await this.search.excerptsForAssistant(all, staff);
    const sqlEvidence = evidenceFromSearch(result, excerpts, staff)
      .filter(e => evidenceMatchesQuestion(safeQuestion, e));
    // Official-site links are supplementary references, never SQL-approved publications.
    const referenceEvidence = staff ? [] : catalogEvidence(safeQuestion, String(domain), sqlEvidence.length)
      .filter(e => evidenceMatchesQuestion(safeQuestion, e));
    const evidence = [...sqlEvidence, ...referenceEvidence].filter(e => gdsEvidenceFits(safeQuestion, e));
    const fallback = retrievalFallback(safeQuestion, evidence, staff);
    const base = {
      mode: staff ? 'STAFF_DRAFT_PREVIEW' : 'PUBLISHED_ONLY', retrieval: result.retrieval,
      intent: result.intent, urgentSafety: result.urgentSafety, missingInformation: result.missingInformation,
      evidence: evidence.map(({ excerpt, ...rest }) => rest), links: result.links.slice(0, 12),
      disclaimer: staff
        ? 'CHỈ DÙNG NỘI BỘ: bản nháp và nguồn chưa xác minh; không phải tư vấn pháp lý hoặc kết luận chính thức.'
        : 'Trợ lý thông tin không thay thế cơ quan có thẩm quyền. Tài liệu SQL đã duyệt và liên kết tham khảo bên ngoài có trạng thái khác nhau; liên kết ngoài chưa được xác minh theo quy trình SQL.',
    };
    // GDS_FULLFIX_20261027: public legal information must not rely on unverified model memory.
    // Set AI_ALLOW_UNVERIFIED_GENERAL=1 ONLY for explicitly opted-in development experiments.
    const gdsVerified = evidence.filter(e => gdsTrustedEvidence(e));
    if (!staff && gdsVerified.length === 0 && process.env.AI_ALLOW_UNVERIFIED_GENERAL !== '1') {
      const focused = gdsSafeGuidance(safeQuestion);
      const guardedAnswer = focused || fallback;
      return { ...base, status: 'RETRIEVAL_ONLY', modelActive: false,
        answer: { ...guardedAnswer, citationIds: [] },
        notice: 'Chưa có đoạn nguồn SQL đã công bố và được xác minh cho câu hỏi; hiển thị hướng dẫn an toàn, không khẳng định quy định.' };
    }
    // GDS_QUICKFIX_20261027: reference-only evidence cannot support freeform official legal guidance.
    // Return the grounded fallback *before* calling slow Ollama (the old guard below remains defensive).
    if (evidence.length && evidence.every(e => e.sourceStatus === 'reference_not_verified_in_sql')) {
      return { ...base, status: 'RETRIEVAL_ONLY', answer: fallback, modelActive: false,
        notice: 'Đã tìm thấy liên kết tham khảo liên quan nhưng chưa kiểm duyệt trong SQL; vui lòng kiểm tra tại nguồn.' };
    }
    // Lack of published evidence is NOT a reason to suppress the real model.
    // The model may offer non-authoritative general guidance but no legal specifics or fake citations.
    // Local Ollama needs no paid API key; the token 'ollama' is ignored by localhost.
    const local = process.env.AI_PROVIDER?.trim().toLowerCase() === 'ollama';
    const key = local ? 'ollama' : process.env.AI_API_KEY?.trim();
    const model = process.env.AI_MODEL?.trim();
    const draftsEnabled = process.env.AI_ALLOW_STAFF_DRAFTS === 'true';
    if (!key || !model || (staff && !draftsEnabled)) {
      return { ...base, status: 'RETRIEVAL_ONLY', answer: fallback, modelActive: false,
        notice: staff && !draftsEnabled ? 'AI chưa được phép sử dụng bản nháp; bật AI_ALLOW_STAFF_DRAFTS chỉ khi thử nghiệm nội bộ.'
          : 'Chưa cấu hình mô hình AI. Hãy chạy tools/ai/start-gds.ps1; hiện chỉ tra cứu dữ liệu.' };
    }
    try {
      const raw = await this.generate(safeQuestion, recent, evidence, staff, key, model);

let usedEvidence = evidence;
let parsedBase = parseModelAnswer(raw, evidence, staff);

// Thử loại bỏ phần văn bản thừa bao quanh đối tượng JSON.
// Vẫn phải qua parseModelAnswer để kiểm tra cấu trúc và citationIds.
if (!parsedBase) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');

  if (start >= 0 && end > start) {
    const candidate = raw.slice(start, end + 1);
    parsedBase = parseModelAnswer(candidate, evidence, staff);
  }
}

// Nếu AI thiếu dẫn chứng, thử tạo lại một lần.
// Không tự động gán S1 cho nội dung chưa được chứng minh.
if (!parsedBase && evidence.length > 0) {
  const validCitationIds = evidence.map(e => e.id);

  const citationReminder =
    safeQuestion +
    '\n\nYÊU CẦU KIỂM TRA DẪN CHỨNG:\n' +
    'Trả về đúng JSON theo cấu trúc đã yêu cầu.\n' +
    'Các mã dẫn chứng có thể sử dụng: ' +
    validCitationIds.join(', ') + '.\n' +
    'Chỉ đưa mã vào citationIds khi nội dung câu trả lời ' +
    'thực sự được tài liệu tương ứng hỗ trợ.\n' +
    'Nếu tài liệu không đủ để xác định điều kiện, hồ sơ, ' +
    'thời hạn hoặc quyền lợi cụ thể thì không được tự suy đoán.\n' +
    'Không tự tạo mã dẫn chứng mới.';

  const retryRaw = await this.generate(
    citationReminder,
    recent,
    evidence,
    staff,
    key,
    model,
  );

  parsedBase = parseModelAnswer(retryRaw, evidence, staff);
}

// Chỉ bật khi kiểm thử nội bộ.
// Không ghi nội dung câu hỏi hoặc phản hồi AI vào log production.
if (process.env.AI_DEBUG_FORMAT === '1') {
  let format = 'INVALID_JSON';
  let keys: string[] = [];
  let citations: unknown = null;

  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    format = 'VALID_JSON';
    keys = Object.keys(obj);
    citations = obj.citationIds;
  } catch {
    // JSON không hợp lệ.
  }

  const diagnostic = {
  format,
  keys,
  citations,
  expectedCitationIds: evidence.map(e => e.id),
  acceptedAfterRetry: parsedBase !== null,
  responseLength: raw.length,
};

this.logger.log('AI_FORMAT_DIAGNOSTIC ' + JSON.stringify(diagnostic));
}
      // Nếu AI vẫn không tạo được câu trả lời có dẫn chứng hợp lệ,
      // chỉ hiển thị tài liệu tham khảo, không tự suy đoán.
      if (!parsedBase && evidence.length) {
        return {
          ...base,
          status: 'RETRIEVAL_ONLY',
          answer: fallback,
          modelActive: false,
          notice:
            'AI chưa tạo được câu trả lời có dẫn chứng hợp lệ. ' +
            'Hệ thống hiển thị tài liệu tham khảo thay vì tự suy đoán.'
        };
      }
      // Nguồn tham khảo bên ngoài chưa kiểm duyệt SQL:
      // không công bố phần diễn giải tự do của AI như quy trình chính thức.
      const externalOnly =
        evidence.length > 0 &&
        evidence.every(
          e => e.sourceStatus === 'reference_not_verified_in_sql'
        );

      if (externalOnly) {
        return {
          ...base,
          status: 'RETRIEVAL_ONLY',
          answer: fallback,
          modelActive: false,
          notice:
            'Hệ thống đã tìm thấy tài liệu tham khảo và mã thủ tục liên quan. ' +
            'Nội dung nguồn chưa được kiểm duyệt trong SQL nên chưa thể ' +
            'xác nhận các bước thực hiện, điều kiện hoặc thời hạn cụ thể.'
        };
      }
      const parsed = parsedBase ? enforceSafetyFloor(safeQuestion, parsedBase) : null;
      if (!parsed) return { ...base, status: 'PROVIDER_UNAVAILABLE', answer: fallback, modelActive: false,
        notice: 'Mô hình không trả về JSON hợp lệ hoặc không dẫn nguồn phù hợp; đang hiển thị kết quả tra cứu dự phòng.' };
      if (!staff && gdsUnsupportedClaim(safeQuestion, parsed, evidence)) {
        return { ...base, status: 'RETRIEVAL_ONLY', answer: fallback, modelActive: false,
          notice: 'Chi tiet dinh luong trong cau tra loi AI chua duoc chung minh boi tai lieu; su dung ket qua tra cuu.' };
      }
      return { ...base, status: 'AI_GENERATED', answer: parsed, modelActive: true,
        evidence: usedEvidence.length ? base.evidence : [], links: usedEvidence.length ? base.links : [],
        notice: usedEvidence.length
          ? 'AI tổng hợp từ tài liệu liên quan. Liên kết tham khảo bên ngoài chưa qua quy trình xác minh/công bố SQL; cần kiểm tra hiệu lực và nội dung tại nguồn.'
          : 'AI trả lời hướng dẫn chung; kho dữ liệu hiện chưa có nguồn đã kiểm chứng cho câu hỏi này.' };
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.name : 'UnknownError';
      this.logger.warn('Provider unavailable (' + reason + '); fallback to retrieval-only answer.');
      return { ...base, status: 'PROVIDER_UNAVAILABLE', answer: fallback, modelActive: false,
        notice: 'Dịch vụ AI hiện không phản hồi; hệ thống vẫn hiển thị thông tin tìm được và không tự tạo kết luận.' };
    }
  }

  private async generate(question: string, history: string[], evidence: AssistantEvidence[], staff: boolean, key: string, model: string): Promise<string> {
    const base = process.env.AI_BASE_URL?.trim() ||
      (process.env.AI_PROVIDER?.toLowerCase() === 'ollama' ? 'http://127.0.0.1:11434/v1' : 'https://api.openai.com/v1');
    const url = new URL(base.replace(/\/+$/, '') + '/chat/completions');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '::1'].includes(url.hostname)))
      throw new ServiceUnavailableException('AI_BASE_URL không hợp lệ.');
    const context = evidence.map(e => ({ id: e.id, domain: e.domain, businessCode: e.businessCode, title: e.title,
      summary: e.summary, excerpt: e.excerpt, sourceTitle: e.sourceTitle, sourceUrl: e.sourceUrl,
      sourceStatus: e.sourceStatus, editorialStatus: e.editorialStatus }));
    const payload = { model, messages: [
      { role: 'system', content: createSystemPrompt(staff) },
      { role: 'user', content: JSON.stringify({ question, recentUserMessages: history.slice(-3), mode: staff ? 'DRAFT_INTERNAL' : 'PUBLISHED_ONLY', evidence: context }) },
    ], temperature: 0.1, max_tokens: 1200, response_format: { type: 'json_object' } };
    const controller = new AbortController();
    // Local CPU inference can take longer than a remote model.
    const timeout = setTimeout(() => controller.abort(), process.env.AI_PROVIDER?.toLowerCase() === 'ollama' ? 180000 : 30000);
    try {
      const response = await fetch(url.toString(), { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error('AI provider HTTP error');
      const json: unknown = await response.json();
      const content = (json as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.length > 14000) throw new Error('Malformed provider response');
      return content;
    } finally { clearTimeout(timeout); }
  }
}

