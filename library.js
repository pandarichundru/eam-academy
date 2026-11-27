const collections = new Map();
let tableMapPromise = null;
async function asset(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('Could not load ' + path);
  return res.json();
}
function library(kind) {
  if (!collections.has(kind)) {
    const pending = asset('data/' + kind + '.json')
      .then(paths => Promise.all(paths.map(asset)))
      .then(parts => parts.flat())
      .catch(err => { collections.delete(kind); throw err; });
    collections.set(kind, pending);
  }
  return collections.get(kind);
}
function tableIndex() {
  if (!tableMapPromise) {
    tableMapPromise = library('tables').then(rows => new Map(rows.map(r => [r.name, r])))
      .catch(err => { tableMapPromise = null; throw err; });
  }
  return tableMapPromise;
}
async function academyAPI(path, opts) {
  const url = new URL(path, location.href);
  const param = key => url.searchParams.get(key) || '';
  if (url.pathname === '/api/sql') return runTrainingQuery(JSON.parse(opts.body).sql);
  if (url.pathname === '/api/schema') return asset('data/schema.json');
  if (url.pathname === '/api/tables/item') {
    const map = await tableIndex();
    return map.get(param('name').toUpperCase()) || null;
  }
  const isCode = url.pathname.includes('/code/');
  const rows = await library(isCode ? 'code' : 'docs');
  if (url.pathname.endsWith('/item') || url.pathname.endsWith('/doc')) {
    const row = param('id') ? rows.find(r => r.id === Number(param('id'))) :
      rows.find(r => r.source === (param('source') || 'Infor EAM 11.6') && r.page === Number(param('page')));
    if (!row) throw new Error('Record unavailable');
    if (!isCode) return row;
    return {...row, siblings:rows.filter(r => r.kind === row.kind && r.norm_name === row.norm_name)};
  }
  const terms = (param('q').toLowerCase().match(/[\p{L}\p{N}_]+/gu) || []).slice(0,12);
  const kinds = param('kind').split(',').filter(Boolean);
  const relatedTable = param('table').toUpperCase();
  const source = param('source');
  const matches = [];
  for (const r of rows) {
    if (source && r.source !== source || kinds.length && !kinds.includes(r.kind)) continue;
    if (relatedTable && !r.tables?.split(',').some(t => t.trim() === relatedTable)) continue;
    const label = (r.title || r.name).toLowerCase();
    const body = terms.length ? r.body.toLowerCase() : '';
    if (!terms.every(t => label.includes(t) || body.includes(t))) continue;
    matches.push({r,score:terms.filter(t => label.includes(t)).length});
  }
  matches.sort((a,b) => b.score - a.score);
  const size = isCode ? 40 : 30, start = Math.max(0,Number(param('offset')) || 0);
  const items = matches.slice(start,start+size).map(({r}) => {
    const position = terms.length ? r.body.toLowerCase().indexOf(terms[0]) : 0;
    const from = Math.max(0,position-60);
    return {...r, excerpt:(from ? '… ' : '') + r.body.slice(from,from+230)};
  });
  return {items,more:start+size<matches.length,total:matches.length};
}
