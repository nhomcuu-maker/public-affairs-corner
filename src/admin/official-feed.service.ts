import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from '../database/database.service';

const SOURCE_KEY = 'congbao-van-ban-moi';
function entryId(value: string): number {
  if (!/^[1-9]\d{0,14}$/.test(value)) throw new BadRequestException('Invalid entry ID');
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new BadRequestException('Invalid entry ID');
  return n;
}
function queryParams(params: { page?: string; size?: string; q?: string }) {
  const rawPage: unknown = params.page ?? '1';
  const rawSize: unknown = params.size ?? '20';
  const rawQuery: unknown = params.q ?? '';
  if (typeof rawPage !== 'string' || typeof rawSize !== 'string' || typeof rawQuery !== 'string')
    throw new BadRequestException('Invalid filter types');
  const q = rawQuery.trim();
  if (!/^[1-9]\d{0,3}$/.test(rawPage)) throw new BadRequestException('Invalid page');
  if (!['10', '20', '50'].includes(rawSize)) throw new BadRequestException('Invalid page size');
  if (q.length > 100) throw new BadRequestException('Search is too long');
  const page = Number(rawPage), size = Number(rawSize);
  const needle = '%' + q.replace(/~/g, '~~').replace(/%/g, '~%')
    .replace(/_/g, '~_').replace(/\[/g, '~[') + '%';
  return { page, size, needle, offset: (page - 1) * size };
}

@Injectable()
export class OfficialFeedService {
  constructor(private readonly db: DatabaseService) {}

  async overview() {
    const result = await this.db.request()
      .input('sourceKey', sql.NVarChar(80), SOURCE_KEY)
      .query(`
        SELECT
          (SELECT COUNT_BIG(*) FROM dbo.official_feed_entry WHERE source_key=@sourceKey) AS totalEntries,
          (SELECT COUNT_BIG(*) FROM dbo.official_feed_snapshot s
             JOIN dbo.official_feed_entry e ON e.id=s.entry_id
             WHERE e.source_key=@sourceKey) AS totalSnapshots,
          (SELECT COUNT_BIG(*) FROM dbo.official_feed_snapshot s
             JOIN dbo.official_feed_entry e ON e.id=s.entry_id
             WHERE e.source_key=@sourceKey AND s.review_status=N'pending_review') AS pendingSnapshots,
          (SELECT MAX(last_seen_at) FROM dbo.official_feed_entry WHERE source_key=@sourceKey) AS lastSeenAt;
      `);
    return { sourceKey: SOURCE_KEY, ...(result.recordset[0] ?? {}),
      notice: 'RSS metadata inbox only; NOT legal verification or publication' };
  }

  async list(params: { page?: string; size?: string; q?: string }) {
    const p = queryParams(params);
    const result = await this.db.request()
      .input('sourceKey', sql.NVarChar(80), SOURCE_KEY)
      .input('needle', sql.NVarChar(230), p.needle)
      .input('offset', sql.Int, p.offset)
      .input('size', sql.Int, p.size)
      .query(`
        SELECT e.id AS entryId, e.canonical_url AS canonicalUrl,
               e.first_seen_at AS firstSeenAt, e.last_seen_at AS lastSeenAt,
               s.id AS snapshotId, s.title, s.description, s.published_at AS publishedAt,
               s.captured_at AS capturedAt, s.review_status AS reviewStatus,
               (SELECT COUNT_BIG(*) FROM dbo.official_feed_snapshot history
                 WHERE history.entry_id=e.id) AS snapshotCount,
               COUNT_BIG(*) OVER () AS totalCount
        FROM dbo.official_feed_entry e
        CROSS APPLY (
          SELECT TOP (1) lastSnap.id, lastSnap.title, lastSnap.description,
                 lastSnap.published_at, lastSnap.captured_at, lastSnap.review_status
          FROM dbo.official_feed_snapshot lastSnap WHERE lastSnap.entry_id=e.id
          ORDER BY lastSnap.captured_at DESC, lastSnap.id DESC
        ) s
        WHERE e.source_key=@sourceKey AND
              (s.title LIKE @needle ESCAPE N'~'
               OR e.canonical_url LIKE @needle ESCAPE N'~')
        ORDER BY e.last_seen_at DESC, e.id DESC
        OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY;
      `);
    return {
      page: p.page, pageSize: p.size,
      total: Number(result.recordset[0]?.totalCount ?? 0),
      items: result.recordset.map(({ totalCount, ...row }) => row),
    };
  }

  async history(rawId: string) {
    const id = entryId(rawId);
    const entry = await this.db.request()
      .input('id', sql.BigInt, id)
      .input('sourceKey', sql.NVarChar(80), SOURCE_KEY)
      .query(`SELECT id AS entryId, source_key AS sourceKey,
                      canonical_url AS canonicalUrl, first_seen_at AS firstSeenAt,
                      last_seen_at AS lastSeenAt
              FROM dbo.official_feed_entry WHERE id=@id AND source_key=@sourceKey;`);
    if (!entry.recordset.length) throw new NotFoundException('Entry not found');
    const snapshots = await this.db.request()
      .input('id', sql.BigInt, id)
      .query(`SELECT TOP (100) id AS snapshotId, title, description,
                     published_at AS publishedAt, captured_at AS capturedAt,
                     review_status AS reviewStatus
              FROM dbo.official_feed_snapshot
              WHERE entry_id=@id ORDER BY captured_at DESC, id DESC;`);
    return { entry: entry.recordset[0], snapshots: snapshots.recordset,
      notice: 'Most recent 100 metadata snapshots, not verified legal documents' };
  }
}
