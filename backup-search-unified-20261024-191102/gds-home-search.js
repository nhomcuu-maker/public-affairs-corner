(() => {
  'use strict';

  const searchInput = document.getElementById('searchInput');
  const main = document.querySelector('.main-container');

  if (!searchInput || !main) return;

  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();

  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  let catalogPromise;

  function loadCatalog() {
    if (!catalogPromise) {
      catalogPromise = Promise.all([
        fetch('/library-catalog.json', { cache: 'no-store' })
          .then(r => r.ok ? r.json() : null),
        fetch('/curated-official-catalog.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
        fetch('/official-reference-catalog.json', { cache: 'no-store' })
          .then(r => r.ok ? r.json() : null)
      ]).then(([local, curated, official]) => [
        ...(local?.items || []),
        ...(curated?.items || []),
        ...(official?.items || [])
      ]);
    }
    return catalogPromise;
  }

  function safeUrl(value) {
    const url = String(value || '');

    if (/^\/library-files\/[A-Za-z0-9_-]+\.pdf$/.test(url)) {
      return url;
    }

    try {
      const parsed = new URL(url);
      if (
        parsed.protocol === 'https:' &&
        ['congbao.chinhphu.vn', 'chinhphu.vn'].includes(parsed.hostname) &&
        !parsed.port &&
        !parsed.username &&
        !parsed.password
      ) {
        return parsed.href;
      }
    } catch {}

    return null;
  }

  const section = create('section', 'gds-live');
  section.id = 'gds-home-official-results';
  section.hidden = true;

  const heading = create('h2', '', 'Văn bản pháp luật và nguồn tham khảo');
  const status = create('p', 'gds-status');
  const list = create('div', 'gds-list');
  const more = create('a', 'gds-dev-link', 'Xem toàn bộ kết quả trong thư viện ↗');

  section.append(
    heading,
    create(
      'p',
      'gds-muted',
      'Nguồn Công báo và PDF tham khảo. Chưa xác minh hiệu lực; cần đối chiếu bản gốc trước khi áp dụng.'
    ),
    status,
    list,
    more
  );

  main.prepend(section);

  let serial = 0;

  async function search() {
    const query = searchInput.value.trim();
    if (!query || query.length > 80) return;

    const current = ++serial;

    section.hidden = false;
    status.textContent = 'Đang tìm văn bản trong thư viện...';
    list.replaceChildren();

    more.href = '/thu-vien.html?q=' + encodeURIComponent(query);

    try {
      const items = await loadCatalog();
      if (current !== serial) return;

      const words = normalize(query).split(/\s+/).filter(Boolean);
      const unique = new Set();

      const matches = items
        .map(item => {
          const url = safeUrl(item.url);
          if (!url) return null;

          const title = normalize(item.title);
          const topic = normalize(item.topic);
          const description = normalize(item.description || item.excerpt);
          const code = normalize(item.documentCode);

          const phrase = normalize(query);
          const words = phrase.split(/\s+/).filter(Boolean);

          let score = 0;

          if (title.includes(phrase)) score += 100;
          if (title.includes('bo luat lao dong') && phrase === 'luat lao dong') score += 100;
          if (words.every(w => title.includes(w))) score += 60;
          if (topic.includes(phrase)) score += 30;
          if (description.includes(phrase)) score += 10;
          if (code.includes(phrase)) score += 80;

          if (score === 0) return null;

          return { ...item, _score: score };
        })
        .filter(Boolean)
        .sort((a, b) => b._score - a._score)
        .filter(item => {
          const key = item.documentCode
            ? normalize(item.documentCode)
            : safeUrl(item.url);

          if (unique.has(key)) return false;
          unique.add(key);
          return true;
        });
      status.textContent = `Tìm thấy ${matches.length} văn bản tham khảo phù hợp.`;

      if (!matches.length) {
        list.append(create('p', 'gds-muted',
          'Không có văn bản phù hợp. Hãy thử từ khóa khác hoặc mở thư viện đầy đủ.'));
      }

      matches.slice(0, 5).forEach(item => {
        const card = create('article', 'gds-item');

        const title = create('strong', '', item.title || 'Văn bản chưa có tên');
        const meta = create(
          'span',
          '',
          (item.topic || 'Chưa phân loại') +
          ' · ' +
          (item.origin === 'official_rss'
            ? 'Nguồn Công báo'
            : 'PDF tham khảo')
        );

        const link = create(
          'a',
          'gds-dev-link',
          item.origin === 'official_rss'
            ? 'Xem nguồn Công báo ↗'
            : 'Đọc PDF ↗'
        );

        link.href = safeUrl(item.url);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.referrerPolicy = 'no-referrer';

        card.append(title, meta, link);
        list.append(card);
      });

      section.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (error) {
      if (current !== serial) return;
      status.textContent = 'Không tải được thư viện văn bản. Vui lòng thử lại.';
      console.warn('Library search failed:', error);
    }
  }

  // Lắng nghe thao tác tìm kiếm mà không thay đổi gds-live.js.
  const searchButton = searchInput.closest('.search-box')?.querySelector('button');

  if (searchButton) {
    searchButton.addEventListener('click', search);
  }

  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') search();
  });

})();

