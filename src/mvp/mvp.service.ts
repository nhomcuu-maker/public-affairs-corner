import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from '../database/database.service';

const CODES = [
  'GDS-MVP-LEGAL-BHTN',
  'GDS-MVP-ADMIN-TCTN',
  'GDS-MVP-SCAM-MAODANH-BHXH',
] as const;

@Injectable()
export class MvpService {
  constructor(private readonly db: DatabaseService) {}

  async overview() {
    const results = await this.db.request().query(`
      SELECT d.code AS domain, i.business_code AS businessCode, i.kind,
             v.id AS versionId, v.title, v.summary, v.editorial_status AS editorialStatus,
             (SELECT COUNT(*) FROM dbo.knowledge_source_candidate c WHERE c.item_id=i.id) AS sourceCandidates
      FROM dbo.knowledge_item i
      JOIN dbo.[domain] d ON d.id=i.domain_id
      JOIN dbo.knowledge_version v ON v.item_id=i.id AND v.version_no=1
      WHERE i.business_code IN (N'GDS-MVP-LEGAL-BHTN',N'GDS-MVP-ADMIN-TCTN',N'GDS-MVP-SCAM-MAODANH-BHXH')
        AND i.deleted_at IS NULL
      ORDER BY CASE d.code WHEN N'LEGAL' THEN 1 WHEN N'ADMIN' THEN 2 ELSE 3 END;
    `);
    const links = await this.db.request().query(`
      SELECT fi.business_code AS fromCode, ti.business_code AS toCode,
             l.relation_type AS relationType, l.relation_note AS note
      FROM dbo.knowledge_item_link l
      JOIN dbo.knowledge_item fi ON fi.id=l.from_item_id
      JOIN dbo.knowledge_item ti ON ti.id=l.to_item_id
      WHERE fi.business_code IN (N'GDS-MVP-LEGAL-BHTN',N'GDS-MVP-ADMIN-TCTN',N'GDS-MVP-SCAM-MAODANH-BHXH')
      ORDER BY l.id;
    `);
    return {
      name: 'GocDanSinh - MVP Step 9',
      mode: 'STAFF_ONLY_DRAFT',
      articles: results.recordset,
      links: links.recordset,
      warning: 'Nguon moi la URL tham chieu, chua co snapshot va xac minh noi bo. Khong duoc cong bo.'
    };
  }

  async detail(code: string) {
    if (!CODES.includes(code as typeof CODES[number])) {
      throw new BadRequestException('MVP business code is not recognized');
    }
    const r = await this.db.request().input('code',sql.NVarChar(100),code).query(`
      SELECT TOP(1) i.id AS itemId, i.business_code AS businessCode, d.code AS domain,
        v.id AS versionId, i.kind, v.title, v.summary, v.body_markdown AS bodyMarkdown,
        v.editorial_status AS editorialStatus
      FROM dbo.knowledge_item i
      JOIN dbo.[domain] d ON d.id=i.domain_id
      JOIN dbo.knowledge_version v ON v.item_id=i.id AND v.version_no=1
      WHERE i.business_code=@code AND i.deleted_at IS NULL;
    `);
    if (!r.recordset.length) throw new NotFoundException('MVP draft has not been seeded in SQL Server');
    const item = r.recordset[0];
    const versionId = item.versionId as number;
    const itemId = item.itemId as number;
    const [refs, links, conditions, steps, requirements, indicators, detail] = await Promise.all([
      this.db.request().input('item',sql.BigInt,itemId).query(`
        SELECT s.title, s.canonical_url AS url, s.source_kind AS kind,
          c.review_status AS reviewStatus, c.review_note AS reviewNote
        FROM dbo.knowledge_source_candidate c JOIN dbo.[source] s ON s.id=c.source_id
        WHERE c.item_id=@item ORDER BY s.title;
      `),
      this.db.request().input('item',sql.BigInt,itemId).query(`
        SELECT CASE WHEN l.from_item_id=@item THEN ti.business_code ELSE fi.business_code END AS linkedCode,
          CASE WHEN l.from_item_id=@item THEN tv.title ELSE fv.title END AS linkedTitle,
          l.relation_type AS relationType, l.relation_note AS note
        FROM dbo.knowledge_item_link l
        JOIN dbo.knowledge_item fi ON fi.id=l.from_item_id
        JOIN dbo.knowledge_item ti ON ti.id=l.to_item_id
        JOIN dbo.knowledge_version fv ON fv.item_id=fi.id AND fv.version_no=1
        JOIN dbo.knowledge_version tv ON tv.item_id=ti.id AND tv.version_no=1
        WHERE l.from_item_id=@item OR l.to_item_id=@item ORDER BY l.id;
      `),
      this.db.request().input('v',sql.BigInt,versionId).query(`
        SELECT condition_no AS no, condition_text AS text, condition_type AS type
        FROM dbo.benefit_condition WHERE version_id=@v ORDER BY condition_no;
      `),
      this.db.request().input('v',sql.BigInt,versionId).query(`
        SELECT step_no AS no, step_title AS title, instruction AS text
        FROM dbo.procedure_step WHERE version_id=@v ORDER BY step_no;
      `),
      this.db.request().input('v',sql.BigInt,versionId).query(`
        SELECT pr.requirement_no AS no, dt.name AS title, pr.condition_note AS note
        FROM dbo.procedure_requirement pr JOIN dbo.document_type dt ON dt.id=pr.document_type_id
        WHERE pr.version_id=@v ORDER BY pr.requirement_no;
      `),
      this.db.request().input('v',sql.BigInt,versionId).query(`
        SELECT indicator_no AS no, indicator_kind AS type, description AS text
        FROM dbo.scam_indicator WHERE version_id=@v ORDER BY indicator_no;
      `),
      this.db.request().input('v',sql.BigInt,versionId).query(`
        SELECT 'LEGAL' AS kind, beneficiary_group AS a, entitlement_text AS b, claim_guidance AS c
          FROM dbo.benefit_detail WHERE version_id=@v
        UNION ALL
        SELECT 'ADMIN',procedure_code,eligibility_note,processing_time_text
          FROM dbo.procedure_detail WHERE version_id=@v
        UNION ALL
        SELECT 'SCAM',severity,warning_signs,immediate_actions
          FROM dbo.scam_detail WHERE version_id=@v;
      `),
    ]);
    return {
      ...item, sources: refs.recordset, linked: links.recordset,
      conditions: conditions.recordset, steps: steps.recordset,
      requirements: requirements.recordset, indicators: indicators.recordset,
      specific: detail.recordset[0] ?? null,
      warning: 'DRAFT - NOT APPROVED. Source URLs are candidates only; no verified snapshot was created.'
    };
  }
}
