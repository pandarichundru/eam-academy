importScripts('sql-asm.js');

const FORBIDDEN_KW = /\b(insert|update|delete|drop|alter|create|replace|attach|detach|pragma|vacuum|reindex|begin|commit|rollback|savepoint)\b/i;

function stripCommentsAndStrings(sql) {
  return sql
    .replace(/--[^\n]*(?:\n|$)/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:''|[^'])*'/g, "''");
}

function assertReadOnlySql(sql) {
  if (typeof sql !== 'string' || sql.length > 20000) {
    throw Error('Enter one SELECT or WITH query (max 20,000 characters).');
  }
  if (!/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*(select|with)\b/i.test(sql)) {
    throw Error('Enter one SELECT or WITH query.');
  }
  const stripped = stripCommentsAndStrings(sql)
    .replace(/"(?:""|[^"])*"/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ');
  if (FORBIDDEN_KW.test(stripped)) {
    throw Error('Read-only lab: only a single SELECT or WITH ... SELECT statement is allowed.');
  }
}

function extractCandidateIdentifiers(sql) {
  const noStrings = stripCommentsAndStrings(sql);
  const ids = new Set();
  for (const m of noStrings.matchAll(/"((?:""|[^"])*)"|\[([^\]]+)\]|`([^`]+)`|([A-Za-z_][A-Za-z0-9_$]*)/g)) {
    const raw = (m[1] !== undefined ? m[1].replace(/""/g, '"') : m[2] ?? m[3] ?? m[4] ?? '').trim();
    if (raw) ids.add(raw.toUpperCase());
  }
  return ids;
}

function sqliteType(sqlType) {
  const t = String(sqlType || '').toLowerCase();
  if (t === 'int' || t === 'smallint' || t === 'tinyint') return 'INTEGER';
  if (t === 'float' || t === 'real') return 'REAL';
  if (t === 'bigint' || t === 'numeric' || t === 'decimal') return 'NUMERIC';
  return 'TEXT';
}

function qIdent(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

async function loadRealDatabase(engine, sql, passedTables) {
  let tables = passedTables;
  if (!Array.isArray(tables)) {
    const res = await fetch('data/manifest.json', { cache: 'default' });
    if (!res.ok) throw Error('Real-data manifest unavailable.');
    const manifest = await res.json();
    tables = manifest.tables || [];
  }
  const byName = new Map();
  for (const entry of tables) {
    byName.set(entry.table.toUpperCase(), entry);
    byName.set(entry.full_name.toUpperCase(), entry);
  }
  const ids = extractCandidateIdentifiers(sql);
  const needed = [];
  const seen = new Set();
  for (const id of ids) {
    const entry = byName.get(id);
    if (entry && !seen.has(entry.full_name)) {
      seen.add(entry.full_name);
      needed.push(entry);
    }
  }
  if (needed.length > 40) {
    throw Error('Too many tables referenced in one query (max 40).');
  }
  const payloads = await Promise.all(
    needed.map(async entry => {
      const r = await fetch(entry.export_path, { cache: 'default' });
      if (!r.ok) throw Error('Failed to load table export: ' + entry.table);
      return r.json();
    })
  );

  const db = new engine.Database();
  for (const tbl of payloads) {
    const cols = tbl.columns || [];
    const colDefs = cols.map(c => `${qIdent(c.name)} ${sqliteType(c.sql_type)}`).join(', ');
    const tq = qIdent(tbl.table);
    db.run(`CREATE TABLE ${tq} (${colDefs})`);
    if (tbl.rows && tbl.rows.length) {
      const placeholders = cols.map(() => '?').join(', ');
      const colNames = cols.map(c => qIdent(c.name)).join(', ');
      db.run('BEGIN');
      const stmt = db.prepare(`INSERT INTO ${tq} (${colNames}) VALUES (${placeholders})`);
      try {
        for (const row of tbl.rows) {
          stmt.run(cols.map(c => {
            const v = row[c.name];
            return v === undefined ? null : v;
          }));
        }
      } finally {
        stmt.free();
      }
      db.run('COMMIT');
    }
  }
  return { db, loadedTables: payloads.map(p => p.table) };
}

onmessage = async ({ data }) => {
  const sql = typeof data === 'string' ? data : data.sql;
  const rawDataset = typeof data === 'string' ? 'training' : data.dataset;
  const isReal = rawDataset === 'real';
  const dataset = ['practice-0', 'practice-1'].includes(rawDataset) ? rawDataset : 'training';
  let db;
  try {
    assertReadOnlySql(sql);
    let loadedTables = [];
    if (isReal) {
      const engine = await initSqlJs();
      const loaded = await loadRealDatabase(engine, sql, data.tables);
      db = loaded.db;
      loadedTables = loaded.loadedTables;
    } else {
      const [engine, file] = await Promise.all([
        initSqlJs(),
        fetch('data/' + dataset + '.db', { cache: 'no-cache' }),
      ]);
      if (!file.ok) throw Error('Training data unavailable.');
      db = new engine.Database(new Uint8Array(await file.arrayBuffer()));
    }
    db.run('PRAGMA query_only=ON');
    const stmts = db.iterateStatements(sql);
    const statement = stmts.next().value;
    if (!statement || statement.getRemainingSQL?.().trim()) throw Error('Enter one query.');
    const columns = statement.getColumnNames();
    const rows = [];
    while (rows.length < 201 && statement.step()) rows.push(statement.get());
    if (!stmts.next().done) throw Error('Enter one query.');
    postMessage({ columns, rows: rows.slice(0, 200), truncated: rows.length > 200, loadedTables });
  } catch (err) {
    postMessage({ error: err.message });
  } finally {
    if (db) db.close();
  }
};
