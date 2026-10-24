(() => {
  'use strict';
  function normalize(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase(); }
  function safeLink(s) {
    try {
      const u = new URL(String(s || ''));
      return u.protocol === 'https:' && ['chinhphu.vn', 'congbao.chinhphu.vn'].includes(u.hostname) && !u.port && !u.username && !u.password ? u.href : null;
    } catch (_) { return null; }
  }
  function init() {
    // Library UI is built dynamically; observe for its search input.
    const target = document.getElementById('gds-reference-library');
    if (!target) return;
    function attach() {
      const input = target.querySelector('input[type="search"], input[type="text"]');
      if (!input || target.querySelector('#gds-library-search-button')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'gds-library-search-button';
      button.textContent = '🔎 Tìm kiếm';
      button.style.cssText = 'display:inline-block;margin:9px 0 0;padding:10px 20px;background:#2455a4;color:white;border:0;border-radius:8px;font-weight:700;cursor:pointer';
      input.insertAdjacentElement('afterend', button);
      const go = () => { input.dispatchEvent(new Event('input', {bubbles:true})); const count = target.querySelector('.gds-lib-count'); if (count) count.scrollIntoView({behavior:'smooth',block:'center'}); };
      button.addEventListener('click', go);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    }
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(target, {childList:true,subtree:true});
    // Show the verified government reference only for closely matching queries.
    fetch('./curated-official-catalog.json', {cache:'no-store'}).then(r => r.ok ? r.json() : {items:[]}).then(data => {
      const item = (data.items || [])[0];
      if (!item || !safeLink(item.url)) return;
      const panel = document.createElement('section');
      panel.style.cssText = 'margin:16px 0;padding:14px;border:1px solid #cbd5e1;border-radius:10px;background:#fff';
      panel.hidden = true;
      const title = document.createElement('strong'); title.textContent = 'Văn bản pháp luật liên quan';
      const desc = document.createElement('p'); desc.textContent = item.title + ' — Nguồn Chính phủ. Kiểm tra hiệu lực trước khi áp dụng.';
      const link = document.createElement('a'); link.textContent = 'Xem văn bản tại nguồn chính thức ↗'; link.href = safeLink(item.url); link.target = '_blank'; link.rel = 'noopener noreferrer';
      panel.append(title,desc,link); target.prepend(panel);
      function update() {
        const input = target.querySelector('input[type="search"], input[type="text"]');
        const q = normalize(input && input.value).trim();
        panel.hidden = !(q && (normalize(item.title).includes(q) || normalize(item.documentCode).includes(q) || (q.includes('luat') && q.includes('lao dong'))));
      }
      target.addEventListener('input', update); update();
    }).catch(console.warn);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();