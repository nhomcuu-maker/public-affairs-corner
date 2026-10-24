# Goc Dan Sinh - safe additive patch (PowerShell 5.1 compatible)
$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$pub = Join-Path $root 'public'
if (!(Test-Path (Join-Path $pub 'index.html'))) { throw 'Run from GocDanSinh project root.' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root ('backup-search-' + $stamp)
New-Item -ItemType Directory -Path $backup | Out-Null
$files = @('index.html','phap-luat-quyen-loi.html','thu-tuc-hanh-chinh.html','thu-vien.html','js/gds-home-search.js')
foreach ($name in $files) {
  $src = Join-Path $pub $name
  if (Test-Path $src) {
    $dest = Join-Path $backup $name
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
    Copy-Item $src $dest -Force
  }
}
$utf8 = New-Object System.Text.UTF8Encoding($false)
$catalog = @'
{
  "items": [
    {
      "title": "Bộ luật Lao động số 45/2019/QH14",
      "documentCode": "45/2019/QH14",
      "domain": "LEGAL",
      "topic": "Lao động, việc làm và an sinh",
      "searchText": "bộ luật lao động luật lao động 45/2019/QH14 hợp đồng lao động tiền lương nghỉ việc",
      "url": "https://chinhphu.vn/?docid=198540&pageid=27160",
      "origin": "official_reference",
      "validityNote": "Cần kiểm tra tình trạng hiệu lực và văn bản sửa đổi tại nguồn chính thức"
    }
  ]
}
'@
[System.IO.File]::WriteAllText((Join-Path $pub 'curated-official-catalog.json'), $catalog, $utf8)

# Add a separate search enhancement without changing existing search internals.
$addon = @'
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
    fetch('/curated-official-catalog.json', {cache:'no-store'}).then(r => r.ok ? r.json() : {items:[]}).then(data => {
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
'@
[System.IO.File]::WriteAllText((Join-Path $pub 'js/gds-search-enhancement.js'), $addon, $utf8)

# Homepage: add the curated reference to the existing catalog reader with safe, exact checks.
$homePath = Join-Path $pub 'js/gds-home-search.js'
if (Test-Path $homePath) {
  $s = [System.IO.File]::ReadAllText($homePath)
  if (!$s.Contains('curated-official-catalog.json')) {
    $needle = "fetch('/official-reference-catalog.json', { cache: 'no-store' })"
    if ($s.Contains($needle)) {
      $s = $s.Replace($needle, "fetch('/curated-official-catalog.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),`n        " + $needle)
      $s = $s.Replace('([local, official])', '([local, curated, official])')
      $s = $s.Replace('...(local?.items || []),', '...(local?.items || []),`n        ...(curated?.items || []),'.Replace('`n',"`n"))
      $s = $s.Replace("parsed.hostname === 'congbao.chinhphu.vn'", "['congbao.chinhphu.vn', 'chinhphu.vn'].includes(parsed.hostname)")
      [System.IO.File]::WriteAllText($homePath, $s, $utf8)
    } else { Write-Warning 'Homepage reader differs; curated reference is available on category pages.' }
  }
}
foreach ($name in @('phap-luat-quyen-loi.html','thu-tuc-hanh-chinh.html','thu-vien.html')) {
  $p = Join-Path $pub $name
  if (!(Test-Path $p)) { continue }
  $s = [System.IO.File]::ReadAllText($p)
  if (!$s.Contains('gds-search-enhancement.js') -and $s.Contains('</body>')) {
    $s = $s.Replace('</body>', '<script defer src="./js/gds-search-enhancement.js"></script>' + "`r`n" + '</body>')
    [System.IO.File]::WriteAllText($p, $s, $utf8)
  }
}
Write-Host ('PATCH COMPLETED. Backup: ' + $backup) -ForegroundColor Green
Write-Host 'Refresh with Ctrl+F5 and test: luat lao dong.'
