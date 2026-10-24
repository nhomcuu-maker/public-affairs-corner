(()=>{'use strict';
  const ids=n=>document.getElementById(n);
  const create=(root,tag,txt,css)=>{const el=document.createElement(tag);if(txt!==undefined)el.textContent=String(txt);if(css)el.className=css;root.append(el);return el;};
  const displayDate=x=>{if(!x)return '';const d=new Date(x);return Number.isNaN(d.getTime())?'':d.toLocaleString('vi-VN');};
  async function load(){
    const stats=ids('fb-stats'),list=ids('fb-list'),status=ids('fb-status');stats.replaceChildren();list.replaceChildren();
    try{
      const response=await fetch('/api/admin/feedback',{credentials:'same-origin',cache:'no-store'});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(response.status===401?'Cần đăng nhập tài khoản nội bộ.':response.status===403?'Tài khoản chưa được cấp quyền.':body.message||'HTTP '+response.status);
      status.textContent='Đã đọc '+(body.items?.length||0)+' phản hồi gần nhất.';
      for(const r of body.stats||[])create(stats,'p',`${r.vote==='helpful'?'Hữu ích':'Chưa hữu ích'} · ${r.reason}: ${r.total}`);
      if(!body.stats?.length)create(stats,'p','Chưa có phản hồi nào.');
      for(const item of body.items||[]){
        const card=create(list,'div',undefined,'source');
        create(card,'strong',`#${item.id} · ${item.vote==='helpful'?'Hữu ích':'Chưa hữu ích'} · ${item.reason}`);
        create(card,'p',`Chế độ ${item.scope} · ${item.intent} · ${item.answerStatus} · ${item.sourceCount} nguồn`,'sub');
        create(card,'p',`Gửi lúc ${displayDate(item.createdAt)} · ${item.reviewStatus}`,'sub');
        if(item.reviewStatus==='pending'){
          const button=create(card,'button','Đánh dấu đã xem xét');button.type='button';
          button.addEventListener('click',async()=>{
            button.disabled=true;
            try{const res=await fetch('/api/admin/feedback/'+encodeURIComponent(item.id)+'/review',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});
              const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.message||'HTTP '+res.status);await load();}
            catch(e){button.disabled=false;status.textContent=e.message||String(e);}
          });
        }
      }
      if(!body.items?.length)create(list,'p','Chưa có phản hồi nào.');
    }catch(err){status.className='error';status.textContent=err.message||String(err);}
  }
  void load();
})();
