// All task state is scoped by the existing profile store.
function nextLearningTask() {
  const task = read('resumeTask', null);
  if (task && ['lesson', 'exercise', 'sql', 'sql-real'].includes(task.route)) return task;
  const lesson = lessons.find(item => item.id === read('lastLesson', ''));
  if (lesson) return {route: 'lesson', id: lesson.id, label: 'Continue ' + lesson.title};
  const exercise = Number(read('lastExercise', 0));
  if (exercise) return {route: 'exercise', id: String(exercise), label: 'Continue exercise ' + exercise};
  return {route: 'lesson', id: 'INTRO01', label: 'Start first lesson'};
}

function resumeLink(task) {
  return task.route + (task.id ? '/' + U(task.id) : '');
}

let stopTrackingTask = () => {};
function trackTask(route, id) {
  const lesson = route === 'lesson' && lessons.find(item => item.id === id);
  const editor = $('sqlText');
  if (!lesson && !(route === 'exercise' && $('answerSQL')) && !(['sql','sql-real'].includes(route) && editor)) return;
  const key = route + '/' + id;
  const selected = editor && ($('sqlExample')?.selectedOptions[0] || $('realSqlExample')?.selectedOptions[0]);
  const label = lesson ? 'Continue ' + lesson.title : route === 'exercise' ? 'Continue exercise ' + id :
    'Resume ' + (route === 'sql-real' ? 'restored' : 'synthetic') + ' SQL Lab' + (selected?.value ? ' · ' + selected.textContent : '');
  write('resumeTask', {route, id, label});
  const saved = read('workspaceDrafts', {})[key];
  if (editor && typeof saved === 'string') editor.value = saved;
  const offset = lesson ? read('readingPositions', {})[key] || 0 : 0;
  if (offset) window.scrollTo({top: offset, behavior: 'instant'});
  const profile = window.EAMProfiles.getActiveProfileId();
  // Save against the originating profile even during sign-out or a profile switch.
  function save(name, value) {
    const profiles = window.EAMProfiles;
    const values = profiles.readFor(profile, name, {});
    if (values[key] === value) return;
    profiles.writeFor(profile, name, {...values, [key]: value});
  }
  const saveDraft = () => save('workspaceDrafts', editor.value);
  let position = offset;
  const rememberPosition = () => { position = window.scrollY; };
  const flush = () => {
    if (editor) saveDraft();
    if (lesson) save('readingPositions', position);
  };
  if (lesson) window.addEventListener('scroll', rememberPosition, {passive: true});
  editor?.addEventListener('input', saveDraft);
  window.addEventListener('pagehide', flush);
  stopTrackingTask = () => {
    flush();
    window.removeEventListener('pagehide', flush);
    window.removeEventListener('scroll', rememberPosition);
    editor?.removeEventListener('input', saveDraft);
    stopTrackingTask = () => {};
  };
}

function learningDialog(title, body, origin, className) {
  const dialog = document.createElement('dialog');
  dialog.className = 'learning-dialog ' + className;
  dialog.setAttribute('aria-label', title);
  dialog.innerHTML = '<div class="row between"><h2>' + E(title) + '</h2><button type="button" data-close>Close</button></div>' + body;
  document.body.append(dialog);
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  const close = () => dialog.close();
  window.addEventListener('hashchange', close);
  dialog.addEventListener('close', () => {
    window.removeEventListener('hashchange', close);
    dialog.remove();
    if (origin?.isConnected) origin.focus({preventScroll:true});
  }, {once:true});
  dialog.showModal();
  return dialog;
}

function inspectField(t, c, origin) {
  const relations = [];
  for (const fk of t.out_fks || []) for (const [child,parent] of fk.cols) {
    if (child === c[0]) relations.push(t.name + '.' + child + ' → ' + fk.to + '.' + parent);
  }
  for (const fk of t.in_fks || []) for (const [child,parent] of fk.cols) {
    if (parent === c[0]) relations.push(fk.from + '.' + child + ' → ' + t.name + '.' + parent);
  }
  learningDialog(c[0], '<p><code>' + E(t.name) + '</code> · ' + E(c[1]) + (c[2] ? ' · nullable' : ' · required') +
    '</p><p>' + E(c[4]) + '</p><p>' + E(c[6]) + '</p><h3>Foreign keys</h3>' +
    (relations.length ? '<ul>' + relations.map(text => '<li>' + E(text) + '</li>').join('') + '</ul>' : '<p>No foreign key listed for this field.</p>') +
    A('sql-real/' + U(t.name), 'Try in SQL Lab', 'button'), origin, 'field-sheet');
}

let searchItems;
async function searchIndex() {
  if (!searchItems) searchItems = Promise.all([library('tables'), getPractice()]).then(([tables, practice]) => {
    const entries = [];
    function add(kind, name, route, extra = '', field = null) {
      entries.push({kind, name, route, field, searchable:(name + ' ' + extra).toLowerCase()});
    }
    for (const t of tables) {
      add('Table', t.name, 'table/' + U(t.name), t.title);
      for (const c of t.cols) add('Field', c[0], '', t.name + ' ' + c[4], [t,c]);
    }
    for (const t of catalog.tables) add('Table', t[0], 'table/' + U(t[0]), t.slice(6).join(' '));
    for (const l of lessons) add('Lesson', l.title, 'lesson/' + U(l.id), l.concept);
    for (const x of practice.exercises) add('Exercise', x.title, 'exercise/' + x.id, x.prompt + ' ' + x.tables.join(' '));
    add('SQL example','Work orders without activities','sql/trace-left','missing activities unmatched left join');
    return entries;
  }).catch(error => { searchItems = null; throw error; });
  return searchItems;
}

function openTaskSearch(initial = '') {
  if (document.body.dataset.view === 'profiles' || document.querySelector('dialog[open]')) return;
  const origin = document.activeElement;
  const dialog = learningDialog('Search the academy',
    '<label>Task, table, or field<input type="search" data-term placeholder="Try EVT_OBJECT or work orders without activities"></label><p data-status role="status"></p><div data-results></div>', origin, 'task-search');
  const input = dialog.querySelector('[data-term]'), results = dialog.querySelector('[data-results]');
  input.value = initial;
  input.focus();
  async function render() {
    const q = input.value.trim().toLowerCase();
    results.replaceChildren();
    const status = dialog.querySelector('[data-status]');
    if (!q) { status.textContent = 'Enter a name or describe a task.'; return; }
    status.textContent = 'Searching…';
    try {
      const entries = await searchIndex();
      if (input.value.trim().toLowerCase() !== q || !dialog.open) return;
      const words = q.split(/\s+/);
      const hits = entries.filter(x => words.every(w => x.searchable.includes(w)));
      const rank = x => x.name.toLowerCase() === q ? 0 : x.name.toLowerCase().startsWith(q) ? 1 : 2;
      hits.sort((a,b) => rank(a)-rank(b));
      status.textContent = hits.length ? 'Showing ' + Math.min(12,hits.length) + ' of ' + hits.length + ' matches.' : 'No matches in tasks or identifiers.';
      results.innerHTML = hits.slice(0,12).map((x,i) => '<button type="button" data-hit="' + i + '"><small>' + E(x.kind) + '</small> ' + E(x.name) + (x.field ? ' · ' + E(x.field[0].name) : '') + '</button>').join('') + A('search/' + U(input.value.trim()), 'Search all documentation');
      results.querySelector('a').onclick = () => dialog.close();
      results.querySelectorAll('button').forEach((btn,i) => btn.onclick = () => {
        const item = hits[i];
        if (item.field) inspectField(...item.field, btn);
        else { dialog.close(); location.hash = item.route; }
      });
    } catch { status.textContent = 'Search index unavailable. Try again.'; }
  }
  input.oninput = render;
  results.onkeydown = event => {
    if (!['ArrowDown','ArrowUp'].includes(event.key)) return;
    const links = [...results.querySelectorAll('button,a')];
    const index = links.indexOf(document.activeElement) + (event.key === 'ArrowDown' ? 1 : -1);
    event.preventDefault();
    (links[Math.min(index,links.length-1)] || input).focus();
  };
  input.onkeydown = event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); results.querySelector('button,a')?.focus(); }
    if (event.key === 'Enter') { event.preventDefault(); results.querySelector('button,a')?.click(); }
  };
  render();
}

const traceExamples = [
  {id:'join', title:'One order, multiple activities', select:'e.EVT_CODE, a.ACT_ACT', join:'JOIN', filter:'WHERE e.EVT_CODE = 101'},
  {id:'left', title:'Work orders without activities', select:'e.EVT_CODE, a.ACT_ACT', join:'LEFT JOIN', filter:'WHERE a.ACT_EVENT IS NULL'},
  {id:'count', title:'Count activities per work order', select:'e.EVT_CODE, COUNT(a.ACT_ACT) AS activities', join:'LEFT JOIN', filter:'GROUP BY e.EVT_CODE'}
];
function traceQuery(x) {
  return 'SELECT ' + x.select + '\nFROM R5EVENTS e\n' + x.join + ' R5ACTIVITIES a ON a.ACT_EVENT = e.EVT_CODE\n' + x.filter + '\nORDER BY 1, 2;';
}
function wireTrace(id) {
  const host = document.createElement('section');
  host.className = 'section';
  host.innerHTML = '<h2>Why did this row appear?</h2><div class="row">' +
    traceExamples.map(x => A('sql/trace-' + x.id, x.title, 'button')).join('') + '</div><div data-trace></div>';
  $('main').append(host);
  const x = traceExamples.find(x => id === 'trace-' + x.id);
  if (!x) return;
  const sql = traceQuery(x);
  $('sqlText').value = sql;
  const out = host.querySelector('[data-trace]');
  out.innerHTML = '<p>Select a row from the example to trace its inputs.</p><pre>' + E(sql) + '</pre>';
  Promise.all([runTrainingQuery(sql), runTrainingQuery('SELECT EVT_CODE, EVT_STATUS FROM R5EVENTS ORDER BY EVT_CODE'),
    runTrainingQuery('SELECT ACT_EVENT, ACT_ACT, ACT_TRADE FROM R5ACTIVITIES ORDER BY ACT_EVENT, ACT_ACT')]).then(([result,orders,activities]) => {
    out.insertAdjacentHTML('beforeend', '<p>' + result.columns.map(E).join(' · ') + '</p><div class="row">' +
      result.rows.map((row,i) => '<button data-row="' + i + '">' + row.map(v => E(v ?? 'NULL')).join(' · ') + '</button>').join('') + '</div><div data-source aria-live="polite"></div>');
    const source = out.querySelector('[data-source]');
    out.querySelectorAll('[data-row]').forEach((btn,i) => btn.onclick = () => {
      const [key,value] = result.rows[i];
      const matches = activities.rows.filter(row => row[0] === key);
      const inputs = x.id === 'join' ? matches.filter(row => row[1] === value) : matches;
      const explanation = x.id === 'count' ? 'COUNT(ACT_ACT) counts the ' + matches.length + ' matching activity rows.' : x.id === 'left' ?
        'The order has no activity. LEFT JOIN keeps it and supplies NULL for the activity columns.' :
        'This order has ' + matches.length + ' activities. Each produces a separate result row. The selected row uses activity ' + value + '.';
      source.innerHTML = '<div class="trace-input"><h3>1 · Work order</h3>' + table(orders.columns,orders.rows.filter(row => row[0] === key)) +
        '<h3>2 · Contributing activities</h3>' + (inputs.length ? table(activities.columns,inputs) : '<p>Zero matching rows</p>') +
        '<p><strong>3 · Result</strong> ' + E(explanation) + '</p></div>';
      out.querySelectorAll('[data-row]').forEach(item => item.setAttribute('aria-pressed', String(item === btn)));
    });
  }).catch(error => { out.append(document.createTextNode(error.message)); });
}
