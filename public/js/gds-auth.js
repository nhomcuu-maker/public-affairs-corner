(() => {
  'use strict';
  async function api(endpoint, body) {
    const response = await fetch('/api/auth/'+endpoint,{
      method:body===undefined?'GET':'POST',
      credentials:'same-origin', cache:'no-store',
      headers:body===undefined?{Accept:'application/json'}:{'Content-Type':'application/json',Accept:'application/json'},
      ...(body!==undefined?{body:JSON.stringify(body)}:{})
    });
    const json = await response.json().catch(()=>({}));
    if(!response.ok) throw Error(typeof json.message==='string'?json.message:'Yêu cầu thất bại (HTTP '+response.status+')');
    return json;
  }
  function status(form,message,error=false){
    const node=form.parentNode.querySelector('[data-auth-status]');
    if(node){node.textContent=message;node.style.color=error?'#b91c1c':'#166534';}
  }
  const login=document.querySelector('#loginForm');
  if(login)login.addEventListener('submit',async e=>{
    e.preventDefault();const submit=login.querySelector('button[type="submit"]');submit.disabled=true;
    status(login,'Đang xác thực...');
    try{
      await api('login',{email:login.elements.namedItem('email').value.trim(),password:login.elements.namedItem('password').value});
      status(login,'Đăng nhập thành công. Đang chuyển trang...');
      location.assign('index.html');
    }catch(err){status(login,err.message,true);}finally{submit.disabled=false;}
  });
  const register=document.querySelector('#registerForm');
  if(register)register.addEventListener('submit',async e=>{
    e.preventDefault();const submit=register.querySelector('button[type="submit"]');
    if(register.elements.namedItem('password').value!==register.elements.namedItem('confirmPassword').value){status(register,'Hai mật khẩu không khớp',true);return;}
    submit.disabled=true;status(register,'Đang đăng ký...');
    try{
      await api('register',{displayName:register.elements.namedItem('displayName').value.trim(),email:register.elements.namedItem('email').value.trim(),password:register.elements.namedItem('password').value,confirmPassword:register.elements.namedItem('confirmPassword').value});
      status(register,'Đăng ký thành công. Chuyển sang đăng nhập...');
      setTimeout(()=>location.assign('login.html'),900);
    }catch(err){status(register,err.message,true);}finally{submit.disabled=false;}
  });
  const authLinks=document.querySelector('.auth-links');
  if(authLinks){
    api('me').then(({user})=>{
      authLinks.replaceChildren();
      const label=document.createElement('span');label.textContent='Xin chào, '+user.displayName+' ';
      const logout=document.createElement('button');logout.type='button';logout.textContent='Đăng xuất';
      logout.style.cssText='border:0;background:none;color:#1a365d;font:inherit;font-weight:700;cursor:pointer;text-decoration:underline';
      logout.addEventListener('click',async()=>{
        logout.disabled=true;
        try{await api('logout',{});location.reload();}catch(err){alert(err.message);logout.disabled=false;}
      });
      if(user.roles?.some(role=>['author','editor','reviewer','publisher','admin'].includes(role))){
        const admin=document.createElement('a');admin.href='./admin.html';admin.textContent='Quản trị nội dung';
        admin.style.margin='0 10px';authLinks.append(admin);
      }
      authLinks.append(label,logout);
    }).catch(()=>{});
  }
})();
