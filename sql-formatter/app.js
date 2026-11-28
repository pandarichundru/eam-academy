(function () {
  'use strict';

  const input = document.getElementById('sqlInput');
  const highlight = document.getElementById('highlight');
  const gutter = document.getElementById('gutter');
  const statusBar = document.getElementById('statusBar');
  const cursorStats = document.getElementById('cursorStats');
  const btnFormat = document.getElementById('btnFormat');
  const btnMinify = document.getElementById('btnMinify');
  const btnSample = document.getElementById('btnSample');
  const btnCopy = document.getElementById('btnCopy');
  const btnClear = document.getElementById('btnClear');
  const btnTheme = document.getElementById('btnTheme');
  const optDialect = document.getElementById('optDialect');
  const optIndent = document.getElementById('optIndent');
  const optCase = document.getElementById('optCase');
  const optComma = document.getElementById('optComma');
  const shortcutHint = document.getElementById('shortcutHint');

  const SAMPLE_SQL = "with open_orders as (select e.evt_code, e.evt_desc, e.evt_object, e.evt_created, case when e.evt_priority = '1' then 'Urgent' else 'Normal' end as prio from r5events e where e.evt_status = 'Open' and e.evt_created between '2026-01-01' and '2026-12-31') select o.obj_code, o.obj_desc, w.evt_code, w.prio, row_number() over (partition by o.obj_code order by w.evt_created) as seq from r5objects o left join open_orders w on w.evt_object = o.obj_code order by o.obj_code, w.evt_code;";

  const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');
  shortcutHint.textContent = isMac ? '⌘⇧F' : 'Ctrl+Shift+F';

  // In-memory theme only (no localStorage or cookies)
  let dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  function applyTheme() {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    btnTheme.textContent = dark ? 'Light mode' : 'Dark mode';
  }
  applyTheme();

  function getOptions() {
    return {
      dialect: optDialect.value,
      indent: optIndent.value,
      keywordCase: optCase.value,
      commaPosition: optComma.value
    };
  }

  function showNotice(msg, kind) {
    if (!msg) {
      statusBar.innerHTML = '';
      return;
    }
    const div = document.createElement('div');
    div.className = `notice ${kind}`;
    div.textContent = msg;
    statusBar.innerHTML = '';
    statusBar.appendChild(div);
  }

  let lastLineCount = 0;
  let rafId = 0;
  function renderEditor(immediate = false) {
    const val = input.value;
    const lineCount = Math.max(1, val.split('\n').length);
    if (lineCount !== lastLineCount) {
      lastLineCount = lineCount;
      const nums = new Array(lineCount);
      for (let i = 0; i < lineCount; i++) nums[i] = `<div>${i + 1}</div>`;
      gutter.innerHTML = nums.join('');
    }
    const paint = () => {
      highlight.innerHTML = window.SQLFormatterEngine.highlightHTML(val, optDialect.value) + (val.endsWith('\n') ? ' ' : '');
    };
    if (rafId) cancelAnimationFrame(rafId);
    if (immediate || val.length <= 12000) paint();
    else rafId = requestAnimationFrame(paint);
    updateCursorStats();
  }

  function updateCursorStats() {
    const pos = input.selectionStart || 0;
    const before = input.value.slice(0, pos);
    const lines = before.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    cursorStats.textContent = `Line ${line}, Col ${col} · ${input.value.length.toLocaleString()} chars`;
  }

  function syncScroll() {
    highlight.scrollTop = input.scrollTop;
    highlight.scrollLeft = input.scrollLeft;
    gutter.scrollTop = input.scrollTop;
  }

  function doFormat() {
    if (!input.value.trim()) {
      showNotice('', '');
      return;
    }
    const t0 = performance.now();
    const res = window.SQLFormatterEngine.formatSQL(input.value, getOptions());
    const ms = (performance.now() - t0).toFixed(1);
    if (res.error) {
      showNotice(res.error, 'error');
      return;
    }
    input.value = res.formatted;
    renderEditor(true);
    const msg = `Formatted ${res.statements} statement${res.statements === 1 ? '' : 's'} in ${ms} ms.`;
    showNotice(msg, 'ok');
    setTimeout(() => {
      if (statusBar.textContent === msg) showNotice('', '');
    }, 2000);
  }

  function doMinify() {
    if (!input.value.trim()) return;
    const res = window.SQLFormatterEngine.minifySQL(input.value, getOptions());
    if (res.error) {
      showNotice(res.error, 'error');
      return;
    }
    input.value = res.minified;
    renderEditor();
    showNotice('SQL minified.', 'ok');
    setTimeout(() => {
      if (statusBar.textContent === 'SQL minified.') showNotice('', '');
    }, 1800);
  }

  async function doCopy() {
    if (!input.value) return;
    try {
      await navigator.clipboard.writeText(input.value);
      const prev = btnCopy.textContent;
      btnCopy.textContent = 'Copied';
      setTimeout(() => { btnCopy.textContent = prev; }, 1400);
    } catch {
      input.select();
      document.execCommand('copy');
    }
  }

  function doClear() {
    input.value = '';
    showNotice('', '');
    renderEditor();
    input.focus();
  }

  input.addEventListener('input', () => {
    showNotice('', '');
    renderEditor();
  });
  input.addEventListener('scroll', syncScroll);
  input.addEventListener('click', updateCursorStats);
  input.addEventListener('keyup', updateCursorStats);

  // Tab indentation inside editor
  input.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const unit = optIndent.value === 'tab' ? '\t' : ' '.repeat(Number(optIndent.value) || 2);
      const st = input.selectionStart;
      const en = input.selectionEnd;
      input.value = input.value.slice(0, st) + unit + input.value.slice(en);
      input.setSelectionRange(st + unit.length, st + unit.length);
      renderEditor();
    }
  });

  // Ctrl/Cmd + Shift + F to format
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      doFormat();
    }
  });

  btnFormat.addEventListener('click', doFormat);
  btnMinify.addEventListener('click', doMinify);
  btnSample.addEventListener('click', () => {
    input.value = SAMPLE_SQL;
    showNotice('', '');
    renderEditor(true);
    input.focus();
  });
  btnCopy.addEventListener('click', doCopy);
  btnClear.addEventListener('click', doClear);
  btnTheme.addEventListener('click', () => {
    dark = !dark;
    applyTheme();
  });
  optDialect.addEventListener('change', () => renderEditor(true));
  optIndent.addEventListener('change', () => {
    input.style.tabSize = optIndent.value === '4' ? '4' : '2';
    highlight.style.tabSize = input.style.tabSize;
  });

  // Initial sample query (purely illustrative; never persisted)
  input.value = SAMPLE_SQL;
  renderEditor(true);
})();
