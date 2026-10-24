(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const make = (tag, text, cls) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = String(text); if (cls) node.className = cls; return node; };
  const add = (parent, tag, text, cls) => { const node = make(tag, text, cls); parent.appendChild(node); return node; };
  const domains = ['LEGAL', 'ADMIN', 'SCAM'];
  const names = { LEGAL: 'Pháp luật', ADMIN: 'Thủ tục', SCAM: 'Cảnh báo' };
  let activeSearch = 0;
  async function getJson(path) {
    const res = await fetch(path, { credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' } });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error('API ' + res.status);
    return data;
  }
  async function updateCounts() {
    const status = $('publicStatus');
    try {
      const data = await Promise.all(domains.map(d => getJson('/api/content?domain=' + d)));
      if (data.some(x => !Array.isArray(x))) throw new Error('API trả về dữ liệu không đúng định dạng');
      const counts = data.map(list => list.length);
      ['Legal', 'Admin', 'Scam'].forEach((d, i) => { $('count' + d).textContent = String(counts[i]); });
      $('publicCounts').hidden = false;
      $('publicStatus').parentNode.classList.toggle('warning', counts.every(c => c === 0));
      status.textContent = counts.every(c => c === 0)
        ? 'Website đã kết nối kho công khai, nhưng chưa có nội dung nào được kiểm duyệt và phát hành. Bạn vẫn có thể sử dụng tìm kiếm, trợ lý và liên kết đến nguồn chính thức; dữ liệu đang chờ duyệt không được hiển thị.'
        : 'Kho công khai đang phục vụ các nội dung đã đủ điều kiện phát hành. Con số hiển thị là số bản ghi API trả về (tối đa 50 mỗi lĩnh vực), không bao gồm bản nháp.';
    } catch (err) {
      status.textContent = 'Chưa kết nối được kho nội dung công khai (' + err.message + '). Kiểm tra backend tại /api/health. Không dùng dữ liệu chưa xác minh để thay thế.';
      status.parentNode.classList.add('warning');
    }
  }
  function validOfficialUrl(raw) {
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  function renderRecord(parent, record, label) {
    const card = add(parent, 'article', undefined, 'result');
    add(card, 'p', names[record.domain] || label || 'Đã công bố', 'meta');
    add(card, 'h3', record.title || 'Chưa có tiêu đề');
    add(card, 'p', record.summary || 'Xem nội dung và nguồn khi đã kiểm chứng.');
    const links = add(card, 'div');
    const button = add(links, 'button', 'Xem nội dung'); button.type = 'button';
    button.addEventListener('click', () => void showDetail(record));
    for (const src of (record.sources || []).slice(0, 3)) {
      const href = validOfficialUrl(src.url);
      if (!href) continue;
      const a = add(links, 'a', ' Nguồn chính thức ↗'); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.referrerPolicy = 'no-referrer';
    }
  }
  async function search() {
    const ticket = ++activeSearch, question = $('question').value.trim(), domain = $('domain').value;
    const status = $('searchStatus'), results = $('searchResults');
    if (question.length < 2 || question.length > 240) { status.textContent = 'Nhập từ 2 đến 240 ký tự.'; return; }
    results.replaceChildren(); status.textContent = 'Đang tìm nội dung đã duyệt…'; $('findButton').disabled = true;
    try {
      const q = new URLSearchParams({ q: question, domain, limit: '8' });
      const response = await getJson('/api/search?' + q);
      if (ticket !== activeSearch) return;
      const items = [...(Array.isArray(response.results) ? response.results : []), ...(Array.isArray(response.related) ? response.related : [])];
      status.textContent = items.length ? 'Tìm được ' + items.length + ' nội dung đã công bố hoặc liên quan.'
        : 'Chưa có kết quả đã được kiểm duyệt và phát hành phù hợp. Bạn có thể tra cứu trực tiếp tại các cổng chính thức bên dưới.';
      items.forEach(row => renderRecord(results, row));
      if (response.urgentSafety) add(results, 'p', 'Nếu bị yêu cầu cung cấp OTP hoặc chuyển tiền: không thực hiện theo cuộc gọi, tự xác minh qua kênh chính thức và liên hệ ngân hàng nếu đã chuyển tiền.');
    } catch (err) { if (ticket === activeSearch) status.textContent = 'Không thể tra cứu (' + err.message + '). Vui lòng kiểm tra kết nối backend.'; }
    finally { if (ticket === activeSearch) $('findButton').disabled = false; }
  }
  async function showDetail(item) {
    const backdrop = make('div', undefined, 'detail-backdrop');
    const modal = add(backdrop, 'div', undefined, 'detail-box');
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', 'Chi tiết đã công bố');
    const close = add(modal, 'button', 'Đóng ×', 'close'); close.type = 'button';
    const dismiss = () => backdrop.remove(); close.addEventListener('click', dismiss);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) dismiss(); });
    document.body.appendChild(backdrop); close.focus();
    add(modal, 'p', 'Đang đọc bản công khai từ SQL Server…');
    try {
      const code = encodeURIComponent(String(item.businessCode || ''));
      const data = await getJson(item.domain === 'ADMIN' ? '/api/procedures/' + code : '/api/content/' + code);
      modal.querySelectorAll('p:not(.close),h2,h3,ul').forEach(n => n.remove());
      add(modal, 'h2', data.title || item.title);
      add(modal, 'p', data.summary || '');
      if (data.bodyMarkdown) add(modal, 'p', data.bodyMarkdown);
      if (data.processingTime) add(modal, 'p', 'Thời hạn: ' + data.processingTime);
      for (const [heading, arr, mapper] of [
        ['Trình tự thực hiện', data.steps, x => x.stepNo + '. ' + x.title + ': ' + x.instruction],
        ['Hồ sơ cần chuẩn bị', data.requirements, x => x.documentName + (x.conditionNote ? ': ' + x.conditionNote : '')],
        ['Phí/lệ phí', data.fees, x => x.feeKind + ': ' + x.amount + ' ' + x.currency]
      ]) {
        if (!Array.isArray(arr) || !arr.length) continue;
        add(modal, 'h3', heading);
        const list = add(modal, 'ul'); arr.forEach(row => add(list, 'li', mapper(row)));
      }
      if (data.officeVerificationStatus === 'not_verified') add(modal, 'p', 'Địa chỉ tiếp nhận tại địa phương chưa có chứng cứ xác minh.');
      add(modal, 'p', 'Nội dung tham khảo: kiểm tra lại hiệu lực và cơ quan tiếp nhận trước khi làm thủ tục.');
    } catch (err) { add(modal, 'p', 'Chưa thể mở chi tiết (' + err.message + '). Vui lòng thử lại từ kết quả công khai.'); }
  }
  async function fillProvinces() {
    const info = $('provinceStatus');
    try {
      const response = await getJson('/api/locations/provinces');
      if (!Array.isArray(response.provinces) || response.provinces.length !== 34) throw new Error('Danh mục 34 tỉnh/thành chưa hợp lệ');
      for (const p of response.provinces) { const option = add($('province'), 'option', p.name); option.value = p.code; }
      info.textContent = 'Đã tải 34 tỉnh/thành phố. Nơi tiếp nhận riêng của từng tỉnh cần được kiểm chứng trước khi hiển thị.';
    } catch (err) { info.textContent = 'Không tải được danh mục địa phương (' + err.message + '). Bạn vẫn có thể mở trang thủ tục toàn quốc.'; }
  }
  $('quickSearch').addEventListener('submit', e => { e.preventDefault(); void search(); });
  $('province').addEventListener('change', () => {
    const code = $('province').value;
    $('procedureLink').href = '/thu-tuc-hanh-chinh.html' + (code ? '?provinceCode=' + encodeURIComponent(code) : '');
  });
  void updateCounts(); void fillProvinces();
})();
