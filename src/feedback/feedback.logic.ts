// Feedback contains no user question, answer, IP address, e-mail or free text.
export type Vote='helpful'|'not_helpful';
export type Reason='none'|'incorrect'|'outdated'|'missing_source'|'unclear'|'unsafe'|'other';
export type FeedbackPayload={receipt:string;vote:Vote;reason:Reason};
export function validateFeedback(value:unknown):FeedbackPayload {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Phản hồi không hợp lệ.');
  const x=value as Record<string,unknown>;
  const receipt=x.receipt, vote=x.vote, reason=x.reason;
  if(typeof receipt!=='string'||receipt.length<40||receipt.length>900||!/^[a-zA-Z0-9_.-]+$/.test(receipt))throw new Error('Mã phản hồi không hợp lệ.');
  if(vote!=='helpful'&&vote!=='not_helpful')throw new Error('Vui lòng chọn đánh giá.');
  if(!['none','incorrect','outdated','missing_source','unclear','unsafe','other'].includes(String(reason))) throw new Error('Lý do không hợp lệ.');
  if(vote==='helpful'&&reason!=='none')throw new Error('Đánh giá hữu ích không yêu cầu lý do.');
  if(vote==='not_helpful'&&reason==='none')throw new Error('Vui lòng chọn lý do cần cải thiện.');
  return {receipt,vote,reason:reason as Reason};
}
export function safeMetrics(value:Record<string,unknown>) {
  const scope=value.mode==='STAFF_DRAFT_PREVIEW'?'staff':'public';
  const intent=['SAFETY','BENEFIT','PROCEDURE','GENERAL'].includes(String(value.intent))?String(value.intent):'GENERAL';
  const status=['AI_GENERATED','RETRIEVAL_ONLY','PROVIDER_UNAVAILABLE','INSUFFICIENT_EVIDENCE'].includes(String(value.status))?String(value.status):'INSUFFICIENT_EVIDENCE';
  const count=Array.isArray(value.evidence)?Math.min(9,value.evidence.length):0;
  return {scope,intent,status,count};
}
