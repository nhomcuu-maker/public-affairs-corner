import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from '../database/database.service';

const DOMAIN_CODES = new Set(['', 'ADMIN', 'LEGAL', 'SCAM']);
const STATUSES = new Set(['', 'draft', 'review', 'rejected', 'approved', 'published', 'archived']);

function ensureVersionId(value: string): number {
  if (!/^[1-9]\d{0,14}$/.test(value)) throw new BadRequestException('Mã phiên bản không hợp lệ');
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new BadRequestException('Mã phiên bản quá lớn');
  return number;
}

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  async overview() {
    const result = await this.db.request().query(`
      SELECT d.code AS domainCode, kv.editorial_status AS editorialStatus, COUNT_BIG(*) AS itemCount
      FROM dbo.knowledge_version kv
      JOIN dbo.knowledge_item ki ON ki.id=kv.item_id AND ki.deleted_at IS NULL
      JOIN dbo.[domain] d ON d.id=ki.domain_id
      GROUP BY d.code, kv.editorial_status
      ORDER BY d.code, kv.editorial_status;
    `);
    return { database: 'GocDanSinh', rows: result.recordset, notice: 'Số phiên bản theo trạng thái; không phải số bài đã công bố' };
  }

  async list(params: { domain?: string; status?: string; q?: string; page?: string }) {
    const domain = (params.domain ?? '').trim().toUpperCase();
    const status = (params.status ?? '').trim().toLowerCase();
    const query = (params.q ?? '').trim();
    const p = params.page ?? '1';
    if (!DOMAIN_CODES.has(domain) || !STATUSES.has(status)) throw new BadRequestException('Bộ lọc không hợp lệ');
    if (query.length > 100) throw new BadRequestException('Từ khóa dài quá 100 ký tự');
    if (!/^[1-9]\d{0,3}$/.test(p)) throw new BadRequestException('Trang không hợp lệ');
    const page = Number(p);
    const size = 20;
    const offset = (page - 1) * size;
    // Search is fully parameterized; SQL wildcard characters are escaped.
    const pattern = '%' + query.replace(/~/g, '~~').replace(/%/g, '~%').replace(/_/g, '~_').replace(/\[/g, '~[') + '%';
    const request = this.db.request()
      .input('domain', sql.NVarChar(24), domain)
      .input('status', sql.NVarChar(24), status)
      .input('needle', sql.NVarChar(220), pattern)
      .input('offset', sql.Int, offset)
      .input('size', sql.Int, size);
    const result = await request.query(`
      SELECT kv.id AS versionId, ki.business_code AS businessCode,
             d.code AS domainCode, ki.kind, kv.title, kv.summary,
             kv.version_no AS versionNo, kv.editorial_status AS editorialStatus,
             kv.created_at AS createdAt,
             COUNT_BIG(*) OVER () AS totalCount
      FROM dbo.knowledge_version kv
      JOIN dbo.knowledge_item ki ON ki.id=kv.item_id AND ki.deleted_at IS NULL
      JOIN dbo.[domain] d ON d.id=ki.domain_id
      WHERE (@domain=N'' OR d.code=@domain)
        AND (@status=N'' OR kv.editorial_status=@status)
        AND (@needle=N'%%' OR ki.business_code LIKE @needle ESCAPE N'~'
             OR kv.title LIKE @needle ESCAPE N'~')
      ORDER BY kv.created_at DESC, kv.id DESC
      OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY;
    `);
    return {
      page, pageSize: size,
      total: Number(result.recordset[0]?.totalCount ?? 0),
      items: result.recordset.map(({totalCount, ...record}) => record),
    };
  }

  async detail(id: string) {
    const versionId = ensureVersionId(id);
    const mainResult = await this.db.request().input('id', sql.BigInt, versionId).query(`
      SELECT TOP (1) kv.id AS versionId, kv.version_no AS versionNo,
          kv.editorial_status AS editorialStatus, kv.title, kv.summary,
          kv.body_markdown AS bodyMarkdown, kv.effective_from AS effectiveFrom,
          kv.effective_to AS effectiveTo, kv.created_at AS createdAt,
          ki.business_code AS businessCode, ki.kind, d.code AS domainCode,
          kv.created_by AS createdBy, kv.approved_by AS approvedBy,
          (SELECT TOP(1) me.actor_id FROM dbo.moderation_event me
            WHERE me.version_id=kv.id AND me.action=N'submit'
            ORDER BY me.occurred_at DESC, me.id DESC) AS submittedBy,
          au.display_name AS createdByName
      FROM dbo.knowledge_version kv
      JOIN dbo.knowledge_item ki ON ki.id=kv.item_id AND ki.deleted_at IS NULL
      JOIN dbo.[domain] d ON d.id=ki.domain_id
      LEFT JOIN dbo.app_user au ON au.id=kv.created_by
      WHERE kv.id=@id;
    `);
    const main = mainResult.recordset[0];
    if (!main) throw new NotFoundException('Không tìm thấy phiên bản nội dung');
    const [legal, evidence, history] = await Promise.all([
      this.db.request().input('id', sql.BigInt, versionId).query(`
        SELECT ld.document_number AS documentNumber, ld.title,
               kb.basis_role AS basisRole, ld.official_status_note AS statusNote
        FROM dbo.knowledge_basis_document kb
        JOIN dbo.legal_document ld ON ld.id=kb.legal_document_id
        WHERE kb.knowledge_version_id=@id
        ORDER BY ld.issued_on, ld.id;
      `),
      this.db.request().input('id', sql.BigInt, versionId).query(`
        SELECT kvs.snapshot_id AS snapshotId,
               CONVERT(VARCHAR(64),ss.content_sha256,2) AS snapshotSha256,
               s.title AS sourceTitle, s.canonical_url AS sourceUrl,
               kvs.evidence_role AS evidenceRole, kvs.locator,
               fa.storage_key AS storageKey,
               ss.captured_at AS capturedAt, s.trust_tier AS trustTier,
               latest.decision AS verificationDecision,
               latest.verified_at AS verifiedAt,
               latest.valid_until AS validUntil,
               CASE WHEN latest.decision=N'accepted' AND
                           (latest.valid_until IS NULL OR latest.valid_until>SYSUTCDATETIME())
                    THEN CONVERT(bit,1) ELSE CONVERT(bit,0) END AS isVerified
        FROM dbo.knowledge_version_source kvs
        JOIN dbo.source_snapshot ss ON ss.id=kvs.snapshot_id
        JOIN dbo.[source] s ON s.id=ss.source_id
        LEFT JOIN dbo.file_asset fa ON fa.id=ss.file_asset_id
        OUTER APPLY (
          SELECT TOP (1) sv.decision,sv.verified_at,sv.valid_until
          FROM dbo.source_verification sv
          WHERE sv.source_snapshot_id=ss.id AND sv.verified_at<=SYSUTCDATETIME()
          ORDER BY sv.verified_at DESC,sv.id DESC
        ) latest
        WHERE kvs.version_id=@id ORDER BY kvs.snapshot_id;
      `),
      this.db.request().input('id', sql.BigInt, versionId).query(`
        SELECT me.action, me.from_status AS fromStatus, me.to_status AS toStatus,
               me.reason_note AS reasonNote, me.occurred_at AS occurredAt,
               au.display_name AS actorName
        FROM dbo.moderation_event me
        LEFT JOIN dbo.app_user au ON au.id=me.actor_id
        WHERE me.version_id=@id ORDER BY me.occurred_at DESC, me.id DESC;
      `),
    ]);
    let specific: Record<string, unknown> = {};
    if (main.kind === 'procedure') {
      const [procedure, steps, requirements, fees, offices] = await Promise.all([
        this.db.request().input('id', sql.BigInt, versionId).query(`
          SELECT procedure_code AS procedureCode, eligibility_note AS eligibilityNote,
                 processing_time_text AS processingTime, result_description AS resultDescription
          FROM dbo.procedure_detail WHERE version_id=@id;
        `),
        this.db.request().input('id', sql.BigInt, versionId).query(`
          SELECT step_no AS stepNo, step_title AS title, instruction
          FROM dbo.procedure_step WHERE version_id=@id ORDER BY step_no;
        `),
        this.db.request().input('id', sql.BigInt, versionId).query(`
          SELECT pr.requirement_no AS requirementNo, dt.name AS documentName,
                 pr.quantity, pr.is_required AS isRequired, pr.condition_note AS conditionNote
          FROM dbo.procedure_requirement pr
          JOIN dbo.document_type dt ON dt.id=pr.document_type_id
          WHERE pr.version_id=@id ORDER BY pr.requirement_no;
        `),
        this.db.request().input('id', sql.BigInt, versionId).query(`
          SELECT fee_kind AS feeKind, amount, currency_code AS currency,
                 pricing_rule AS pricingRule
          FROM dbo.procedure_fee WHERE version_id=@id ORDER BY fee_kind;
        `),
        this.db.request().input('id', sql.BigInt, versionId).query(`
          SELECT o.name AS organizationName, po.office_role AS officeRole,
                 po.submission_channel AS submissionChannel, po.instructions
          FROM dbo.procedure_office po
          JOIN dbo.organization o ON o.id=po.organization_id
          WHERE po.version_id=@id ORDER BY po.id;
        `),
      ]);
      specific = { procedure: procedure.recordset[0] ?? null,
        steps:steps.recordset, requirements:requirements.recordset,
        fees:fees.recordset, offices:offices.recordset };
    } else if (main.kind === 'benefit') {
      const [details, conditions] = await Promise.all([
        this.db.request().input('id',sql.BigInt,versionId).query(`
          SELECT beneficiary_group AS beneficiaryGroup, entitlement_text AS entitlementText,
                 claim_guidance AS claimGuidance FROM dbo.benefit_detail WHERE version_id=@id;
        `),
        this.db.request().input('id',sql.BigInt,versionId).query(`
          SELECT condition_no AS conditionNo, condition_text AS conditionText, condition_type AS conditionType
          FROM dbo.benefit_condition WHERE version_id=@id ORDER BY condition_no;
        `),
      ]);
      specific = { benefit: details.recordset[0] ?? null, conditions: conditions.recordset };
    } else if (main.kind === 'scam') {
      const [details, indicators] = await Promise.all([
        this.db.request().input('id',sql.BigInt,versionId).query(`
          SELECT severity, mechanism, warning_signs AS warningSigns,
                 immediate_actions AS immediateActions, reporting_guidance AS reportingGuidance
          FROM dbo.scam_detail WHERE version_id=@id;
        `),
        this.db.request().input('id',sql.BigInt,versionId).query(`
          SELECT indicator_no AS indicatorNo, indicator_kind AS indicatorKind, description
          FROM dbo.scam_indicator WHERE version_id=@id ORDER BY indicator_no;
        `),
      ]);
      specific = { scam: details.recordset[0] ?? null, indicators: indicators.recordset };
    }
    return { ...main, ...specific, legalBases:legal.recordset,
      evidence:evidence.recordset, history: history.recordset,
      notice: main.editorialStatus === 'published' ? 'NỘI DUNG ĐÃ CÔNG BỐ — KHÔNG SỬA TRỰC TIẾP' : 'DỮ LIỆU NỘI BỘ — CHỈ CÔNG BỐ SAU KHI KIỂM CHỨNG' };
  }
}
