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
function fieldHome() {
  const last = lessons.find(l => l.id === read('lastLesson',''));
  return '<div class="front"><div class="front-copy"><div class="eyebrow">Enterprise asset management</div><h1>Learn EAM in practice.</h1><p>Explore the work behind an asset, trace the records it creates, and use SQL to explain what happened.</p><form id="refSearch"><input type="search" id="refQ" aria-label="Search the academy" placeholder="Search a topic, process or R5 table"><button class="primary">Search</button></form><div class="row footer-links">' + A('practice','Open 100 SQL Exercises','button primary') + '</div></div>'
    + '<a class="feature" href="#pump"><small>FEATURED CASE STUDY</small><h2>From pump to preventive work order</h2><div class="asset-flow"><span>Asset <b>PUMP-001</b></span><span>Schedule <b>PUMP30</b></span><span>Interval <b>30 days</b></span></div><strong>Explore the case study</strong></a></div>'
    + (last ? '<div class="resume-band"><span>Last opened lesson</span>' + A('lesson/' + last.id,last.title) + '</div>' : '')
    + '<h2>Choose your starting point</h2>' + tiles([['learn','Functional curriculum',lessons.length + ' lessons across ' + Object.keys(groups).length + ' modules, with scenarios and source evidence.'],['practice','100 SQL Exercises','Write and check your own queries across four difficulty levels, from SELECT to historical reporting.'],['paths','Role-based paths','Follow a curriculum organized around your responsibilities.'],['reference','Reference library','Look up guides, fields, database tables and relationships.']])
    + '<div class="section-head"><h2>Practice with a business problem</h2>' + A('workshops','All workshops') + '</div>' + workshopCards([workshops[2],workshops[4],workshops[3]])
    + '<div class="row footer-links">' + A('coverage','Inspect curriculum coverage') + A('flows','Browse business process flows') + '</div>';
}
function attachLessonContents() {
  const article = document.querySelector('.lesson-content');
  if (!article) return;
  const headings = [...article.querySelectorAll('section > h2')];
  const details = document.createElement('details');
  details.className = 'lesson-contents';
  details.innerHTML = '<summary>On this page</summary><div class="row"></div>';
  headings.forEach(h => {
    h.tabIndex = -1;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = h.textContent;
    btn.onclick = () => { details.open = false; h.focus({preventScroll:true}); h.scrollIntoView({block:'start'}); };
    details.lastChild.append(btn);
  });
  const first = article.querySelector('section');
  if (first) first.before(details);
}
