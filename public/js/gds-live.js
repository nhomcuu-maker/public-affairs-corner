/* Goc Dan Sinh: real read-only API integration; never exposes drafts or DEV_PREVIEW_KEY. */
(() => {
  'use strict';
  const API = '/api';
  const pages = {
    'index.html': null,
    'phap-luat-quyen-loi.html': 'LEGAL',
    'thu-tuc-hanh-chinh.html': 'ADMIN',
    'canh-bao-lua-dao.html': 'SCAM'
  };
  const currentPage = decodeURIComponent(location.pathname.split('/').pop() || 'index.html');
  const currentDomain = Object.prototype.hasOwnProperty.call(pages, currentPage) ? pages[currentPage] : null;
  const labels = { LEGAL: 'Pháp luật & Quyền lợi', ADMIN: 'Thủ tục hành chính', SCAM: 'Cảnh báo lừa đảo' };
  let panel;
  let results;
  let status;
  let currentSearch = '';
  let selectedScamCategory = null;
  let requestSerial = 0;
  let referencePanel = null;
  let referenceCatalogPromise = null;

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  async function get(path) {
    const response = await fetch(API + path, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function notify(message, warning=false) {
    if (!status) return;
    status.textContent = message;
    status.className = 'gds-status' + (warning ? ' gds-warning' : '');
  }
  // Keep every original page unchanged until a visitor explicitly searches.
  // Technical API/SQL status lives in /kiem-tra-he-thong.html, not on the homepage.
  function ensurePanel() {
    if (panel) return;
    const main = document.querySelector('.main-container') || document.body;
    panel = el('section', 'gds-live');
    panel.id = 'ket-qua-tra-cuu';
    const heading = el('h2', '', currentDomain === 'SCAM'
      ? 'Danh sách bài cảnh báo công khai'
      : (currentDomain ? 'Kết quả tra cứu – ' + labels[currentDomain] : 'Kết quả tra cứu'));
    const caption = el('p', 'gds-muted', 'Chỉ hiển thị nội dung đã được kiểm duyệt và công bố.');
    status = el('p', 'gds-status', 'Đang tra cứu...');
    results = el('div', 'gds-list');
    panel.append(heading, caption, status, results);
    if (currentDomain === 'ADMIN' || currentDomain === 'LEGAL') {
      referencePanel = el('section', 'gds-live-references');
      referencePanel.id = 'gds-live-pdf-references';
      referencePanel.append(el('h3', '', 'Th\u01b0 vi\u1ec7n PDF tham kh\u1ea3o (ch\u01b0a ki\u1ec3m duy\u1ec7t)'));
      referencePanel.hidden = Boolean(document.getElementById('gds-reference-library'));
      panel.append(referencePanel);
    }
    const publicMount = currentDomain === 'SCAM' ? document.getElementById('scamPublishedMount') : null;
    (publicMount || main).appendChild(panel);
  }
  // A published article belongs to the primary category assigned to its item in SQL.
  // No test article, agency, or business code is given special treatment.
  // Only mapped official categories are filterable; unknown codes retain their DB name.
  const categoryToGroup = Object.freeze({
    GIA_DANH: 'impersonation',
    LINK_GIA: 'phishing',
    TUYEN_DUNG: 'jobs',
    DAU_TU: 'investments',
    MANG_XA_HOI: 'social',
    DICH_VU_CONG: 'public-services',
    MUA_BAN: 'shopping',
    NGAN_HANG: 'banking',
    GIAO_HANG: 'parcel',
    TINH_CAM: 'romance',
    TRUNG_THUONG: 'prizes',
    UNG_DUNG_DOC_HAI: 'malware'
  });
  function classifyScam(item) {
    const code = String(item.primaryCategoryCode || '').trim().toUpperCase();
    return {
      id: Object.prototype.hasOwnProperty.call(categoryToGroup, code) ? categoryToGroup[code] : null,
      label: String(item.primaryCategoryName || '').trim() || 'Chưa phân loại'
    };
  }
  // A local PDF is a reference asset, NOT a published knowledge_version.
  // Show these side by side without weakening public SQL publication gates.
  async function renderReferenceCatalog(domain, search, serial) {
    if (!referencePanel || (domain !== 'LEGAL' && domain !== 'ADMIN')) return;
    if (!referenceCatalogPromise) referenceCatalogPromise = Promise.all([
      fetch('/library-catalog.json', {cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null),
      fetch('/official-reference-catalog.json', {cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null)
    ]).then(([local,official])=>({items:[...(local?.items||[]),...(official?.items||[])]}));
    const catalog = await referenceCatalogPromise;
    if (serial !== requestSerial) return;
    referencePanel.replaceChildren();
    referencePanel.append(el('h3', '', 'Thư viện PDF tham khảo và văn bản gốc Công báo (chưa xác minh hiệu lực)'));
    if (!catalog || !Array.isArray(catalog.items)) {
      referencePanel.append(el('p', 'gds-muted', 'Ch\u01b0a t\u1ea3i \u0111\u01b0\u1ee3c th\u01b0 vi\u1ec7n PDF. Vui l\u00f2ng t\u1ea3i l\u1ea1i trang.'));
      return;
    }
    const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u0111/g,'d').toLowerCase();
    const safe = u => /^\/library-files\/[a-zA-Z0-9_-]+\.pdf$/.test(String(u||'')) || /^https:\/\/congbao\.chinhphu\.vn\/[^\s<>"']+$/.test(String(u||''));
    const available = catalog.items.filter(x => x && x.domain === domain && safe(x.url));
    const words = norm(search).split(/\s+/).filter(Boolean);
    const matches = available.filter(x => words.every(w => norm([x.title,x.topic,x.searchText].join(' ')).includes(w)));
    referencePanel.append(el('p', 'gds-muted', available.length + ' tài liệu và nguồn tham khảo trong kho này; ' +
      matches.length + ' ph\u00f9 h\u1ee3p t\u1eeb kh\u00f3a. Ch\u01b0a ph\u1ea3i v\u0103n b\u1ea3n \u0111\u00e3 c\u00f4ng b\u1ed1.'));
    const list = el('div','gds-lib-results');
    const show = rows => {
      list.replaceChildren();
      rows.slice(0,24).forEach(x => {
        const card = el('article','gds-lib-item');
        card.append(el('h4','',String(x.title||'PDF tham kh\u1ea3o')),
          el('p','gds-muted',String(x.topic||'')+' · '+(x.origin==='official_rss'?'Nguồn Công báo, chưa xác minh hiệu lực':'Chưa kiểm duyệt – PDF tham khảo')));
        const a = el('a','', x.origin==='official_rss'&&!x.localPdfUrl?'Mở nguồn trên Công báo ↗':'Mở PDF tham khảo ↗');
        a.href = x.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        card.append(a); list.append(card);
      });
    };
    if (!matches.length && available.length && words.length) {
      referencePanel.append(el('p','gds-muted','Ch\u01b0a c\u00f3 PDF ph\u00f9 h\u1ee3p ch\u1ee7 \u0111\u1ec1 \u0111ang ch\u1ecdn. Kh\u00f4ng d\u00f9ng t\u00e0i li\u1ec7u kh\u00e1c ch\u1ee7 \u0111\u1ec1 \u0111\u1ec3 thay th\u1ebf.'));
      const all = el('button','gds-reference-toggle','Xem t\u1ea5t c\u1ea3 PDF tham kh\u1ea3o c\u1ee7a kho');
      all.type='button'; all.addEventListener('click',() => { show(available); all.remove(); });
      referencePanel.append(all);
    } else show(matches);
    referencePanel.append(list);
    const a = el('a','gds-lib-all','M\u1edf th\u01b0 vi\u1ec7n \u0111\u1ea7y \u0111\u1ee7 \u2197');a.href='./thu-vien.html';referencePanel.append(a);
  }

  function renderRecords(items) {
    clear(results);
    if (!items.length) {
      results.append(el('p', 'gds-muted', selectedScamCategory
        ? 'Chưa có bài cảnh báo đã công bố thuộc nhóm này. Danh mục chỉ giúp phân loại, không phải là nguồn chứng cứ.'
        : (currentSearch ? 'Không có nội dung đã công bố khớp từ khóa này.'
        : 'Chưa có bài hướng dẫn được phê duyệt trong nhóm này; văn bản gốc vẫn có thể tra cứu bên trên.')));
      return;
    }
    items.forEach(item => {
      const button = el('button', 'gds-item');
      button.type = 'button';
      if (currentDomain === 'SCAM') {
        const topic = classifyScam(item);
        const category = el('span','gds-scam-topic',topic.label + (topic.sublabel ? ' · ' + topic.sublabel : ''));
        button.append(category);
      }
      const summary = /^Bản nháp MVP:/i.test(String(item.summary || '').trim())
        ? 'Bấm Xem chi tiết để đọc đầy đủ dấu hiệu và cách xử lý.'
        : (item.summary || 'Nội dung cảnh báo đã công bố');
      button.append(el('strong', '', item.title), el('span', '', summary));
      button.append(el('span','gds-read-detail','Xem chi tiết bài viết và nguồn ↗'));
      button.setAttribute('aria-label', 'Xem chi tiết: ' + item.title);
      button.addEventListener('click', () => viewDetail(item.businessCode, item.kind));
      results.append(button);
    });
  }
  async function refresh(domain, search='', scrollToResults=false) {
    ensurePanel();
    const serial = ++requestSerial;
    currentSearch = search.trim();
    if (domain === 'SCAM') { selectedScamCategory = null; updateScamSelection(); }
    notify('Đang tra cứu nội dung đã công bố...');
    try {
      // Empty keyword uses the exact endpoint proven by check-public-api.cjs.
      const query = currentSearch ? '&q=' + encodeURIComponent(currentSearch) : '';
      let items;
      try {
        items = await get('/content?domain=' + encodeURIComponent(domain) + query);
      } catch (queryError) {
        if (!query) throw queryError;
        // Some SQL Server deployments fail only on the keyword branch.  Read the
        // published-only endpoint and filter its public records locally instead.
        // This is not a replacement for server search when more than 50 records exist.
        const fallbackRows = await get('/content?domain=' + encodeURIComponent(domain));
        const norm = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
        const words = norm(currentSearch).split(/\s+/).filter(Boolean);
        items = fallbackRows.filter(x => words.every(w => norm([x.title,x.summary,x.primaryCategoryName].join(' ')).includes(w)));
        if (typeof console !== 'undefined' && console.warn) console.warn('Keyword API error; published list fallback used:', queryError);
      }
      if (serial !== requestSerial) return items;
      notify('Đã kết nối API. ' + items.length + ' nội dung đã công bố' + (currentSearch ? ' khớp tìm kiếm.' : '.'));
      renderRecords(items);
      void renderReferenceCatalog(domain, currentSearch, serial);
      if (scrollToResults) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return items;
    } catch (error) {
      if (serial !== requestSerial) return [];
      notify('Tạm thời chưa tải được bài hướng dẫn đã phê duyệt. Bạn vẫn có thể tra cứu văn bản gốc theo lĩnh vực phía trên.', true);
      if(typeof console !== 'undefined' && console.warn) console.warn('Published content API failed:', error);
      clear(results);
      void renderReferenceCatalog(domain, currentSearch, serial);
      const note = el('p', 'gds-muted', 'Thư viện văn bản gốc được tải độc lập với danh sách bài hướng dẫn đã phê duyệt.');
      results.append(note);
      if (domain === 'ADMIN' || domain === 'LEGAL') {
        const link = el('a', '', 'Mở Thư viện văn bản tham khảo ↗');
        link.href = '/thu-vien.html';
        results.append(link);
      }
      return [];
    }
  }
  function modal() {
    let overlay = document.querySelector('.gds-modal-overlay');
    if (overlay) return overlay;
    overlay = el('div', 'gds-modal-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Chi tiết nội dung đã công bố');
    const box = el('div', 'gds-modal');
    const close = el('button', 'gds-close', 'Đóng ✕');
    close.type = 'button';
    close.onclick = () => { overlay.style.display='none'; };
    box.append(close);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display='none'; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.style.display='none'; });
    overlay.append(box);
    document.body.appendChild(overlay);
    return overlay;
  }
  function section(box, title, lines, numbered=false) {
    if (!lines?.length) return;
    box.append(el('h3','',title));
    const list = el(numbered ? 'ol':'ul');
    lines.forEach(line => { list.append(el('li','',line)); });
    box.append(list);
  }
  function appendRichText(parent, text) {
    // Minimal Markdown inline text renderer; does not interpret or inject HTML from SQL.
    const chunks = String(text).split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https:\/\/[^)]+\))/g);
    chunks.forEach(chunk => {
      if (!chunk) return;
      const bold = chunk.match(/^\*\*(.+)\*\*$/);
      if (bold) { parent.append(el('strong','',bold[1])); return; }
      const markdownLink = chunk.match(/^\[([^\]]+)\]\((https:\/\/[^)]+)\)$/);
      if (markdownLink) {
        const url = safeLink(markdownLink[2]);
        if (url) {
          const a=el('a','gds-document-link',markdownLink[1]);
          a.href=url; a.target='_blank';a.rel='noopener noreferrer';
          parent.append(a);return;
        }
      }
      parent.append(document.createTextNode(chunk));
    });
  }
  function safeLink(value) {
    try {
      const u=new URL(String(value));
      return u.protocol==='https:' ? u.href : null;
    } catch { return null; }
  }
  function renderBodyMarkdown(parent, markdown) {
    let activeList = null, activeType = null;
    String(markdown || '').replace(/\r/g,'').split('\n').forEach(raw => {
      const line=raw.trim();
      if (!line) { activeList=null;activeType=null;return; }
      const heading=line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        activeList=null;activeType=null;
        const h=el(heading[1].length<3?'h3':'h4');appendRichText(h,heading[2]);parent.append(h);return;
      }
      const ordered=line.match(/^\d+[.)]\s+(.+)$/);
      const bullet=line.match(/^[-*]\s+(.+)$/);
      if (ordered||bullet) {
        const type=ordered?'ol':'ul';
        if (!activeList || type!==activeType) {
          activeList=el(type);activeType=type;parent.append(activeList);
        }
        const li=el('li');appendRichText(li,ordered?ordered[1]:bullet[1]);activeList.append(li);return;
      }
      activeList=null;activeType=null;
      const paragraph=el('p');appendRichText(paragraph,line);parent.append(paragraph);
    });
  }
  async function viewDetail(code, kind) {
    const overlay = modal();
    const box = overlay.querySelector('.gds-modal');
    while (box.children.length > 1) box.lastChild.remove();
    overlay.style.display='flex';
    box.append(el('p','','Đang tải chi tiết nội dung đã công bố...'));
    try {
      const data = kind === 'procedure'
        ? await get('/procedures/' + encodeURIComponent(code))
        : await get('/content/' + encodeURIComponent(code));
      while (box.children.length > 1) box.lastChild.remove();
      const isScam = data.domain === 'SCAM' || kind === 'SCAM';
      if (isScam) {
        const topic=classifyScam(data);
        box.append(el('p','gds-detail-category','Nhóm: '+topic.label+(topic.sublabel?' / '+topic.sublabel:'')));
      }
      box.append(el('h2','',data.title));
      if (isScam && data.businessCode) {
        const permalink=el('a','gds-document-link','Liên kết trực tiếp tới bài cảnh báo ↗');
        permalink.href='./canh-bao-lua-dao.html?bai='+encodeURIComponent(data.businessCode);
        box.append(permalink);
      }
      if (data.summary && !/^Bản nháp MVP:/i.test(data.summary.trim()))
        box.append(el('p','gds-detail-summary',data.summary));
      if (data.bodyMarkdown) {
        const content=el('div','gds-document-body');
        renderBodyMarkdown(content,data.bodyMarkdown);
        box.append(content);
      }
      if (isScam) {
        const sources=Array.isArray(data.sources)?data.sources:[];
        const sectionEl=el('section','gds-verified-sources');
        sectionEl.append(el('h3','','Nguồn chứng cứ đã xác minh'));
        if (!sources.length) sectionEl.append(el('p','gds-muted','Chưa có đường dẫn nguồn hiển thị. Vui lòng đối chiếu với cơ quan có thẩm quyền.'));
        sources.forEach(source => {
          const url=safeLink(source.url);
          if (!url) return;
          const a=el('a','gds-official-source',source.title || 'Mở nguồn chứng cứ');
          a.href=url;a.target='_blank';a.rel='noopener noreferrer';
          sectionEl.append(a);
        });
        box.append(sectionEl);
      }
      if (data.processingTime) box.append(el('p','', 'Thời gian xử lý: ' + data.processingTime));
      section(box,'Các bước thực hiện',(data.steps || []).map(x => `${x.stepNo}. ${x.title}: ${x.instruction}`),true);
      section(box,'Thành phần hồ sơ',(data.requirements || []).map(x => `${x.documentName}${x.conditionNote ? ' — '+x.conditionNote : ''}`));
      section(box,'Lệ phí (tùy điều kiện áp dụng)',(data.fees || []).map(x => `${x.feeKind}: ${x.amount} ${x.currency || 'VND'} — ${x.pricingRule || 'Kiểm tra điều kiện'}`));
      box.append(el('p','gds-muted','Thông tin tham khảo. Đối chiếu nguồn chính thức và điều kiện áp dụng trước khi thực hiện.'));
    } catch (err) {
      while (box.children.length > 1) box.lastChild.remove();
      box.append(el('p','','Không lấy được nội dung đã công bố (' + err.message + ').'));
    }
  }
  // Categories are a browsing taxonomy. Never represent them as verified news.
  // Filtering uses only the published-only SCAM API, not drafts or RSS candidates.
  const moreScamCategories = [
    ['shopping','Mua bán, đơn hàng giả','fa-cart-shopping'],
    ['banking','Ngân hàng, OTP, thẻ','fa-building-columns'],
    ['parcel','Giả giao hàng, bưu kiện','fa-truck-fast'],
    ['romance','Lừa đảo tình cảm, kết bạn','fa-heart-crack'],
    ['prizes','Trúng thưởng, quà tặng giả','fa-gift'],
    ['malware','Ứng dụng độc hại, chiếm quyền','fa-mobile-screen-button']
  ];
  function updateScamSelection() {
    document.querySelectorAll('[data-scam-category]').forEach(card => {
      const active = card.dataset.scamCategory === selectedScamCategory;
      card.setAttribute('aria-pressed', String(active));
      card.classList.toggle('scam-selected', active);
    });
  }
  async function selectScamCategory(id, title) {
    ensurePanel();
    const serial = ++requestSerial;
    selectedScamCategory = id;
    currentSearch = '';
    updateScamSelection();
    notify('Đang tìm cảnh báo công khai thuộc nhóm: ' + title + '...');
    try {
      const published = await get('/content?domain=SCAM');
      if (serial !== requestSerial) return;
      const matches = published.filter(item => classifyScam(item).id === id);
      renderRecords(matches);
      notify('Nhóm "' + title + '": ' + matches.length + ' bài đã công bố được xếp nhóm chính.');
      panel.scrollIntoView({behavior:'smooth',block:'nearest'});
      return matches;
    } catch (error) {
      if (serial !== requestSerial) return;
      notify('Không thể đọc nội dung đã công bố: ' + error.message, true);
      clear(results);
    }
    panel.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function installScamCategories() {
    const grid = document.getElementById('scamCategoryGrid');
    if (!grid) return;
    const original = Array.from(grid.querySelectorAll('[data-scam-category]'));
    const bind = button => button.addEventListener('click', () => {
      const title = button.querySelector('.scam-card-text')?.textContent?.trim() || '';
      selectScamCategory(button.dataset.scamCategory, title);
    });
    original.forEach(bind);
    const extra=[];
    moreScamCategories.forEach(([id, title, iconName]) => {
      const card=el('button','scam-card');
      card.type='button'; card.dataset.scamCategory=id;
      card.hidden=true; card.setAttribute('aria-pressed','false');
      const visual=el('span','scam-icon');visual.setAttribute('aria-hidden','true');
      visual.append(el('i','fa-solid '+iconName));
      card.append(visual,el('span','scam-card-text',title));
      grid.appendChild(card);extra.push(card);bind(card);
    });
    const more=document.getElementById('scamCategoryToggle');
    if (more) more.addEventListener('click', () => {
      const expanded = more.getAttribute('aria-expanded') !== 'true';
      more.setAttribute('aria-expanded', String(expanded));
      more.textContent = expanded ? 'THU GỌN NHÓM THỦ ĐOẠN' : 'XEM THÊM NHÓM THỦ ĐOẠN';
      extra.forEach(card => { card.hidden = !expanded; });
      if (!expanded && extra.some(card => card.dataset.scamCategory === selectedScamCategory)) {
        refresh('SCAM','',false);
      }
    });
    const showAll = document.getElementById('scamViewAll');
    if (showAll) showAll.addEventListener('click', () => refresh('SCAM','',true));
  }
  function installSearch() {
    const mainSearch = document.getElementById('searchInput');
    if (mainSearch && !document.getElementById('gds-home-official-results')) {
      window.handleSearch = async () => {
        const q = mainSearch.value.trim();
        if (!q) { alert('Hãy nhập từ khóa tra cứu.');return; }
        if (q.length > 80) { alert('Từ khóa tối đa 80 ký tự.');return; }
        ensurePanel();
        notify('Đang tìm nội dung đã công bố trong cả 3 module...');
        try {
          const matches = await Promise.all(['LEGAL','ADMIN','SCAM'].map(
            domain => get('/content?domain=' + domain + '&q=' + encodeURIComponent(q))
          ));
          const items = matches.flat();
          currentSearch=q;
          renderRecords(items);
          notify('Tìm thấy ' + items.length + ' nội dung đã công bố.');
          panel.scrollIntoView({behavior:'smooth',block:'nearest'});
        } catch(err) {notify('Không thể tìm kiếm: '+err.message,true);}
      };
      mainSearch.addEventListener('keydown',e=>{if(e.key==='Enter')window.handleSearch();});
    }
    const inputs = { LEGAL:'legalSearch', ADMIN:'procedureSearch', SCAM:'scamSearch' };
    const input = document.getElementById(inputs[currentDomain]);
    if (input && !((currentDomain==='LEGAL'||currentDomain==='ADMIN') && document.getElementById('gds-reference-library'))) {
      const callback = () => refresh(currentDomain,input.value,true);
      if (currentDomain==='LEGAL')window.handleLegalSearch=callback;
      if (currentDomain==='ADMIN')window.handleProcedureSearch=callback;
      if (currentDomain==='SCAM')window.handleSearch=callback;
      input.addEventListener('keydown',e=>{if(e.key==='Enter')callback();});
      const initial = new URLSearchParams(location.search).get('q');
      if (initial) {input.value=initial; setTimeout(callback,0);}
    }
    if (currentDomain==='ADMIN') {
      // Replace fake alert handlers of 11 UI tiles with real SQL Server searches.
      document.querySelectorAll('.procedure-card').forEach(card => {
        card.removeAttribute('onclick');
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        const label = card.querySelector('span')?.textContent?.trim() || '';
        const mapped = label.includes('giấy tờ') ? 'hộ chiếu' : label;
        const run = () => {
          const search = document.getElementById('procedureSearch');
          if (search) search.value = mapped;
          const library=document.getElementById('gds-reference-library');
          const q=library?.querySelector('#gds-lib-search'); if(q){q.value=mapped;q.dispatchEvent(new Event('input',{bubbles:true})); library.scrollIntoView({behavior:'smooth',block:'start'});}else refresh('ADMIN',mapped,true);
        };
        card.addEventListener('click', run);
        card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') {e.preventDefault();run();} });
      });
    }
    if (currentDomain==='LEGAL' && !document.getElementById('gds-reference-library')) {
      window.selectCategory=(btn, categoryName)=>{
        document.querySelectorAll('.category-btn').forEach(x=>x.classList.remove('active'));
        btn.classList.add('active');
        const input=document.getElementById('legalSearch'); if(input)input.value=categoryName;
        const lib=document.getElementById('gds-reference-library'); const q=lib?.querySelector('#gds-lib-search');
        if(q){q.value=categoryName.replace(/^LUẬT /,'');q.dispatchEvent(new Event('input',{bubbles:true}));lib.scrollIntoView({behavior:'smooth',block:'start'});}else refresh('LEGAL',categoryName,true);
      };
    }
    if (currentDomain==='SCAM') {
      installScamCategories();
      window.handleReportClick=()=>notify('Biểu mẫu báo cáo trực tuyến chưa được triển khai. Nếu bị lừa đảo, hãy liên hệ ngân hàng và trình báo công an theo hướng dẫn phía trên.',true);
    }
  }
  function installChat() {
    const fn = async () => {
      const input = document.querySelector('#chatInput, #aiInput');
      const body = document.getElementById('chatBody');
      const q = input?.value.trim();
      if (!q || !body) return;
      // All legacy page chat buttons must use the same real assistant and history.
      // Do not tell visitors AI is unimplemented when the unified chat is available.
      if (window.GDSChat && typeof window.GDSChat.ask === 'function') {
        input.value = '';
        await window.GDSChat.ask(q);
        return;
      }
      ensurePanel();
      const bubble=el('div', currentDomain==='SCAM'?'chat-msg user':'msg',q);
      if(currentDomain!=='SCAM'){bubble.style.background='#3b82f6';bubble.style.color='white';bubble.style.alignSelf='flex-end';}
      body.append(bubble);
      input.value='';
      const answer=el('div',currentDomain==='SCAM'?'chat-msg bot':'msg msg-ai','Đang tra cứu nội dung công khai...');
      body.append(answer);
      try {
        const items=await get('/content?domain='+encodeURIComponent(currentDomain)+'&q='+encodeURIComponent(q));
        answer.textContent=items.length
          ? 'Kết quả đã công bố: '+items.slice(0,3).map(x=>x.title).join('; ')+'. Xem mục dữ liệu phía dưới để đọc chi tiết. (Đây là tìm kiếm CSDL, chưa phải AI.)'
          : 'Chưa có thông tin đã công bố phù hợp. Chức năng trả lời bằng AI chưa được triển khai.';
        renderRecords(items); currentSearch=q;
      } catch { answer.textContent='Không kết nối được dữ liệu. Trợ lý AI hiện chưa được kích hoạt.'; }
      body.scrollTop=body.scrollHeight;
    };
    window.sendMsg=fn;
    window.sendAIMessage=fn;
  }
  function init() {
    // Authentication pages are managed exclusively by gds-auth.js and the real API.
    if (currentPage==='login.html'||currentPage==='register.html') return;
    if (!(currentPage in pages)) return;
    // The original home page and category layouts are not modified on page load.
    // Results panel is created only after an explicit search/click.
    installSearch();
    if(currentDomain) installChat();
    if (currentDomain === 'SCAM') {
      refresh('SCAM','',false);
      const article = new URLSearchParams(location.search).get('bai');
      if (article && /^[A-Za-z0-9_-]{1,100}$/.test(article)) viewDetail(article, 'SCAM');
    }
    if(currentPage==='index.html') {
      const ai=document.querySelector('.ai-btn');
      if(ai) ai.onclick=()=>alert('Trợ lý AI chưa được triển khai. Bạn có thể tra cứu nội dung đã công bố bằng thanh tìm kiếm.');
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
