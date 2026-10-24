(() => {
  'use strict';
  const ROLES = new Set(['author','editor','reviewer','publisher','admin']);
  const el = id => document.getElementById(id);
  const state = { page:1, total:0, loading:false, actor:null, current:null };
  function txt(value) { return value === null || value === undefined ? '' : String(value); }
  function element(tag, text, cls) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = txt(text);
    if (cls) node.className = cls;
    return node;
  }
  function add(parent, tag, value, cls) { const node=element(tag,value,cls);parent.append(node);return node; }
  async function call(path, init) {
    const res = await fetch(path, { credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},...init });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) {
      const message = Array.isArray(data.message)?data.message.join('; '):data.message;
      const error = new Error(message || `HTTP ${res.status}`); error.status=res.status; throw error;
    }
    return data;
  }
  function showError(node,error) { node.replaceChildren(element('div',error.message||String(error),'error')); }
  function section(container,title,value) {
    if (value===undefined || value===null || value==='') return;
    add(container,'h3',title);
    add(container,'p',value);
  }
  function entries(container,title,items,render) {
    add(container,'h3',title + ' (' + items.length + ')');
    if (!items.length) { add(container,'p','Chưa có dữ liệu liên kết.','muted'); return; }
    const list=add(container,'div',undefined,'detail-list');
    items.forEach(item => {const entry=add(list,'div',undefined,'detail-entry');render(entry,item);});
  }
  function link(parent,url,label) {
    if (!/^https?:\/\//i.test(txt(url))) return;
    const a=add(parent,'a',label);a.href=url;a.rel='noopener noreferrer';a.target='_blank';
  }
  function renderDetails(d) {
    state.current=d; renderWorkflow(d);
    const root=el('details');root.replaceChildren();
    el('detailId').textContent='#'+d.versionId;
    section(root,'Tên nội dung',d.title);
    const meta=add(root,'p');meta.append(element('strong','Mã nghiệp vụ: '),element('span',d.businessCode+' · '+d.domainCode+' · '+d.editorialStatus));
    section(root,'Tóm tắt',d.summary);
    if (d.bodyMarkdown) {add(root,'h3','Nội dung gốc (Markdown)');add(root,'pre',d.bodyMarkdown);}
    if(d.procedure){
      section(root,'Mã thủ tục',d.procedure.procedureCode);
      section(root,'Đối tượng',d.procedure.eligibilityNote);
      section(root,'Thời gian',d.procedure.processingTime);
      section(root,'Kết quả',d.procedure.resultDescription);
      entries(root,'Các bước',d.steps??[],(e,x)=>{add(e,'strong',`Bước ${x.stepNo}: ${x.title}`);add(e,'p',x.instruction);});
      entries(root,'Thành phần hồ sơ',d.requirements??[],(e,x)=>{add(e,'strong',`${x.requirementNo}. ${x.documentName}`);add(e,'p',`Số lượng: ${x.quantity} · Bắt buộc: ${x.isRequired?'Có':'Không'}`);add(e,'p',x.conditionNote);});
      entries(root,'Lệ phí',d.fees??[],(e,x)=>{add(e,'strong',`${x.feeKind}: ${x.amount} ${x.currency}`);add(e,'p',x.pricingRule);});
      entries(root,'Nơi tiếp nhận',d.offices??[],(e,x)=>{add(e,'strong',x.organizationName);add(e,'p',[x.officeRole,x.submissionChannel,x.instructions].filter(Boolean).join(' · '));});
    }
    if(d.benefit){section(root,'Đối tượng thụ hưởng',d.benefit.beneficiaryGroup);section(root,'Quyền lợi',d.benefit.entitlementText);section(root,'Cách thực hiện',d.benefit.claimGuidance);}
    if(d.conditions)entries(root,'Điều kiện',d.conditions,(e,x)=>{add(e,'strong',`Điều kiện ${x.conditionNo}`);add(e,'p',x.conditionText);});
    if(d.scam){section(root,'Mức cảnh báo',d.scam.severity);section(root,'Thủ đoạn',d.scam.mechanism);section(root,'Dấu hiệu',d.scam.warningSigns);section(root,'Xử lý ngay',d.scam.immediateActions);section(root,'Cách báo cáo',d.scam.reportingGuidance);}
    if(d.indicators)entries(root,'Chỉ dấu',d.indicators,(e,x)=>{add(e,'strong',`Dấu hiệu ${x.indicatorNo}`);add(e,'p',x.description);});
    entries(root,'Căn cứ pháp lý',d.legalBases??[],(e,x)=>{add(e,'strong',x.documentNumber+' — '+x.title);add(e,'p',[x.basisRole,x.statusNote].filter(Boolean).join(' · '));});
    entries(root,'Chứng cứ và nguồn',d.evidence??[],(e,x)=>{add(e,'strong',x.sourceTitle+' · Snapshot #'+x.snapshotId);add(e,'p',[x.evidenceRole,x.locator,x.storageKey].filter(Boolean).join(' · '));if(x.snapshotSha256)add(e,'p','SHA-256: '+x.snapshotSha256,'muted');add(e,'p',(x.isVerified===true||x.isVerified===1)?'ĐÃ CÓ XÁC MINH HIỆU LỰC trong CSDL':'CHƯA CÓ XÁC MINH HỢP LỆ trong CSDL (không được coi là nguồn đã kiểm chứng)',(x.isVerified===true||x.isVerified===1)?'verified-note':'error');link(e,x.sourceUrl,'Mở nguồn chính thức ↗');});
    entries(root,'Lịch sử kiểm duyệt',d.history??[],(e,x)=>{add(e,'strong',x.action+' · '+x.fromStatus+' → '+x.toStatus);add(e,'p',[x.actorName,x.reasonNote,x.occurredAt].filter(Boolean).join(' · '));});
    section(root,'Cảnh báo',d.notice);
  }
  async function detail(id){
    const panel=el('detailPanel');panel.hidden=false;el('detailId').textContent='#'+id;
    el('details').textContent='Đang tải chi tiết...';panel.scrollIntoView({behavior:'smooth',block:'start'});
    try {renderDetails(await call('/api/admin/content/'+encodeURIComponent(id)));}
    catch(err){showError(el('details'),err);}
  }
  async function overview(){
    const box=el('overview');box.textContent='Đang tải...';
    try{
      const data=await call('/api/admin/overview');box.replaceChildren();
      ['LEGAL','ADMIN','SCAM'].forEach(domain=>{
        const rows=data.rows.filter(r=>r.domainCode===domain);
        const sum=rows.reduce((n,x)=>n+Number(x.itemCount),0);
        const card=add(box,'div',undefined,'metric');
        add(card,'div',domain);add(card,'strong',sum);
        add(card,'div',rows.length?rows.map(r=>r.editorialStatus+': '+r.itemCount).join(' · '):'Chưa có phiên bản','sub');
      });
    }catch(err){showError(box,err);}
  }
  async function list(){
    if(state.loading)return;state.loading=true;
    const body=el('items');body.replaceChildren();
    el('total').textContent='Đang tải...';
    const values=new FormData(el('filters'));
    const query=new URLSearchParams({domain:txt(values.get('domain')),status:txt(values.get('status')),q:txt(values.get('q')),page:String(state.page)});
    try{
      const data=await call('/api/admin/content?'+query);
      state.total=data.total;
      el('total').textContent=data.total+' phiên bản';
      if(!data.items.length){const tr=add(body,'tr');const td=add(tr,'td','Không có nội dung khớp bộ lọc.');td.colSpan=5;}
      for(const item of data.items){
        const tr=add(body,'tr');
        add(tr,'td','#'+item.versionId+' · v'+item.versionNo);
        add(tr,'td',item.domainCode);
        const name=add(tr,'td');add(name,'span',item.businessCode,'muted');add(name,'span',item.title,'item-title');
        const status=add(tr,'td');add(status,'span',item.editorialStatus,'status '+item.editorialStatus);
        const actions=add(tr,'td');const b=add(actions,'button','Xem');b.type='button';b.addEventListener('click',()=>detail(item.versionId));
      }
      el('pageInfo').textContent='Trang '+state.page;
      el('previous').disabled=state.page<=1;
      el('next').disabled=state.page*data.pageSize>=state.total;
    }catch(err){const tr=add(body,'tr');const td=add(tr,'td');td.colSpan=5;showError(td,err);el('total').textContent='Lỗi tải dữ liệu';}
    finally{state.loading=false;}
  }
  function controls(container,label,nodeType,placeholder,initial) {
    const labelEl=add(container,'label',label,'workflow-label');
    const input=document.createElement(nodeType);
    input.className='workflow-field';
    if(placeholder) input.placeholder=placeholder;
    if(nodeType==='textarea') input.rows=4;
    if(initial!==undefined) input.value=txt(initial);
    labelEl.append(input);
    return input;
  }
  function allowed(role){return !!state.actor?.roles?.some(r=>role.includes(r));}
  function appendButton(parent,title,fn,variant){
    const button=add(parent,'button',title,variant||'');button.type='button';
    button.addEventListener('click',fn);return button;
  }
  async function runAction(id,method,action,payload,success){
    const box=el('workflowMessage');
    try{
      box.textContent='Đang xử lý...';
      await call('/api/admin/content/'+encodeURIComponent(id)+'/'+action,{
        method, headers:{'Accept':'application/json','Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      box.textContent=success;
      await Promise.all([overview(),list()]);
      await detail(id);
      el('workflowMessage').textContent=success;
    }catch(error){showError(box,error);}
  }
  async function renderEvidenceTools(d, fields) {
    if (!state.actor || d.editorialStatus==='published') return;
    const box=add(fields,'div',undefined,'evidence-box');
    add(box,'h3','Chứng cứ gốc — tiếp nhận và đối chiếu độc lập');
    add(box,'p','Chỉ dùng file đã lưu thủ công tại evidence/review trên máy chủ. Đăng ký file KHÔNG đồng nghĩa nguồn đã được xác minh hoặc bài được công bố.','muted');
    const own=Number(d.createdBy)===Number(state.actor.id);
    const submitted=Number(d.submittedBy)===Number(state.actor.id);
    const canAttach=['draft','rejected'].includes(d.editorialStatus) &&
      (allowed(['editor','admin'])||(own&&allowed(['author'])));
    const canVerify=d.editorialStatus==='review' && allowed(['reviewer','admin']) && !own && !submitted;
    if (canAttach) {
      try {
        const candidates=await call('/api/admin/content/'+encodeURIComponent(d.versionId)+'/evidence-candidates');
        if (state.current?.versionId!==d.versionId)return;
        if(!candidates.items?.length){add(box,'p','Chưa có nguồn tham khảo đề xuất trong SQL. Không tự thêm nguồn giả.','error');return;}
        const form=add(box,'div',undefined,'evidence-form');
        const sourceLabel=add(form,'label','Chọn nguồn chính thức đã đề xuất','workflow-label');
        const selector=document.createElement('select');selector.className='workflow-field';sourceLabel.append(selector);
        for(const item of candidates.items){const o=document.createElement('option');o.value=String(item.sourceId);o.textContent=item.title+' · '+item.url;selector.append(o);}
        const filename=controls(form,'Tên file đã lưu trong evidence/review (ví dụ canh_bao_mao_danh_bhxh_2025_v2.pdf)','input','ten_chung_cu.pdf','');
        const locator=controls(form,'Vị trí trích dẫn / thông tin được đối chiếu','input','Phần cảnh báo chuyển tiền và OTP','');
        const note=controls(form,'Biên bản tiếp nhận: cách lưu bản, nguồn, ngày và những phần chưa đầy đủ','textarea','Ít nhất 30 ký tự; chỉ ghi những gì đã thực sự kiểm tra','');
        const status=add(form,'div','','muted');
        appendButton(form,'Đăng ký snapshot — vẫn CHỜ xác minh',async()=>{
          if(!window.confirm('Chỉ tiếp nhận metadata file, KHÔNG xác minh nguồn. Tiếp tục?'))return;
          status.textContent='Đang kiểm tra hash và đăng ký...';
          try {
            const result=await call('/api/admin/content/'+encodeURIComponent(d.versionId)+'/evidence-attach',{
              method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
              body:JSON.stringify({sourceId:Number(selector.value),fileName:filename.value,
                locator:locator.value,reason:note.value})});
            await detail(d.versionId);
            el('workflowMessage').textContent='Đã tiếp nhận snapshot #'+result.snapshotId+'; SHA-256: '+result.sha256+'. CHƯA được xác minh.';
          }catch(e){status.textContent=e.message||String(e);status.className='error';}
        },'primary');
      }catch(error){showError(box,error);}
    }
    if(canVerify && Array.isArray(d.evidence) && d.evidence.length){
      add(box,'p','Người xác minh phải khác người tạo, gửi duyệt và tiếp nhận file. Mở file gốc trên máy và URL chính thức để so sánh trước khi ký xác nhận.','muted');
      for(const source of d.evidence){
        if(source.isVerified===true||source.isVerified===1)continue;
        if (!source.snapshotId || !source.storageKey)continue;
        const form=add(box,'div',undefined,'evidence-form');
        add(form,'strong',source.sourceTitle+' · snapshot #'+source.snapshotId);
        add(form,'p','File: '+source.storageKey+' · SHA-256: '+source.snapshotSha256,'muted');
        link(form,source.sourceUrl,'Mở trang chính thức để đối chiếu ↗');
        const checks=[];
        for(const label of ['Đã mở URL chính thức và xác nhận đúng văn bản/tác giả/nguồn',
          'Đã mở tệp gốc trên máy chủ và đối chiếu mã SHA-256',
          'Đã so sánh nội dung bài với thông báo chính thức',
          'Đã kiểm tra tài liệu có đầy đủ phần cần làm căn cứ; không dùng hình/phụ lục thiếu']){
          const row=add(form,'label',undefined,'tick-label');const cb=document.createElement('input');cb.type='checkbox';row.append(cb,document.createTextNode(' '+label));checks.push(cb);
        }
        const decisionLabel=add(form,'label','Kết quả xác minh (không tự phê duyệt bài viết)','workflow-label');
        const sel=document.createElement('select');sel.className='workflow-field';decisionLabel.append(sel);
        [['needs_review','Cần kiểm tra thêm'],['rejected','Không đạt'],['accepted','Xác minh hợp lệ — sau đối chiếu thực tế']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;sel.append(o);});
        const until=controls(form,'Hạn cần kiểm tra lại (YYYY-MM-DD, trong 366 ngày)','input','2026-12-31','');
        const note=controls(form,'Biên bản xác minh: URL, nội dung đối chiếu, phần thiếu, ngày kiểm tra','textarea','Ít nhất 80 ký tự, chỉ xác nhận những gì đã kiểm chứng','');
        const msg=add(form,'p','','muted');
        appendButton(form,'Lưu kết quả xác minh độc lập',async()=>{
          if(!checks.every(x=>x.checked)){alert('Chưa đủ bốn xác nhận kiểm chứng.');return;}
          if(!window.confirm('Đây là kết luận của người kiểm duyệt, được ghi vĩnh viễn vào lịch sử nguồn. Tiếp tục?'))return;
          try {
            await call('/api/admin/content/'+encodeURIComponent(d.versionId)+'/evidence-verify',{
              method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
              body:JSON.stringify({snapshotId:Number(source.snapshotId),decision:sel.value,validUntil:until.value,
                reason:note.value,checkedOriginal:checks[0].checked,checkedHash:checks[1].checked,
                checkedContent:checks[2].checked,checkedCompleteness:checks[3].checked})});
            await detail(d.versionId);
            el('workflowMessage').textContent='Đã ghi quyết định xác minh. Chưa phê duyệt hoặc công bố bài.';
          }catch(e){msg.textContent=e.message||String(e);msg.className='error';}
        },'primary');
      }
    }
  }
  function renderWorkflow(d){
    const root=el('workflowActions');root.replaceChildren();
    if(!state.actor)return;
    const id=d.versionId;
    const own=Number(d.createdBy)===Number(state.actor.id);
    const submitted=Number(d.submittedBy)===Number(state.actor.id);
    const approved=Number(d.approvedBy)===Number(state.actor.id);
    const writer=allowed(['admin','editor'])||(own&&allowed(['author']));
    const reviewer=allowed(['admin','reviewer'])&&!own&&!submitted;
    const publisher=allowed(['admin','publisher'])&&!own&&!submitted&&!approved;
    add(root,'h3','Thao tác biên tập / kiểm duyệt');
    const msg=add(root,'div','','workflow-message');msg.id='workflowMessage';
    add(root,'p','Dữ liệu pháp lý phải được xác minh độc lập trước khi phê duyệt. Hành động được ghi lại trong lịch sử.','muted');
    const sources=Array.isArray(d.evidence)?d.evidence:[];
    const verified=sources.filter(source=>source.isVerified===true||source.isVerified===1).length;
    const allVerified=sources.length>0&&verified===sources.length;
    add(root,'p',`Đối chiếu trạng thái nguồn trong SQL: ${verified}/${sources.length} snapshot có xác minh hợp lệ. `+
      (allVerified?'Vẫn cần kiểm tra nội dung pháp lý và phạm vi áp dụng.':'Chưa đủ điều kiện phê duyệt / công bố.'),
      allVerified?'verified-note':'error');
    const fields=add(root,'div',undefined,'workflow-fields');
    void renderEvidenceTools(d,fields);
    if(['draft','rejected'].includes(d.editorialStatus)&&writer){
      const editor=add(fields,'details',undefined,'workflow-editor');
      const summary=add(editor,'summary','Mở biểu mẫu chỉnh sửa bản nháp');
      summary.tabIndex=0;
      const title=controls(editor,'Tiêu đề','input','',d.title);
      title.maxLength=300;
      const short=controls(editor,'Tóm tắt','textarea','',d.summary);
      short.maxLength=1600;
      const body=controls(editor,'Nội dung (Markdown)','textarea','',d.bodyMarkdown);
      body.maxLength=50000;body.rows=8;
      const from=controls(editor,d.domainCode==='SCAM'?'Ngày bắt đầu áp dụng bài cảnh báo (YYYY-MM-DD; không phải hiệu lực luật)':'Ngày có hiệu lực (YYYY-MM-DD, để trống nếu chưa xác nhận)','input','YYYY-MM-DD',d.effectiveFrom?String(d.effectiveFrom).slice(0,10):'');
      appendButton(editor,'Lưu bản nháp',()=>runAction(id,'PUT','draft',{
        title:title.value,summary:short.value,bodyMarkdown:body.value,effectiveFrom:from.value.trim()
      },'Đã lưu bản nháp. Hãy kiểm tra lại nội dung trước khi gửi duyệt.'),'primary');
    }
    const canSubmit=d.editorialStatus==='draft'&&writer;
    const canReject=d.editorialStatus==='review'&&reviewer;
    const canApprove=d.editorialStatus==='review'&&reviewer&&allVerified;
    const canPublish=d.editorialStatus==='approved'&&publisher&&allVerified;
    if(canSubmit||canReject||canApprove||canPublish){
      const note=controls(fields,'Lý do / biên bản đối chiếu (bắt buộc)','textarea','Mô tả kết quả kiểm tra, điều khoản, tài liệu nguồn...','');
      note.maxLength=1000;
      const confirmation=add(fields,'div',undefined,'workflow-confirm');
      let legal=null,evidence=null,typed=null;
      if(canApprove||canPublish){
        const a=add(confirmation,'label',undefined,'tick-label');legal=document.createElement('input');legal.type='checkbox';a.append(legal,document.createTextNode(d.domainCode==='SCAM'?' Tôi đã đối chiếu nội dung cảnh báo với thông báo chính thức, không khẳng định hành vi của cá nhân cụ thể.':' Tôi đã đối chiếu mã thủ tục, hiệu lực, mức phí với văn bản gốc.'));
        const b=add(confirmation,'label',undefined,'tick-label');evidence=document.createElement('input');evidence.type='checkbox';b.append(evidence,document.createTextNode(' Tôi đã kiểm tra tài liệu chứng cứ và tình trạng xác minh nguồn.'));
      }
      if(canPublish){typed=controls(confirmation,'Gõ CONG_BO để xác nhận phát hành','input','CONG_BO','');}
      const actions=add(fields,'div',undefined,'workflow-buttons');
      const action=(verb,minimum,warning)=>{
        if(note.value.trim().length<minimum){alert('Hãy ghi rõ lý do/biên bản ít nhất '+minimum+' ký tự.');return;}
        if((verb==='approve'||verb==='publish')&&(!legal?.checked||!evidence?.checked)){
          alert('Bạn phải xác nhận cả hai mục kiểm chứng nguồn và pháp lý.');return;
        }
        if(verb==='publish'&&typed?.value!=='CONG_BO'){
          alert('Bạn phải gõ chính xác CONG_BO trước khi phát hành.');return;
        }
        if(!window.confirm(warning))return;
        runAction(id,'POST',verb,{
          reason:note.value.trim(),
          verifiedLegal:!!legal?.checked, verifiedEvidence:!!evidence?.checked,
          publishConfirm:typed?.value||''
        },'Đã thực hiện: '+verb+'. Hãy đối chiếu lịch sử kiểm duyệt.');
      };
      if(canSubmit) appendButton(actions,'Gửi duyệt',()=>action('submit',15,'Gửi phiên bản vào hàng chờ kiểm duyệt? Không thể tự phê duyệt nội dung mình gửi.'),'primary');
      if(canReject) appendButton(actions,'Trả lại chỉnh sửa',()=>action('reject',20,'Trả lại phiên bản này để chỉnh sửa?'));
      if(canApprove) appendButton(actions,'Phê duyệt',()=>action('approve',30,'Xác nhận đã đối chiếu chứng cứ và quy định pháp luật? SQL có thể từ chối nếu nguồn chưa được xác minh.'),'primary');
      if(canPublish) appendButton(actions,'CÔNG BỐ',()=>action('publish',30,'XÁC NHẬN CÔNG BỐ NỘI DUNG RA WEBSITE CÔNG KHAI? Hành động này không thể hoàn tác bằng cách sửa trực tiếp.'),'primary danger');
    } else {
      add(fields,'p',d.editorialStatus==='published'
          ?'Đã công bố. Không được sửa trực tiếp; muốn cập nhật phải tạo phiên bản mới.'
          :'Không có thao tác chuyển trạng thái nào phù hợp với tài khoản và phiên bản này. Người tạo/gửi duyệt phải khác người kiểm duyệt; người công bố phải độc lập với người phê duyệt.','muted');
    }
  }
  async function init(){
    try {
      const info=await call('/api/auth/me');
      if(!info.user?.roles?.some(role=>ROLES.has(role)))throw Object.assign(new Error('Tài khoản này chưa được cấp quyền biên tập hoặc quản trị. Hãy dùng SSMS cấp quyền theo README và sql/04_Phan_Quyen_Quan_Tri.sql rồi tải lại trang.'),{status:403});
      state.actor=info.user;
      el('whoami').textContent=info.user.displayName+' · '+info.user.roles.join(', ');
      el('gate').hidden=true;el('workspace').hidden=false;
      el('logout').hidden=false;
      el('logout').addEventListener('click',async()=>{try{await call('/api/auth/logout',{method:'POST'});location.assign('/login.html');}catch(e){alert(e.message);}});
      el('filters').addEventListener('submit',e=>{e.preventDefault();state.page=1;list();});
      el('refresh').addEventListener('click',()=>{overview();list();});
      el('previous').addEventListener('click',()=>{if(state.page>1){state.page--;list();}});
      el('next').addEventListener('click',()=>{if(state.page*20<state.total){state.page++;list();}});
      el('closeDetail').addEventListener('click',()=>{el('detailPanel').hidden=true;});
      await Promise.all([overview(),list()]);
    } catch(err) {
      const gate=el('gate');gate.replaceChildren();showError(gate,err);
      const a=add(gate,'a',err.status===401?'Đến trang đăng nhập':'Về trang chủ');a.href=err.status===401?'/login.html':'/index.html';
    }
  }
  init();
})();
