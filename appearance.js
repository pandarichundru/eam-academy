(() => {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const key = 'eam3:appearance';
  let mode = 'system';
  try {
    const saved = localStorage.getItem(key);
    if (saved === 'light' || saved === 'dark') mode = saved;
  } catch {}
  function apply() {
    document.documentElement.dataset.theme = mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;
    document.querySelectorAll('[data-appearance]').forEach(select => { select.value = mode; });
  }
  apply();
  media.addEventListener('change', apply);
  document.addEventListener('DOMContentLoaded', apply);
  document.addEventListener('change', event => {
    if (!event.target.matches('[data-appearance]')) return;
    mode = event.target.value;
    try { localStorage.setItem(key, mode); } catch {}
    apply();
  });
})();
