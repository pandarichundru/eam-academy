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
    + '<div class="row">' + (w.sql ? A('lesson/' + w.sql,'Study the related SQL lesson','button primary') : '') + A('workshops','Browse workshops','button') + '</div></div>';
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
  const days = new Set(read('activity', [])), date = new Date();
  if (!days.has(activityDay(date))) date.setDate(date.getDate()-1);
  let streak = 0;
  while (days.has(activityDay(date))) { streak++; date.setDate(date.getDate()-1); }
  const count = lessons.filter(l => done.includes(l.id)).length;
  const correct = quizzes.filter(q => quizState[q.id] === true).length;
  const solved = read('practiceSolved', []).length;
  const badges = [
    ['First lesson', count >= 1],
    ['Quiz specialist', correct >= 5],
    ['SQL explorer', solved >= 5]
  ];
  return '<section class="panel"><div class="dashboard-head"><div><h2>Your learning</h2><p class="muted mb-sm">Local progress, quiz accuracy, and SQL practice stored in this browser.</p></div>' + progressRing(count, lessons.length) + '</div><div class="metrics">' +
    metric(count + '/' + lessons.length, 'Lessons complete') + metric(count*10 + correct*5 + solved*15,'XP') +
    metric(streak, 'Day streak') + '</div>' + progress(count, lessons.length) +
    '<div class="badge-row"><span class="muted">Milestones</span>' + badges.map(([label, earned]) => '<span class="badge-pill' + (earned ? ' is-earned' : '') + '">' + (earned ? ICON_CHECK : '') + '<span>' + E(label) + '</span></span>').join('') + '</div>' +
    '<details><summary>Completion by module</summary>' + Object.entries(groups).map(([name, items]) => {
      const n = items.filter(l => done.includes(l.id)).length;
      return '<p>' + A('module/' + U(name),name) + ' · ' + n + '/' + items.length + '</p>' + progress(n,items.length);
    }).join('') + '</details>' + A('progress','Manage or back up progress') + '</section>';
}
function fieldHome() {
  const last = lessons.find(l => l.id === read('lastLesson',''));
  const entryTiles = [
    ['learn', 'Functional curriculum', `${lessons.length} lessons`, ICON_BOOK, `${lessons.length} lessons across ${Object.keys(groups).length} modules, with scenarios and source evidence.`],
    ['practice', 'SQL Exercises', '110 challenges', ICON_TERMINAL, 'Write and check your own queries across four difficulty levels, from SELECT to historical reporting.'],
    ['paths', 'Role-based paths', `${Object.keys(roles).length} role paths`, ICON_COMPASS, 'Follow a curriculum organized around your responsibilities.'],
    ['reference', 'Reference library', '1,681 R5 tables', ICON_DATABASE, 'Look up guides, fields, database tables and relationships.']
  ];
  return '<div class="front"><div class="front-copy"><div class="eyebrow">Enterprise asset management</div><h1>Learn EAM in practice.</h1><p>Explore the work behind an asset, trace the records it creates, and use SQL to explain what happened.</p><form id="refSearch"><input type="search" id="refQ" aria-label="Search the academy" placeholder="Search a topic, process or R5 table"><button class="primary">Search</button></form><div class="row footer-links">' + (last ? A('lesson/' + last.id,'Continue learning','button primary') : A('lesson/INTRO01','Start here · What is EAM?','button primary')) + '</div></div>'
    + '<a class="feature" href="#pump"><small>FEATURED CASE STUDY</small><h2>From pump to preventive work order</h2>'
    + '<svg class="feature-schematic" viewBox="0 0 320 44" fill="none" aria-hidden="true">'
    + '<line x1="28" y1="22" x2="144" y2="22" stroke="currentColor" stroke-opacity="0.3" stroke-width="1.25" stroke-dasharray="3 3"/>'
    + '<line x1="176" y1="22" x2="290" y2="22" stroke="currentColor" stroke-opacity="0.3" stroke-width="1.25"/>'
    + '<polyline points="285,18 291,22 285,26" stroke="currentColor" stroke-opacity="0.55" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<circle cx="20" cy="22" r="7" stroke="currentColor" stroke-width="1.4"/><circle cx="20" cy="22" r="2.2" fill="currentColor"/>'
    + '<rect x="148" y="14" width="24" height="16" rx="4" stroke="currentColor" stroke-width="1.4"/><path d="M155 22h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'
    + '<circle cx="300" cy="22" r="7" stroke="currentColor" stroke-width="1.4"/><path d="M297 22l2 2 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'
    + '</svg>'
    + '<div class="asset-flow"><span>Asset <b>PUMP-001</b></span><span>Schedule <b>PUMP30</b></span><span>Interval <b>30 days</b></span></div><strong>Explore the case study</strong></a></div>'
    + (last ? '<div class="resume-band"><span>Continue where you left off</span>' + A('lesson/' + last.id,last.title) + '</div>' : '<div class="resume-band"><span>Start with the fundamentals</span>' + lessonLink(lessons[0]) + '</div>')
    + learningDashboard()
    + '<h2>Choose your starting point</h2><div class="grid home-tiles">'
    + entryTiles.map(([r, t, meta, icon, d]) => `<a class="tile entry-tile" href="#${r}"><div class="entry-head"><span class="entry-icon" aria-hidden="true">${icon}</span><span class="pill tabular">${E(meta)}</span></div><h3>${E(t)}</h3><p>${E(d)}</p></a>`).join('')
    + '</div>'
    + '<div class="section-head"><h2>Practice with a business problem</h2>' + A('workshops','All workshops') + '</div>' + workshopCards([workshops[2],workshops[4],workshops[3]])
    + '<div class="row footer-links">' + A('coverage','Inspect curriculum coverage') + A('flows','Browse business process flows') + '</div>';
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
      h.scrollIntoView({ block: 'start', behavior: 'smooth' });
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
