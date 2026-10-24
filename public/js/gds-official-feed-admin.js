(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const text = (node, value) => { node.textContent = value == null ? '' : String(value); return node; };
  const add = (parent, tag, content, cls) => {
    const element = document.createElement(tag);
    if (cls) element.className = cls;
    if (content !== undefined) text(element, content);
    parent.append(element);
    return element;
  };
  const state = { page: 1, total: 0, size: 20, q: '', busy: false };
  const date = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('vi-VN', { timeZone: 'UTC' });
  };
  const safeSourceUrl = (value) => {
    try {
      const uri = new URL(value);
      return uri.protocol === 'https:' && uri.hostname === 'congbao.chinhphu.vn'
        && (!uri.port || uri.port === '443') && !uri.username && !uri.password ? uri.href : null;
    } catch { return null; }
  };
  const sourceLink = (parent, value) => {
    const url = safeSourceUrl(value);
    if (!url) return add(parent, 'span', 'Liên kết không hợp lệ', 'feed-warning');
    const a = add(parent, 'a', 'Mở tại Công báo');
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.referrerPolicy = 'no-referrer';
    return a;
  };
  const api = async (path) => {
    const result = await fetch(path, { credentials: 'same-origin', cache: 'no-store', headers: { 'Accept': 'application/json' } });
    const body = await result.json().catch(() => ({}));
    if (!result.ok) {
      if (result.status === 401) throw Error('Bạn cần đăng nhập tài khoản nội bộ.');
      if (result.status === 403) throw Error('Tài khoản không có quyền xem hàng chờ RSS.');
      throw Error(body.message || 'HTTP ' + result.status);
    }
    return body;
  };
  const showStatus = (message, error = false) => {
    $('feed-status').className = error ? 'notice error' : 'notice';
    text($('feed-status'), message);
  };
  async function overview() {
    const root = $('feed-overview'); root.replaceChildren();
    const data = await api('/api/admin/official-feed/overview');
    const metrics = [
      ['Văn bản trong hàng chờ', data.totalEntries],
      ['Phiên bản metadata', data.totalSnapshots],
      ['Snapshot chờ kiểm duyệt', data.pendingSnapshots],
    ];
    for (const [label, value] of metrics) {
      const card = add(root, 'div', undefined, 'feed-metric');
      add(card, 'span', label, 'feed-muted'); add(card, 'strong', value ?? 0);
    }
    return data;
  }
  async function history(id) {
    const panel = $('feed-history-panel'), root = $('feed-history');
    panel.hidden = false; root.replaceChildren();
    add(root, 'p', 'Đang tải lịch sử...');
    panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
    try {
      const data = await api('/api/admin/official-feed/entries/' + encodeURIComponent(id) + '/history');
      root.replaceChildren(); sourceLink(root, data.entry.canonicalUrl);
      for (const item of data.snapshots || []) {
        const card = add(root, 'div', undefined, 'feed-history-record');
        add(card, 'strong', item.title);
        add(card, 'p', 'Ngày đăng: ' + date(item.publishedAt) + ' | Lần ghi: ' + date(item.capturedAt), 'feed-muted');
        add(card, 'p', 'Trạng thái: ' + item.reviewStatus, 'feed-warning');
        if (item.description) add(card, 'p', item.description);
      }
      if (!data.snapshots?.length) add(root, 'p', 'Không có snapshot.');
    } catch (e) { root.replaceChildren(); add(root, 'p', e.message || String(e), 'feed-warning'); }
  }
  async function list() {
    if (state.busy) return;
    state.busy = true;
    const tbody = $('feed-rows'); tbody.replaceChildren();
    showStatus('Đang tải metadata...');
    try {
      const args = new URLSearchParams({ page: String(state.page), size: String(state.size), q: state.q });
      const data = await api('/api/admin/official-feed/entries?' + args.toString());
      state.total = Number(data.total || 0);
      for (const record of data.items || []) {
        const row = add(tbody, 'tr');
        const name = add(row, 'td'); add(name, 'strong', record.title); sourceLink(name, record.canonicalUrl);
        add(row, 'td', date(record.publishedAt));
        add(row, 'td', record.reviewStatus, 'feed-warning');
        add(row, 'td', record.snapshotCount);
        const ops = add(row, 'td');
        const button = add(ops, 'button', 'Lịch sử'); button.type = 'button';
        button.addEventListener('click', () => history(record.entryId));
      }
      if (!data.items?.length) {
        const row = add(tbody, 'tr'), cell = add(row, 'td', 'Không có văn bản phù hợp.');
        cell.colSpan = 5;
      }
      text($('feed-page'), 'Trang ' + state.page + ' | Tổng ' + state.total + ' văn bản');
      $('feed-prev').disabled = state.page <= 1;
      $('feed-next').disabled = state.page * state.size >= state.total;
      showStatus('Đã tải ' + (data.items?.length || 0) + ' văn bản. Tất cả chỉ là metadata, CHƯA XÁC MINH và CHƯA CÔNG BỐ.');
    } catch (err) { showStatus(err.message || String(err), true); }
    finally { state.busy = false; }
  }
  $('feed-search').addEventListener('submit', (event) => {
    event.preventDefault(); state.page = 1; state.q = $('feed-q').value.trim(); void list();
  });
  $('feed-prev').addEventListener('click', () => { if (state.page > 1) { state.page--; void list(); } });
  $('feed-next').addEventListener('click', () => {
    if (state.page * state.size < state.total) { state.page++; void list(); }
  });
  void overview().then(() => list()).catch((e) => showStatus(e.message || String(e), true));
})();
