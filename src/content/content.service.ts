import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from '../database/database.service';
import { PUBLIC_VISIBILITY } from '../procedures/procedures.queries';

const DOMAINS = ['LEGAL', 'ADMIN', 'SCAM'] as const;
function checkDomain(domain?: string): string {
  if (!domain || !DOMAINS.includes(domain as typeof DOMAINS[number])) {
    throw new BadRequestException('domain must be LEGAL, ADMIN or SCAM');
  }
  return domain;
}
function checkKeyword(q?: string): string {
  if (!q) return '';
  const text = q.trim();
  if (text.length > 80) throw new BadRequestException('Search text is too long');
  return text;
}

@Injectable()
export class ContentService {
  constructor(private readonly db: DatabaseService) {}

  async categories(domain?: string) {
    const code = checkDomain(domain);
    const result = await this.db.request().input('domain', sql.NVarChar(24), code).query(`
      SELECT c.id, c.code, c.name
      FROM dbo.category AS c
      INNER JOIN dbo.[domain] AS d ON d.id = c.domain_id
      WHERE d.code = @domain AND d.is_active = 1 AND c.is_active = 1
      ORDER BY c.name;
    `);
    return result.recordset;
  }

  async list(domain?: string, q?: string) {
    const code = checkDomain(domain);
    const keyword = checkKeyword(q);
    // Escape SQL LIKE metacharacters; all values are bound parameters.
    const pattern = '%' + keyword.replace(/[\\%_\[]/g, (s) => '\\' + s) + '%';
    const result = await this.db.request()
      .input('domain', sql.NVarChar(24), code)
      .input('keyword', sql.NVarChar(80), keyword)
      .input('pattern', sql.NVarChar(250), pattern)
      .query(`
        WITH visible AS (
          SELECT ki.business_code AS businessCode, ki.kind,
                 kv.id AS versionId, kv.title, kv.summary,
                 kv.effective_from AS effectiveFrom,
                 primaryCategory.code AS primaryCategoryCode,
                 primaryCategory.name AS primaryCategoryName,
                 ROW_NUMBER() OVER (
                   PARTITION BY ki.id ORDER BY kv.effective_from DESC, kv.version_no DESC, kv.id DESC
                 ) AS rn
          FROM dbo.knowledge_item AS ki
          INNER JOIN dbo.[domain] AS d ON d.id = ki.domain_id
          INNER JOIN dbo.knowledge_version AS kv ON kv.item_id = ki.id
          OUTER APPLY (
            SELECT TOP (1) c.code, c.name
            FROM dbo.item_category AS ic
            INNER JOIN dbo.category AS c ON c.id = ic.category_id AND c.domain_id = ki.domain_id
            WHERE ic.item_id = ki.id AND ic.is_primary = 1 AND c.is_active = 1
            ORDER BY c.id
          ) AS primaryCategory
          WHERE d.code = @domain AND ki.deleted_at IS NULL
            AND (@keyword = N'' OR kv.title LIKE @pattern ESCAPE N'\'
                 OR kv.summary LIKE @pattern ESCAPE N'\')
            ${PUBLIC_VISIBILITY}
        )
        SELECT TOP (50) businessCode, kind, versionId, title, summary,
               effectiveFrom, primaryCategoryCode, primaryCategoryName
        FROM visible WHERE rn = 1 ORDER BY title;
      `);
    return result.recordset;
  }

  async detail(businessCode: string) {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(businessCode)) {
      throw new BadRequestException('Invalid business code');
    }
    const result = await this.db.request()
      .input('code', sql.NVarChar(100), businessCode)
      .query(`
        SELECT TOP (1) ki.business_code AS businessCode, d.code AS domain,
               ki.kind, kv.id AS versionId, kv.title, kv.summary,
               kv.body_markdown AS bodyMarkdown,
               kv.effective_from AS effectiveFrom, kv.effective_to AS effectiveTo,
               primaryCategory.code AS primaryCategoryCode,
               primaryCategory.name AS primaryCategoryName
        FROM dbo.knowledge_item AS ki
        INNER JOIN dbo.[domain] AS d ON d.id = ki.domain_id
        INNER JOIN dbo.knowledge_version AS kv ON kv.item_id = ki.id
        OUTER APPLY (
          SELECT TOP (1) c.code, c.name
          FROM dbo.item_category AS ic
          INNER JOIN dbo.category AS c ON c.id = ic.category_id AND c.domain_id = ki.domain_id
          WHERE ic.item_id = ki.id AND ic.is_primary = 1 AND c.is_active = 1
          ORDER BY c.id
        ) AS primaryCategory
        WHERE ki.business_code = @code AND ki.deleted_at IS NULL
          ${PUBLIC_VISIBILITY}
        ORDER BY kv.effective_from DESC, kv.version_no DESC, kv.id DESC;
      `);
    if (!result.recordset.length) throw new NotFoundException('Published content not found');
    const record = result.recordset[0];
    // Only show sources that are linked to THIS published version and whose latest
    // independent verification is accepted and still valid. Never expose draft candidates.
    const sources = await this.db.request()
      .input('versionId', sql.BigInt, record.versionId)
      .query(`
        SELECT DISTINCT s.title, s.canonical_url AS url
        FROM dbo.knowledge_version_source AS kvs
        JOIN dbo.source_snapshot AS ss ON ss.id = kvs.snapshot_id
        JOIN dbo.source AS s ON s.id = ss.source_id
        OUTER APPLY (
          SELECT TOP (1) sv.decision, sv.valid_until
          FROM dbo.source_verification AS sv
          WHERE sv.source_snapshot_id = ss.id
          ORDER BY sv.verified_at DESC, sv.id DESC
        ) AS verification
        WHERE kvs.version_id = @versionId
          AND verification.decision = N'accepted'
          AND (verification.valid_until IS NULL
               OR verification.valid_until > SYSUTCDATETIME())
          AND s.canonical_url LIKE N'https://%'
        ORDER BY s.title;
      `);
    return { ...record, sources: sources.recordset };
  }
}
