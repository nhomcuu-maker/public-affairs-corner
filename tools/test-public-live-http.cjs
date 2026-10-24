'use strict';
// Read-only local acceptance checks; no credentials, no mutations.
const base = 'http://127.0.0.1:3001';
const timeout = 8000;
async function request(route, init={}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(base + route, { ...init, redirect:'manual', signal:controller.signal, headers: { 'Accept':'application/json', ...(init.headers || {}) } });
    const data = await response.json().catch(() => null);
    return { response, data };
  } finally { clearTimeout(t); }
}
async function main() {
  try {
    const status = await request('/api/health');
    if(status.response.status !== 200 || status.data?.db !== 'connected') throw Error('API health/SQL Server chưa kết nối');
    console.log('PASS SQL: /api/health');
    const provinces = await request('/api/locations/provinces');
    if(provinces.response.status !== 200 || !Array.isArray(provinces.data?.provinces) || provinces.data.provinces.length!==34) throw Error('API địa phương chưa trả đủ 34 tỉnh/thành');
    console.log('PASS LOCATION: 34 tỉnh/thành');
    let total=0;
    for(const domain of ['LEGAL','ADMIN','SCAM']) {
      const r=await request('/api/content?domain='+domain);
      if(r.response.status!==200 || !Array.isArray(r.data)) throw Error('API công khai '+domain+' bị lỗi HTTP '+r.response.status);
      console.log('PASS PUBLIC '+domain+': '+r.data.length+' nội dung đã công bố (trong giới hạn API)');
      total += r.data.length;
    }
    const procedures = await request('/api/procedures?provinceCode=01');
    if(procedures.response.status!==200 || !Array.isArray(procedures.data)) throw Error('API thủ tục theo tỉnh chưa hoạt động');
    console.log('PASS PROCEDURES: '+procedures.data.length+' nội dung công khai cho Hà Nội');
    const search = await request('/api/search?q=tro%20cap%20that%20nghiep&domain=ALL&limit=5');
    if(search.response.status!==200 || search.data?.mode!=='PUBLISHED_ONLY' || !Array.isArray(search.data.results)) throw Error('API tìm kiếm công khai chưa hoạt động');
    console.log('PASS SEARCH: '+search.data.results.length+' kết quả; published-only');
    const protectedApi = await request('/api/admin/overview');
    if(![401,403].includes(protectedApi.response.status)) throw Error('API admin không chặn người chưa đăng nhập (status='+protectedApi.response.status+')');
    console.log('PASS ADMIN GUARD: HTTP '+protectedApi.response.status);
    const assistant = await request('/api/assistant/ask', {
      method:'POST', headers: {'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({question:'Điều kiện hưởng trợ cấp thất nghiệp là gì?',domain:'LEGAL'})
    });
    if(assistant.response.status!==201 && assistant.response.status!==200) {
      const message = assistant.data?.message;
      const detail = Array.isArray(message) ? message.join('; ') : typeof message==='string' ? message : 'không có thông báo lỗi';
      throw Error('Trợ lý công khai lỗi HTTP '+assistant.response.status+': '+detail.slice(0,300));
    }
    if(!['INSUFFICIENT_EVIDENCE','RETRIEVAL_ONLY','AI_GENERATED','PROVIDER_UNAVAILABLE'].includes(assistant.data?.status)) throw Error('Trợ lý trả trạng thái không hợp lệ');
    if(assistant.data?.mode!=='PUBLISHED_ONLY') throw Error('Trợ lý không chạy ở chế độ published-only');
    console.log('PASS ASSISTANT: '+assistant.data.status+'; published-only');
    console.log(total > 0 ? 'PUBLIC CONTENT READY: '+total+' kết quả (giới hạn từng API). Cần kiểm tra độ chính xác từng nguồn trước khi sử dụng.' : 'PUBLIC CONTENT PENDING: 0 nội dung đã phát hành. Đây KHÔNG phải lỗi server; nguồn nháp chưa đủ điều kiện duyệt.');
    console.log('LOCAL PUBLIC API SMOKE: PASS, no SQL writes');
  } catch(e) {
    console.error('LOCAL PUBLIC API SMOKE: FAIL: '+(e?.message || String(e)));
    console.error('Nếu báo fetch failed: kiểm tra backend 3001. Nếu API trả HTTP 4xx/5xx: xem thông báo chi tiết ở dòng trên.');
    process.exitCode=1;
  }
}
void main();
