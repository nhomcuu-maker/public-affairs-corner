import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import * as sql from 'mssql';
import { DatabaseService } from '../database/database.service';
import { safeMetrics, validateFeedback } from './feedback.logic';
import type { Identity } from '../auth/auth.service';

const VALID_MS=45*60*1000;
@Injectable()
export class FeedbackService {
  // Ephemeral signing key: receipts expire after restart; no env secret or stored raw questions.
  private readonly secret=randomBytes(32);
  constructor(private readonly db:DatabaseService) {}
  issue(answer:Record<string,unknown>):string {
    const data={...safeMetrics(answer),issued:Date.now(),nonce:randomBytes(18).toString('base64url')};
    const encoded=Buffer.from(JSON.stringify(data),'utf8').toString('base64url');
    const signature=createHmac('sha256',this.secret).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
  }
  private verify(receipt:string):{scope:string;intent:string;status:string;count:number} {
    const parts=receipt.split('.');
    if(parts.length!==2||parts[1].length!==43)throw new BadRequestException('Mã phản hồi không hợp lệ.');
    const expected=createHmac('sha256',this.secret).update(parts[0]).digest();
    const signature=Buffer.from(parts[1],'base64url');
    if(expected.length!==signature.length||!timingSafeEqual(expected,signature))throw new BadRequestException('Mã phản hồi không hợp lệ.');
    let data:any;
    try{data=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));}catch{throw new BadRequestException('Mã phản hồi không hợp lệ.');}
    if(!data||!Number.isSafeInteger(data.issued)||data.issued>Date.now()+60000||Date.now()-data.issued>VALID_MS)
      throw new BadRequestException('Mã phản hồi hết hạn. Hãy hỏi lại để đánh giá.');
    if(!['public','staff'].includes(data.scope)||!['SAFETY','BENEFIT','PROCEDURE','GENERAL'].includes(data.intent)||
       !['AI_GENERATED','RETRIEVAL_ONLY','PROVIDER_UNAVAILABLE','INSUFFICIENT_EVIDENCE'].includes(data.status)||
       !Number.isInteger(data.count)||data.count<0||data.count>9||typeof data.nonce!=='string'||data.nonce.length<20)
      throw new BadRequestException('Mã phản hồi không hợp lệ.');
    return {scope:data.scope,intent:data.intent,status:data.status,count:data.count};
  }
  async submit(payload:unknown) {
    let form;
    try{form=validateFeedback(payload);}catch(e){throw new BadRequestException((e as Error).message);}
    const metadata=this.verify(form.receipt);
    const digest=createHash('sha256').update(form.receipt).digest();
    try{
      await this.db.request().input('digest',sql.VarBinary(32),digest)
        .input('vote',sql.NVarChar(16),form.vote)
        .input('reason',sql.NVarChar(30),form.reason)
        .input('scope',sql.NVarChar(12),metadata.scope)
        .input('intent',sql.NVarChar(16),metadata.intent)
        .input('status',sql.NVarChar(32),metadata.status)
        .input('count',sql.SmallInt,metadata.count)
        .query(`INSERT dbo.assistant_feedback (receipt_sha256,vote,reason_kind,answer_scope,answer_status,intent,source_count,created_at,review_status)
          VALUES(@digest,@vote,@reason,@scope,@status,@intent,@count,SYSUTCDATETIME(),N'pending');`);
    }catch(err){
      if(/2601|2627|duplicate|unique/i.test(String((err as Error).message)))throw new ConflictException('Phản hồi này đã được gửi.');
      throw err;
    }
    return {ok:true,message:'Đã tiếp nhận đánh giá. Cảm ơn bạn đã giúp cải thiện hệ thống.'};
  }
  async overview(){
    const stats=await this.db.request().query(`SELECT vote,reason_kind AS reason,COUNT(*) AS total FROM dbo.assistant_feedback GROUP BY vote,reason_kind ORDER BY total DESC;`);
    const items=await this.db.request().query(`SELECT TOP(60) id,vote,reason_kind AS reason,answer_scope AS scope,answer_status AS answerStatus,
       intent,source_count AS sourceCount,created_at AS createdAt,review_status AS reviewStatus,reviewed_at AS reviewedAt
       FROM dbo.assistant_feedback ORDER BY id DESC;`);
    return {stats:stats.recordset,items:items.recordset,privacy:'Không lưu nội dung câu hỏi, câu trả lời, IP, email hoặc mã OTP.'};
  }
  async markReviewed(id:string,actor:Identity){
    if(!/^[1-9]\d{0,14}$/.test(id))throw new BadRequestException('Mã phản hồi không hợp lệ.');
    if(!actor.roles.some(x=>x==='admin'||x==='reviewer'))throw new ForbiddenException('Chỉ Admin/Reviewer được đánh dấu đã xem xét.');
    const response=await this.db.request().input('id',sql.BigInt,id).input('reviewer',sql.BigInt,actor.id)
      .query(`UPDATE dbo.assistant_feedback SET review_status=N'reviewed',reviewed_by=@reviewer,reviewed_at=SYSUTCDATETIME()
        WHERE id=@id AND review_status=N'pending'; SELECT @@ROWCOUNT AS changed;`);
    if(Number(response.recordset[0]?.changed)!==1)throw new NotFoundException('Không tìm thấy phản hồi đang chờ xử lý.');
    return {ok:true,message:'Đã đánh dấu phản hồi được xem xét.'};
  }
}
