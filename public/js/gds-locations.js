'use strict';
(function () {
  const province = document.getElementById('gdsProvince');
  const results = document.getElementById('gdsProcedureResults');
  const status = document.getElementById('gdsProvinceStatus');
  if (!province || !results || !status) return;
  const params = new URLSearchParams(location.search);
  let provinces = [];
  let requestId = 0;
  const text = (node, value) => { node.textContent = value; };
  const label = (code) => provinces.find(p => p.code === code)?.name || 'Toàn quốc';
  const api = async (url) => {
    const r = await fetch(url, {headers: {'Accept': 'application/json'}, credentials: 'same-origin'});
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  };
  async function search(query) {
    const current = ++requestId;
    const code = province.value;
    const phrase = String(query ?? document.getElementById('procedureSearch')?.value ?? '').trim().toLocaleLowerCase('vi');
    results.hidden = false;
    results.replaceChildren();
    const heading = document.createElement('h3');
    text(heading, 'Thủ tục đã được công bố · ' + label(code));
    results.appendChild(heading);
    const info = document.createElement('p');
    info.className = 'gds-empty';
    text(info, 'Đang kiểm tra nội dung đã công bố và nguồn chứng cứ…');
    results.appendChild(info);
    try {
      const filter = new URLSearchParams();
      if (code) filter.set('provinceCode', code);
      const rows = await api('/api/procedures' + (filter.toString() ? '?' + filter : ''));
      if (current !== requestId) return;
      if (!Array.isArray(rows)) throw new Error('Định dạng API không hợp lệ');
      const normalize = str => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi');
      const found = rows.filter(row => !phrase || normalize([row.title,row.summary,row.procedureCode].join(' ')).includes(normalize(phrase)));
      info.remove();
      if (!found.length) {
        const p = document.createElement('p');
        p.className = 'gds-empty';
        text(p, 'Chưa có thủ tục phù hợp đã được kiểm duyệt và công bố. Việc chọn địa phương không có nghĩa đã xác minh nơi tiếp nhận. Hãy tra cứu trên Cổng Dịch vụ công Quốc gia hoặc cơ quan địa phương.');
        results.appendChild(p);
        const ref = document.createElement('a');
        ref.href = 'https://dichvucong.gov.vn/';
        ref.target = '_blank'; ref.rel = 'noopener noreferrer';
        ref.textContent = 'Tra cứu thủ tục tại Cổng Dịch vụ công Quốc gia ↗';
        results.appendChild(ref);
      } else {
        const note = document.createElement('p');
        text(note, 'Nội dung dùng chung có thể áp dụng toàn quốc; địa chỉ tiếp nhận địa phương chỉ hiển thị sau xác minh riêng.');
        results.appendChild(note);
        for (const row of found) {
          const item = document.createElement('article');
          item.className = 'gds-result-item';
          const anchor = document.createElement('a');
          anchor.href = '/api/procedures/' + encodeURIComponent(row.businessCode);
          text(anchor, row.title || row.businessCode);
          anchor.addEventListener('click', e => { e.preventDefault(); showDetail(row.businessCode); });
          const desc = document.createElement('p');
          text(desc, row.summary || '');
          item.append(anchor, desc);
          results.appendChild(item);
        }
      }
    } catch (err) {
      if (current !== requestId) return;
      text(info, 'Không tải được dữ liệu đã công bố (' + err.message + '). Vui lòng thử lại; không sử dụng thông tin chưa kiểm chứng.');
    }
  }
  async function showDetail(code) {
    const current = ++requestId;
    results.hidden = false;
    results.replaceChildren();
    const heading = document.createElement('h3');
    text(heading, 'Đang mở thủ tục đã được công bố…');
    results.appendChild(heading);
    try {
      const q = new URLSearchParams();
      if (province.value) q.set('provinceCode', province.value);
      const url = '/api/procedures/' + encodeURIComponent(code) + (q.toString() ? '?' + q : '');
      const item = await api(url);
      if (current !== requestId) return;
      text(heading, item.title || 'Chi tiết thủ tục');
      const create = (tag, value) => { const node = document.createElement(tag); text(node, value); results.appendChild(node); return node; };
      create('p', item.summary || '');
      create('p', 'Mã thủ tục: ' + (item.procedureCode || 'Đang cập nhật'));
      create('p', 'Thời hạn: ' + (item.processingTime || 'Chưa có nội dung đã kiểm chứng'));
      create('p', 'Kết quả: ' + (item.resultDescription || 'Chưa có nội dung đã kiểm chứng'));
      if (Array.isArray(item.steps) && item.steps.length) {
        create('h4','Trình tự thực hiện');
        for (const step of item.steps) create('p', String(step.stepNo) + '. ' + step.title + ': ' + step.instruction);
      }
      if (Array.isArray(item.requirements) && item.requirements.length) {
        create('h4','Hồ sơ cần chuẩn bị');
        for (const req of item.requirements) create('p', '• ' + req.documentName + (req.conditionNote ? ': ' + req.conditionNote : ''));
      }
      create('p', 'Nơi tiếp nhận địa phương: Chưa có thông tin đã xác minh để hiển thị. Vui lòng tra cứu tại cơ quan chức năng.');
      const back = document.createElement('button');
      back.type = 'button'; text(back,'Quay lại danh sách');
      back.addEventListener('click',()=>search());
      results.appendChild(back);
    } catch (err) {
      text(heading, 'Không thể mở thủ tục (' + err.message + '). Vui lòng tra cứu lại.');
    }
  }
  window.gdsSearchProcedures = () => search();
  window.gdsSearchCategory = name => {
    const input = document.getElementById('procedureSearch');
    if (input) input.value = name;
    return search(name);
  };
  province.addEventListener('change', () => {
    const url = new URL(location.href);
    if (province.value) url.searchParams.set('provinceCode', province.value);
    else url.searchParams.delete('provinceCode');
    history.replaceState(null, '', url.pathname + url.search);
    text(status, 'Đang chọn ' + label(province.value) + '. Địa chỉ tiếp nhận cần được đối chiếu riêng.');
    search();
  });
  api('/api/locations/provinces').then(data => {
    if (!Array.isArray(data.provinces) || data.provinces.length !== 34) throw new Error('Danh mục địa phương chưa hợp lệ');
    provinces = data.provinces;
    for (const record of provinces) {
      const o = document.createElement('option');
      o.value = record.code;
      text(o, record.name);
      province.appendChild(o);
    }
    const requested = params.get('provinceCode');
    if (requested && provinces.some(p => p.code === requested)) province.value = requested;
    text(status, 'Danh mục 34 tỉnh/thành theo Quyết định 19/2025/QĐ-TTg. Dữ liệu thủ tục chưa công bố sẽ không được hiển thị.');
    search();
  }).catch(err => {
    province.disabled = true;
    text(status, 'Không thể tải danh mục địa phương (' + err.message + '). Vui lòng kiểm tra backend.');
  });
})();
