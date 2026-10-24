import {
  BadRequestException, ConflictException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from '../database/database.service';
import type { Identity } from '../auth/auth.service';

const WRITERS = new Set(['author', 'editor', 'admin']);
const REVIEWERS = new Set(['reviewer', 'admin']);
const PUBLISHERS = new Set(['publisher', 'admin']);

function idOf(raw: string): number {
  if (!/^[1-9]\d{0,14}$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw new BadRequestException('ID phiên bản không hợp lệ');
  }
  return Number(raw);
}
function text(value: unknown, max: number, label: string, min = 1): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new BadRequestException(`${label}: cần từ ${min} đến ${max} ký tự`);
  }
  return value.trim();
}
function date(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) {
    throw new BadRequestException('Ngày áp dụng phải có định dạng YYYY-MM-DD hợp lệ');
  }
  return value;
}
function hasRole(actor: Identity, roles: Set<string>) { return actor.roles.some(role => roles.has(role)); }
function needRole(actor: Identity, roles: Set<string>) {
  if (!hasRole(actor, roles)) throw new ForbiddenException('Vai trò của bạn không được thực hiện thao tác này');
}
function samePeople(actor: Identity, createdBy: number | null, submittedBy: number | null) {
  if (actor.id === createdBy || actor.id === submittedBy) {
    throw new ForbiddenException('Người tạo hoặc gửi duyệt không được tự kiểm duyệt nội dung');
  }
}

@Injectable()
export class WorkflowService {
  constructor(private readonly db: DatabaseService) {}

  private async meta(id: number) {
    const r = await this.db.request().input('id', sql.BigInt, id).query(`
      SELECT TOP (1) v.id, v.created_by AS createdBy,
        v.editorial_status AS status, v.approved_by AS approvedBy,
        i.business_code AS businessCode,
        (SELECT TOP (1) m.actor_id FROM dbo.moderation_event m
          WHERE m.version_id=v.id AND m.action=N'submit'
          ORDER BY m.occurred_at DESC, m.id DESC) AS submittedBy
      FROM dbo.knowledge_version v
      JOIN dbo.knowledge_item i ON i.id=v.item_id AND i.deleted_at IS NULL
      WHERE v.id=@id;
    `);
    if (!r.recordset.length) throw new NotFoundException('Không tìm thấy phiên bản nội dung');
    return r.recordset[0] as {
      createdBy: number | null; status: string; approvedBy: number | null;
      businessCode: string; submittedBy: number | null;
    };
  }

  // Preserve the user's existing draft, its evidence links and subtype metadata.
  // Editing only affects 4 header fields and recalculates the body SHA-256 in SQL.
  async saveDraft(raw: string, actor: Identity, body: Record<string, unknown>) {
    needRole(actor, WRITERS);
    const id = idOf(raw);
    const title = text(body.title, 300, 'Tiêu đề', 3);
    const summary = text(body.summary, 1600, 'Tóm tắt', 10);
    const markdown = text(body.bodyMarkdown, 50000, 'Nội dung', 10);
    const effectiveFrom = date(body.effectiveFrom);
    const original = await this.meta(id);
    if (original.status !== 'draft' && original.status !== 'rejected') {
      throw new ConflictException('Chỉ được chỉnh sửa phiên bản draft hoặc rejected');
    }
    if (!hasRole(actor, new Set(['editor','admin'])) && actor.id !== original.createdBy) {
      throw new ForbiddenException('Chỉ tác giả hoặc biên tập viên có quyền sửa');
    }
    const r = await this.db.request()
      .input('id', sql.BigInt, id)
      .input('actor', sql.BigInt, actor.id)
      .input('title', sql.NVarChar(300), title)
      .input('summary', sql.NVarChar(1600), summary)
      .input('body', sql.NVarChar(sql.MAX), markdown)
      .input('effectiveFrom', sql.Date, effectiveFrom)
      .query(`
        SET XACT_ABORT ON;
        BEGIN TRY
          BEGIN TRAN;
          DECLARE @old NVARCHAR(24);
          SELECT @old=editorial_status FROM dbo.knowledge_version WITH (UPDLOCK,HOLDLOCK) WHERE id=@id;
          IF @old NOT IN (N'draft',N'rejected') OR @old IS NULL
            THROW 58501,N'Phiên bản đã thay đổi trạng thái; vui lòng tải lại',1;
          UPDATE dbo.knowledge_version
          SET title=@title,summary=@summary,body_markdown=@body,
              effective_from=@effectiveFrom,
              content_sha256=HASHBYTES('SHA2_256',CONVERT(VARBINARY(MAX),@body)),
              editorial_status=N'draft'
          WHERE id=@id;
          INSERT dbo.moderation_event(version_id,actor_id,action,from_status,to_status,reason_note,occurred_at)
          VALUES (@id,@actor,CASE WHEN @old=N'rejected' THEN N'revise' ELSE N'edit' END,
                  @old,N'draft',N'Chỉnh sửa nội dung bản nháp',SYSUTCDATETIME());
          COMMIT TRAN;
          SELECT 1 AS ok;
        END TRY BEGIN CATCH
          IF @@TRANCOUNT>0 ROLLBACK TRAN;
          THROW;
        END CATCH;
      `);
    return { ok: !!r.recordset[0]?.ok, status: 'draft', versionId: id };
  }

  async submit(raw: string, actor: Identity, body: Record<string,unknown>) {
    needRole(actor, WRITERS);
    const id = idOf(raw);
    const note = text(body.reason, 1000, 'Ghi chú gửi duyệt', 15);
    const original = await this.meta(id);
    if (!hasRole(actor, new Set(['editor','admin'])) && actor.id !== original.createdBy) {
      throw new ForbiddenException('Bạn không được gửi duyệt phiên bản của tác giả khác');
    }
    if (original.status !== 'draft') throw new ConflictException('Chỉ bản draft mới được gửi duyệt');
    await this.db.request().input('id',sql.BigInt,id).input('actor',sql.BigInt,actor.id)
      .input('note',sql.NVarChar(1000),note).query(`
        SET XACT_ABORT ON;
        BEGIN TRY
          BEGIN TRAN;
          DECLARE @status NVARCHAR(24),@title NVARCHAR(300),@body NVARCHAR(MAX);
          SELECT @status=editorial_status,@title=title,@body=body_markdown
          FROM dbo.knowledge_version WITH (UPDLOCK,HOLDLOCK) WHERE id=@id;
          IF @status IS NULL OR @status<>N'draft' THROW 58502,N'Chỉ bản nháp mới được gửi duyệt',1;
          IF LEN(LTRIM(RTRIM(@title)))<3 OR LEN(LTRIM(RTRIM(@body)))<10
            THROW 58503,N'Nội dung thiếu tiêu đề hoặc phần trình bày',1;
          UPDATE dbo.knowledge_version SET editorial_status=N'review' WHERE id=@id AND editorial_status=N'draft';
          IF @@ROWCOUNT<>1 THROW 58504,N'Trạng thái bị thay đổi đồng thời',1;
          INSERT dbo.moderation_event(version_id,actor_id,action,from_status,to_status,reason_note,occurred_at)
          VALUES(@id,@actor,N'submit',N'draft',N'review',@note,SYSUTCDATETIME());
          COMMIT TRAN;
        END TRY BEGIN CATCH
          IF @@TRANCOUNT>0 ROLLBACK TRAN;
          THROW;
        END CATCH;
      `);
    return { ok:true, status:'review', versionId:id };
  }

  async reject(raw: string, actor: Identity, body: Record<string, unknown>) {
    needRole(actor, REVIEWERS);
    const id = idOf(raw);
    const reason = text(body.reason, 1000, 'Lý do trả lại', 20);
    const m = await this.meta(id);
    if (m.status !== 'review' || m.submittedBy === null) throw new ConflictException('Phải có lịch sử gửi duyệt hợp lệ');
    samePeople(actor, m.createdBy, m.submittedBy);
    await this.db.request().input('id',sql.BigInt,id).input('actor',sql.BigInt,actor.id)
      .input('note',sql.NVarChar(1000),reason).query(`
        SET XACT_ABORT ON;
        BEGIN TRY
          BEGIN TRAN;
          DECLARE @creator BIGINT,@submitter BIGINT,@status NVARCHAR(24);
          SELECT @creator=created_by,@status=editorial_status FROM dbo.knowledge_version WITH (UPDLOCK,HOLDLOCK) WHERE id=@id;
          SELECT TOP(1) @submitter=actor_id FROM dbo.moderation_event
            WHERE version_id=@id AND action=N'submit' ORDER BY occurred_at DESC,id DESC;
          IF @status IS NULL OR @status<>N'review' THROW 58505,N'Phiên bản không còn ở trạng thái review',1;
          IF @creator=@actor OR @submitter=@actor THROW 58506,N'Không được tự kiểm duyệt',1;
          UPDATE dbo.knowledge_version SET editorial_status=N'rejected' WHERE id=@id AND editorial_status=N'review';
          IF @@ROWCOUNT<>1 THROW 58507,N'Xung đột trạng thái',1;
          INSERT dbo.moderation_event(version_id,actor_id,action,from_status,to_status,reason_note,occurred_at)
          VALUES(@id,@actor,N'reject',N'review',N'rejected',@note,SYSUTCDATETIME());
          COMMIT TRAN;
        END TRY BEGIN CATCH
          IF @@TRANCOUNT>0 ROLLBACK TRAN;
          THROW;
        END CATCH;
      `);
    return { ok:true,status:'rejected',versionId:id };
  }

  async approve(raw: string, actor: Identity, body: Record<string,unknown>) {
    needRole(actor, REVIEWERS);
    const id = idOf(raw);
    const note = text(body.reason, 1000, 'Biên bản đối chiếu', 30);
    if (body.verifiedLegal !== true || body.verifiedEvidence !== true) {
      throw new BadRequestException('Phải xác nhận đã đối chiếu căn cứ pháp lý và chứng cứ gốc');
    }
    const m = await this.meta(id);
    if (m.status !== 'review' || m.submittedBy === null) throw new ConflictException('Phải có lịch sử gửi duyệt hợp lệ');
    samePeople(actor, m.createdBy, m.submittedBy);
    // Core SQL stored procedure performs snapshot/trust checks, scope, author separation
    // and the immutable moderation event; never replace it with a direct UPDATE.
    await this.db.request().input('id',sql.BigInt,id).input('actor',sql.BigInt,actor.id)
      .input('note',sql.NVarChar(1000),note).query(`
        SET XACT_ABORT ON;
        BEGIN TRY
          BEGIN TRAN;
          DECLARE @submitter BIGINT;
          SELECT TOP(1) @submitter=actor_id FROM dbo.moderation_event WITH (HOLDLOCK)
            WHERE version_id=@id AND action=N'submit' ORDER BY occurred_at DESC,id DESC;
          IF @submitter IS NULL THROW 58512,N'Khong co lich su gui duyet',1;
          IF @submitter=@actor THROW 58508,N'Người gửi duyệt không được tự phê duyệt',1;
          EXEC dbo.usp_approve_knowledge_version
            @version_id=@id,@reviewer_user_id=@actor,@reason_note=@note;
          COMMIT TRAN;
        END TRY BEGIN CATCH
          IF @@TRANCOUNT>0 ROLLBACK TRAN;
          THROW;
        END CATCH;
      `);
    return {ok:true,status:'approved',versionId:id};
  }

  async publish(raw: string, actor: Identity, body: Record<string,unknown>) {
    needRole(actor, PUBLISHERS);
    const id = idOf(raw);
    const reason = text(body.reason, 1000, 'Xác nhận phát hành', 30);
    if (body.verifiedLegal !== true || body.verifiedEvidence !== true || body.publishConfirm !== 'CONG_BO') {
      throw new BadRequestException('Cần kiểm chứng nguồn, căn cứ và gõ chính xác CONG_BO');
    }
    const m = await this.meta(id);
    if (m.status !== 'approved' || m.submittedBy === null) throw new ConflictException('Chỉ phiên bản có lịch sử gửi duyệt và đã approved mới được công bố');
    if (m.approvedBy === actor.id || m.createdBy === actor.id || m.submittedBy === actor.id) {
      throw new ForbiddenException('Người công bố phải khác người tạo, gửi duyệt và phê duyệt');
    }
    // The *existing* SQL stored proc revalidates eligible evidence, scope,
    // effective date, overlap, publisher permissions and publication chronology.
    await this.db.request().input('id',sql.BigInt,id).input('actor',sql.BigInt,actor.id)
      .input('note',sql.NVarChar(1000),reason).query(`
        SET XACT_ABORT ON;
        BEGIN TRY
          BEGIN TRAN;
          DECLARE @creator BIGINT,@approver BIGINT,@submitter BIGINT,@status NVARCHAR(24);
          SELECT @creator=created_by,@approver=approved_by,@status=editorial_status
          FROM dbo.knowledge_version WITH (UPDLOCK,HOLDLOCK) WHERE id=@id;
          SELECT TOP(1) @submitter=actor_id FROM dbo.moderation_event WITH (HOLDLOCK)
            WHERE version_id=@id AND action=N'submit' ORDER BY occurred_at DESC,id DESC;
          IF @status IS NULL OR @status<>N'approved' THROW 58509,N'Phiên bản chưa approved',1;
          IF @submitter IS NULL THROW 58513,N'Khong co lich su gui duyet',1;
          IF @creator=@actor OR @approver=@actor OR @submitter=@actor
            THROW 58510,N'Người công bố phải độc lập với người tạo/gửi/phê duyệt',1;
          EXEC dbo.usp_publish_knowledge_version @version_id=@id,@publisher_user_id=@actor;
          INSERT dbo.moderation_event(version_id,actor_id,action,from_status,to_status,reason_note,occurred_at)
          VALUES (@id,@actor,N'publish_note',N'published',N'published',@note,SYSUTCDATETIME());
          COMMIT TRAN;
        END TRY BEGIN CATCH
          IF @@TRANCOUNT>0 ROLLBACK TRAN;
          THROW;
        END CATCH;
      `);
    return {ok:true,status:'published',versionId:id};
  }
}
