const practiceLevels = {
  Easy: 'Choose columns, filter records, sort, handle NULLs, and summarize a single table.',
  Medium: 'Connect tables, compare groups, combine result sets, and keep unmatched rows.',
  Hard: 'Control join cardinality, rank records within groups, and analyze sequences.',
  'Very Hard': 'Reconstruct historical state, traverse hierarchies, allocate stock, and reconcile multiple levels of detail.'
};
let practiceData;
async function getPractice() {
  if (!practiceData) {
    const res = await fetch('challenges.json');
    if (!res.ok) throw Error('Could not load SQL exercises.');
    practiceData = await res.json();
  }
  return practiceData;
}
function practiceIndex(level, bank) {
  const solved = read('practiceSolved',[]);
  const subset = bank.exercises.filter(x => !level || x.level === level);
  const next = subset.find(x => x.id === read('lastExercise',0)) || subset.find(x => !solved.includes(x.id)) || subset[0];
  if (!next) return A('practice','Browse the SQL practice course');
  return H('SQL practice',bank.exercises.length + ' SQL exercises','Write each query from a business question. Run it on the practice data, then check your answer on two datasets. Your drafts and completed exercises are saved in this browser.')
    + '<div class="row practice-tools">' + A('exercise/' + next.id,'Continue practice','button primary') + '<button id="mixedPractice">Random challenge</button>' + A('sql-course','Guided SQL lessons') + '</div>'
    + '<details class="challenge-aid"><summary>How to approach an unfamiliar SQL question</summary><ol><li>Write down what one output row represents and the columns it needs.</li><li>Inspect the tables. Identify the key on each side of every join.</li><li>Start with a few source rows. Add one filter, join or calculation at a time.</li><li>Check what happens with a missing match, a tie and two detail rows for the same parent.</li><li>Compare your result on both datasets. Revisit a solved question later without opening the solution.</li></ol></details>'
    + '<div class="practice-levels">' + Object.entries(practiceLevels).map(([name,desc]) => {
      const total = bank.exercises.filter(x => x.level === name).length;
      const count = bank.exercises.filter(x => x.level === name && solved.includes(x.id)).length;
      const active = level === name ? ' is-active' : '';
      return '<a class="case-card' + active + '" href="#practice/' + U(name) + '"><div class="row between mb-sm"><h2>' + E(name) + '</h2><span class="pill tabular">' + count + '/' + total + '</span></div><p>' + E(desc) + '</p>' + progress(count,total) + '</a>';
    }).join('') + '</div><div class="section-head"><h2>' + E(level || 'All exercises') + '</h2>' + (level ? A('practice','Show all levels') : '') + '</div>'
    + '<label for="practiceTopic">SQL topic</label><select id="practiceTopic"><option value="">All topics</option>' + Object.keys(practiceTopics).map(t=>'<option>'+E(t)+'</option>').join('')+'</select><label for="practiceFind">Find an exercise</label><input type="search" id="practiceFind" placeholder="Try median, receipts, or meter"><div id="practiceList"></div>';
}
const practiceTopics = {
  Joins: /\bJOIN\b/i, Aggregation: /\b(COUNT|SUM|AVG|MAX|MIN)\s*\(/i,
  Subqueries: /\(\s*SELECT\b/i, 'Window functions': /\bOVER\s*\(/i,
  'Common table expressions': /\bWITH\b/i, Sorting: /\bORDER BY\b/i
};
function practiceList(items,q) {
  const solved = read('practiceSolved',[]);
  const terms = q.trim().toLowerCase().split(/\s+/);
  const hits = items.filter(x => terms.every(t => [x.title,x.level,x.prompt,...x.tables].join(' ').toLowerCase().includes(t)));
  return hits.length ? hits.map(x => {
    const isSolved = solved.includes(x.id);
    return '<a class="challenge-row" href="#exercise/' + x.id + '"><span>' + String(x.id).padStart(2,'0') + '</span><strong>' + E(x.title) + '</strong><span class="challenge-meta"><small>' + E(x.level) + '</small>' + (isSolved ? '<span class="pill ok">' + ICON_CHECK + '<span>Solved</span></span>' : '') + '</span></a>';
  }).join('') : '<p class="muted">No exercises match this search.</p>';
}
function practiceTask(x,bank) {
  const draft = read('practiceDrafts',{})[x.id] || '';
  const solved = read('practiceSolved',[]).includes(x.id);
  return '<div class="challenge-reader">' + A('practice/' + U(x.level),'Back to ' + x.level + ' exercises') + '<div class="lab-panels" data-panel="question"><nav class="lab-switch" aria-label="Exercise workspace">'+['Question','Editor','Results'].map(n=>'<button data-show="'+n.toLowerCase()+'">'+n+'</button>').join('')+'</nav><section class="lab-question">' + H(x.level + ' · Exercise ' + x.id + ' of ' + bank.exercises.length,x.title,x.prompt)
    + '<div class="section practice-schema"><h2>Tables for this question</h2><p>Choose a table to inspect up to five sample rows.</p><div class="row">' + x.tables.map(t => '<button data-sample="' + E(t) + '">' + E(t) + '</button>').join('') + '</div><div id="sampleRows" aria-live="polite"></div><details><summary>Column names</summary>' + x.tables.map(t => '<p><b>' + E(t) + '</b><br><code>' + E(bank.schema[t].join(', ')) + '</code></p>').join('') + '</details></div>'
    + (x.id === 30 ? '<details><summary>Fix this query</summary><p>This query reports one work order for an idle asset. Run it, inspect the outer join and change the count.</p><pre id="brokenQuery">SELECT e.OBJ_CODE, COUNT(*) FROM R5OBJECTS e LEFT JOIN R5EVENTS w ON w.EVT_OBJECT = e.OBJ_CODE GROUP BY e.OBJ_CODE</pre><button id="loadBroken">Load debugging example</button></details>' : '')
    + '<details><summary>Expected output preview</summary>'+table(Array.from({length:x.cols},(_,i)=>'Column '+(i+1)),x.expected[0].slice(0,3))+'<small>First '+Math.min(x.expected[0].length,3)+' of '+x.expected[0].length+' expected rows on the practice data.</small></details></section><div class="lab-work"><section class="lab-editor"><label for="answerSQL"><strong>Your SQL query</strong></label><div class="editor-shell"><div class="editor-head"><span>SQLite · Read-only practice</span><span class="editor-hint"><kbd>⌘↵</kbd> Run</span></div><textarea id="answerSQL" spellcheck="false" placeholder="SELECT …">' + E(draft) + '</textarea></div><div class="row"><button id="runPractice">' + ICON_PLAY + '<span>Run query</span></button><button id="gradePractice" class="primary">' + ICON_CHECK + '<span>Check answer</span></button><small id="practiceState">' + (solved ? 'Previously solved' : 'SQLite · read-only practice data') + '</small></div></section><section class="lab-results"><p id="emptyResult">Run your query to see its result.</p><div id="practiceFeedback" aria-live="polite"></div><div id="practiceOutput"></div></section></div></div>'
    + '<details class="challenge-aid"><summary>Hint</summary><p>' + E(x.reason) + '</p></details><details class="challenge-aid"><summary>Show worked solution</summary><pre>' + E(x.sql) + '</pre><p>' + E(x.reason) + '</p><p>On the practice data this returns ' + x.expected[0].length + ' row(s) and ' + x.cols + ' column(s).</p></details>'
    + (x.id===53?'<a class="button primary" href="data/database-reference.html#Study%3AWork-order%20labor">Explore the visual join walkthrough</a>':'')
    + '<p>Inspect the EAM schema · '+x.tables.map(t=>'<a href="data/database-reference.html#Table%3A'+encodeURIComponent(t)+'">'+E(t)+'</a>').join(' · ')+'</p>'
    + '<div class="row footer-links">' + (x.id>1 ? A('exercise/' + (x.id-1),'Previous exercise','button') : '') + (x.id<bank.exercises.length ? A('exercise/' + (x.id+1),'Next exercise','button') : A('practice','Review your progress','button')) + '</div></div>';
}
function comparePractice(result,x,index) {
  const expected = x.expected[index];
  if (result.truncated) return 'Your query returned more than 200 rows. Check the joins and filters.';
  if (result.columns.length !== x.cols) return 'Expected ' + x.cols + ' columns; your query returned ' + result.columns.length + '. Follow the requested column sequence.';
  const key = row => JSON.stringify(row.map(v => typeof v === 'number' ? Number(v.toPrecision(12)) : v));
  const actual = result.rows.map(key), target = expected.map(key);
  const balance = new Map();
  for (const row of target) balance.set(row,(balance.get(row) || 0)+1);
  for (const row of actual) balance.set(row,(balance.get(row) || 0)-1);
  for (const [row,count] of balance) {
    if (count < 0 && target.includes(row)) return 'Extra duplicate: ' + row + '. Check whether a join repeated this row.';
  }
  if (actual.length === target.length && x.cols > 1 && actual.every((row,i) => {
    const cells = value => JSON.stringify(JSON.parse(value).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
    return cells(row) === cells(target[i]);
  }) && actual.some((row,i) => row !== target[i])) return 'The values match in each row. Check the order of columns in SELECT.';
  for (const [row,count] of balance) {
    if (count > 0) return 'Missing expected row: ' + row + '. Check values, filters and join keys.';
    if (count < 0) return 'Unexpected row: ' + row + '. Check filters and join keys.';
  }
  const first = target.findIndex((row,i) => row !== actual[i]);
  if (x.ordered && first >= 0) return 'The values match. Check ORDER BY and tie-breakers: row ' + (first+1) + ' should be ' + target[first] + '.';
  return '';
}
function wirePracticeTask(x) {
  const editor = $('answerSQL'), output = $('practiceOutput'), feedback = $('practiceFeedback');
  const run = $('runPractice'), grade = $('gradePractice');
  write('lastExercise',x.id);
  const panels=editor.closest('.lab-panels'), buttons=[...panels.querySelectorAll('[data-show]')];
  function selectPanel(name){panels.dataset.panel=name;buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.show===name)));}
  buttons.forEach(b=>b.onclick=()=>selectPanel(b.dataset.show));selectPanel('question');
  const render = result => table(result.columns,result.rows);
  const setFeedback = (state, msg) => {
    feedback.className = state ? 'is-' + state : '';
    if (!msg) { feedback.textContent = ''; return; }
    const icon = state === 'ok' ? ICON_CHECK : (state === 'warn' || state === 'err') ? ICON_ALERT : '';
    feedback.innerHTML = icon ? icon + '<span>' + E(msg) + '</span>' : E(msg);
  };
  editor.oninput = () => { const drafts=read('practiceDrafts',{}); drafts[x.id]=editor.value; write('practiceDrafts',drafts); setFeedback('', ''); output.textContent=''; };
  if ($('loadBroken')) $('loadBroken').onclick = () => {
    if (editor.value.trim() && !confirm('Replace the current draft with the debugging example?')) return;
    editor.value = $('brokenQuery').textContent; editor.oninput(); editor.focus();
  };
  let sampleSequence = 0;
  document.querySelectorAll('[data-sample]').forEach(btn => {
    btn.onclick = async () => {
      const panel = $('sampleRows'), seq=++sampleSequence;
      const name = btn.dataset.sample;
      if (!x.tables.includes(name)) return;
      panel.textContent = 'Loading sample…';
      try { const r=await runTrainingQuery('SELECT * FROM "' + name + '" LIMIT 5','practice-0'); if(seq===sampleSequence) panel.innerHTML=render(r); }
      catch(err) { if(seq===sampleSequence) panel.textContent=err.message; }
    };
  });
  async function submit(check) {
    const sql=editor.value.trim();
    if (!sql) { setFeedback('warn', 'Write a SELECT or WITH query first.'); selectPanel('results');return; }
    selectPanel('results');panels.querySelector('#emptyResult').hidden=true;run.disabled=grade.disabled=true; editor.readOnly=true; setFeedback('', check?'Checking your query…':'Running…'); output.textContent='';
    try {
      const first=await runTrainingQuery(sql,'practice-0');
      output.innerHTML='<div class="result-head"><h2>Your result</h2><small class="tabular">' + first.rows.length + (first.truncated ? '+ rows' : ' rows') + ' · ' + first.columns.length + ' cols</small></div>' + render(first);
      if (!check) { setFeedback('', ''); return; }
      let issue=comparePractice(first,x,0);
      if (issue) { setFeedback('warn', issue); return; }
      const second=await runTrainingQuery(sql,'practice-1');
      issue=comparePractice(second,x,1);
      if (issue) { setFeedback('warn', 'The first dataset passed. On a second dataset with changed records: ' + issue); return; }
      const solved=read('practiceSolved',[]);
      if (!solved.includes(x.id)) write('practiceSolved',[...solved,x.id]);
      logActivity();
      setFeedback('ok', 'Correct on both datasets.');
      if (editor.isConnected) $('practiceState').textContent='Solved';
    } catch(err) { setFeedback('err', err.message); }
    finally { run.disabled=grade.disabled=false; editor.readOnly=false; }
  }
  run.onclick=()=>submit(false); grade.onclick=()=>submit(true);
  editor.onkeydown=e=>{ if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){ e.preventDefault(); submit(false); } };
}
async function showPractice(route,id,current) {
  const bank=await getPractice();
  if (current!==generation) return;
  const main=$('main');
  if (route==='exercise') {
    const x=bank.exercises.find(v=>v.id===Number(id));
    if (!x) { main.innerHTML=H('SQL practice','Exercise unavailable')+A('practice','Browse exercises'); return; }
    main.innerHTML=practiceTask(x,bank); wirePracticeTask(x); return;
  }
  const [requested,topic]=(id||'').split('~');
  const level=Object.hasOwn(practiceLevels,requested)?requested:'';
  const subset=bank.exercises.filter(x=>!level || x.level===level);
  main.innerHTML=practiceIndex(level,bank);
  const picker=$('practiceTopic'), find=$('practiceFind');
  picker.value=Object.hasOwn(practiceTopics,topic)?topic:'';
  const refresh=()=>{const rule=practiceTopics[picker.value];$('practiceList').innerHTML=practiceList(subset.filter(x=>!rule||rule.test(x.sql)),find.value);};
  picker.onchange=find.oninput=refresh;refresh();
  $('mixedPractice').onclick=()=>{ const solved=read('practiceSolved',[]); const pending=subset.filter(x=>!solved.includes(x.id)); const pool=pending.length?pending:subset; location.hash='exercise/'+pool[Math.floor(Math.random()*pool.length)].id; };
}
