/* Interactive figures for the Academy's fictional worked examples. */
function diagramExplorer(lesson) {
  const {kind, question, labels, icons, answer} = lesson.diagram;
  const nodes = labels.map((label, i) => `<button type="button" class="diagram-node" data-diagram-node="${i}" aria-pressed="${i === 0}" data-note="${E(lesson.diagramNotes[i])}">${kind === 'flow' ? `<span class="node-number" aria-hidden="true">${i + 1}</span>` : ''}${E(label)}</button>`);
  let drawing;
  if (kind === 'pair') {
    drawing = [0, 2].map(i => `<div class="diagram-half">${icons ? `<svg class="slide-icon" aria-hidden="true"><use href="data/lesson-illustrations.svg#${E(icons[i / 2])}"></use></svg>` : ''}${nodes[i]}${nodes[i + 1]}</div>`).join('');
  } else if (kind === 'tree') {
    drawing = `${nodes[0]}<div class="diagram-branches">${nodes.slice(1).join('')}</div>`;
  } else {
    drawing = nodes.join('');
  }
  return `<figure class="study-figure" data-diagram><figcaption>${E(question)}</figcaption><div role="group" aria-label="${E(question)}" class="diagram-canvas diagram-${kind}">${drawing}</div><div class="diagram-explanation" aria-live="polite"><b>${E(labels[0])}</b><p>${E(lesson.diagramNotes[0])}</p></div>${answer ? `<p class="figure-takeaway">${E(answer)}</p>` : ''}</figure>`;
}

const workStages = [
  {label:'Create order', time:'08:15', status:'Reported', activity:'Awaiting plan', labor:'—', material:'—', note:'The operator reports abnormal vibration on PUMP-001. The work order identifies the equipment and records the symptom.'},
  {label:'Plan activity', time:'09:00', status:'Planned', activity:'Check coupling alignment', labor:'2 h planned', material:'1 shim kit planned', note:'The planner adds activity 10, estimates two hours and lists a shim kit. An estimate can be compared with the eventual booking.'},
  {label:'Record actuals', time:'11:45', status:'Work recorded', activity:'Alignment corrected', labor:'1.5 h booked', material:'1 shim kit issued', note:'The mechanic books 1.5 hours to activity 10. Stores issues one kit against the order. These transactions explain what the repair consumed.'},
  {label:'Close order', time:'12:10', status:'Closed', activity:'Test run complete', labor:'1.5 h booked', material:'1 shim kit issued', note:'The planner reviews the test result, booked hours and issued kit. The completed repair can now be found in the equipment’s work history.'}
];
function recordMetric(label, value) {
  return `<div><dt>${E(label)}</dt><dd>${E(value)}</dd></div>`;
}
function workRecord(i) {
  const stage = workStages[i];
  return `<div class="lab-record-head"><strong>WO-1042 · PUMP-001</strong><span>${stage.status}</span></div><dl class="lab-metrics">${recordMetric('Activity',stage.activity)}${recordMetric('Labor',stage.labor)}${recordMetric('Materials',stage.material)}</dl><p>${stage.note}</p>`;
}
function workTimeline() {
  return `<figure class="study-figure" data-work-timeline><figcaption>What changes as a repair moves through the day?</figcaption><p class="figure-context">Example work order · Abnormal pump vibration</p><div class="work-timeline" role="group" aria-label="Work order stages">${workStages.map((stage,i)=>`<button type="button" data-stage="${i}" aria-pressed="${i === 0}"><time>${stage.time}</time><b>${stage.label}</b></button>`).join('')}</div><div class="lab-record" aria-live="polite">${workRecord(0)}</div></figure>`;
}

function stockPosition(issued) {
  const seals = Array.from({length:8},(_,i) => `<i class="${i === 7 && issued ? 'issued' : ''}"></i>`).join('');
  return `<div class="stock-grid"><div><small>MAIN · Store bin</small><strong>${8 - issued} on hand</strong><div class="seal-row" aria-hidden="true">${seals}</div></div><div><small>WO-1001 · Material history</small><strong>${issued} issued</strong><div class="seal-row destination" aria-hidden="true">${issued ? '<i></i>' : '<i class="issued"></i>'}</div></div></div><p>${issued ? 'The issue posts one SEAL-25 to WO-1001. The bin balance and the order’s material history show opposite sides of that transaction.' : 'Eight seals are in stock. This order has no issue transaction for SEAL-25 yet.'}</p>`;
}
function stockLab() {
  return `<figure class="study-figure" data-stock-lab><figcaption>Where did the issued seal go?</figcaption><p class="figure-context">Example transaction · SEAL-25</p><div class="lab-record" aria-live="polite">${stockPosition(0)}</div><button type="button" class="lab-action" data-issue="0">Issue one seal</button></figure>`;
}

function calendarDates(interval) {
  const due = new Set();
  for (let day = 1 + interval; day <= 30; day += interval) due.add(day);
  const dates = Array.from({length:30}, (_,i) => {
    const day = i + 1;
    return `<span aria-hidden="true" class="${day === 1 ? 'calendar-anchor' : due.has(day) ? 'calendar-due' : ''}">${day}</span>`;
  }).join('');
  const blank = '<span aria-hidden="true"></span>'.repeat(2);
  return `<div class="calendar-layout"><div><strong>April 2026</strong><div class="lab-calendar">${['M','T','W','T','F','S','S'].map(d=>`<small aria-hidden="true">${d}</small>`).join('')}${blank}${dates}</div></div><div class="calendar-legend"><small>Inspection completed</small><b>1 April</b><small>Forecast dates in April</small><b>${[...due].join(', ')} April</b><p>Each due date is ${interval} days after the previous one. Generating a work order is a separate step.</p></div></div>`;
}
function calendarLab() {
  return `<figure class="study-figure" data-calendar-lab><figcaption>When will the next compressor inspection fall?</figcaption><p class="figure-context">Calendar-based training schedule · Fixed interval</p><label class="lab-input">Repeat every <select aria-label="Inspection interval" data-interval><option value="7">7 days</option><option value="14" selected>14 days</option><option value="21">21 days</option></select></label><div class="lab-record" aria-live="polite">${calendarDates(14)}</div></figure>`;
}

function recordsBehind(lesson) {
  if (!lesson.records?.length) return '';
  const cards = lesson.records.map(r => {
    const key = r.keys ? recordMetric(r.keys.kind,r.keys.columns.join(' + ')) : '';
    const edge = r.relationship;
    const relationship = edge ? `<div class="schema-edge"><b>${E(edge.kind)}</b><p>${edge.columns.map(([child,parent])=>`<code>${E(child)}</code> pairs with <code>${E(edge.target)}.${E(parent)}</code>`).join('<br>')}</p><small>${E(edge.evidence)}</small></div>` : '';
    return `<li><h3><a href="#table/${U(r.table)}">${E(r.meaning)}</a></h3><code>${E(r.table)}</code><p>${E(r.basis)}</p>${key ? `<dl class="record-key">${key}</dl>` : ''}${relationship}<a href="data/database-reference.html#${U('Table:'+r.table)}">Inspect table definition</a></li>`;
  }).join('');
  return `<details class="lesson-records"><summary>See the records behind this step</summary><ul>${cards}</ul></details>`;
}
function lessonVisual(lesson) {
  if (!lesson.diagram) return '';
  let visual;
  switch (lesson.id) {
    case 'INTRO03': visual = pumpScene('lesson'); break;
    case 'L067': visual = workTimeline(); break;
    case 'L155': visual = stockLab(); break;
    case 'L081': case 'L088': visual = calendarLab(); break;
    default: visual = diagramExplorer(lesson);
  }
  return visual + recordsBehind(lesson);
}

document.addEventListener('click', event => {
  const node = event.target.closest('[data-diagram-node]');
  if (node) {
    const figure = node.closest('[data-diagram]');
    figure.querySelector('[aria-pressed="true"]').setAttribute('aria-pressed','false');
    node.setAttribute('aria-pressed','true');
    const output = figure.querySelector('.diagram-explanation');
    output.querySelector('b').textContent = node.lastChild.textContent;
    output.querySelector('p').textContent = node.dataset.note;
    return;
  }
  const stage = event.target.closest('[data-stage]');
  if (stage) {
    const figure = stage.closest('[data-work-timeline]');
    if (!figure) return;
    figure.querySelector('[aria-pressed="true"]').setAttribute('aria-pressed','false');
    stage.setAttribute('aria-pressed','true');
    figure.querySelector('.lab-record').innerHTML = workRecord(Number(stage.dataset.stage));
    return;
  }
  const issue = event.target.closest('[data-issue]');
  if (issue) {
    const issued = issue.dataset.issue === '0' ? 1 : 0;
    issue.dataset.issue = String(issued);
    issue.textContent = issued ? 'Reset example' : 'Issue one seal';
    issue.closest('[data-stock-lab]').querySelector('.lab-record').innerHTML = stockPosition(issued);
  }
});
document.addEventListener('change', event => {
  if (event.target.matches('[data-interval]')) {
    event.target.closest('[data-calendar-lab]').querySelector('.lab-record').innerHTML = calendarDates(Number(event.target.value));
  }
});

function presentLesson(lesson) {
  const diagram = lesson.diagram;
  const labels = diagram?.labels || (lesson.walkthrough?.length ? lesson.walkthrough.map((_,i)=>'Step '+(i+1)) : ['Query','Check the result']);
  const notes = diagram ? lesson.diagramNotes : (lesson.walkthrough?.length ? lesson.walkthrough : [lesson.sql,lesson.verify]);
  const dialog = document.createElement('dialog');
  dialog.className = 'trainer-screen'; dialog.setAttribute('aria-label','Present '+lesson.title);
  dialog.innerHTML = `<div class="trainer-inner"><header><span>${E(lesson.module)}</span><button data-exit>End presentation</button></header><h2>${E(lesson.title)}</h2><p>${E(diagram?.question || lesson.concept)}</p><div class="trainer-map" data-kind="${E(diagram?.kind||'flow')}"></div><div class="trainer-answer" aria-live="polite"></div><footer><button data-prev>Previous</button><span data-count></span><button data-next>Next</button><button data-reveal>Show explanation</button></footer></div>`;
  let current = 0, revealed = false;
  const find = selector => dialog.querySelector(selector);
  function draw() {
    find('.trainer-map').innerHTML = labels.map((label,i)=>`<span class="${i===current?'current':''}" style="visibility:${i<=current?'visible':'hidden'}">${E(label)}</span>`).join('');
    find('.trainer-answer').textContent = revealed ? notes[current] : '';
    find('[data-count]').textContent = (current+1)+' / '+labels.length;
    find('[data-prev]').disabled = current===0;find('[data-next]').disabled = current===labels.length-1;
    find('[data-reveal]').textContent = revealed?'Hide explanation':'Show explanation';
  }
  function move(offset){current=Math.max(0,Math.min(labels.length-1,current+offset));revealed=false;draw();}
  find('[data-prev]').onclick=()=>move(-1);find('[data-next]').onclick=()=>move(1);
  find('[data-reveal]').onclick=()=>{revealed=!revealed;draw();};
  find('[data-exit]').onclick=()=>dialog.close();
  const end=()=>dialog.close();
  dialog.addEventListener('keydown',event=>{
    if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();move(event.key==='ArrowRight'?1:-1);}
  });
  dialog.addEventListener('close',()=>{window.removeEventListener('hashchange',end);dialog.remove();},{once:true});
  window.addEventListener('hashchange',end);document.body.append(dialog);draw();dialog.showModal();
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-present-lesson]');
  if(button){const lesson=lessons.find(l=>l.id===button.dataset.presentLesson);if(lesson)presentLesson(lesson);}
});
