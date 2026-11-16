// theme-init.js — Khởi tạo Theme giao diện trước khi render SPA và gán nonce cho Dynamic Style Tags
(function() {
  try {
    const theme = localStorage.getItem('qk7_theme') || 'dark';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }

    // Auto-attach CSP nonce to dynamically created <style> tags (Ant Design v5 CSS-in-JS)
    var origCreate = document.createElement;
    document.createElement = function(tagName, options) {
      var el = origCreate.call(document, tagName, options);
      if (el && typeof tagName === 'string' && tagName.toLowerCase() === 'style') {
        var n = (typeof window !== 'undefined' && window.__CSP_NONCE__) ||
                (document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content'));
        if (n) {
          try { el.nonce = n; el.setAttribute('nonce', n); } catch(e) {}
        }
      }
      return el;
    };
  } catch (e) {}
})();
