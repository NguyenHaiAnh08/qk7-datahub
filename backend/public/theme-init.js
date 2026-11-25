// theme-init.js — Khởi tạo Theme giao diện trước khi render SPA và gán nonce cho Dynamic Style Tags
(function() {
  try {
    var MIGRATION_KEY = 'qk7_theme_default_light_v1';
    if (!localStorage.getItem(MIGRATION_KEY)) {
      localStorage.setItem('qk7_theme', 'light');
      localStorage.setItem(MIGRATION_KEY, '1');
    }
    var stored = localStorage.getItem('qk7_theme');
    var theme = stored === 'dark' ? 'dark' : 'light';
    var root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
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
