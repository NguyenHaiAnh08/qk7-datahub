// theme-init.js — Khởi tạo Theme giao diện trước khi render SPA
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
  } catch (e) {}
})();

