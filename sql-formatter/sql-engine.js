/**
 * Client-side SQL Tokenizer, Syntax Highlighter, Validator, Minifier, and Formatter.
 * Zero network calls, zero external dependencies.
 */
(function (global) {
  'use strict';

  const BASE_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'AS',
    'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'NATURAL', 'ON', 'USING',
    'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST',
    'LIMIT', 'OFFSET', 'FETCH', 'NEXT', 'ROWS', 'ONLY', 'TOP', 'DISTINCT', 'ALL',
    'UNION', 'INTERSECT', 'EXCEPT', 'MINUS',
    'WITH', 'RECURSIVE', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'CAST', 'COALESCE', 'NULLIF', 'EXISTS', 'BETWEEN', 'LIKE', 'ILIKE', 'SIMILAR', 'TO',
    'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'MERGE', 'MATCHED',
    'CREATE', 'ALTER', 'DROP', 'TABLE', 'VIEW', 'INDEX', 'TRIGGER', 'PROCEDURE', 'FUNCTION',
    'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK', 'DEFAULT', 'CONSTRAINT',
    'OVER', 'PARTITION', 'RANGE', 'UNBOUNDED', 'PRECEDING', 'FOLLOWING', 'CURRENT', 'ROW',
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD',
    'TRUE', 'FALSE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION', 'EXPLAIN', 'ANALYZE'
  ];

  const DIALECT_EXTRAS = {
    standard: [],
    postgresql: ['RETURNING', 'CONFLICT', 'DO', 'NOTHING', 'LATERAL', 'FILTER', 'ARRAY', 'JSONB', 'SERIAL', 'BIGSERIAL', 'UNNEST', 'MATERIALIZED'],
    mysql: ['AUTO_INCREMENT', 'STRAIGHT_JOIN', 'FORCE', 'IGNORE', 'DUPLICATE', 'REPLACE', 'IFNULL', 'SHOW', 'ENGINE', 'CHARSET'],
    plsql: ['CONNECT', 'PRIOR', 'START', 'NOCYCLE', 'ROWNUM', 'SYSDATE', 'NVL', 'NVL2', 'DECODE', 'DUAL', 'BULK', 'COLLECT', 'ELSIF', 'LOOP', 'EXIT', 'DECLARE', 'VARCHAR2', 'NUMBER'],
    tsql: ['NOLOCK', 'CROSS', 'APPLY', 'OUTER', 'PIVOT', 'UNPIVOT', 'OUTPUT', 'INSERTED', 'DELETED', 'ISNULL', 'GETDATE', 'CONVERT', 'NVARCHAR', 'DATETIME2', 'GO', 'EXEC', 'DECLARE', 'PRINT'],
    sqlite: ['PRAGMA', 'AUTOINCREMENT', 'GLOB', 'IFNULL', 'TYPEOF', 'WITHOUT', 'ROWID', 'VACUUM', 'ATTACH']
  };

  const MAJOR_CLAUSES = new Set([
    'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET',
    'FETCH', 'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT', 'MINUS', 'WITH',
    'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'RETURNING', 'ON CONFLICT'
  ]);

  const JOIN_STARTERS = new Set([
    'JOIN', 'INNER JOIN', 'LEFT JOIN', 'LEFT OUTER JOIN', 'RIGHT JOIN',
    'RIGHT OUTER JOIN', 'FULL JOIN', 'FULL OUTER JOIN', 'CROSS JOIN',
    'NATURAL JOIN', 'CROSS APPLY', 'OUTER APPLY'
  ]);

  function getKeywordSet(dialect) {
    const set = new Set(BASE_KEYWORDS);
    (DIALECT_EXTRAS[dialect] || []).forEach(k => set.add(k));
    return set;
  }

  function tokenize(sql, dialect) {
    const kwSet = getKeywordSet(dialect);
    const tokens = [];
    let i = 0;
    const len = sql.length;

    while (i < len) {
      const ch = sql[i];

      // Whitespace
      if (/\s/.test(ch)) {
        let start = i;
        while (i < len && /\s/.test(sql[i])) i++;
        tokens.push({ type: 'ws', value: sql.slice(start, i), start });
        continue;
      }

      // Line comment --
      if (ch === '-' && sql[i + 1] === '-') {
        let start = i;
        i += 2;
        while (i < len && sql[i] !== '\n') i++;
        tokens.push({ type: 'comment', value: sql.slice(start, i), start });
        continue;
      }

      // MySQL # line comment
      if (dialect === 'mysql' && ch === '#') {
        let start = i;
        i++;
        while (i < len && sql[i] !== '\n') i++;
        tokens.push({ type: 'comment', value: sql.slice(start, i), start });
        continue;
      }

      // Block comment /* ... */
      if (ch === '/' && sql[i + 1] === '*') {
        let start = i;
        i += 2;
        let closed = false;
        while (i < len) {
          if (sql[i] === '*' && sql[i + 1] === '/') {
            i += 2;
            closed = true;
            break;
          }
          i++;
        }
        if (!closed) {
          return { error: `Unclosed block comment starting at character ${start + 1}.`, tokens: [] };
        }
        tokens.push({ type: 'comment', value: sql.slice(start, i), start });
        continue;
      }

      // Single-quoted string '...'
      if (ch === '\'') {
        let start = i;
        i++;
        let closed = false;
        while (i < len) {
          if (sql[i] === '\'' && sql[i + 1] === '\'') {
            i += 2;
            continue;
          }
          if (dialect === 'mysql' && sql[i] === '\\' && i + 1 < len) {
            i += 2;
            continue;
          }
          if (sql[i] === '\'') {
            i++;
            closed = true;
            break;
          }
          i++;
        }
        if (!closed) {
          return { error: `Unclosed string literal starting at character ${start + 1}.`, tokens: [] };
        }
        tokens.push({ type: 'string', value: sql.slice(start, i), start });
        continue;
      }

      // Quoted identifier: "...", `...`, [...]
      if (ch === '"' || ch === '`' || (ch === '[' && dialect === 'tsql')) {
        const closeCh = ch === '[' ? ']' : ch;
        let start = i;
        i++;
        let closed = false;
        while (i < len) {
          if (sql[i] === closeCh) {
            if (closeCh !== ']' && sql[i + 1] === closeCh) {
              i += 2;
              continue;
            }
            i++;
            closed = true;
            break;
          }
          i++;
        }
        if (!closed) {
          return { error: `Unclosed quoted identifier starting at character ${start + 1}.`, tokens: [] };
        }
        tokens.push({ type: 'ident', value: sql.slice(start, i), start });
        continue;
      }

      // Numbers
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(sql[i + 1] || ''))) {
        let start = i;
        while (i < len && /[0-9._eExXa-fA-F]/.test(sql[i])) i++;
        tokens.push({ type: 'number', value: sql.slice(start, i), start });
        continue;
      }

      // Punctuation
      if (ch === '(' || ch === ')' || ch === ',' || ch === ';') {
        tokens.push({ type: 'punct', value: ch, start: i });
        i++;
        continue;
      }

      // Multi-char operators
      const two = sql.slice(i, i + 2);
      if (['<>', '!=', '<=', '>=', '||', '::', '->>', '->'].includes(two)) {
        tokens.push({ type: 'op', value: two, start: i });
        i += 2;
        continue;
      }

      if ('=<>+-*/%.~!&|^@:'.includes(ch)) {
        tokens.push({ type: 'op', value: ch, start: i });
        i++;
        continue;
      }

      // Words (keywords or identifiers)
      if (/[A-Za-z_$]/.test(ch)) {
        let start = i;
        while (i < len && /[A-Za-z0-9_$#]/.test(sql[i])) i++;
        const raw = sql.slice(start, i);
        const upper = raw.toUpperCase();
        tokens.push({
          type: kwSet.has(upper) ? 'keyword' : 'word',
          value: raw,
          upper,
          start
        });
        continue;
      }

      // Fallback single char
      tokens.push({ type: 'op', value: ch, start: i });
      i++;
    }

    // Validate balanced parentheses
    let depth = 0;
    for (const tok of tokens) {
      if (tok.type === 'punct' && tok.value === '(') depth++;
      if (tok.type === 'punct' && tok.value === ')') {
        depth--;
        if (depth < 0) {
          return { error: `Unexpected closing parenthesis ')' at character ${tok.start + 1}.`, tokens: [] };
        }
      }
    }
    if (depth > 0) {
      return { error: `Unclosed opening parenthesis '(' (${depth} unclosed).`, tokens: [] };
    }

    return { error: null, tokens };
  }

  function applyKeywordCase(tok, kwCase) {
    if (tok.type !== 'keyword') return tok.value;
    if (kwCase === 'upper') return tok.upper;
    if (kwCase === 'lower') return tok.value.toLowerCase();
    return tok.value;
  }

  function splitStatements(tokens) {
    const stmts = [];
    let cur = [];
    for (const t of tokens) {
      if (t.type === 'punct' && t.value === ';') {
        stmts.push(cur);
        cur = [];
      } else {
        cur.push(t);
      }
    }
    if (cur.some(t => t.type !== 'ws')) {
      stmts.push(cur);
    }
    return stmts;
  }

  function mergeCompoundKeywords(rawTokens) {
    const clean = rawTokens.filter(t => t.type !== 'ws');
    const out = [];
    let i = 0;
    while (i < clean.length) {
      const a = clean[i];
      const b = clean[i + 1];
      const c = clean[i + 2];
      if (a.type === 'keyword' && b && b.type === 'keyword' && c && c.type === 'keyword') {
        const tri = `${a.upper} ${b.upper} ${c.upper}`;
        if (JOIN_STARTERS.has(tri)) {
          out.push({ type: 'keyword', value: `${a.value} ${b.value} ${c.value}`, upper: tri, start: a.start });
          i += 3;
          continue;
        }
      }
      if (a.type === 'keyword' && b && b.type === 'keyword') {
        const bi = `${a.upper} ${b.upper}`;
        if (MAJOR_CLAUSES.has(bi) || JOIN_STARTERS.has(bi)) {
          out.push({ type: 'keyword', value: `${a.value} ${b.value}`, upper: bi, start: a.start });
          i += 2;
          continue;
        }
      }
      out.push(a);
      i++;
    }
    return out;
  }

  function formatStatement(rawTokens, opts) {
    const indentUnit = opts.indent === 'tab' ? '\t' : ' '.repeat(Number(opts.indent) || 2);
    const kwCase = opts.keywordCase || 'upper';
    const commaPos = opts.commaPosition || 'trailing';

    const tokens = mergeCompoundKeywords(rawTokens);
    if (!tokens.length) return '';

    const lines = [];
    let curLine = '';
    let indent = 0;
    const parenStack = []; // tracks { isSubquery, prevClause, inSelectList }
    let currentClause = '';

    const pad = (extra = 0) => indentUnit.repeat(Math.max(0, indent + extra));
    const pushLine = (extra = null) => {
      const trimmed = curLine.trimEnd();
      if (trimmed) {
        const effExtra = extra !== null ? extra : (inSelectCols && multiColSelect && !/^(select|distinct|all)\b/i.test(trimmed.trimStart()) ? 1 : 0);
        lines.push(pad(effExtra) + trimmed.trimStart());
      }
      curLine = '';
    };
    const appendTok = (text) => {
      if (!curLine) {
        curLine = text;
        return;
      }
      const noSpaceBefore = [',', ')', '.', ';'];
      const noSpaceAfter = ['(', '.'];
      const lastChar = curLine[curLine.length - 1];
      if (noSpaceBefore.includes(text) || noSpaceAfter.includes(lastChar) || text === '::') {
        curLine += text;
      } else if (curLine.endsWith('::')) {
        curLine += text;
      } else {
        curLine += ' ' + text;
      }
    };

    // Determine if a SELECT list has >1 top-level comma at current depth
    function selectHasMultipleColumns(startIdx) {
      let d = 0;
      let commas = 0;
      for (let j = startIdx; j < tokens.length; j++) {
        const tj = tokens[j];
        if (tj.type === 'punct' && tj.value === '(') d++;
        else if (tj.type === 'punct' && tj.value === ')') {
          if (d === 0) break;
          d--;
        } else if (d === 0 && tj.type === 'punct' && tj.value === ',') {
          commas++;
          if (commas >= 1) return true;
        } else if (d === 0 && tj.type === 'keyword' && (MAJOR_CLAUSES.has(tj.upper) || JOIN_STARTERS.has(tj.upper))) {
          break;
        }
      }
      return false;
    }

    let inSelectCols = false;
    let multiColSelect = false;

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      const next = tokens[i + 1];
      const text = applyKeywordCase(tok, kwCase);

      if (tok.type === 'comment') {
        if (curLine.trim()) pushLine();
        lines.push(pad() + tok.value);
        continue;
      }

      if (tok.type === 'punct' && tok.value === '(') {
        const nextIsSelect = next && next.type === 'keyword' && (next.upper === 'SELECT' || next.upper === 'WITH');
        parenStack.push({ isSubquery: nextIsSelect, prevClause: currentClause, inSelectCols, multiColSelect });
        if (nextIsSelect) {
          appendTok('(');
          pushLine();
          indent++;
          inSelectCols = false;
          multiColSelect = false;
        } else {
          appendTok('(');
        }
        continue;
      }

      if (tok.type === 'punct' && tok.value === ')') {
        const frame = parenStack.pop() || { isSubquery: false, prevClause: '', inSelectCols: false, multiColSelect: false };
        if (frame.isSubquery) {
          pushLine();
          indent = Math.max(0, indent - 1);
          curLine = ')';
        } else {
          appendTok(')');
        }
        currentClause = frame.prevClause;
        inSelectCols = frame.inSelectCols;
        multiColSelect = frame.multiColSelect;
        continue;
      }

      if (tok.type === 'punct' && tok.value === ',') {
        const topFrame = parenStack[parenStack.length - 1];
        const insideFunc = topFrame && !topFrame.isSubquery;
        if (inSelectCols && multiColSelect && !insideFunc) {
          if (commaPos === 'leading') {
            pushLine(1);
            curLine = ',';
          } else {
            curLine += ',';
            pushLine(1);
          }
        } else if (currentClause === 'WITH' && !insideFunc) {
          curLine += ',';
          pushLine();
        } else {
          curLine += ',';
        }
        continue;
      }

      if (tok.type === 'keyword') {
        const u = tok.upper;

        if (u === 'CASE') {
          appendTok(text);
          pushLine();
          indent++;
          continue;
        }
        if (u === 'WHEN' || u === 'ELSE') {
          pushLine();
          curLine = text;
          continue;
        }
        if (u === 'END') {
          pushLine();
          indent = Math.max(0, indent - 1);
          curLine = text;
          continue;
        }

        if (MAJOR_CLAUSES.has(u) && (!parenStack.length || parenStack[parenStack.length - 1].isSubquery)) {
          if (curLine.trim()) pushLine();
          currentClause = u;
          if (u === 'SELECT') {
            inSelectCols = true;
            multiColSelect = selectHasMultipleColumns(i + 1);
            curLine = text;
            if (multiColSelect) {
              // Skip optional DISTINCT/TOP onto same SELECT line
              if (next && next.type === 'keyword' && (next.upper === 'DISTINCT' || next.upper === 'ALL')) {
                i++;
                appendTok(applyKeywordCase(next, kwCase));
              }
              pushLine();
              // Next tokens will be indented by 1 via pushLine(1) or manual pad
              curLine = indentUnit;
            }
          } else {
            inSelectCols = false;
            multiColSelect = false;
            curLine = text;
          }
          continue;
        }

        if (JOIN_STARTERS.has(u) && (!parenStack.length || parenStack[parenStack.length - 1].isSubquery)) {
          if (curLine.trim()) pushLine();
          inSelectCols = false;
          currentClause = u;
          curLine = text;
          continue;
        }

        if ((u === 'AND' || u === 'OR') && (currentClause === 'WHERE' || currentClause === 'HAVING' || JOIN_STARTERS.has(currentClause))) {
          if (!parenStack.length || parenStack[parenStack.length - 1].isSubquery) {
            pushLine();
            curLine = indentUnit + text;
            continue;
          }
        }

        if (u === 'ON' && JOIN_STARTERS.has(currentClause) && (!parenStack.length || parenStack[parenStack.length - 1].isSubquery)) {
          pushLine();
          curLine = indentUnit + text;
          continue;
        }
      }

      appendTok(text);
    }

    if (curLine.trim()) pushLine(inSelectCols && multiColSelect && lines.length > 0 && lines[lines.length - 1].trim() === 'SELECT' ? 1 : 0);
    // Clean up any leading extra indent on first SELECT column line
    return lines.map(l => l.replace(/\s+$/, '')).join('\n');
  }

  function formatSQL(sql, options = {}) {
    if (!sql || !sql.trim()) return { formatted: '', error: null };
    const dialect = options.dialect || 'standard';
    const tokRes = tokenize(sql, dialect);
    if (tokRes.error) return { formatted: sql, error: tokRes.error };

    const stmts = splitStatements(tokRes.tokens);
    const formatted = stmts
      .map(stmt => formatStatement(stmt, options))
      .filter(Boolean)
      .join(';\n\n') + (sql.trim().endsWith(';') && stmts.length ? ';' : '');

    return { formatted, error: null };
  }

  function minifySQL(sql, options = {}) {
    if (!sql || !sql.trim()) return { minified: '', error: null };
    const dialect = options.dialect || 'standard';
    const tokRes = tokenize(sql, dialect);
    if (tokRes.error) return { minified: sql, error: tokRes.error };

    const parts = [];
    for (const tok of tokRes.tokens) {
      if (tok.type === 'ws' || tok.type === 'comment') continue;
      const val = tok.type === 'keyword' ? applyKeywordCase(tok, options.keywordCase || 'upper') : tok.value;
      if (!parts.length) {
        parts.push(val);
        continue;
      }
      const prev = parts[parts.length - 1];
      const noSpaceBefore = [',', ')', '.', ';'];
      const noSpaceAfter = ['(', '.'];
      if (noSpaceBefore.includes(val) || noSpaceAfter.includes(prev) || val === '::' || prev.endsWith('::')) {
        parts[parts.length - 1] = prev + val;
      } else {
        parts.push(val);
      }
    }
    return { minified: parts.join(' '), error: null };
  }

  function highlightHTML(sql, dialect = 'standard') {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const tokRes = tokenize(sql, dialect);
    if (tokRes.error) return esc(sql);
    return tokRes.tokens.map(tok => {
      const v = esc(tok.value);
      if (tok.type === 'keyword') return `<span class="tok-kw">${v}</span>`;
      if (tok.type === 'string') return `<span class="tok-str">${v}</span>`;
      if (tok.type === 'number') return `<span class="tok-num">${v}</span>`;
      if (tok.type === 'comment') return `<span class="tok-com">${v}</span>`;
      if (tok.type === 'ident') return `<span class="tok-id">${v}</span>`;
      return v;
    }).join('');
  }

  global.SQLFormatterEngine = {
    formatSQL,
    minifySQL,
    highlightHTML,
    tokenize
  };
})(window);
