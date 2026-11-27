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
  const next = subset.find(x => !solved.includes(x.id)) || subset[0];
  if (!next) return A('practice','Browse the SQL practice course');
  return H('SQL practice','100 SQL Exercises','Write each query from a business question. Run it on the practice data, then check your answer on two datasets. Your drafts and completed exercises are saved in this browser.')
    + '<div class="row practice-tools">' + A('exercise/' + next.id,'Continue practice','button primary') + '<button id="mixedPractice">Random challenge</button>' + A('sql-course','Guided SQL lessons') + '</div>'
    + '<details class="challenge-aid"><summary>How to approach an unfamiliar SQL question</summary><ol><li>Write down what one output row represents and the columns it needs.</li><li>Inspect the tables. Identify the key on each side of every join.</li><li>Start with a few source rows. Add one filter, join or calculation at a time.</li><li>Check what happens with a missing match, a tie and two detail rows for the same parent.</li><li>Compare your result on both datasets. Revisit a solved question later without opening the solution.</li></ol></details>'
    + '<div class="practice-levels">' + Object.entries(practiceLevels).map(([name,desc]) => {
      const count = bank.exercises.filter(x => x.level === name && solved.includes(x.id)).length;
      return '<a class="case-card" href="#practice/' + U(name) + '"><h2>' + E(name) + '</h2><p>' + E(desc) + '</p><small>' + count + ' / 25 solved</small>' + progress(count,25) + '</a>';
    }).join('') + '</div><div class="section-head"><h2>' + E(level || 'All exercises') + '</h2>' + (level ? A('practice','Show all levels') : '') + '</div>'
    + '<label for="practiceFind">Find an exercise</label><input type="search" id="practiceFind" placeholder="Try median, receipts, or meter"><div id="practiceList"></div>';
}
function practiceList(items,q) {
  const solved = read('practiceSolved',[]);
  const terms = q.trim().toLowerCase().split(/\s+/);
  const hits = items.filter(x => terms.every(t => [x.title,x.level,x.prompt,...x.tables].join(' ').toLowerCase().includes(t)));
  return hits.length ? hits.map(x => '<a class="challenge-row" href="#exercise/' + x.id + '"><span>' + String(x.id).padStart(2,'0') + '</span><strong>' + E(x.title) + '</strong><small>' + E(x.level) + (solved.includes(x.id) ? ' · Solved' : '') + '</small></a>').join('') : '<p>No exercises match this search.</p>';
}
function practiceTask(x,bank) {
  const draft = read('practiceDrafts',{})[x.id] || '';
  const solved = read('practiceSolved',[]).includes(x.id);
  return '<div class="challenge-reader">' + A('practice/' + U(x.level),'Back to ' + x.level + ' exercises') + H(x.level + ' · Exercise ' + x.id + ' of 100',x.title,x.prompt)
    + '<div class="section practice-schema"><h2>Tables for this question</h2><p>Choose a table to inspect up to five sample rows.</p><div class="row">' + x.tables.map(t => '<button data-sample="' + E(t) + '">' + E(t) + '</button>').join('') + '</div><div id="sampleRows" aria-live="polite"></div><details><summary>Column names</summary>' + x.tables.map(t => '<p><b>' + E(t) + '</b><br><code>' + E(bank.schema[t].join(', ')) + '</code></p>').join('') + '</details></div>'
    + '<label for="answerSQL"><strong>Your SQL query</strong></label><textarea id="answerSQL" spellcheck="false" placeholder="SELECT …">' + E(draft) + '</textarea><div class="row"><button id="runPractice">Run query</button><button id="gradePractice" class="primary">Check answer</button><small id="practiceState">' + (solved ? 'Previously solved' : 'SQLite · read-only practice data') + '</small></div><div id="practiceFeedback" aria-live="polite"></div><div id="practiceOutput"></div>'
    + '<details class="challenge-aid"><summary>Hint</summary><p>' + E(x.reason) + '</p></details><details class="challenge-aid"><summary>Show worked solution</summary><pre>' + E(x.sql) + '</pre><p>' + E(x.reason) + '</p><p>On the practice data this returns ' + x.expected[0].length + ' row(s) and ' + x.cols + ' column(s).</p></details>'
    + '<div class="row footer-links">' + (x.id>1 ? A('exercise/' + (x.id-1),'Previous exercise','button') : '') + (x.id<100 ? A('exercise/' + (x.id+1),'Next exercise','button') : A('practice','Review your progress','button')) + '</div></div>';
}
function comparePractice(result,x,index) {
  const expected = x.expected[index];
  if (result.truncated) return 'Your query returned more than 200 rows. Check the joins and filters.';
  if (result.columns.length !== x.cols) return 'Expected ' + x.cols + ' columns; your query returned ' + result.columns.length + '. Follow the requested column sequence.';
  if (result.rows.length !== expected.length) return 'Expected ' + expected.length + ' rows; your query returned ' + result.rows.length + '. Check missing records or duplicates.';
  const key = row => JSON.stringify(row.map(v => typeof v === 'number' ? Number(v.toPrecision(12)) : v));
  const actual = result.rows.map(key), target = expected.map(key);
  if (!x.ordered) { actual.sort(); target.sort(); }
  const i = target.findIndex((r,n) => r !== actual[n]);
  if (i<0) return '';
  if (x.ordered) return 'Row ' + (i+1) + ' should be ' + target[i] + '. Check values, sorting and tie-breakers.';
  const counts = new Map();
  for (const r of actual) counts.set(r,(counts.get(r)||0)+1);
  const missing = target.find(r => { const n=counts.get(r)||0; counts.set(r,n-1); return n===0; });
  return 'The row count matches. An expected row is missing or has different values: ' + missing + '.';
}
function wirePracticeTask(x) {
  const editor = $('answerSQL'), output = $('practiceOutput'), feedback = $('practiceFeedback');
  const run = $('runPractice'), grade = $('gradePractice');
  const render = result => table(result.columns,result.rows.map(row => row.map(v => v === null ? 'NULL' : v)));
  editor.oninput = () => { const drafts=read('practiceDrafts',{}); drafts[x.id]=editor.value; write('practiceDrafts',drafts); feedback.textContent=''; output.textContent=''; };
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
    if (!sql) { feedback.textContent='Write a SELECT or WITH query first.'; editor.focus(); return; }
    run.disabled=grade.disabled=true; editor.readOnly=true; feedback.textContent=check?'Checking your query…':'Running…'; output.textContent='';
    try {
      const first=await runTrainingQuery(sql,'practice-0');
      output.innerHTML='<h2>Your result</h2><p>' + first.rows.length + (first.truncated ? '+ rows' : ' rows') + '</p>' + render(first);
      if (!check) {feedback.textContent=''; return;}
      let issue=comparePractice(first,x,0);
      if (issue) {feedback.textContent=issue; return;}
      const second=await runTrainingQuery(sql,'practice-1');
      issue=comparePractice(second,x,1);
      if (issue) { feedback.textContent='The first dataset passed. On a second dataset with changed records: ' + issue; return; }
      const solved=read('practiceSolved',[]);
      if (!solved.includes(x.id)) write('practiceSolved',[...solved,x.id]);
      logActivity();
      feedback.textContent='Correct on both datasets.';
      if (editor.isConnected) $('practiceState').textContent='Solved';
    } catch(err) { feedback.textContent=err.message; }
    finally { run.disabled=grade.disabled=false; editor.readOnly=false; }
  }
  run.onclick=()=>submit(false); grade.onclick=()=>submit(true);
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
  const level=Object.hasOwn(practiceLevels,id)?id:'';
  const subset=bank.exercises.filter(x=>!level || x.level===level);
  main.innerHTML=practiceIndex(level,bank);
  $('practiceList').innerHTML=practiceList(subset,'');
  $('practiceFind').oninput=e=>{ $('practiceList').innerHTML=practiceList(subset,e.target.value); };
  $('mixedPractice').onclick=()=>{ const solved=read('practiceSolved',[]); const pending=subset.filter(x=>!solved.includes(x.id)); const pool=pending.length?pending:subset; location.hash='exercise/'+pool[Math.floor(Math.random()*pool.length)].id; };
}
