import { BadRequestException, Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from '../database/database.service';
import { PUBLIC_VISIBILITY } from '../procedures/procedures.queries';
import { SearchLink, SearchParams, SearchRow, searchGraph } from './search.logic';

const MAX_CANDIDATES = 1500; // bounded MVP scan; replace with indexed retrieval at scale

function parseQuery(q: Record<string, unknown>): SearchParams {
  if (typeof q.q !== 'string' || q.q.trim().length < 2 || q.q.trim().length > 240) {
    throw new BadRequestException('Câu hỏi phải từ 2 đến 240 ký tự.');
  }
  const domain = q.domain === undefined ? 'ALL' : q.domain;
  if (!['ALL', 'LEGAL', 'ADMIN', 'SCAM'].includes(String(domain))) {
    throw new BadRequestException('domain phải là ALL, LEGAL, ADMIN hoặc SCAM.');
  }
  const rawLimit = q.limit === undefined ? '8' : q.limit;
  if (typeof rawLimit !== 'string' || !/^\d{1,2}$/.test(rawLimit)) {
    throw new BadRequestException('limit phải là số từ 1 đến 20.');
  }
  const limit = Number(rawLimit);
  if (limit < 1 || limit > 20) throw new BadRequestException('limit phải từ 1 đến 20.');
  return { question: q.q.trim(), domain: domain as SearchParams['domain'], limit };
}

type RefRow = { itemId?: number; versionId?: number; title: string; url: string | null; reviewStatus: string; verifiedAt?:string|null; validUntil?:string|null };

@Injectable()
export class SearchService {
  constructor(private readonly db: DatabaseService) {}

  async search(query: Record<string, unknown>, staff: boolean) {
    const params = parseQuery(query);
    // Public mode uses exactly the same security predicate as the existing public content API.
    const visibility = staff ? "AND kv.editorial_status <> N'archived'" : PUBLIC_VISIBILITY;
    const candidatesResult = await this.db.request().query(`
      WITH eligible AS (
        SELECT i.id AS itemId, kv.id AS versionId, i.business_code AS businessCode,
               d.code AS domain, kv.title, kv.summary,
               CONVERT(NVARCHAR(4000), SUBSTRING(kv.body_markdown,1,4000)) AS sample,
               (SELECT TOP(1) c.name FROM dbo.item_category ic
                  JOIN dbo.category c ON c.id=ic.category_id
                  WHERE ic.item_id=i.id ORDER BY ic.is_primary DESC, c.id) AS category,
               kv.editorial_status AS editorialStatus,
               kv.effective_from AS effectiveFrom, kv.effective_to AS effectiveTo,
               kv.published_at AS publishedAt,
               ROW_NUMBER() OVER(PARTITION BY i.id ORDER BY kv.version_no DESC, kv.id DESC) AS rn,
               kv.created_at AS createdAt
        FROM dbo.knowledge_item i
        JOIN dbo.[domain] d ON d.id=i.domain_id AND d.is_active=1
        JOIN dbo.knowledge_version kv ON kv.item_id=i.id
        WHERE i.deleted_at IS NULL AND d.code IN (N'LEGAL',N'ADMIN',N'SCAM')
          ${visibility}
      )
      SELECT TOP (${MAX_CANDIDATES}) itemId,versionId,businessCode,domain,category,title,
             summary,sample,editorialStatus,effectiveFrom,effectiveTo,publishedAt
      FROM eligible WHERE rn=1 ORDER BY createdAt DESC,versionId DESC;
    `);
    const rows = candidatesResult.recordset as SearchRow[];

    // Only relationships whose BOTH endpoints passed the same visibility policy survive.
    // The SQL query itself returns no end-user output until the graph is restricted.
    let links: SearchLink[] = [];

try {
  const linkResult = await this.db.request().query(`
    SELECT TOP(5000)
      l.from_item_id AS fromId,
      l.to_item_id AS toId,
      a.business_code AS fromCode,
      b.business_code AS toCode,
      l.relation_type AS relationType,
      l.relation_note AS note
    FROM dbo.knowledge_item_link l
    JOIN dbo.knowledge_item a ON a.id = l.from_item_id
    JOIN dbo.knowledge_item b ON b.id = l.to_item_id
    WHERE a.deleted_at IS NULL
      AND b.deleted_at IS NULL
    ORDER BY l.id;
  `);

  links = linkResult.recordset as SearchLink[];
} catch (error: unknown) {
  const sqlError = error as {
    number?: number;
    originalError?: { code?: number };
  };

  const missingTable =
    sqlError.number === 208 ||
    sqlError.originalError?.code === 208;

  if (!missingTable) {
    throw error;
  }

  // SQL Server error 208: missing relationship table.
  // Continue with content search but without related-item links.
  links = [];
}

const graph = searchGraph(rows, links, params);
const displayed = [...graph.primary, ...graph.related];

    const refs = await this.sources(displayed, staff);
    const project = (item: (typeof displayed)[number]) => ({
      businessCode: item.businessCode, domain: item.domain, category: item.category,
      title: item.title, summary: item.summary, versionId: item.versionId,
      editorialStatus: item.editorialStatus, effectiveFrom: item.effectiveFrom,
      effectiveTo: item.effectiveTo, publishedAt: item.publishedAt,
      score: item.score, matchedTerms: item.hits,
      sources: refs.get(Number(item.versionId)) ?? [],
    });

    return {
      mode: staff ? 'STAFF_PREVIEW' : 'PUBLISHED_ONLY',
      retrieval: 'RULE_BASED_LEXICAL',
      intent: graph.analysis.intent,
      missingInformation: graph.analysis.missingInformation,
      urgentSafety: graph.analysis.urgentSafety,
      matchedCount: graph.matchedCount,
      results: graph.primary.map(project),
      related: graph.related.map(project),
      links: graph.links.map(x => ({fromCode:x.fromCode,toCode:x.toCode,relationType:x.relationType,note:x.note})),
      scope: {domain:params.domain, limit:params.limit, candidateCap:MAX_CANDIDATES},
      warning: staff
        ? 'Chế độ NỘI BỘ: có thể gồm DRAFT và nguồn CHỜ XÁC MINH. Không dùng để tư vấn pháp lý chính thức hoặc công bố.'
        : 'Chỉ tìm nội dung đã công bố và có nguồn được xác minh. Không đủ căn cứ thì không đưa ra kết luận. Đây chưa phải AI/RAG.',
    };
  }


  // Internal evidence excerpts for grounded synthesis. IDs come ONLY from guarded search results.
  // Re-apply the same public visibility predicate (defense in depth).
  async excerptsForAssistant(items: Array<{versionId:number}>, staff:boolean): Promise<Map<number,string>> {
    const result=new Map<number,string>();
    if (!items.length) return result;
    const req=this.db.request();
    const ids=items.slice(0,12).map((item,i)=>{
      req.input('aid'+i,sql.BigInt,item.versionId);
      return '@aid'+i;
    });
    const visibility=staff ? "AND kv.editorial_status <> N'archived'" : PUBLIC_VISIBILITY;
    const query=await req.query(`
      SELECT kv.id AS versionId,CONVERT(NVARCHAR(4000),SUBSTRING(kv.body_markdown,1,2400)) AS excerpt
      FROM dbo.knowledge_version kv
      JOIN dbo.knowledge_item ki ON ki.id=kv.item_id
      WHERE kv.id IN (${ids.join(',')}) AND ki.deleted_at IS NULL
      ${visibility};
    `);
    for(const row of query.recordset) result.set(Number(row.versionId),String(row.excerpt??''));
    return result;
  }

  private async sources(items: Array<{itemId: number; versionId: number}>, staff: boolean) {
    const result = new Map<number, Array<{title:string;url:string|null;status:string;verifiedAt:string|Date|null;validUntil:string|Date|null}>>();
    if (!items.length) return result;
    // Item identifiers are produced by our SQL query, not by the browser.
    const request = this.db.request();
    const values = items.map((x,i) => {
      request.input('id'+i,sql.BigInt,staff?x.itemId:x.versionId);
      return '@id'+i;
    });
    const query = staff ? `
      -- STAFF-ONLY: read snapshots linked to exact version, including pending review.
      -- Do not misrepresent these rows as accepted/verified public evidence.
      SELECT e.version_id AS versionId, s.title,
        COALESCE(ss.captured_url,s.canonical_url) AS url,
        COALESCE(latest.decision,N'pending_review') AS reviewStatus,
        latest.verified_at AS verifiedAt, latest.valid_until AS validUntil
      FROM dbo.knowledge_version_source e
      JOIN dbo.source_snapshot ss ON ss.id=e.snapshot_id
      JOIN dbo.[source] s ON s.id=ss.source_id AND s.archived_at IS NULL
      OUTER APPLY (
        SELECT TOP(1) v.decision,v.verified_at,v.valid_until
        FROM dbo.source_verification v WHERE v.source_snapshot_id=ss.id
        ORDER BY v.verified_at DESC,v.id DESC
      ) latest
      WHERE e.version_id IN (${items.map((x,i)=>{request.input('v'+i,sql.BigInt,x.versionId);return '@v'+i;}).join(',')})
      UNION ALL
      -- Older draft items may have candidate sources but no captured snapshot yet.
      SELECT kv.id AS versionId,s.title,s.canonical_url AS url,
        N'pending_review' AS reviewStatus,NULL AS verifiedAt,NULL AS validUntil
      FROM dbo.knowledge_source_candidate c
      JOIN dbo.knowledge_version kv ON kv.item_id=c.item_id
      JOIN dbo.[source] s ON s.id=c.source_id AND s.archived_at IS NULL
      WHERE kv.id IN (${items.map((x,i)=>'@v'+i).join(',')})
        AND NOT EXISTS (
          SELECT 1 FROM dbo.knowledge_version_source kvs
          JOIN dbo.source_snapshot snap ON snap.id=kvs.snapshot_id
          WHERE kvs.version_id=kv.id AND snap.source_id=c.source_id
        )
` : `
      SELECT e.version_id AS versionId,s.title,
             COALESCE(ss.captured_url,s.canonical_url) AS url,
             latest.decision AS reviewStatus,latest.verified_at AS verifiedAt,latest.valid_until AS validUntil
      FROM dbo.knowledge_version_source e
      JOIN dbo.source_snapshot ss ON ss.id=e.snapshot_id
      JOIN dbo.[source] s ON s.id=ss.source_id
      CROSS APPLY (
        SELECT TOP(1) sv.decision,sv.verified_at,sv.valid_until FROM dbo.source_verification sv
        WHERE sv.source_snapshot_id=ss.id ORDER BY sv.verified_at DESC,sv.id DESC
      ) latest
      WHERE e.version_id IN (${values.join(',')})
        AND latest.decision=N'accepted'
        AND (latest.valid_until IS NULL OR latest.valid_until>SYSUTCDATETIME())
        AND s.archived_at IS NULL
      ORDER BY s.id;
    `;
    const q = await request.query(query);
    for (const row of q.recordset as RefRow[]) {
      const version = Number(row.versionId);
      if (!result.has(version)) result.set(version, []);
      const bucket = result.get(version)!;
      if (bucket.length < 8) bucket.push({title:row.title,url:row.url,status:row.reviewStatus,verifiedAt:row.verifiedAt??null,validUntil:row.validUntil??null});
    }
    return result;
  }
}
