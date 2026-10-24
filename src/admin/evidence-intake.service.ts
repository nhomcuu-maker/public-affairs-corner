import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { basename, join, resolve, sep } from 'node:path';
import * as sql from 'mssql';
import { DatabaseService } from '../database/database.service';
import type { Identity } from '../auth/auth.service';

// Server-side, local-file-only evidence intake. This does NOT verify sources, accept
// snapshots, approve knowledge or publish. A second human must verify the original.
const WRITERS = new Set(['author','editor','admin']);
const REVIEWERS = new Set(['reviewer','admin']);
const REVIEW_ROOT = resolve(process.cwd(), 'evidence', 'review');
const MAX_FILE = 25 * 1024 * 1024;
function versionId(v: string): number {
  if (!/^[1-9]\d{0,14}$/.test(v) || !Number.isSafeInteger(Number(v))) throw new BadRequestException('ID nội dung không hợp lệ');
  return Number(v);
}
function ident(v: unknown, name: string): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 1) throw new BadRequestException(`${name} không hợp lệ`);
  return v;
}
function string(v: unknown, name: string, min: number, max: number): string {
  if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max) throw new BadRequestException(`${name}: yêu cầu ${min}–${max} ký tự`);
  return v.trim();
}
function roles(actor: Identity, allowed: Set<string>): void {
  if (!actor.roles.some(r => allowed.has(r))) throw new ForbiddenException('Không đủ quyền thực hiện');
}
export function safeEvidenceName(raw: unknown): string {
  const name = string(raw, 'Tên tệp chứng cứ', 5, 150);
  if (name !== basename(name) || !/^[\p{L}\p{N}][\p{L}\p{N}_.() -]*\.(pdf|png|jpg|jpeg)$/iu.test(name) || name.includes('..')) {
    throw new BadRequestException('Chỉ chấp nhận tên tệp PDF/JPG/PNG trong evidence/review, không nhập đường dẫn');
  }
  return name;
}
async function checkedLocalFile(name: string): Promise<{ sha: Buffer; size: number; mime: string }> {
  let real: string;
  try { real = await fs.realpath(join(REVIEW_ROOT, name)); }
  catch { throw new BadRequestException('Không tìm thấy tệp chứng cứ trong evidence/review'); }
  // Reject traversal AND symbolic links that point outside the evidence folder.
  if (!real.startsWith(REVIEW_ROOT + sep)) throw new ForbiddenException('Tệp chứng cứ nằm ngoài thư mục cho phép');
  const st = await fs.stat(real);
  if (!st.isFile() || st.size < 100 || st.size > MAX_FILE) throw new BadRequestException('Tệp không hợp lệ hoặc lớn hơn 25 MB');
  const buf = await fs.readFile(real);
  const ext = name.toLowerCase().split('.').pop();
  const isPdf = ext === 'pdf' && buf.subarray(0, 5).toString('ascii') === '%PDF-';
  const isPng = ext === 'png' && buf.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isJpg = ['jpg','jpeg'].includes(ext ?? '') && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (!isPdf && !isPng && !isJpg) throw new BadRequestException('Định dạng thực tế không khớp đuôi PDF/JPG/PNG');
  return {sha:createHash('sha256').update(buf).digest(),size:buf.length,mime:isPdf?'application/pdf':isPng?'image/png':'image/jpeg'};
}
function checkOriginSource(url: string | null): void {
  if (!url) throw new BadRequestException('Nguồn chưa có URL chính thức');
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.username || u.password || ![
      'baohiemxahoi.gov.vn','congbao.chinhphu.vn','vanban.chinhphu.vn','vbpl.vn',
      'dichvucong.gov.vn','vpcp.dichvucong.gov.vn','datafiles.chinhphu.vn'
    ].includes(u.hostname.toLowerCase())) throw new Error('not allowlisted');
  } catch { throw new BadRequestException('Nguồn chưa thuộc danh sách website chính thức được phép'); }
}

@Injectable()
export class EvidenceIntakeService {
  constructor(private readonly db: DatabaseService) {}

  private async context(version: number) {
    const r=await this.db.request().input('v',sql.BigInt,version).query(`
      SELECT TOP(1) v.id,v.item_id AS itemId,v.editorial_status AS status,v.created_by AS createdBy,
        (SELECT TOP(1) m.actor_id FROM dbo.moderation_event m
         WHERE m.version_id=v.id AND m.action=N'submit' ORDER BY m.occurred_at DESC,m.id DESC) AS submittedBy
      FROM dbo.knowledge_version v
      JOIN dbo.knowledge_item i ON i.id=v.item_id AND i.deleted_at IS NULL WHERE v.id=@v;
    `);
    if (!r.recordset.length) throw new NotFoundException('Không tìm thấy bài viết');
    return r.recordset[0] as {itemId:number;status:string;createdBy:number;submittedBy:number|null};
  }

  async candidates(raw:string) {
    const version=versionId(raw);
    const c=await this.context(version);
    const r=await this.db.request().input('item',sql.BigInt,c.itemId).query(`
      SELECT src.id AS sourceId,src.title,src.canonical_url AS url,
             k.review_status AS reviewStatus,k.review_note AS reviewNote
      FROM dbo.knowledge_source_candidate k JOIN dbo.[source] src ON src.id=k.source_id
      WHERE k.item_id=@item AND src.archived_at IS NULL ORDER BY src.id;
    `);
    return {versionId:version,status:c.status,items:r.recordset,
      notice:'Nguồn tham khảo chưa phải chứng cứ xác minh. Đăng ký bản lưu trước, người khác kiểm tra sau.'};
  }

  async attach(raw:string, actor:Identity, body:Record<string,unknown>) {
    roles(actor,WRITERS);
    const version=versionId(raw), sourceId=ident(body.sourceId,'Nguồn');
    const name=safeEvidenceName(body.fileName);
    const reason=string(body.reason,'Biên bản tiếp nhận',30,900);
    const locator=string(body.locator,'Vị trí trích dẫn',4,400);
    const ctx=await this.context(version);
    if (!['draft','rejected'].includes(ctx.status)) throw new ConflictException('Chỉ được liên kết chứng cứ khi nội dung là draft/rejected');
    if (!actor.roles.some(r=>['editor','admin'].includes(r)) && actor.id!==ctx.createdBy)
      throw new ForbiddenException('Không có quyền biên tập bài viết này');
    const source=await this.db.request().input('item',sql.BigInt,ctx.itemId).input('source',sql.BigInt,sourceId).query(`
      SELECT TOP(1) src.canonical_url AS url
      FROM dbo.knowledge_source_candidate k JOIN dbo.[source] src ON src.id=k.source_id
      WHERE k.item_id=@item AND k.source_id=@source AND src.archived_at IS NULL;
    `);
    if (!source.recordset.length) throw new BadRequestException('Nguồn chưa được đề xuất cho bài viết này');
    const officialUrl=String(source.recordset[0].url ?? '');
    checkOriginSource(officialUrl);
    const checked=await checkedLocalFile(name);
    const key='evidence/review/'+name;
    // Every write is guarded, transactional and parameterized. Verification is deliberately absent.
    const r=await this.db.request()
      .input('v',sql.BigInt,version).input('item',sql.BigInt,ctx.itemId)
      .input('source',sql.BigInt,sourceId).input('actor',sql.BigInt,actor.id)
      .input('key',sql.NVarChar(500),key).input('hash',sql.VarBinary(32),checked.sha)
      .input('mime',sql.NVarChar(120),checked.mime).input('bytes',sql.BigInt,checked.size)
      .input('locator',sql.NVarChar(400),locator)
      .input('note',sql.NVarChar(1000),reason).query(`
        SET XACT_ABORT ON;
        BEGIN TRY
          BEGIN TRAN;
          DECLARE @status NVARCHAR(24),@actualItem BIGINT,@asset BIGINT,@snapshot BIGINT,@oldHash BINARY(32),@oldBytes BIGINT;
          SELECT @status=v.editorial_status,@actualItem=v.item_id
          FROM dbo.knowledge_version v WITH(UPDLOCK,HOLDLOCK) WHERE v.id=@v;
          IF @status NOT IN (N'draft',N'rejected') OR @actualItem<>@item THROW 59101,N'Phiên bản đã thay đổi; tải lại',1;
          IF NOT EXISTS(SELECT 1 FROM dbo.knowledge_source_candidate WHERE item_id=@item AND source_id=@source)
            THROW 59102,N'Nguồn không còn thuộc bài viết',1;
          SELECT TOP(1) @asset=id,@oldHash=sha256,@oldBytes=size_bytes
          FROM dbo.file_asset WITH(UPDLOCK,HOLDLOCK) WHERE storage_key=@key;
          IF @asset IS NOT NULL AND (@oldHash<>@hash OR @oldBytes<>@bytes)
            THROW 59103,N'Tệp trùng tên nhưng nội dung khác; đặt tên mới, giữ chứng cứ cũ',1;
          IF @asset IS NULL BEGIN
            INSERT dbo.file_asset(storage_key,sha256,mime_type,size_bytes,uploaded_at)
            VALUES(@key,@hash,@mime,@bytes,SYSUTCDATETIME());
            SET @asset=CONVERT(BIGINT,SCOPE_IDENTITY());
          END;
          SELECT TOP(1) @snapshot=id FROM dbo.source_snapshot WITH(UPDLOCK,HOLDLOCK)
          WHERE source_id=@source AND file_asset_id=@asset AND content_sha256=@hash ORDER BY id;
          IF @snapshot IS NULL BEGIN
            INSERT dbo.source_snapshot(source_id,captured_at,content_sha256,file_asset_id,captured_url,capture_method)
            VALUES(@source,SYSUTCDATETIME(),@hash,@asset,NULL,N'manual');
            SET @snapshot=CONVERT(BIGINT,SCOPE_IDENTITY());
          END;
          IF NOT EXISTS(SELECT 1 FROM dbo.knowledge_version_source WHERE version_id=@v AND snapshot_id=@snapshot)
            INSERT dbo.knowledge_version_source(version_id,snapshot_id,evidence_role,locator)
            VALUES(@v,@snapshot,N'supporting',@locator);
          INSERT dbo.moderation_event(version_id,actor_id,action,from_status,to_status,reason_note,occurred_at)
          VALUES(@v,@actor,N'evidence_attach',@status,@status,
            CONCAT(N'Chờ kiểm chứng; SHA256=',CONVERT(VARCHAR(64),@hash,2),N'; ',@note),SYSUTCDATETIME());
          COMMIT;
          SELECT @snapshot AS snapshotId;
        END TRY BEGIN CATCH
          IF @@TRANCOUNT>0 ROLLBACK;
          THROW;
        END CATCH;
      `);
    return {ok:true,snapshotId:r.recordset[0]?.snapshotId,
      sha256:checked.sha.toString('hex').toUpperCase(),sizeBytes:checked.size,
      verification:'PENDING_REVIEW',published:false};
  }

  async verify(raw:string, actor:Identity, body:Record<string,unknown>) {
    roles(actor,REVIEWERS);
    const version=versionId(raw),snapshot=ident(body.snapshotId,'Snapshot');
    const decision=string(body.decision,'Quyết định',7,20);
    if (!['accepted','rejected','needs_review'].includes(decision))
      throw new BadRequestException('Quyết định xác minh không hợp lệ');
    const note=string(body.reason,'Biên bản xác minh độc lập',80,900);
    if (body.checkedOriginal!==true || body.checkedHash!==true || body.checkedContent!==true || body.checkedCompleteness!==true)
      throw new BadRequestException('Phải trực tiếp kiểm tra URL chính thức, bản lưu, SHA-256 và tính đầy đủ');
    const ctx=await this.context(version);
    if(ctx.status!=='review') throw new ConflictException('Bài viết phải ở trạng thái review trước khi xác minh');
    if(ctx.createdBy===actor.id || ctx.submittedBy===actor.id)
      throw new ForbiddenException('Người biên tập/gửi duyệt không được tự xác minh');
    const result=await this.db.request().input('v',sql.BigInt,version).input('snapshot',sql.BigInt,snapshot).query(`
      SELECT TOP(1) fa.storage_key AS storageKey, fa.sha256 AS originalHash, fa.size_bytes AS sizeBytes,
        s.canonical_url AS officialUrl, ss.content_sha256 AS snapshotHash
      FROM dbo.knowledge_version_source ks
      JOIN dbo.source_snapshot ss ON ss.id=ks.snapshot_id
      JOIN dbo.[source] s ON s.id=ss.source_id
      JOIN dbo.file_asset fa ON fa.id=ss.file_asset_id
      WHERE ks.version_id=@v AND ks.snapshot_id=@snapshot;
    `);
    if (!result.recordset.length) throw new NotFoundException('Snapshot chưa liên kết bài viết');
    const f=result.recordset[0];
    checkOriginSource(f.officialUrl);
    if (typeof f.storageKey!=='string' || !/^evidence\/review\//.test(f.storageKey))
      throw new BadRequestException('Chỉ xác minh bản lưu đã tiếp nhận qua công cụ mới');
    const safeName=safeEvidenceName(f.storageKey.slice('evidence/review/'.length));
    const checked=await checkedLocalFile(safeName);
    if (!checked.sha.equals(Buffer.from(f.originalHash)) ||
        !checked.sha.equals(Buffer.from(f.snapshotHash)) || checked.size!==Number(f.sizeBytes))
      throw new ConflictException('SHA-256 bản lưu đã thay đổi; không được xác minh');
    const validUntil=string(body.validUntil,'Hạn xác minh',10,10);
    if (!/^\d{4}-\d\d-\d\d$/.test(validUntil) || !Number.isFinite(Date.parse(validUntil+'T00:00:00Z')) || new Date(validUntil+'T00:00:00Z').toISOString().slice(0,10)!==validUntil)
      throw new BadRequestException('Hạn xác minh phải là YYYY-MM-DD');
    const day=Date.parse(validUntil+'T00:00:00Z');
    const max=Date.now()+366*86400000;
    if(!Number.isFinite(day)||day<=Date.now()+86400000||day>max)
      throw new BadRequestException('Hạn đối chiếu phải từ ngày mai đến tối đa 366 ngày');
    await this.db.request().input('v',sql.BigInt,version).input('snapshot',sql.BigInt,snapshot)
      .input('actor',sql.BigInt,actor.id).input('decision',sql.NVarChar(20),decision)
      .input('note',sql.NVarChar(1000),note).input('until',sql.Date,validUntil)
      .input('hash',sql.VarBinary(32),checked.sha).query(`
      SET XACT_ABORT ON;
      BEGIN TRY
        BEGIN TRAN;
        DECLARE @author BIGINT,@submitter BIGINT,@status NVARCHAR(24);
        SELECT @author=created_by,@status=editorial_status
          FROM dbo.knowledge_version WITH(UPDLOCK,HOLDLOCK) WHERE id=@v;
        SELECT TOP(1) @submitter=actor_id FROM dbo.moderation_event
          WHERE version_id=@v AND action=N'submit' ORDER BY occurred_at DESC,id DESC;
        IF @status<>N'review' OR @author=@actor OR @submitter=@actor
          THROW 59111,N'Không đủ điều kiện xác minh độc lập',1;
        IF EXISTS(SELECT 1 FROM dbo.moderation_event
          WHERE version_id=@v AND action=N'evidence_attach' AND actor_id=@actor)
          THROW 59112,N'Người đã tiếp nhận chứng cứ không được tự xác minh',1;
        IF NOT EXISTS (SELECT 1 FROM dbo.user_role ur JOIN dbo.role r ON r.id=ur.role_id
          JOIN dbo.app_user u ON u.id=ur.user_id
          WHERE ur.user_id=@actor AND r.role_code IN(N'reviewer',N'admin') AND u.account_status=N'active')
          THROW 59113,N'Thiếu quyền kiểm duyệt',1;
        IF NOT EXISTS(SELECT 1 FROM dbo.knowledge_version_source kvs
          JOIN dbo.source_snapshot ss ON ss.id=kvs.snapshot_id
          WHERE kvs.version_id=@v AND kvs.snapshot_id=@snapshot AND ss.content_sha256=@hash)
          THROW 59114,N'Bản lưu không còn khớp',1;
        IF EXISTS (SELECT 1 FROM dbo.source_verification WITH(UPDLOCK,HOLDLOCK)
          WHERE source_snapshot_id=@snapshot AND reviewer_id=@actor AND decision=@decision
            AND verified_at>DATEADD(MINUTE,-1,SYSUTCDATETIME()))
          THROW 59115,N'Người kiểm duyệt đã ghi quyết định cùng loại cho snapshot này',1;
        INSERT dbo.source_verification(source_snapshot_id,reviewer_id,decision,evidence_note,verified_at,valid_until)
        VALUES(@snapshot,@actor,@decision,@note,SYSUTCDATETIME(),CONVERT(DATETIME2(3),@until));
        INSERT dbo.moderation_event(version_id,actor_id,action,from_status,to_status,reason_note,occurred_at)
        VALUES(@v,@actor,N'evidence_check',N'review',N'review',
          CONCAT(@decision,N': ',@note),SYSUTCDATETIME());
        COMMIT;
      END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
    `);
    return {ok:true,snapshotId:snapshot,decision,notice:'Kết quả xác minh được ghi lịch sử; không tự phê duyệt hoặc công bố'};
  }
}
