(function () {
  'use strict';

  var SITE_URL = 'https://sarca.digital/';
  var LINK_ID = 'sarCa-back-to-site';

  function isAuthSurface() {
    try {
      if (new URLSearchParams(window.location.search).get('sarCa-original') === '1') return true;
      if (document.getElementById('sarCa-map-dashboard-shell')) return false;
    } catch (_) {}
    var text = String(document.body && document.body.innerText || '').toLowerCase();
    return /entrar como (passageiro|motorista)|criar conta triunfal|número de telemóvel/.test(text) || !document.getElementById('sarCa-map-dashboard-shell');
  }

  function sync() {
    var existing = document.getElementById(LINK_ID);
    if (!isAuthSurface()) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    var link = document.createElement('a');
    link.id = LINK_ID;
    link.href = SITE_URL;
    link.textContent = '← Voltar ao site SARCA';
    link.setAttribute('aria-label', 'Voltar ao site SARCA');
    link.style.cssText = [
      'position:fixed', 'top:16px', 'left:18px', 'z-index:2147483647',
      'display:inline-flex', 'align-items:center', 'min-height:38px',
      'padding:0 14px', 'border:1px solid rgba(245,183,27,.6)',
      'border-radius:999px', 'background:rgba(6,21,65,.94)',
      'box-shadow:0 8px 24px rgba(0,0,0,.25)', 'color:#ffd66a',
      'font:600 12px/1.2 Segoe UI,Arial,sans-serif', 'text-decoration:none',
      'backdrop-filter:blur(12px)'
    ].join(';');
    document.body.appendChild(link);
  }

  function boot() {
    sync();
    new MutationObserver(sync).observe(document.body, { childList: true, subtree: true, characterData: true });
    window.setInterval(sync, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
