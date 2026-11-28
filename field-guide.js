function workshopCards(items) {
  return '<div class="case-grid">' + items.map(w => '<a class="case-card" href="#workshop/' + U(w.module) + '"><small>' + E(w.role) + '</small><h3>' + E(w.title) + '</h3><p>' + E(w.module) + '</p></a>').join('') + '</div>';
}
function workshopPage(moduleName) {
  const w = workshops.find(x => x.module === moduleName);
  if (!w) return H('Guided practice','Functional workshops','Choose a business question. Work through the decisions, inspect the source lesson and test your conclusion.') + workshopCards(workshops);
  return H(w.role,w.title,w.situation) + '<div class="reader">' + w.choices.map(([id,title,body],i) => {
    const l = lessons.find(x => x.id === id);
    return '<section class="decision"><small>Decision ' + (i+1) + '</small><h2>' + E(title) + '</h2><p>' + E(body) + '</p><div class="row">' + lessonLink(l) + sourceLink(l.source.hex.id,'HxGN · p. ' + l.source.hex.page) + '</div></section>';
  }).join('') + '<section class="section"><h2>Test your reasoning</h2><p>' + E(w.check) + '</p><details><summary>Compare your answer</summary><p>' + E(w.answer) + '</p></details></section>'
    + '<div class="row">' + (w.sql ? A('lesson/' + w.sql,'Study the related SQL lesson','button primary') : '') + A('workshops','Browse workshops','button') + A('practice','SQL Practice · 110','button')+'<a class="button" href="data/database-reference.html">Database Reference</a>'+ A('practice/Hard~Joins','Hard join exercises')+'</div></div>';
}
function activityDay(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
}
function logActivity() {
  const days = read('activity', []);
  const today = activityDay();
  if (!days.includes(today)) write('activity', [...days, today]);
}
function learningDashboard() {
  const profile = window.EAMProfiles?.getActiveProfile();
  const days = new Set(read('activity', [])), date = new Date();
  if (!days.has(activityDay(date))) date.setDate(date.getDate()-1);
  let streak = 0;
  while (days.has(activityDay(date))) { streak++; date.setDate(date.getDate()-1); }
  const count = lessons.filter(l => done.includes(l.id)).length;
  const pct = lessons.length ? Math.round((count / lessons.length) * 100) : 0;
  const correct = quizzes.filter(q => quizState[q.id] === true).length;
  const solved = read('practiceSolved', []).length;
  const realSolved = read('realSolved', []).length;
  const recentIds = read('recentLessons', []);
  const recentItems = (Array.isArray(recentIds) ? recentIds : []).map(id => lessons.find(l => l.id === id)).filter(Boolean).slice(0, 5);
  const badges = [
    ['First lesson', count >= 1],
    ['Quiz specialist', correct >= 5],
    ['SQL explorer', solved + realSolved >= 5],
    ['Streak builder', streak >= 3]
  ];
  const syncLabel = window.EAMProfiles ? window.EAMProfiles.getSyncStatus() : 'Local progress';
  return '<section class="panel"><div class="dashboard-head"><div><h2>' + (profile ? E(profile.name) + '’s progress' : 'Your progress') + '</h2><p class="muted mb-sm">' + E(syncLabel) + ' · ' + pct + '% curriculum complete.</p></div>' + progressRing(count, lessons.length) + '</div><div class="metrics">' +
    metric(count + '/' + lessons.length, 'Lessons complete') + metric(solved + '/110', 'Synthetic SQL') +
    metric(realSolved + '/55', 'Real 11.6 SQL') + metric(streak, 'Day streak') + metric(correct, 'Quizzes passed') + '</div>' + progress(count, lessons.length) +
    (recentItems.length ? '<div class="recent-lessons"><span class="muted">Recently visited</span>' + recentItems.map(l => lessonLink(l)).join('') + '</div>' : '') +
    '<div class="badge-row"><span class="muted">Milestones</span>' + badges.map(([label, earned]) => '<span class="badge-pill' + (earned ? ' is-earned' : '') + '">' + (earned ? ICON_CHECK : '') + '<span>' + E(label) + '</span></span>').join('') + '</div>' +
    '<details><summary>Completion by module</summary>' + Object.entries(groups).map(([name, items]) => {
      const n = items.filter(l => done.includes(l.id)).length;
      return '<p>' + A('module/' + U(name),name) + ' · ' + n + '/' + items.length + '</p>' + progress(n,items.length);
    }).join('') + '</details>' + A('progress','Open My Learning & exports') + '</section>';
}
function fieldHome() {
  const profile = window.EAMProfiles?.getActiveProfile();
  const task = nextLearningTask();
  const eyebrow = profile ? `Welcome back, ${E(profile.name)}` : 'Enterprise asset management';
  const entryTiles = [
    ['learn', 'Curriculum', `${lessons.length} lessons`, ICON_BOOK, 'Step-by-step functional & technical modules with diagrams and source evidence.'],
    ['sql-real', 'Real 11.6 SQL Lab', '1,681 tables', ICON_DATABASE, 'Query real exported EAM 11.6 tables across 7 families and 55 graded exercises.'],
    ['sql', 'Synthetic SQL Lab', '110 challenges', ICON_TERMINAL, 'Practice core joins and reporting with instant grading on training data.'],
    ['technical', 'Technical Library', '4,034 objects', ICON_COMPASS, 'Inspect triggers, stored procedures, Visual ER explorer, and R5/U5 crosswalk.']
  ];
  return '<div class="front academy-hero"><div class="front-copy"><div class="eyebrow">' + eyebrow + '</div><h1>Learn EAM in practice.</h1><p>Swap the pump in the north pump room. Then open its history to see which unit owns the seal repair.</p><div class="hero-links">' + A(resumeLink(task), task.label, 'button primary') + A('pump', 'Explore the pump case study') + '</div></div>' + pumpScene('home') + '</div>'
    + '<h2>Choose where to work</h2><div class="grid home-tiles">'
    + entryTiles.map(([r, t, meta, icon, d]) => `<a class="tile entry-tile" href="#${r}"><div class="entry-head"><span class="entry-icon" aria-hidden="true">${icon}</span><span class="pill tabular">${E(meta)}</span></div><h3>${E(t)}</h3><p>${E(d)}</p></a>`).join('')
    + '</div>'
    + learningDashboard()
    + '<div class="row footer-links">' + A('coverage','Inspect curriculum coverage') + A('flows','Browse business process flows') + '<a href="sql-formatter/">Offline SQL Formatter</a></div>';
}
let outlineObserver;
function attachLessonContents() {
  if (outlineObserver) { outlineObserver.disconnect(); outlineObserver = null; }
  const article = document.querySelector('.lesson-content');
  if (!article) return;
  const headings = [...article.querySelectorAll('section > h2')];
  if (!headings.length) return;
  const details = document.createElement('details');
  details.className = 'lesson-contents';
  details.innerHTML = '<summary>On this page</summary><div class="row"></div>';
  const rail = document.querySelector('.rail');
  let railBox = null, railLinks = [];
  if (rail) {
    railBox = document.createElement('div');
    railBox.className = 'rail-outline';
    railBox.innerHTML = '<h3>On this page</h3><nav aria-label="Section outline"></nav><hr>';
  }
  headings.forEach((h, idx) => {
    h.tabIndex = -1;
    if (!h.id) h.id = 'sec-' + (idx + 1);
    const jump = () => {
      details.open = false;
      h.focus({ preventScroll: true });
      h.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    };
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = h.textContent;
    btn.onclick = jump;
    details.lastChild.append(btn);
    if (railBox) {
      const link = document.createElement('a');
      link.href = '#' + h.id;
      link.textContent = h.textContent;
      link.onclick = e => { e.preventDefault(); jump(); };
      railBox.querySelector('nav').append(link);
      railLinks.push({ h, link });
    }
  });
  const first = article.querySelector('section');
  if (first) first.before(details);
  if (rail && railBox) {
    rail.prepend(railBox);
    if ('IntersectionObserver' in window) {
      const setCurrent = target => {
        railLinks.forEach(({ h, link }) => link.classList.toggle('is-current', h === target));
      };
      setCurrent(headings[0]);
      outlineObserver = new IntersectionObserver(entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) setCurrent(visible[0].target);
      }, { rootMargin: '-18% 0px -65% 0px', threshold: 0 });
      headings.forEach(h => outlineObserver.observe(h));
    }
  }
}

// Move live lesson controls, so each note and assessment has one source of state.
let releaseCompanion = () => {};
function attachCompanion(article) {
  const rail = document.querySelector('.lesson-layout .rail');
  if (!rail) return;
  const quiz = article.querySelector('.notes-card')?.closest('section');
  if (!quiz) return;
  const visual = article.querySelector('.study-figure,.pumpsim,.sql-output');
  const notes = quiz.querySelector('.notes-card');
  const items = [['Visual',visual],['Check',quiz],['Notes',notes]].filter(([,node])=>node);
  const host=document.createElement('section');
  host.className='lesson-companion';
  const nav=document.createElement('div');nav.className='row';host.append(nav);
  const entries=items.map(([name,node])=>{
    const slot=document.createComment(name);node.before(slot);
    const button=document.createElement('button');button.type='button';button.textContent=name;nav.append(button);
    const panel=document.createElement('div');host.append(panel);
    button.onclick=()=>{for(const entry of entries){entry.panel.hidden=entry.node!==node;entry.button.setAttribute('aria-pressed',String(entry.node===node));}};
    return {button,panel,node,slot};
  });
  const media=matchMedia('(min-width:1500px)');
  function layout(){
    if(media.matches&&!document.body.classList.contains('reader-focus')){
      rail.prepend(host);
      for(const e of entries)e.panel.append(e.node);
      entries[0].button.click();
    }else{
      for(const e of entries)e.slot.after(e.node);
      host.remove();
    }
  }
  media.addEventListener('change',layout);document.addEventListener('readerlayout',layout);layout();
  releaseCompanion=()=>{media.removeEventListener('change',layout);document.removeEventListener('readerlayout',layout);host.remove();releaseCompanion=()=>{};};
}
