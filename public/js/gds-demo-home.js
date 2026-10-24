(() => {
  'use strict';

  const demoData = [
    {
      domain: 'Pháp luật & Quyền lợi',
      title: 'Hướng dẫn tra cứu quyền lợi',
      summary: 'Thông tin minh họa về cách tìm hiểu quyền và lợi ích của công dân.'
    },
    {
      domain: 'Thủ tục hành chính',
      title: 'Hướng dẫn chuẩn bị hồ sơ',
      summary: 'Thông tin minh họa về các bước chuẩn bị và nộp hồ sơ hành chính.'
    },
    {
      domain: 'Cảnh báo lừa đảo',
      title: 'Nhận biết tin nhắn giả mạo',
      summary: 'Các dấu hiệu minh họa giúp nhận biết tin nhắn và cuộc gọi đáng ngờ.'
    }
  ];

  function renderDemo() {
    const container =
     document.getElementById('searchResults') ||
     document.querySelector('main') ||
     document.body;

    const section = document.createElement('section');
    section.id = 'demoHomeResults';

    const heading = document.createElement('h3');
    heading.textContent = 'Nội dung minh họa trên hệ thống';
    section.appendChild(heading);

    const notice = document.createElement('p');
    notice.textContent =
      'DỮ LIỆU DEMO — Phục vụ kiểm thử đồ án, chưa được xác minh hoặc công bố chính thức.';
    section.appendChild(notice);

    for (const item of demoData) {
      const card = document.createElement('article');
      card.className = 'result';
      card.style.marginBottom = '12px';

      const domain = document.createElement('p');
      domain.className = 'meta';
      domain.textContent = item.domain + ' · DEMO';

      const title = document.createElement('h3');
      title.textContent = item.title;

      const summary = document.createElement('p');
      summary.textContent = item.summary;

      card.append(domain, title, summary);
      section.appendChild(card);
    }

    if (document.getElementById('demoHomeResults')) return;
    container.appendChild(section);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderDemo);
  } else {
    renderDemo();
  }
})();