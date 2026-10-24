import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from '../database/database.service';
import { detailSql, PUBLIC_LIST_SQL } from './procedures.queries';
import { parseProvinceCode } from './provinces.catalog';

function checkBusinessCode(code: string): string {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(code)) {
    throw new BadRequestException('Invalid business code');
  }
  return code;
}

@Injectable()
export class ProceduresService {
  constructor(private readonly database: DatabaseService) {}

  async listPublished(provinceCode?: string): Promise<unknown[]> {
    const province = parseProvinceCode(provinceCode);
    const result = await this.database.request()
      .input('provinceCode', sql.NVarChar(2), province)
      .query(PUBLIC_LIST_SQL);
    return result.recordset;
  }

  async getDetail(code: string, publishedOnly: boolean, provinceCode?: string): Promise<unknown> {
    const businessCode = checkBusinessCode(code);
    const province = publishedOnly ? parseProvinceCode(provinceCode) : null;
    const result = await this.database.request()
      .input('businessCode', sql.NVarChar(100), businessCode)
      .input('provinceCode', sql.NVarChar(2), province)
      .query(detailSql(publishedOnly));
    const main = result.recordset[0];
    if (!main) throw new NotFoundException('Procedure not found');

    const versionId = main.versionId as number;
    const [steps, requirements, fees] = await Promise.all([
      this.database.request().input('versionId', sql.BigInt, versionId).query(`
        SELECT step_no AS stepNo, step_title AS title, instruction
        FROM dbo.procedure_step WHERE version_id = @versionId ORDER BY step_no;
      `),
      this.database.request().input('versionId', sql.BigInt, versionId).query(`
        SELECT pr.requirement_no AS requirementNo, dt.name AS documentName,
          pr.quantity, pr.is_required AS isRequired, pr.condition_note AS conditionNote
        FROM dbo.procedure_requirement AS pr
        INNER JOIN dbo.document_type AS dt ON dt.id = pr.document_type_id
        WHERE pr.version_id = @versionId ORDER BY pr.requirement_no;
      `),
      this.database.request().input('versionId', sql.BigInt, versionId).query(`
        SELECT fee_kind AS feeKind, amount, currency_code AS currency,
               pricing_rule AS pricingRule
        FROM dbo.procedure_fee WHERE version_id = @versionId ORDER BY fee_kind;
      `),
    ]);

    const offices = publishedOnly ? { recordset: [] } : await this.database.request()
      .input('versionId', sql.BigInt, versionId).query(`
        SELECT o.name AS organizationName, po.office_role AS officeRole,
               po.submission_channel AS submissionChannel, po.instructions
        FROM dbo.procedure_office AS po
        JOIN dbo.organization AS o ON o.id = po.organization_id
        WHERE po.version_id = @versionId
        ORDER BY po.id;
      `);

    // Evidence and legal source details are ONLY included for key-protected local developer view.
    let references: unknown[] = [];
    let evidence: unknown[] = [];
    if (!publishedOnly) {
      const [legalRows, evidenceRows] = await Promise.all([
        this.database.request().input('versionId', sql.BigInt, versionId).query(`
          SELECT ld.document_number AS documentNumber, ld.title,
                 kb.basis_role AS basisRole, ld.official_status_note AS statusNote
          FROM dbo.knowledge_basis_document AS kb
          JOIN dbo.legal_document AS ld ON ld.id = kb.legal_document_id
          WHERE kb.knowledge_version_id = @versionId ORDER BY ld.issued_on, ld.id;
        `),
        this.database.request().input('versionId', sql.BigInt, versionId).query(`
          SELECT s.title AS sourceTitle, s.canonical_url AS sourceUrl,
                 k.evidence_role AS evidenceRole, k.locator,
                 fa.storage_key AS storageKey
          FROM dbo.knowledge_version_source AS k
          JOIN dbo.source_snapshot AS ss ON ss.id = k.snapshot_id
          JOIN dbo.[source] AS s ON s.id = ss.source_id
          LEFT JOIN dbo.file_asset AS fa ON fa.id = ss.file_asset_id
          WHERE k.version_id = @versionId ORDER BY k.snapshot_id;
        `),
      ]);
      references = legalRows.recordset;
      evidence = evidenceRows.recordset;
    }

    return {
      ...main,
      steps: steps.recordset,
      requirements: requirements.recordset,
      fees: fees.recordset,
      offices: offices.recordset,
      ...(publishedOnly ? { officeVerificationStatus: 'not_verified', officeNotice: 'Nơi tiếp nhận chưa có chứng cứ địa phương được chấp nhận.' } : {}),
      ...(publishedOnly ? {} : { legalBases: references, evidence, notice: 'LOCAL DEV PREVIEW ONLY — NOT APPROVED FOR PUBLICATION' }),
    };
  }
}
