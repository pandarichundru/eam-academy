/**
 * sql-autocomplete.js  –  EAM Academy SQL Autocomplete Widget
 *
 * Zero external dependencies. Vanilla ES2020.
 * Exposes:  window.SqlAutocomplete = { attach(textarea, getSchemaFn) → { detach() } }
 *
 * getSchemaFn() must return { tables: [{ name:string, columns:[{name,sql_type}] }] }
 * or a Promise that resolves to the same shape.
 *
 * Key interactions
 *   ArrowDown / ArrowUp  – move selection
 *   Enter / Tab          – insert selected token (Tab only when list is open)
 *   Escape               – close list
 *   Click on item        – insert token
 *   Click outside / blur – close list (blur deferred 150 ms so click fires first)
 *
 * SQL keywords provided as fallback when no schema match exists.
 */

(function () {
  'use strict';

  /* ── SQL keywords for fallback suggestions ─────────────────────────────── */
  const SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
    'FULL', 'CROSS', 'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'LIKE',
    'BETWEEN', 'IS', 'NULL', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT',
    'OFFSET', 'UNION', 'ALL', 'DISTINCT', 'AS', 'CASE', 'WHEN', 'THEN',
    'ELSE', 'END', 'INSERT', 'UPDATE', 'DELETE', 'WITH', 'RECURSIVE',
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'IFNULL', 'NULLIF',
    'CAST', 'DATE', 'DATETIME', 'STRFTIME', 'SUBSTR', 'LENGTH', 'TRIM',
    'UPPER', 'LOWER', 'REPLACE', 'ROUND', 'ABS', 'ROW_NUMBER', 'RANK',
    'DENSE_RANK', 'OVER', 'PARTITION', 'ASC', 'DESC', 'NULLS', 'FIRST',
    'LAST', 'CREATE', 'TABLE', 'INDEX', 'VIEW', 'DROP', 'ALTER', 'PRIMARY',
    'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'DEFAULT', 'NOT NULL',
  ];

  /* ── Helpers ────────────────────────────────────────────────────────────── */

  /**
   * Returns true when the cursor inside `text` at position `pos` is inside
   * a single-quoted string literal.  Simple parity-of-quotes heuristic.
   */
  function insideStringLiteral(text, pos) {
    let count = 0;
    for (let i = 0; i < pos; i++) {
      if (text[i] === "'") {
        // skip escaped '' (two consecutive single quotes)
        if (text[i + 1] === "'") { i++; continue; }
        count++;
      }
    }
    return count % 2 !== 0;
  }

  /** Extract the word fragment left of the cursor plus any preceding table. */
  function tokenAtCursor(text, pos) {
    const before = text.slice(0, pos);
    // Look for  tableName.colFrag  or just  wordFrag
    const m = before.match(/(\w[\w$]*)\.(\w*)$|(\w[\w$]*)$/);
    if (!m) return { table: null, word: '', dotted: false };
    if (m[1] !== undefined) return { table: m[1], word: m[2], dotted: true };
    return { table: null, word: m[3], dotted: false };
  }

  /** Score and filter suggestions; returns max `limit` items ranked best-first. */
  function rankSuggestions(candidates, word, limit = 10) {
    if (!word) return candidates.slice(0, limit);
    const wl = word.toLowerCase();
    const exact = [], prefix = [], contains = [];
    for (const c of candidates) {
      const cl = c.label.toLowerCase();
      if (cl === wl) exact.push(c);
      else if (cl.startsWith(wl)) prefix.push(c);
      else if (cl.includes(wl)) contains.push(c);
    }
    return [...exact, ...prefix, ...contains].slice(0, limit);
  }

  /* ── Core factory ───────────────────────────────────────────────────────── */

  function attach(textarea, getSchemaFn) {
    if (!textarea) return { detach: () => {} };

    /* ── State ── */
    let schema = { tables: [] };
    let activeIdx = -1;
    let listVisible = false;
    let items = [];        // { label, insert, type }
    let detached = false;

    /* ── DOM setup ── */
    // The list floats inside a wrapper that is positioned relative to .editor-shell
    const shell = textarea.closest('.editor-shell') || textarea.parentElement;
    shell.style.position = 'relative';
    shell.style.overflow = 'visible';

    const list = document.createElement('ul');
    list.id = 'sqlAcList';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'SQL suggestions');
    list.setAttribute('hidden', '');
    shell.appendChild(list);

    textarea.setAttribute('aria-autocomplete', 'list');
    textarea.setAttribute('aria-controls', 'sqlAcList');

    /* ── Schema loader ── */
    const loadSchema = async () => {
      try {
        const result = await Promise.resolve(getSchemaFn());
        if (!detached && result && Array.isArray(result.tables)) {
          schema = result;
        }
      } catch (_) { /* schema unavailable – keyword-only mode */ }
    };
    loadSchema();

    /* ── Render helpers ── */
    function hide() {
      list.setAttribute('hidden', '');
      list.innerHTML = '';
      listVisible = false;
      activeIdx = -1;
      items = [];
      textarea.removeAttribute('aria-activedescendant');
    }

    function setActive(idx) {
      const lis = list.querySelectorAll('li');
      lis.forEach((li, i) => {
        li.setAttribute('aria-selected', String(i === idx));
        if (i === idx) {
          li.classList.add('ac-active');
          textarea.setAttribute('aria-activedescendant', li.id);
          // scroll into view within the list
          li.scrollIntoView({ block: 'nearest' });
        } else {
          li.classList.remove('ac-active');
        }
      });
      activeIdx = idx;
    }

    function show(suggestions) {
      if (!suggestions.length) { hide(); return; }
      items = suggestions;
      list.innerHTML = suggestions.map((s, i) =>
        `<li id="sqlAc-${i}" role="option" aria-selected="${i === activeIdx}"
          class="ac-item${i === activeIdx ? ' ac-active' : ''}"
          data-idx="${i}">
          <span class="ac-label">${escHtml(s.label)}</span>
          <span class="ac-type">${escHtml(s.type)}</span>
        </li>`
      ).join('');
      list.removeAttribute('hidden');
      listVisible = true;

      list.querySelectorAll('li').forEach(li => {
        // Mousedown fires before blur; prevent blur-then-hide race
        li.addEventListener('mousedown', e => e.preventDefault());
        li.addEventListener('click', () => {
          insert(items[Number(li.dataset.idx)]);
        });
        li.addEventListener('mousemove', () => {
          setActive(Number(li.dataset.idx));
        });
      });
    }

    function escHtml(s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    /* ── Insertion ── */
    function insert(item) {
      if (!item) return;
      const pos = textarea.selectionStart ?? textarea.value.length;
      const text = textarea.value;
      const before = text.slice(0, pos);
      const after = text.slice(textarea.selectionEnd ?? pos);

      // Strip the already-typed fragment from the before so we replace it
      const replaceMatch = item.dotted
        ? before.match(/\.(\w*)$/)
        : before.match(/(\w[\w$]*)$/);

      const stripLen = replaceMatch ? replaceMatch[1].length : 0;
      const newBefore = before.slice(0, before.length - stripLen) + item.insert;
      textarea.value = newBefore + after;
      const newPos = newBefore.length;
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      hide();
    }

    /* ── Compute suggestions ── */
    function compute() {
      const pos = textarea.selectionStart ?? 0;
      const text = textarea.value;

      if (insideStringLiteral(text, pos)) { hide(); return; }

      const { table: tableName, word, dotted } = tokenAtCursor(text, pos);

      if (dotted && tableName) {
        // Column suggestions for a known table
        const tbl = schema.tables.find(t => t.name.toUpperCase() === tableName.toUpperCase());
        if (!tbl) { hide(); return; }
        const candidates = tbl.columns.map(c => ({
          label: c.name,
          insert: c.name,
          type: c.sql_type || 'col',
          dotted: true,
        }));
        show(rankSuggestions(candidates, word));
        return;
      }

      // Need at least 1 character to show table / keyword suggestions
      if (!word || word.length < 1) { hide(); return; }

      const tableCandidates = schema.tables.map(t => ({
        label: t.name,
        insert: t.name,
        type: 'table',
        dotted: false,
      }));
      const keywordCandidates = SQL_KEYWORDS.map(k => ({
        label: k,
        insert: k,
        type: 'keyword',
        dotted: false,
      }));

      const all = [...tableCandidates, ...keywordCandidates];
      show(rankSuggestions(all, word));
    }

    /* ── Keyboard handling on textarea ── */
    function onKeydown(e) {
      if (!listVisible) return;

      const count = items.length;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((activeIdx + 1) % count);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((activeIdx - 1 + count) % count);
      } else if (e.key === 'Enter') {
        if (activeIdx >= 0) {
          e.preventDefault();
          insert(items[activeIdx]);
        } else {
          hide();
        }
      } else if (e.key === 'Tab') {
        // Insert on Tab only when list is visible (prevents stealing focus)
        const target = activeIdx >= 0 ? items[activeIdx] : items[0];
        if (target) {
          e.preventDefault();
          insert(target);
        } else {
          hide();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hide();
      }
    }

    function onInput() {
      activeIdx = -1;
      // Re-fetch schema lazily (it may have loaded since attach)
      if (!schema.tables.length) loadSchema().then(compute);
      else compute();
    }

    function onBlur() {
      // Delay so click-on-suggestion fires first
      setTimeout(() => { if (!detached) hide(); }, 150);
    }

    textarea.addEventListener('keydown', onKeydown);
    textarea.addEventListener('input', onInput);
    textarea.addEventListener('blur', onBlur);

    /* ── Public API ── */
    function detach() {
      detached = true;
      hide();
      if (list.isConnected) list.remove();
      textarea.removeEventListener('keydown', onKeydown);
      textarea.removeEventListener('input', onInput);
      textarea.removeEventListener('blur', onBlur);
      textarea.removeAttribute('aria-autocomplete');
      textarea.removeAttribute('aria-controls');
      textarea.removeAttribute('aria-activedescendant');
    }

    // Expose updateSchema so caller can push new schema when manifest loads
    function updateSchema(newSchema) {
      if (newSchema && Array.isArray(newSchema.tables)) schema = newSchema;
    }

    return { detach, updateSchema };
  }

  window.SqlAutocomplete = { attach };
})();
