'use strict';
const $ = id => document.getElementById(id);
const E = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const U = encodeURIComponent;
const HMark = v => E(v).replace(/\[\[H\]\]/g, '<mark>').replace(/\[\[\/H\]\]/g, '</mark>');
const read = (k, d) => { try { return JSON.parse(localStorage.getItem('eam3:' + k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem('eam3:' + k, JSON.stringify(v)); } catch {} };

let lessons = [], catalog = {}, extended = {}, enrichment = {}, codeMeta = {}, quizzes = [], groups = {};
let done = read('done', []), marks = read('marks', []), notes = read('notes', {}), quizState = read('quiz', {}), sqlHist = read('sqlhist', []);
let generation = 0;

const roles = {
  'Beginner': ['Introduction to EAM', 'Fundamentals', 'Equipment management', 'Work management'],
  'Maintenance technician': ['Fundamentals', 'Equipment management', 'Work management', 'Inspection, safety and calibration'],
  'Maintenance planner': ['Equipment management', 'Work management', 'Preventive maintenance', 'Materials and inventory'],
  'Inventory specialist': ['Fundamentals', 'Materials and inventory', 'Purchasing management'],
  'Purchasing specialist': ['Materials and inventory', 'Purchasing management'],
  'Functional consultant': ['Fundamentals', 'Equipment management', 'Work management', 'Preventive maintenance', 'Materials and inventory', 'Purchasing management', 'Administration', 'Implementation and troubleshooting'],
  'Technical consultant': ['Database and SQL', 'Customization and integration', 'Administration', 'Implementation and troubleshooting'],
  'System administrator': ['Administration', 'Customization and integration', 'Fundamentals'],
  'Implementation specialist': ['Implementation and troubleshooting', 'Administration', 'Equipment management', 'Materials and inventory', 'Work management'],
  'Interview preparation': ['Fundamentals', 'Work management', 'Preventive maintenance', 'Database and SQL', 'Implementation and troubleshooting'],
};

const glossary = {
  'Asset': 'A physical equipment identity; see Creating assets.',
  'Position': 'The maintained function that an installed asset may occupy.',
  'System': 'A group of equipment working together.',
  'Location': 'A physical place; distinguish it from a functional position.',
  'MOS': 'Multi-organization security; record scope and permissions depend on configuration.',
  'Dataspy': 'A reusable list-view filter.',
  'PM': 'Preventive maintenance: scheduled recurring work.',
  'UDF': 'User-defined field on a supported screen.',
  'Work order': 'A maintenance work record containing header and related execution details.',
  'Activity': 'A work order task identified within its parent work order.',
  'Trade': 'A labor skill category used for work planning.',
  'Part': 'An inventory item definition, distinct from an equipment asset.',
  'Store': 'A stock-holding location.',
  'Bin': 'A storage subdivision of a store.',
  'Reservation': 'Planned material demand, not a posted issue.',
  'Requisition': 'A request for materials or services.',
  'Purchase order': 'A purchasing commitment with a header and line details.',
  'Core-tracked part': 'A repairable part with tracking for repair and return.',
  'Status authorization': 'Permission for a particular status change, distinct from screen access.',
  'Meter': 'A device or accumulated usage measure; see the physical and logical meter lesson.',
  'Primary key': 'One or more columns uniquely identifying a row.',
  'Foreign key': 'Columns referencing a parent key; confirm actual composite constraints.',
  'UAT': 'User acceptance testing against agreed business requirements.',
};

const crosswalk = [
  ['organizations', 'R5ORGANIZATION', 'Owning organization codes & currency context'],
  ['departments', 'R5MRCS', 'Maintenance departments / MRCs'],
  ['locations', 'R5OBJECTS', 'Location-typed equipment records (OBJ_OBTYPE = L)'],
  ['equipment', 'R5OBJECTS', 'Assets, positions, systems, and locations'],
  ['equipment_links', 'R5STRUCTURES', 'Parent-child equipment hierarchy links'],
  ['work_orders', 'R5EVENTS', 'Work orders, PM events, and service requests'],
  ['activities', 'R5ACTIVITIES', 'Tasks scoped by composite key (ACT_EVENT, ACT_ACT)'],
  ['trades', 'R5TRADES', 'Craft / labor trade master definitions'],
  ['employees', 'R5PERSONNEL', 'Employee / technician master records'],
  ['labor_entries', 'R5BOOKEDHOURS', 'Actual booked labor hours against work activities'],
  ['parts', 'R5PARTS', 'Inventory part catalog master'],
  ['stores', 'R5STORES', 'Stock-holding warehouse stores'],
  ['bins', 'R5BINS', 'Storage bins inside a store'],
  ['stock', 'R5STOCK', 'Part-store stock levels, reorder & min/max'],
  ['reservations', 'R5TRANSLINES', 'Planned material reservations / demand'],
  ['material_issues', 'R5TRANSACTIONS', 'Posted issue/return inventory transactions'],
  ['suppliers', 'R5COMPANIES', 'Suppliers & manufacturers'],
  ['requisitions', 'R5REQUISITIONS', 'Purchase requisition headers'],
  ['requisition_lines', 'R5REQUISLINES', 'Purchase requisition line items'],
  ['purchase_orders', 'R5ORDERS', 'Purchase order headers'],
  ['purchase_lines', 'R5ORDERLINES', 'Purchase order line items'],
  ['receipts', 'R5DOCKRECEIPTS', 'PO receiving headers & quantities'],
  ['meters', 'R5METERS', 'Physical/logical meter definitions'],
  ['meter_readings', 'R5READINGS', 'Recorded meter readings'],
  ['pm_schedules', 'R5PPM', 'Preventive maintenance schedule definitions'],
  ['inspections', 'R5ASPECTPOINTS', 'Inspection aspects & recorded results'],
  ['projects', 'R5PROJECTS', 'Capital / shutdown project headers'],
  ['work_projects', 'R5EVENTS', 'Project association on work orders (EVT_PROJECT)'],
];

const businessFlows = [
  {
    title: 'Asset Onboarding & Hierarchy',
    desc: 'Establish organizational ownership, locations, systems, functional positions, and physical serialized assets.',
    steps: [
      { label: 'Organization & MOS', lesson: 'Organizations and multi-org security', table: 'R5ORGANIZATION' },
      { label: 'Locations & Systems', lesson: 'Creating locations', table: 'R5OBJECTS' },
      { label: 'Functional Positions', lesson: 'Creating positions', table: 'R5OBJECTS' },
      { label: 'Physical Assets', lesson: 'Creating assets', table: 'R5OBJECTS' },
      { label: 'Hierarchy Links', lesson: 'Equipment hierarchies', table: 'R5STRUCTURES' },
      { label: 'Meters & Warranties', lesson: 'Physical and logical meters', table: 'R5METERS' },
    ],
  },
  {
    title: 'Request-to-Close Work Order',
    desc: 'Capture maintenance demand, approve, plan activities and materials, record actuals, and close cleanly.',
    steps: [
      { label: 'Work Request & Approval', lesson: 'Work request approval', table: 'R5EVENTS' },
      { label: 'Work Order Header', lesson: 'Regular work order lifecycle', table: 'R5EVENTS' },
      { label: 'Activities & Plans', lesson: 'Work order activities', table: 'R5ACTIVITIES' },
      { label: 'Material Planning', lesson: 'Work order material planning', table: 'R5MATLPARTS' },
      { label: 'Labor & Issues', lesson: 'Booking actual labor', table: 'R5BOOKEDHOURS' },
      { label: 'Closeout & Costs', lesson: 'Closing completed work orders', table: 'R5EVENTS' },
    ],
  },
  {
    title: 'Preventive Maintenance Cycle',
    desc: 'Translate recurring engineering requirements into scheduled work orders via meters, calendars, and batch previews.',
    steps: [
      { label: 'Meter History', lesson: 'Meter history', table: 'R5READINGS' },
      { label: 'PM Schedule', lesson: 'Creating PM schedules', table: 'R5PPM' },
      { label: 'PM Activities & Parts', lesson: 'PM work order activities', table: 'R5PPMACTS' },
      { label: 'Equipment Association', lesson: 'Equipment association with PM schedules', table: 'R5PPMS' },
      { label: 'Batch Generation', lesson: 'Generating work orders in batches', table: 'R5EVENTS' },
      { label: 'Review Generated WO', lesson: 'Reviewing generated PM work orders', table: 'R5EVENTS' },
    ],
  },
  {
    title: 'Procure-to-Pay Lifecycle',
    desc: 'Convert operational material or service demand into approved purchase orders, receipts, and three-way matched invoices.',
    steps: [
      { label: 'Requisition Header', lesson: 'Purchase requisition headers', table: 'R5REQUISITIONS' },
      { label: 'Part & Service Lines', lesson: 'Requisition part lines', table: 'R5REQUISLINES' },
      { label: 'Convert to PO', lesson: 'Converting requisitions into POs', table: 'R5ORDERS' },
      { label: 'PO Lines & Approval', lesson: 'Purchase order part lines', table: 'R5ORDERLINES' },
      { label: 'PO Receiving', lesson: 'Purchase order receipts', table: 'R5DOCKRECEIPTS' },
      { label: 'Invoice Voucher', lesson: 'Invoice vouchers', table: 'R5INVOICES' },
    ],
  },
  {
    title: 'Issue-to-Return Inventory',
    desc: 'Control stock across stores and bins, reserve spares for planned jobs, issue consumption, and reconcile counts.',
    steps: [
      { label: 'Stores & Bins', lesson: 'Stores', table: 'R5STORES' },
      { label: 'Part-Store Rules', lesson: 'Part-store association and replenishment', table: 'R5STOCK' },
      { label: 'Part Reservations', lesson: 'Part reservations', table: 'R5TRANSLINES' },
      { label: 'Issue to Work Order', lesson: 'Issue parts to work orders', table: 'R5TRANSACTIONS' },
      { label: 'Return Unused', lesson: 'Return unused materials', table: 'R5TRANSLINES' },
      { label: 'Physical Inventory', lesson: 'Physical inventory', table: 'R5BINSTOCK' },
    ],
  },
];

const ICON_COPY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
const ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';
const ICON_CHECK_CIRCLE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m9 12 2 2 4-4"></path></svg>';
const ICON_BOOKMARK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"></path></svg>';
const ICON_BOOKMARK_FILL = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"></path></svg>';
const ICON_ARROW_LEFT = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>';
const ICON_ARROW_RIGHT = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>';
const ICON_FLOW_ARROW = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg>';
const ICON_PLAY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>';
const ICON_DOWNLOAD = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
const ICON_EXTERNAL = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"></path><path d="M8 7h9v9"></path></svg>';
const ICON_ALERT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
const ICON_BOOK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>';
const ICON_TERMINAL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>';
const ICON_COMPASS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>';
const ICON_DATABASE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"></path><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"></path></svg>';

function progressRing(n, total) {
  const pct = total ? Math.round((n / total) * 100) : 0;
  const r = 19, c = 2 * Math.PI * r, off = c - (pct / 100) * c;
  return `<div class="ring-stat" aria-label="${pct}% complete"><svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true"><circle class="ring-track" cx="24" cy="24" r="${r}"/><circle class="ring-fill" cx="24" cy="24" r="${r}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/></svg><span>${pct}%</span></div>`;
}

const SQL_KEYWORDS = new Set([
  'SELECT','FROM','WHERE','AND','OR','NOT','IN','IS','NULL','AS','ON','JOIN','LEFT','RIGHT','INNER','OUTER','FULL','CROSS',
  'GROUP','BY','ORDER','ASC','DESC','HAVING','LIMIT','OFFSET','DISTINCT','UNION','ALL','WITH','CASE','WHEN','THEN','ELSE','END',
  'CAST','COALESCE','OVER','PARTITION','ROW_NUMBER','RANK','DENSE_RANK','LAG','LEAD','COUNT','SUM','AVG','MIN','MAX',
  'CREATE','TABLE','VIEW','TRIGGER','PROCEDURE','FUNCTION','INDEX','UNIQUE','PRIMARY','KEY','REFERENCES','ALTER','DROP',
  'INSERT','INTO','VALUES','UPDATE','SET','DELETE','BEGIN','DECLARE','IF','RETURN','RETURNS','EXEC','EXECUTE','EXISTS','BETWEEN','LIKE'
]);

function highlightSQL(source) {
  const tokenRe = /(--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/g;
  let out = '', last = 0, m;
  while ((m = tokenRe.exec(source)) !== null) {
    if (m.index > last) out += E(source.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('--') || tok.startsWith('/*')) out += `<span class="tok-com">${E(tok)}</span>`;
    else if (tok.startsWith("'")) out += `<span class="tok-str">${E(tok)}</span>`;
    else if (/^\d/.test(tok)) out += `<span class="tok-num">${E(tok)}</span>`;
    else if (SQL_KEYWORDS.has(tok.toUpperCase())) out += `<span class="tok-kw">${E(tok)}</span>`;
    else out += E(tok);
    last = tokenRe.lastIndex;
  }
  if (last < source.length) out += E(source.slice(last));
  return out;
}

function enhanceCodeBlocks(root) {
  if (!root) return;
  root.querySelectorAll('pre').forEach(pre => {
    if (pre.classList.contains('source-text') || pre.querySelector('mark')) return;
    const raw = pre.textContent;
    if (/\b(SELECT|CREATE|ALTER|WITH|DECLARE|BEGIN|INSERT|UPDATE|DELETE|FROM|WHERE)\b/i.test(raw)) {
      pre.innerHTML = highlightSQL(raw);
    }
    if (pre.classList.contains('code-view') || pre.parentElement?.classList.contains('code-block')) return;
    const wrap = document.createElement('div');
    wrap.className = 'code-block';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-code-btn';
    btn.setAttribute('aria-label', 'Copy code');
    btn.innerHTML = `${ICON_COPY}<span>Copy</span>`;
    btn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(raw);
        btn.classList.add('is-copied');
        btn.innerHTML = `${ICON_CHECK}<span>Copied</span>`;
        setTimeout(() => {
          if (btn.isConnected) {
            btn.classList.remove('is-copied');
            btn.innerHTML = `${ICON_COPY}<span>Copy</span>`;
          }
        }, 1600);
      } catch {}
    };
    pre.parentNode.insertBefore(wrap, pre);
    wrap.append(btn, pre);
  });
}

const H = (tag, title, desc = '') => `<div class="eyebrow">${E(tag)}</div><h1>${E(title)}</h1>${desc ? `<p class="muted">${E(desc)}</p>` : ''}`;
const A = (route, label, cls = '') => `<a ${cls ? `class="${cls}"` : ''} href="#${route}">${E(label)}</a>`;
const ext = (url, label) => `<a class="ext-link" href="${E(url)}" target="_blank" rel="noopener noreferrer"><span>${E(label)}</span>${ICON_EXTERNAL}</a>`;
const table = (headers, rows) => `<div class="scroll"><table><thead><tr>${headers.map(v => `<th scope="col">${E(v)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(v => `<td>${v === null || v === undefined ? '<span class="null-val">NULL</span>' : E(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const tiles = items => `<div class="grid">${items.map(([r, t, d]) => `<a class="tile" href="#${r}"><h3>${E(t)}</h3><p>${E(d)}</p></a>`).join('')}</div>`;
const progress = (n, total) => `<div class="bar" role="progressbar" aria-label="Completion" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${n}"><i style="width:${total ? n / total * 100 : 0}%"></i></div>`;
const lessonLink = l => `<a class="lesson-link${done.includes(l.id) ? ' is-done' : ''}" href="#lesson/${E(l.id)}">${done.includes(l.id) ? ICON_CHECK : ''}<span>${E(l.title)}</span></a>`;
const metric = (n, t) => `<div class="metric"><strong>${E(n)}</strong><span>${E(t)}</span></div>`;
const sourceLink = (id, label) => A('doc/' + id, label);

function findLessonByTitle(t) {
  return lessons.find(l => l.title.toLowerCase() === t.toLowerCase()) || lessons.find(l => l.title.toLowerCase().includes(t.toLowerCase()));
}

function renderNav(route, id) {
  const sections = {
    learn: ['lesson','module','paths','path','assess','coverage'],
    workshops: ['workshop','pump','flows'],
    reference: ['doc','search','glossary','fields','topics'],
    'sql-course': ['sql'],
    technical: ['crosswalk','tables','table','er','triggers','procedures','codes','code'],
    practice: ['exercise']
  };
  const section = Object.keys(sections).find(key => sections[key].includes(route)) || route;
  for (const link of $('topnav').querySelectorAll('a')) {
    if (link.hash === '#' + section) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  const bottomNav = $('mobileBottomNav');
  if (bottomNav) {
    for (const link of bottomNav.querySelectorAll('a')) {
      if (link.hash === '#' + section) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    $('mobileMoreBtn')?.classList.toggle('is-active', ['workshops', 'technical', 'reference', 'progress'].includes(section));
  }
  const selected = lessons.find(l => l.id === id);
  const c = codeMeta.counts || {};
  $('side').innerHTML = '<div class="eyebrow">Course curriculum</div>'
    + Object.entries(groups).map(([m, ls]) => {
      const doneCnt = ls.filter(l => done.includes(l.id)).length;
      return `<details class="module" ${selected?.module === m || (route === 'module' && id === m) ? 'open' : ''}><summary>${E(m)} <span class="${doneCnt === ls.length && ls.length ? 'mod-complete' : ''}">${doneCnt}/${ls.length}</span></summary>${A('module/' + U(m), 'Module overview')}${ls.map(l => {
        const isDone = done.includes(l.id);
        const cls = [l.id === id ? 'active' : '', isDone ? 'is-done' : ''].filter(Boolean).join(' ');
        return `<a ${cls ? `class="${cls}"` : ''} href="#lesson/${E(l.id)}">${isDone ? ICON_CHECK : ''}<span>${E(l.title)}</span></a>`;
      }).join('')}</details>`;
    }).join('')
    + `<hr><div class="eyebrow">Code &amp; Schema</div>`
    + A('triggers', `Triggers — Full (${c.trigger ?? 2405})`, route === 'triggers' ? 'active' : '')
    + A('procedures', `Stored Procedures — Full (${c.procedure ?? 1629})`, route === 'procedures' ? 'active' : '')
    + A('codes', 'All Codes (DDL & Params)', route === 'codes' ? 'active' : '')
    + A('tables', 'Database Dictionary (1,681)', route === 'tables' || route === 'table' ? 'active' : '')
    + A('er/R5EVENTS', 'Visual ER Explorer', route === 'er' ? 'active' : '')
    + A('sql', 'SQL Lab (28 tables)', route === 'sql' ? 'active' : '');
  const activeSide = $('side').querySelector('a.active');
  if (activeSide) activeSide.scrollIntoView({ block: 'nearest' });
  const bc = $('subbarBreadcrumb');
  if (bc) {
    const sep = ' <span class="sep">/</span> ';
    if (route === 'home') bc.innerHTML = `HxGN EAM${sep}Infor EAM`;
    else if (route === 'lesson' && selected) bc.innerHTML = `${A('learn', 'Curriculum')}${sep}${A('module/' + U(selected.module), selected.module)}${sep}<span class="bc-cur">${E(selected.id)}</span>`;
    else if (route === 'module' && id) bc.innerHTML = `${A('learn', 'Curriculum')}${sep}<span class="bc-cur">${E(id)}</span>`;
    else if (route === 'er') bc.innerHTML = `${A('technical', 'Technical Library')}${sep}ER Explorer${id ? sep + `<span class="bc-cur">${E(id)}</span>` : ''}`;
    else if (route === 'table' && id) bc.innerHTML = `${A('technical', 'Technical Library')}${sep}${A('tables', 'Dictionary')}${sep}<span class="bc-cur">${E(id)}</span>`;
    else if (route === 'exercise' && id) bc.innerHTML = `${A('practice', 'SQL Exercises')}${sep}<span class="bc-cur">Exercise #${E(id)}</span>`;
    else if (route === 'workshop' && id) bc.innerHTML = `${A('workshops', 'Workshops')}${sep}<span class="bc-cur">${E(id)}</span>`;
    else if (route === 'path' && id) bc.innerHTML = `${A('paths', 'Role paths')}${sep}<span class="bc-cur">${E(id)}</span>`;
    else {
      const labels = { learn: 'Curriculum', workshops: 'Workshops', 'sql-course': 'SQL Lab', sql: 'SQL Lab', technical: 'Technical Library', triggers: 'Triggers', procedures: 'Stored Procedures', codes: 'All Codes', tables: 'Database Dictionary', practice: 'SQL Exercises', reference: 'Reference', search: 'Search', glossary: 'Glossary', fields: 'Field Dictionary', topics: 'Topic Index', progress: 'My Learning', assess: 'Assessments', coverage: 'Coverage', flows: 'Process Flows', pump: 'Pump Case Study', paths: 'Role Paths' };
      bc.innerHTML = `<span class="bc-cur">${E(labels[route] || 'EAM Academy')}</span>`;
    }
  }
}

const pumpSteps = [
  ['L012', 'Identify the physical pump', 'The planner has a cooling-water pump in Utilities. Find its asset record before creating one. Record the identifier and check its organization, department, and operational status. The training database calls this pump PUMP-001.'],
  ['L082', 'Define the recurring work', 'The example calls for inspection every 30 days. Define PUMP30 on a time basis and review the interval and generation window. A 30-hour meter interval would describe a different maintenance policy.'],
  ['L084', 'Connect the schedule to the asset', 'Select the pump on the schedule’s Equipment tab. Check the organization and first due information. A correct interval alone cannot identify which pump is due.'],
  ['L085', 'Review the resulting work order', 'From the schedule, inspect its associated work orders. Compare equipment, due date and status with the planned inspection. If a record is missing, check the association, due criteria and existing orders before attempting generation again.']
];

const pumpQueries = [
  { title: 'Check the schedule', sql: "SELECT equipment, code, interval_value, basis\nFROM pm_schedules\nWHERE equipment = 'PUMP-001';", result: 'PUMP-001 · PUMP30 · 30 · Days. This confirms the configured interval. The training schema does not store a PM-to-work-order link, so this result cannot establish which order the schedule generated.' },
  { title: 'Inspect the open orders', sql: "SELECT equipment_code, id\nFROM work_orders\nWHERE status = 'Open'\nORDER BY equipment_code, id;", result: 'COMP-001 has order 103. PUMP-001 has order 101. At this stage each row represents one open work order.' },
  { title: 'Find assets with multiple open orders', sql: "SELECT equipment_code, COUNT(*) AS open_orders\nFROM work_orders\nWHERE status = 'Open'\nGROUP BY equipment_code\nHAVING COUNT(*) > 1;", result: 'Zero rows is the correct answer. WHERE removes closed orders before grouping. HAVING keeps only groups with two or more orders. Change > 1 to >= 1 to see both assets with a count of one.' },
  { title: 'Diagnose an inflated count', sql: "SELECT w.equipment_code, COUNT(*) AS joined_rows,\n       COUNT(DISTINCT w.id) AS open_orders\nFROM work_orders w\nLEFT JOIN activities a ON a.wo = w.id\nWHERE w.status = 'Open'\nGROUP BY w.equipment_code\nORDER BY w.equipment_code;", result: 'PUMP-001 shows two joined rows but one order because order 101 has two activities. COMP-001 shows one row and one order because the left join preserves order 103 even without an activity. For a pure order count, use the simpler orders-only query.' }
];

const sqlReading = {
  L127: ['One row per open order', 'WHERE evaluates each order before sorting. Selecting the ID makes the result traceable to an individual record.', 'Switch the status to Closed. Predict which IDs disappear and check the result.'],
  L128: ['One row per matched work order', 'The equipment primary key can match at most one equipment record per order. Joining on description instead would rely on names being unique.', 'Filter to PUMP-001 and verify that two different order IDs share its description.'],
  L129: ['One row per equipment code', 'COUNT counts orders and SUM adds their costs within the same equipment group. Adding status to GROUP BY changes what a row represents.', 'Split the pump total by status. Confirm that both subtotals add back to the original total.'],
  L130: ['One row per work-order activity', 'An activity number is unique only within its work order. Both key columns are needed when attaching labor. LEFT JOIN retains activities without a time entry.', 'Check why activity 10 on orders 101 and 102 must remain separate.'],
  L131: ['One row per part and store below threshold', 'The same part can be stocked at several stores. Compare quantity to the reorder level on that exact row before subtracting.', 'Look up SEAL in both stores. Explain why only MAIN appears.'],
  L132: ['One row per stock record', 'The CTE totals reservations per part and store before the join. COALESCE supplies zero when a stock row has no reservation.', 'Compare SEAL in MAIN and REMOTE. Verify that the MAIN reservation does not reduce REMOTE availability.'],
  L133: ['One row per purchase order line', 'Receipts aggregate on purchase order and line. The outer join keeps an unreceived line visible and COALESCE lets the outstanding quantity be calculated.', 'Check the first purchase line. Five ordered minus three received leaves two outstanding.'],
  L134: ['One row per meter reading', 'LAG reads the preceding value within the same meter. The date and ID establish a deterministic sequence for readings taken on the same date.', 'Explain the first NULL delta. It means the dataset has no previous reading for that meter.'],
  L135: ['One row per approved requisition in PLANT01', 'The organization join adds its name. Both conditions in WHERE have to hold for a requisition to appear.', 'Remove the status condition and inspect the draft requisition that enters the result.'],
  L136: ['One schema definition for activities', 'SQLite stores the table definition in sqlite_master. Inspect the primary and foreign keys before deciding how to join records.', 'Find the two columns in the primary key. Use the activity lesson to see what happens when labor is attached at that grain.']
};

function pumpPage() {
  return H('Maintenance planning', 'From pump to preventive work order', 'Follow PUMP-001 from its asset record to a 30-day maintenance schedule. Use each linked lesson for the full procedure.')
    + '<div class="reader">'
    + pumpSteps.map(([id,title,body],i) => {
      const l = lessons.find(x => x.id === id);
      return '<section class="decision"><small>Step ' + String(i+1).padStart(2,'0') + ' of 04</small><h2>' + E(title) + '</h2><p>' + E(body) + '</p><div class="row">' + lessonLink(l) + sourceLink(l.source.hex.id,'HxGN guide · p. ' + l.source.hex.page) + '</div></section>';
    }).join('')
    + '</div><h2>Verify with SQL</h2><p class="muted">Use the fictional SQLite training records below. Predict each result before opening the explanation.</p>'
    + pumpQueries.map((q,i) => '<section class="section"><h3>' + E(q.title) + '</h3><pre>' + E(q.sql) + '</pre>' + A('sql/pump-' + i,'Open in SQL lab','button') + '<details><summary>Explain the result</summary><p>' + E(q.result) + '</p></details></section>').join('');
}

const sqlStages = [
  {title:'Find open work', question:'Which orders still need attention?', grain:'One row per open work order.', sql:'L127', functional:'INTRO05', exercise:3},
  {title:'Connect assets and orders', question:'Which physical asset does each order describe?', grain:'One row per matched work order.', sql:'L128', functional:'INTRO03', exercise:26},
  {title:'Summarize work by asset', question:'How much work belongs to each asset?', grain:'One row per asset in the summary. Start from equipment to include idle assets.', sql:'L129', functional:'INTRO07', exercise:30},
  {title:'Diagnose repeated charges', question:'Did the join count the same activity twice?', grain:'One row per order and activity before attaching labor. Both keys matter.', sql:'L130', functional:'L068', exercise:53},
  {title:'Read a meter trend', question:'How much did a meter advance between readings?', grain:'One row per reading, compared with the previous reading on the same meter.', sql:'L134', functional:'INTRO06', exercise:107}
];
function stageLinks(stage) {
  return '<div class="row">' + A('lesson/' + stage.functional,'EAM example') + A('lesson/' + stage.sql,'Worked SQL lesson') +
    A('sql/' + stage.sql,'Run example') + A('exercise/' + stage.exercise,'Practice challenge') + '</div>';
}
function sqlCourse() {
  return H('SQL learning', 'Read, explain and test a query', 'Each lesson uses the same local SQLite training database. Work in sequence or choose a business question.')
    + '<div class="row footer-links">' + A('practice','Open SQL Exercises','button primary') + A('sql','Open SQL editor','button') + A('technical','Technical library','button') + A('workshop/' + U('Database and SQL'),'Join troubleshooting workshop','button') + '</div>'
    + '<h2>Five-stage SQL learning path</h2><div class="stage-list">' + sqlStages.map((stage, idx) => '<div class="panel stage-card"><div class="eyebrow tabular">Stage ' + String(idx + 1).padStart(2, '0') + '</div><h3>' + E(stage.title) +
      '</h3><p class="mb-sm">' + E(stage.question) + '</p><p class="muted">' + E(stage.grain) + '</p>' + stageLinks(stage) + '</div>').join('') + '</div>'
    + '<div class="mt-md mb-md">' + A('exercise/30','Fix a query that counts an idle asset as an order','button') + '</div>'
    + '<h2>All SQL lessons</h2>' + lessons.filter(l => l.type === 'technical').map(l => '<section class="list-item"><h3>' + lessonLink(l) + '</h3><p class="muted">' + E(sqlReading[l.id]?.[0] || l.concept) + '</p>' + A('sql/' + l.id,'Run the lesson query') + '</section>').join('');
}

function coveragePage(moduleName) {
  const visible = moduleName ? lessons.filter(l => l.module === moduleName) : lessons;
  return H('Curriculum', 'Curriculum coverage', 'Inspect the teaching material available for each topic. An excerpt count measures availability, not accuracy or instructional quality.')
    + '<label for="coverageModule">Choose a module</label> <select id="coverageModule"><option value="">All modules</option>' + Object.keys(groups).map(m => '<option ' + (m === moduleName ? 'selected' : '') + '>' + E(m) + '</option>').join('') + '</select>'
    + '<div class="scroll"><table><thead><tr><th>Lesson</th><th>HxGN page</th><th>Infor 11.6</th><th>Source excerpts</th><th>Teaching material</th></tr></thead><tbody>' + visible.map(l => {
      const s = l.source, ev = s.evidence, more = enrichment[String(s.hex.page)];
      const materials = [l.scenario && 'Scenario', l.verify && 'verification', more?.example?.length && 'worked example', l.sql && 'SQL exercise', quizzes.some(q => q.lesson.toLowerCase() === l.title.toLowerCase()) && 'quiz'].filter(Boolean);
      return '<tr><td>' + lessonLink(l) + '</td><td>' + sourceLink(s.hex.id,String(s.hex.page)) + '</td><td>' + (s.infor ? sourceLink(s.infor.id,String(s.infor.page)) : 'No mapped page') + '</td><td>' + ev.steps.length + ' steps · ' + ev.fields.length + ' fields</td><td>' + E(materials.join(', ')) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

function introReading() {
  return '<section class="panel"><h2>Introduction slides · pages 2 and 3</h2>' +
    '<p>Read the two opening teaching slides from <cite>EAM Materials</cite>.</p>' +
    '<p><a class="button primary" href="data/eam-introduction-pages-2-3.pdf#page=1">Page 2 · Introduction to Enterprise Asset Management</a></p>' +
    '<p><a class="button" href="data/eam-introduction-pages-2-3.pdf#page=2">Page 3 · What is EAM and why does it matter?</a></p>' +
    '<details><summary>Read the slide overview as text</summary><h3>What EAM manages</h3>' +
    '<p>An asset can be a pump, a production line, a truck, a warehouse or a utility network. EAM connects the people responsible for operating, maintaining, purchasing and financing these resources.</p>' +
    '<h3>What the system records</h3><p>The asset register records identity, hierarchy and location. Inspections track condition. Requests and orders document preventive and corrective work, labor and materials. Stores records track spare parts and replenishment. History and cost reports support decisions about reliability, productivity and investment.</p>' +
    '<h3>Follow a pump through six stages</h3><ol><li>Acquire: select, receive and register the pump.</li><li>Install: commission it and hand it over to operations.</li><li>Operate: monitor output and condition.</li><li>Maintain: inspect, repair and record labor and parts.</li><li>Optimize: compare cost, risk and reliability to decide whether changes are worthwhile.</li><li>Retire: replace or decommission the unit and record its disposition.</li></ol>' +
    '<p>This history helps teams limit downtime, control costs, extend service life and demonstrate which work was performed.</p></details></section>';
}

function modulePage(m) {
  const ls = groups[m];
  if (!ls) return H('Not found', 'Module not found');
  const comp = ls.filter(l => done.includes(l.id)).length;
  return H('Curriculum', m, `${ls.length} lessons · written walkthroughs and source references`)
    + (m === 'Introduction to EAM' ? introReading() : '')
    + `<div class="panel"><div class="row between mb-sm"><strong class="tabular">${comp} of ${ls.length} completed</strong>${A('lesson/' + (ls.find(l => !done.includes(l.id)) || ls[0]).id, 'Continue', 'button primary')}</div>${progress(comp, ls.length)}<div class="lesson-list">${ls.map(l => `<div class="lesson-row"><div class="row between"><div class="lesson-row-title"><span class="pill tabular">${E(l.id)}</span>${lessonLink(l)}</div><span class="pill">${E(l.level)}</span></div><p class="muted">${E(l.concept)}</p></div>`).join('')}</div></div>`;
}

function sourcePanel(l) {
  const s = l.source;
  return `<h3>Primary · HxGN</h3><p>${E(s.hex.title)}</p><p class="muted">Supplied Help export · release unconfirmed</p>${s.hex.pages.map(p => sourceLink(p.id, 'Offline export p. ' + p.page)).join(' ')}<p>${ext(s.online.url, `${s.online.scope} · ${s.online.version}`)}</p><hr><h3>Supporting · Infor 11.6</h3>${s.infor ? `<p>${E(s.infor.title)}</p>${sourceLink(s.infor.id, 'User Guide p. ' + s.infor.page)}<small>${E(s.infor.kind)}</small>` : '<p class="muted">No matching legacy topic identified in supplied User Guide. Do not infer a version difference from this gap.</p>'}<hr><h3>Source interpretation</h3><p class="muted">Offline extracts may span page breaks. The written lesson is original training guidance, not a verbatim vendor procedure. Confirm release, configuration and access before using a real system.</p>`;
}

function quizBlock(qList) {
  if (!qList.length) return '';
  const shuffled = [...qList];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.map(q => {
    const saved = quizState[q.id];
    const badge = saved === true ? `<span class="pill ok">${ICON_CHECK}<span>Answered correctly</span></span>` : saved === false ? `<span class="pill warn">${ICON_ALERT}<span>Needs review</span></span>` : '';
    return `<div class="quiz-box" data-qid="${E(q.id)}"><div class="row between"><strong>Quick check · ${E(q.id)}</strong>${badge}</div><p>${E(q.q)}</p>${q.options.map((opt, idx) => `<label class="quiz-opt"><input type="radio" name="quiz_${E(q.id)}" value="${idx}"><span>${E(opt)}</span></label>`).join('')}<div class="row"><button type="button" class="primary" data-check-quiz="${E(q.id)}">Check answer</button></div><div class="quiz-feedback" aria-live="polite" id="qf_${E(q.id)}"></div></div>`;
  }).join('');
}

function lessonPage(id) {
  const l = lessons.find(v => v.id === id);
  if (!l) return H('Not found', 'Lesson not found');
  write('lastLesson', l.id); logActivity();
  const activePath = read('activePath','');
  const pathModules = roles[activePath];
  const inPath = Array.isArray(pathModules) && pathModules.includes(l.module);
  const sequence = inPath ? pathModules.flatMap(m => groups[m]) : groups[l.module];
  const i = sequence.indexOf(l), s = l.source, ev = s.evidence;
  const more = l.type === 'intro' ? {} : enrichment[String(s.hex.page)] || {};
  const related = sequence.filter(x => x.id !== id).slice(Math.max(0, i - 2), Math.max(0, i - 2) + 4);
  const lQuizzes = quizzes.filter(q => q.lesson.toLowerCase() === l.title.toLowerCase());
  const isMarked = marks.includes(id), isDone = done.includes(id);
  return `<div class="lesson-layout"><article class="lesson-content">${H(l.module, l.title, `${l.id} · ${l.level} · ${l.type === 'technical' ? 'Technical SQL lesson' : l.type === 'consulting' ? 'Consultant guidance' : 'Written functional tutorial'}`)}`
    + `<div class="lesson-toolbar"><div class="row lesson-meta"><span class="pill">${l.type === 'intro' ? 'Academy introduction' : 'HxGN primary'}</span>${s.infor ? '<span class="pill">Infor supporting</span>' : ''}</div><div class="row lesson-actions"><button data-mark="${id}" class="${isMarked ? 'is-active' : ''}">${isMarked ? `${ICON_BOOKMARK_FILL}<span>Bookmarked</span>` : `${ICON_BOOKMARK}<span>Bookmark</span>`}</button><button class="primary${isDone ? ' is-completed' : ''}" data-done="${id}">${isDone ? `${ICON_CHECK_CIRCLE}<span>Completed · undo</span>` : `${ICON_CHECK_CIRCLE}<span>Mark complete</span>`}</button></div></div>`
    + (workshops.some(w => w.module === l.module) ? '<p class="mt-md">' + A('workshop/' + U(l.module),'Open module workshop') + '</p>' : '')
    + sqlStages.filter(stage => [stage.sql,stage.functional].includes(id)).map(stage => '<section class="section"><h2>' + E(stage.title) + '</h2>' + stageLinks(stage) + '</section>').join('')
    + (id === 'INTRO01' ? introReading() : '')
    + (inPath ? '<p class="muted">' + A('path/' + U(activePath),activePath) + ' · Lesson ' + (i+1) + ' of ' + sequence.length + '</p>' : '')
    + (pumpSteps.some(([step]) => step === id) ? '<p class="note">' + A('pump','Case study · From pump to preventive work order') + '</p>' : '')
    + (sqlResults[id] ? '<details class="sql-output"><summary>Inspect the expected training output</summary>' + table(sqlResults[id].columns,sqlResults[id].rows) + '</details>' : '')
    + (sqlReading[id] ? '<section class="section"><h2>How to read this query</h2><div class="callout-panel"><strong>' + E(sqlReading[id][0]) + '</strong><p class="mt-sm">' + E(sqlReading[id][1]) + '</p><h3>Try a variation</h3><p class="mb-sm">' + E(sqlReading[id][2]) + '</p></div></section>' : '')
    + `<section class="section"><h2>What you will learn</h2><p>${E(l.concept)}</p><p>By the end, you should be able to explain the business purpose, describe the steps for the scenario, and identify how to check the result.</p></section>`
    + `<section class="section"><h2>Business scenario</h2><div class="scenario">${E(l.scenario)}</div><p class="muted">Fictional PLANT01 example for learning; not a live EAM transaction.</p></section>`
    + `${more.context && l.type === 'functional' ? `<section class="section"><h2>How it works</h2>${more.context.map(x => `<p>${E(x)}</p>`).join('')}${more.flow ? `<div class="diagram">${more.flow.map((v, idx) => `${idx ? `<span class="diagram-arrow" aria-hidden="true">${ICON_FLOW_ARROW}</span>` : ''}<span>${E(v)}</span>`).join('')}</div>` : ''}</section>` : ''}`
    + `<section class="section"><h2>${l.type === 'technical' ? 'Technical walkthrough' : 'Prerequisites and written walkthrough'}</h2>${l.type === 'technical' ? `<p>Use the local synthetic dataset, not a production database. ${A('sql', 'Open SQL lab')}</p><pre>${E(l.sql)}</pre>${A('sql/' + id, 'Open this query in SQL lab', 'button primary')}` : `<p>${l.type === 'intro' ? 'Follow the example in order.' : l.type === 'consulting' ? 'Agree the business scope, owners and test environment before applying the guidance.' : 'Before starting, confirm the relevant organization, authorized role, and referenced master data. Use the documented screen for your release.'}</p><ol class="steps">${l.walkthrough.map(x => `<li>${E(x)}</li>`).join('')}</ol>`}</section>`
    + `${more.example && l.type === 'functional' ? `<section class="section"><h2>Worked example</h2>${table(['Record / field', 'Training value or decision', 'Explanation'], more.example)}</section>` : ''}`
    + `${l.type === 'functional' && ev.fields.length ? `<section class="section"><h2>Documented fields and options</h2><p class="muted">Selected field descriptions extracted from the supplied HxGN pages. Not an exhaustive field list; some descriptions continue in the original source.</p>${table(['Field / option', 'Source excerpt'], ev.fields.map(x => [x.name, x.meaning]))}</section>` : ''}`
    + `<section class="section"><h2>Expected result &amp; troubleshooting</h2><div class="panel"><p>${E(l.verify)}</p>${more.check && l.type === 'functional' ? `<p>${E(more.check)}</p>` : ''}</div></section>`
    + `${l.type === 'functional' ? `<section class="section"><h2>Documentation reading</h2><p class="muted">Selected local source text for verification. The extract is partial; use the linked full pages for exact field requirements, notes, and remaining steps.</p><details open><summary>HxGN source context · p. ${s.hex.page}</summary><p>${E(ev.intro)}</p>${ev.steps.length ? `<h3>Selected numbered instructions</h3><ul class="steps">${ev.steps.map(x => `<li>${E(x)}</li>`).join('')}</ul>` : '<p>No numbered instructions extracted at this heading. See full pages for nested procedures.</p>'}</details></section>` : ''}`
    + `<section class="section"><h2>Knowledge check</h2>${quizBlock(lQuizzes)}<p><strong>Written scenario prompt:</strong> Explain how you would address this scenario: ${E(l.scenario)} What evidence would demonstrate success?</p><details><summary>Review answer guidance</summary><p>${E(l.concept)}</p><p>${E(l.verify)}</p></details><div class="notes-card"><div class="row between mb-sm"><label for="lessonNotes"><strong>Your revision notes</strong></label><small class="save-state" id="noteSaveState">Saved in browser</small></div><textarea id="lessonNotes" data-note="${id}" placeholder="Record important terms and questions…">${E(notes[id] || '')}</textarea></div></section>`
    + `<section class="section"><h2>Related lessons</h2><div class="related-grid">${related.map(x => `<a class="related-card" href="#lesson/${E(x.id)}"><span class="pill tabular">${E(x.id)}</span><strong>${E(x.title)}</strong><small>${E(x.level)}</small></a>`).join('')}</div></section>`
    + `<div class="row between lesson-nav">${i ? `<a class="button" href="#lesson/${E(sequence[i - 1].id)}">${ICON_ARROW_LEFT}<span>Previous lesson</span></a>` : '<span></span>'}${i < sequence.length - 1 ? `<a class="button primary" href="#lesson/${E(sequence[i + 1].id)}"><span>Next lesson</span>${ICON_ARROW_RIGHT}</a>` : ''}</div></article><aside class="rail" aria-label="Lesson references">${l.reference ? '<h2>Further reading</h2>' + lessonLink(lessons.find(item => item.id === l.reference)) : sourcePanel(l)}</aside></div>`;
}

function paths() {
  return H('Learning paths', 'Choose a role', 'One shared curriculum, arranged for different job responsibilities.')
    + '<div class="grid">' + Object.entries(roles).map(([r, ms]) => {
      const total = ms.reduce((a, m) => a + groups[m].length, 0);
      const comp = ms.reduce((a, m) => a + groups[m].filter(l => done.includes(l.id)).length, 0);
      return `<a class="tile" href="#path/${U(r)}"><div class="row between mb-sm"><h3>${E(r)}</h3><span class="pill tabular">${comp}/${total}</span></div><p class="mb-sm">${total} lessons across ${ms.length} modules</p>${progress(comp, total)}</a>`;
    }).join('') + '</div>';
}

function path(r) {
  const ms = roles[r];
  if (!ms) return H('Not found', 'Path not found');
  const allPathLessons = ms.flatMap(m => groups[m]);
  const comp = allPathLessons.filter(l => done.includes(l.id)).length;
  const next = allPathLessons.find(l => !done.includes(l.id)) || allPathLessons[0];
  return H('Learning path', r, 'Work through these modules in the suggested sequence.')
    + `<div class="panel"><div class="row between"><strong>Overall path progress: ${comp} / ${allPathLessons.length} (${allPathLessons.length ? Math.round(comp / allPathLessons.length * 100) : 0}%)</strong><a class="button primary" href="#lesson/${E(next.id)}" data-start-path="${E(r)}">${comp ? 'Continue next lesson' : 'Start path'}</a></div>${progress(comp, allPathLessons.length)}</div>`
    + ms.map((m, i) => `<div class="panel list-item"><h3>${i + 1}. ${A('module/' + U(m), m)}</h3>${progress(groups[m].filter(l => done.includes(l.id)).length, groups[m].length)}<small>${groups[m].filter(l => done.includes(l.id)).length}/${groups[m].length} complete</small></div>`).join('');
}

function flowsPage() {
  return H('End-to-end workflows', 'EAM business process flows', 'Follow five core operational lifecycles from master data through transactions and closeout. Each stage links to the corresponding tutorial and R5 table evidence.')
    + businessFlows.map(f => `<section class="panel mb-md"><h2>${E(f.title)}</h2><p class="muted">${E(f.desc)}</p><div class="diagram">${f.steps.map((st, idx) => {
      const l = findLessonByTitle(st.lesson);
      return `${idx ? `<span class="diagram-arrow" aria-hidden="true">${ICON_FLOW_ARROW}</span>` : ''}<div class="flow-node"><span class="flow-step">${String(idx + 1).padStart(2, '0')}</span><strong>${l ? A('lesson/' + l.id, st.label) : E(st.label)}</strong><small>${A('table/' + U(st.table), st.table)}</small></div>`;
    }).join('')}</div></section>`).join('');
}

function reference() {
  return H('Reference', 'Documentation and terminology', 'Source search is lexical with highlighted matches. Exact offline page IDs and verified public links are clearly distinguished.')
    + `<form id="refSearch" class="panel"><label for="refQ">Search HxGN and Infor documentation</label><div class="row"><input id="refQ" placeholder="e.g. preventive maintenance" type="search" required><button class="primary">Search sources</button></div></form>`
    + `<h2>Reference tools</h2>`
    + tiles([
      ['search/' + U(''), 'Knowledge assistant', 'Search tutorials and documentation together with highlighted snippets.'],
      ['codes', 'All Codes & Install Parameters', 'Install parameters (97), Equipment classes (46), Asset categories (81), and SQL objects.'],
      ['topics', 'Infor guided topic index', '844 legacy topic links; not additional authored lessons.'],
      ['glossary', 'Glossary', 'Definitions of frequently used EAM terms.'],
      ['fields', 'Field dictionary', 'Search source-derived field descriptions.'],
      ['tables', 'Database dictionary', '1,681 indexed R5 tables and 47 structured key-table exports.'],
    ])
    + `<h2>Official web references</h2><div class="panel"><p>${ext('https://docs.hexagonppm.com/r/en-US/HxGN-EAM-Help/1306526', 'HxGN EAM Help 12.0.1')}</p><p>${ext('https://docs.hexagonppm.com/r/en-US/EAM-System-Overview/1352149', 'HxGN EAM System Overview 12.0.1')}</p><p>${ext('https://docs.hexagonppm.com/r/en-US/HxGN-EAM-Release-Notes-for-12.2.1/12.2.1/1283632', 'Documentation updates and restricted technical references 12.2.1')}</p><p>${ext('https://docs.hexagonppm.com/r/en-US/HxGN-EAM-Configuration-Guide-for-Infor-ION/1275260', 'HxGN EAM Configuration Guide for Infor ION 12.0')}</p><p>Legacy: Infor EAM 11.6 User Guide (supplied local archive), not a claim of current product functionality.</p></div>`
    + `<h2>Evidence coverage</h2><div class="metrics">${metric(1149, 'HxGN archived pages')}${metric(974, 'Infor archived pages')}${metric(lessons.filter(l => l.source.infor).length, 'Legacy topic links')}${metric(lessons.filter(l => l.source.evidence.fields.length).length, 'Lessons with field extracts')}</div>`;
}

const api = academyAPI;

function searchPage(q) {
  return H('Knowledge assistant', 'Search tutorials and sources', 'Find written lessons, then verify against the supplied primary and legacy source pages.')
    + `<div class="panel"><form id="searchForm"><div class="row"><input type="search" id="searchQ" value="${E(q)}" placeholder="Search lessons and sources"><select id="moduleFilter" aria-label="Module filter"><option value="">All modules</option>${Object.keys(groups).map(m => `<option>${E(m)}</option>`).join('')}</select><select id="sourceFilter" aria-label="Source filter"><option value="">Both EAM guides</option><option>Hexagon EAM Help</option><option>Infor EAM 11.6</option></select><button class="primary">Search</button></div></form></div>`
    + `<h2>Matching tutorials</h2><div id="lessonResults"></div><h2>Documentation results</h2><div id="sourceResults">Searching…</div><div id="moreResults"></div>`;
}

let searchToken = 0;
async function doSearch(q, offset = 0) {
  const token = ++searchToken;
  const searchText = q.trim().replace(/\bwo\b/gi,'work order').replace(/\bpm\b/gi,'preventive maintenance');
  const source = $('sourceFilter')?.value || '';
  const mod = $('moduleFilter')?.value || '';
  if (!offset) {
    const terms = searchText.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const names = q.trim() ? catalog.tables.filter(([name]) => name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 20) : [];
    const workshopHits = terms.length ? workshops.filter(w => (!mod || w.module === mod) && terms.every(t => [w.title,w.situation,w.module,w.role].join(' ').toLowerCase().includes(t))) : [];
    const hits = lessons.filter(l => (!mod || l.module === mod) && (!terms.length || terms.every(t => [l.title, l.module, l.concept, l.scenario, l.source.hex.title].join(' ').toLowerCase().includes(t))));
    $('lessonResults').innerHTML = (q || mod)
      ? (hits.length ? hits.slice(0, 30).map(l => `<div class="list-item">${lessonLink(l)}<p class="muted">${E(l.module)} · ${E(l.concept)}</p></div>`).join('') : '<p>No matching authored lesson. Try fewer terms or use the source results.</p>')
      : '<p>Enter a term or select a module to filter tutorials.</p>';
    if (terms.length) {
      const fields = lessons.filter(l => (!mod || l.module === mod) && l.source.evidence?.fields?.some(f =>
        terms.every(t => (f.name + ' ' + f.meaning).toLowerCase().includes(t))));
      if (fields.length) $('lessonResults').innerHTML += '<h2>Field guide</h2>' + fields.slice(0,20).map(l => '<p>' + lessonLink(l) + '</p>').join('');
    }
    if (workshopHits.length) $('lessonResults').innerHTML += '<h2>Matching workshops</h2>' + workshopCards(workshopHits);
    if (names.length && !mod) $('lessonResults').innerHTML += '<h2>Database dictionary</h2>' + names.map(([name]) => A('table/' + U(name),name,'taglink')).join(' ');
    if (!mod && terms.length && terms.every(t => ('pump asset preventive maintenance schedule open work orders').includes(t))) {
      $('lessonResults').innerHTML += '<h2>Guided case study</h2>' + A('pump','From pump to preventive work order');
    }
    $('sourceResults').innerHTML = 'Searching…';
  }
  try {
    const j = await api(`/api/search?q=${U(searchText)}&source=${U(source)}&offset=${offset}`);
    if (token !== searchToken || !$('sourceResults')) return;
    const h = j.items.map(d => `<div class="list-item">${sourceLink(d.id, d.title)}<small> · ${E(d.source)} · p. ${E(d.page)}</small><p class="muted">${HMark(d.excerpt)}</p></div>`).join('');
    $('sourceResults').innerHTML = offset ? $('sourceResults').innerHTML + h : h || '<p>No matching source pages.</p>';
    $('moreResults').innerHTML = j.more ? `<button id="loadMore">Load more results</button>` : '';
    if (!offset && q.trim() && !source && !mod) {
      const code = await api('/api/code/search?q=' + U(q));
      if (token !== searchToken || !$('lessonResults')) return;
      if (code.items.length) $('lessonResults').insertAdjacentHTML('beforeend','<h2>SQL library</h2>' +
        code.items.slice(0,10).map(item => '<p>' + A('code/' + item.id,item.name) + '</p>').join(''));
    }
    if (j.more) $('loadMore').onclick = () => doSearch(q, offset + 30);
  } catch (e) {
    if ($('sourceResults') && token === searchToken) $('sourceResults').textContent = 'Search failed: ' + e.message;
  }
}

function cleanDocText(body) {
  return body.split('\n').filter(line => {
    const s = line.trim();
    return !s.startsWith('01/05/2026') && !s.startsWith('https://hexagonppm.fluidtopics.net/internal/') && !/^\d+\/1149$/.test(s);
  }).join('\n');
}

function topics() {
  return H('Legacy reference', 'Infor guided topic index', 'Search the 844 supplied table-of-contents entries. Each links to its original page, not a separate lesson.')
    + `<input id="topicFilter" type="search" placeholder="Filter topic titles"><div id="topicList"></div>`;
}
function renderTopics(q = '') {
  const hits = extended.topics.filter(t => t.title.toLowerCase().includes(q.toLowerCase()));
  $('topicList').innerHTML = `<p class="muted">${hits.length} matches · displaying up to 150</p>` + hits.slice(0, 150).map(t => `<div class="list-item">${A('doc/' + (t.page + 9), t.title)} <small>· p. ${t.page}</small></div>`).join('');
}

function fields() {
  return H('Field reference', 'Field dictionary', 'Extracted HxGN field descriptions with lesson and page references. Identical labels can have different meanings by screen.')
    + `<input id="fieldFilter" type="search" placeholder="Filter field or lesson title"><div id="fieldList"></div>`;
}
function renderFields(q = '') {
  const hits = lessons.filter(l => l.type === 'functional').flatMap(l => l.source.evidence.fields.map(f => ({ l, f }))).filter(({ l, f }) => [f.name, l.title, f.meaning].join(' ').toLowerCase().includes(q.toLowerCase()));
  $('fieldList').innerHTML = `<p class="muted">${hits.length} matches · first 100 shown</p>` + hits.slice(0, 100).map(({ l, f }) => `<div class="list-item"><strong>${E(f.name)}</strong> · ${lessonLink(l)}<p>${E(f.meaning)}</p><small>${sourceLink(l.source.hex.id, 'HxGN p. ' + l.source.hex.page)} · excerpt; see full pages</small></div>`).join('');
}

function glossaryPage() {
  return H('Reference', 'EAM glossary', 'Independent explanations; use linked tutorials to verify product-specific details.')
    + `<div class="field-grid">${Object.entries(glossary).map(([k, v]) => `<div class="panel"><h3>${E(k)}</h3><p>${E(v)}</p>${A('search/' + U(k), 'Find related lessons')}</div>`).join('')}</div>`;
}

function technical() {
  const c = codeMeta.counts || {};
  return H('Technical academy', 'Technical Library', 'Separate supplied schema evidence and read-only recovered SQL Server reference code from the synthetic SQLite practice lab. Never run recovered or training SQL against production.')
    + tiles([
      ['triggers', `Triggers — Full (${c.trigger ?? 2405})`, 'All 2,405 recovered SQL Server trigger blocks, searchable by name, keyword, or R5 table.'],
      ['procedures', `Stored Procedures — Full (${c.procedure ?? 1629})`, 'All 1,629 recovered SQL Server stored procedures plus procedure directory.'],
      ['crosswalk', 'Training-to-R5 crosswalk', 'Look up the closest R5 table for a training database example.'],
      ['codes', 'SQL object explorer', 'Views (304), Functions (947), Tables/Indexes (11), Flex SQL (8), Install Parameters (97), Classes & Categories.'],
      ['tables', 'Database dictionary', 'All 1,681 EAM 11.6 tables with 34,711 columns, meanings, primary/foreign keys, indexes & triggers.'],
      ['er/R5EVENTS', 'Visual ER relationship explorer', 'Interactive SVG parent/child diagram around any R5 key table.'],
      ['sql', 'SQL lab & Self-Check', 'Read-only synthetic training database, 28 tables, click-to-insert schema, R5 crosswalk.'],
      ['module/' + U('Database and SQL'), 'SQL tutorials', 'Ten executable SQLite lessons with expected outputs.'],
      ['module/' + U('Customization and integration'), 'Customization and integration', 'Alerts, imports, grids, web service prompts, GIS, and OAuth 2.0.'],
    ]);
}

function codeExplorerPage(mode, initialFilter = '') {
  const isTrg = mode === 'trigger';
  const c = codeMeta.counts || {};
  const title = isTrg ? 'Triggers — Full Explorer' : 'Stored Procedures — Full Explorer';
  const count = isTrg ? (c.trigger ?? 2405) : (c.procedure ?? 1629);
  const sub = isTrg
    ? `All ${count} recovered SQL Server trigger blocks from All_Triggers.sql, indexed with R5 table references.`
    : `All ${count} recovered SQL Server stored procedure definitions (covering procedures.md).`;
  const chips = isTrg
    ? ['R5EVENTS', 'R5OBJECTS', 'R5ACTIVITIES', 'R5TRANSACTIONS', 'R5ORDERS', 'R5REQUISITIONS', 'R5BOOKEDHOURS', 'R5STOCK']
    : ['O7', 'AUDITSQL', 'BAIM', 'POSINS', 'XML', 'R5EVENTS', 'R5OBJECTS', 'R5TRANSACTIONS'];
  return H('Recovered SQL Reference', title, sub)
    + `<div class="note warn">Read-only archive carved from Infor EAM 11.6 SQL Server backup. Multiple candidate blocks may exist per object. Never execute recovered SQL against production.</div>`
    + `<div class="panel"><form id="codeSearchForm"><div class="row"><input type="search" id="codeQ" placeholder="Search ${isTrg ? 'trigger name, SQL, or keyword' : 'procedure name, parameter, or SQL'}" value="${E(initialFilter.startsWith('R5') ? '' : initialFilter)}"><input id="codeTable" class="input-narrow" placeholder="Filter by R5 table (e.g. R5EVENTS)" value="${E(initialFilter.startsWith('R5') ? initialFilter : '')}"><button class="primary">Search</button></div></form><div class="row mt-md"><small>Quick filter:</small>${chips.map(ch => `<button type="button" class="chip" data-code-chip="${E(ch)}">${E(ch)}</button>`).join('')}<button type="button" class="chip" data-code-chip="">Reset</button></div></div>`
    + `<div id="codeMetaStats" class="muted mt-md mb-sm">Loading…</div><div id="codeResults"></div><div id="codeMore" class="mt-md"></div>`;
}

let codeToken = 0;
async function runCodeSearch(kind, offset = 0) {
  const token = ++codeToken;
  const q = $('codeQ')?.value || '';
  const tbl = $('codeTable')?.value || '';
  if (!offset && $('codeResults')) $('codeResults').innerHTML = '<p class="muted">Loading code objects…</p>';
  try {
    const j = await api(`/api/code/search?kind=${U(kind)}&q=${U(q)}&table=${U(tbl)}&offset=${offset}`);
    if (token !== codeToken || !$('codeResults')) return;
    $('codeMetaStats').textContent = `${j.total} matching objects`;
    const html = j.items.map(it => {
      const tblLinks = (it.tables || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 8)
        .map(t => A('table/' + U(t), t, 'taglink')).join('');
      return `<div class="list-item"><div class="row between code-item-head"><div>${A('code/' + it.id, it.name)} <span class="pill">${E(it.kind.toUpperCase())}</span> <small class="tabular">Candidate ${E(it.candidate)} · ${it.line_count} lines</small></div><a class="button" href="#code/${E(it.id)}"><span>View full SQL</span>${ICON_ARROW_RIGHT}</a></div>${tblLinks ? `<div class="mt-sm">${tblLinks}</div>` : ''}<pre class="code-excerpt">${HMark(it.excerpt)}</pre></div>`;
    }).join('');
    $('codeResults').innerHTML = offset ? $('codeResults').innerHTML + html : (html || '<p>No matching code objects.</p>');
    $('codeMore').innerHTML = j.more ? `<button id="codeLoadMore">Load more (${j.total - offset - j.items.length} remaining)</button>` : '';
    if (j.more) $('codeLoadMore').onclick = () => runCodeSearch(kind, offset + 40);
  } catch (e) {
    if ($('codeResults') && token === codeToken) $('codeResults').innerHTML = `<p class="warning">${E(e.message)}</p>`;
  }
}

function codesHubPage() {
  const c = codeMeta.counts || {};
  return H('Reference & Code Hub', 'All Codes', 'Browse all recovered SQL views, functions, table/index DDL, Flex SQL candidates, plus EAM install parameters, equipment classes, and asset categories.')
    + `<div class="tabs"><button type="button" class="active" data-codetab="sql">SQL Views, Functions &amp; DDL (${(c.view ?? 304) + (c.function ?? 947) + (c.table_ddl ?? 10) + (c.index ?? 1)})</button><button type="button" data-codetab="params">Install Parameters (${(codeMeta.install_params || []).length})</button><button type="button" data-codetab="classes">Equipment Classes (${(codeMeta.equipment_classes || []).length})</button><button type="button" data-codetab="categories">Asset Categories (${(codeMeta.asset_categories || []).length})</button><button type="button" data-codetab="flex">Flex SQL (${(codeMeta.flex_sql || []).length})</button></div><div id="codesBody"></div>`;
}

function renderCodesTab(tab) {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.codetab === tab));
  const body = $('codesBody');
  if (!body) return;
  if (tab === 'sql') {
    const c = codeMeta.counts || {};
    body.innerHTML = `<div class="note warn">Recovered SQL Server views, functions, table DDL, and index candidates. Read-only reference only.</div>`
      + `<div class="panel"><form id="codeSearchForm"><div class="row"><select id="ddlKind"><option value="view,function,table_ddl,index">All SQL DDL (${(c.view ?? 304) + (c.function ?? 947) + (c.table_ddl ?? 10) + (c.index ?? 1)})</option><option value="view">Views (${c.view ?? 304})</option><option value="function">Functions (${c.function ?? 947})</option><option value="table_ddl">Tables (${c.table_ddl ?? 10})</option><option value="index">Unique Indexes (${c.index ?? 1})</option></select><input type="search" id="codeQ" placeholder="Search view/function name or SQL"><input id="codeTable" class="input-narrow" placeholder="Filter R5 table"><button class="primary">Search</button></div></form></div>`
      + `<div id="codeMetaStats" class="muted mt-md mb-sm">Loading…</div><div id="codeResults"></div><div id="codeMore" class="mt-md"></div>`;
    $('codeSearchForm').onsubmit = e => { e.preventDefault(); runCodeSearch($('ddlKind').value, 0); };
    $('ddlKind').onchange = () => runCodeSearch($('ddlKind').value, 0);
    runCodeSearch($('ddlKind').value, 0);
  } else if (tab === 'params') {
    body.innerHTML = `<p class="muted">Installation and system parameters extracted directly from Hexagon EAM Help with page citations.</p><input id="paramFilter" type="search" placeholder="Filter parameter code or description (e.g. ASSETASS, AUTOANUM, POCURR)"><div id="paramList" class="mt-md"></div>`;
    const draw = (q = '') => {
      const hits = (codeMeta.install_params || []).filter(p => (p.code + ' ' + p.refs.map(r => r.context).join(' ')).toLowerCase().includes(q.toLowerCase()));
      $('paramList').innerHTML = `<p class="muted">${hits.length} parameters</p>` + hits.map(p => `<div class="panel mb-sm"><div class="row between"><strong>${E(p.code)}</strong><span class="pill">${p.mentions} Help mention(s)</span></div>${p.refs.map(r => `<p class="mt-sm mb-sm">${sourceLink(r.doc_id, 'HxGN Help p. ' + r.page)} — <span class="muted">${E(r.context)}</span></p>`).join('')}</div>`).join('');
    };
    $('paramFilter').oninput = e => draw(e.target.value);
    draw();
  } else if (tab === 'classes') {
    body.innerHTML = `<p class="muted">Equipment classes from supplied archive reference sheet.</p><input id="clsFilter" type="search" placeholder="Filter class code or description"><div id="clsList" class="mt-md"></div>`;
    const draw = (q = '') => {
      const hits = (codeMeta.equipment_classes || []).filter(x => (x.code + ' ' + x.desc).toLowerCase().includes(q.toLowerCase()));
      $('clsList').innerHTML = table(['Class code', 'Description'], hits.map(x => [x.code, x.desc]));
    };
    $('clsFilter').oninput = e => draw(e.target.value);
    draw();
  } else if (tab === 'categories') {
    body.innerHTML = `<p class="muted">Asset categories exported from the reference database.</p><input id="catFilter" type="search" placeholder="Filter category code or description"><div id="catList" class="mt-md"></div>`;
    const draw = (q = '') => {
      const hits = (codeMeta.asset_categories || []).filter(x => (x.code + ' ' + x.desc).toLowerCase().includes(q.toLowerCase()));
      $('catList').innerHTML = table(['Category code', 'Description'], hits.map(x => [x.code, x.desc]));
    };
    $('catFilter').oninput = e => draw(e.target.value);
    draw();
  } else if (tab === 'flex') {
    const fx = codeMeta.flex_sql || [];
    body.innerHTML = `<p class="muted">Flex SQL related module candidates identified in recovered triggers and stored procedures (R5FLEXSQL / R5FLEXTABLES).</p>`
      + fx.map(x => `<div class="panel mb-sm"><div class="row between"><strong>${E(x.name)}</strong><span class="pill">${E(x.source)}</span></div><div class="mt-sm mb-sm">${x.tables.map(t => A('table/' + U(t), t, 'taglink')).join(' ')}</div>${A(x.source.includes('Trigger') ? 'triggers' : 'procedures', 'Open in explorer →', 'button')}</div>`).join('');
  }
}

async function codeItemPage(id) {
  const item = await api('/api/code/item?id=' + U(id));
  const backRoute = item.kind === 'trigger' ? 'triggers' : item.kind === 'procedure' ? 'procedures' : 'codes';
  const backLabel = item.kind === 'trigger' ? 'All Triggers' : item.kind === 'procedure' ? 'All Stored Procedures' : 'All Codes';
  const tblLinks = (item.tables || '').split(',').map(x => x.trim()).filter(Boolean).map(t => A('table/' + U(t), t, 'taglink')).join('');
  const sibs = (item.siblings || []).length > 1
    ? `<div class="row mt-md"><small>Candidates for ${E(item.norm_name)}:</small>${item.siblings.map(sb => A('code/' + sb.id, `Candidate ${sb.candidate} (${sb.line_count}L)`, sb.id === item.id ? 'button primary' : 'button')).join('')}</div>`
    : '';
  const lineCount = item.body.split('\n').length;
  const gutter = Array.from({ length: lineCount }, (_, idx) => `<span>${idx + 1}</span>`).join('');
  return H('Recovered SQL Source', item.name, `${item.kind.toUpperCase()} · Candidate ${item.candidate} · ${item.line_count} lines${item.offset ? ` · backup byte ${item.offset}` : ''}`)
    + `<div class="note warn">${ICON_ALERT}<span>RECOVERY REFERENCE ONLY — NOT A VERIFIED OR DEPLOYABLE SCRIPT. Never run against production or training SQLite.</span></div>`
    + `<div class="row"><a class="button" href="#${backRoute}">${ICON_ARROW_LEFT}<span>${backLabel}</span></a><button type="button" id="copySqlBtn" class="primary">${ICON_COPY}<span>Copy SQL</span></button><button type="button" id="dlSqlBtn">${ICON_DOWNLOAD}<span>Download .sql</span></button></div>`
    + sibs
    + (tblLinks ? `<div class="panel mt-md mb-md"><strong>Referenced R5 tables:</strong><div class="mt-sm">${tblLinks}</div></div>` : '')
    + `<div class="code-viewer mt-md"><div class="code-viewer-head"><span>T-SQL · ${lineCount} lines</span><span class="tabular">Candidate ${E(item.candidate)}</span></div><div class="code-viewer-body"><div class="code-gutter" aria-hidden="true">${gutter}</div><pre class="code-view" id="rawSqlCode">${E(item.body)}</pre></div></div>`;
}

function tablesPage() {
  const areas = [...new Set(catalog.tables.map(t => t[6]).filter(Boolean))].sort();
  const st = catalog.stats || {};
  return H('Technical reference', 'Database table dictionary',
    `Complete EAM 11.6 schema: ${(st.tables || catalog.tables.length).toLocaleString()} tables · ${(st.columns || 34711).toLocaleString()} columns · ${(st.fks || 2020).toLocaleString()} foreign keys · ${(st.triggers || 2382).toLocaleString()} triggers.`)
    + `<div class="panel mb-md"><div class="row"><input id="tableFilter" type="search" placeholder="Search table name, meaning, or PK column (e.g. R5EVENTS, Work Order, OBJ_CODE)"><select id="tableArea" class="input-narrow"><option value="">All domains (${areas.length})</option>${areas.map(a => `<option value="${E(a)}">${E(a)}</option>`).join('')}</select></div></div><div id="tableList" class="mt-md"></div>`;
}
function renderTables(q = '', area = '') {
  const ql = q.trim().toLowerCase();
  const hits = catalog.tables.filter(t => {
    if (area && t[6] !== area) return false;
    if (!ql) return true;
    return t[0].toLowerCase().includes(ql) || (t[1] || '').toLowerCase().includes(ql) || (t[6] || '').toLowerCase().includes(ql) || (t[7] || '').toLowerCase().includes(ql);
  });
  $('tableList').innerHTML = `<p class="muted">${hits.length.toLocaleString()} matching tables · showing first 150</p><div class="scroll"><table><thead><tr><th>Table &amp; Meaning</th><th>Domain</th><th>Primary Key</th><th>Cols</th><th>FKs (Out / In)</th><th>Triggers</th></tr></thead><tbody>${hits.slice(0, 150).map(t => `<tr><td>${A('table/' + U(t[0]), t[0])}${t[7] ? `<div class="muted table-sub">${E(t[7])}</div>` : ''}</td><td><span class="pill">${E(t[6] || 'System')}</span></td><td><code>${E(t[1] || 'None')}</code></td><td class="tabular">${E(t[5] || '—')}</td><td class="tabular">${E(t[2] || '0')} / ${E(t[3] || '0')}</td><td class="tabular">${E(t[4] || '0')}</td></tr>`).join('')}</tbody></table></div>`;
}

function tablePage(t) {
  const row = catalog.tables.find(x => x[0] === t);
  const kt = (codeMeta.key_tables || {})[t];
  const d = catalog.keys[t];
  if (!row && !d && !kt) return H('Not found', 'Table not found');
  const title = row?.[7] || kt?.area || 'R5 Table';
  const area = row?.[6] || kt?.area || 'Database Schema';
  return H('Schema Reference · ' + area, t, title)
    + `<div class="row mb-md">${A('er/' + U(t), 'Open Visual ER Diagram', 'button primary')}${A('triggers/' + U(t), 'Search Triggers for ' + t, 'button')}${A('procedures/' + U(t), 'Search Procedures for ' + t, 'button')}${A('tables', 'All Tables', 'button')}</div>`
    + (t === 'R5EVENTS' ? '<p>' + A('lesson/L127','Worked training example · Find open work orders') + '</p>' : '')
    + `<div id="tableFullDetail"><p class="muted">Loading full column dictionary, keys, relationships, and triggers for ${E(t)}…</p></div>`
    + `<h2>Recovered SQL objects referencing ${E(t)}</h2><div id="tableCodeRefs"><p class="muted">Checking triggers, procedures &amp; views…</p></div>`;
}

function renderTableDetail(t, td) {
  const el = $('tableFullDetail');
  if (!el) return;
  if (!td) {
    el.innerHTML = '<div class="note warn">Detailed schema export not available for this table.</div>';
    return;
  }
  const pkBadge = td.pk_source === 'pk' ? '<span class="pill ok">Physical PK</span>'
    : td.pk_source === 'audit_pk' ? '<span class="pill">R5AUDITPK Logical Key</span>'
    : '<span class="pill">No PK</span>';
  const flexBadge = td.flex ? '<span class="pill ok">Flex SQL Enabled</span>' : '';
  const entPills = (td.entities || []).map(en => `<span class="pill">Entity: ${E(en)}</span>`).join('');

  const overviewHtml = `<div class="panel mb-md">
    <div class="row between mb-sm"><div><span class="pill">${E(td.area)}</span> ${pkBadge} ${flexBadge} ${entPills}</div><small class="tabular muted">${td.cols.length} columns · ${td.out_fks.length} outbound FKs · ${td.in_fks.length} inbound FKs · ${td.triggers.length} triggers</small></div>
    <p>${E(td.desc)}</p>
  </div>`;

  const keysHtml = `<div class="grid mt-md mb-md">
    <div class="panel">
      <h3>Primary &amp; Logical Key</h3>
      <p><strong>Key columns:</strong> <code>${E(td.pk.length ? td.pk.join(', ') : 'None defined')}</code></p>
      <p class="muted">${E(td.pk_explain)}</p>
    </div>
    <div class="panel">
      <h3>Indexes &amp; Unique Constraints (${td.indexes.length})</h3>
      <div class="scroll-panel">${td.indexes.length ? td.indexes.map(ix => `<div class="fk-row"><span class="pill ${ix.pk ? 'ok' : ''}">${ix.pk ? 'PK' : ix.unique ? 'UNIQUE' : 'INDEX'}</span> <code>${E(ix.name)}</code> <span class="muted">(${E(ix.cols.join(', '))})</span></div>`).join('') : '<p class="muted">No indexes defined.</p>'}</div>
    </div>
  </div>`;

  const fkHtml = `<div class="grid mt-md mb-md">
    <div class="panel">
      <h3>Parent References · Outbound FKs (${td.out_fks.length})</h3>
      <div class="scroll-panel">${td.out_fks.length ? td.out_fks.map(fk => {
        const pairs = fk.cols.map(([c, p]) => `${c} → ${p}`).join(', ');
        return `<div class="fk-item"><div class="fk-row"><code>${E(fk.cols.map(x => x[0]).join(', '))}</code> ${ICON_FLOW_ARROW} ${A('table/' + U(fk.to), `${fk.to} (${fk.cols.map(x => x[1]).join(', ')})`)}</div><div class="fk-explain muted">${E(fk.explain)} <small>[${E(fk.name)}${fk.on_delete && fk.on_delete !== 'NO_ACTION' ? ` · ON DELETE ${E(fk.on_delete)}` : ''}]</small></div></div>`;
      }).join('') : '<p class="muted">No outbound foreign keys.</p>'}</div>
    </div>
    <div class="panel">
      <h3>Child References · Inbound FKs (${td.in_fks.length})</h3>
      <div class="scroll-panel">${td.in_fks.length ? td.in_fks.map(fk => {
        return `<div class="fk-item"><div class="fk-row">${A('table/' + U(fk.from), `${fk.from} (${fk.cols.map(x => x[0]).join(', ')})`)} ${ICON_FLOW_ARROW} <code>${E(fk.cols.map(x => x[1]).join(', '))}</code></div><div class="fk-explain muted">${E(fk.explain)} <small>[${E(fk.name)}]</small></div></div>`;
      }).join('') : '<p class="muted">No inbound foreign keys from other tables.</p>'}</div>
    </div>
  </div>`;

  const trgHtml = td.triggers.length ? `<div class="panel mt-md mb-md">
    <h3>Database Triggers (${td.triggers.length})</h3>
    <div class="row">${td.triggers.map(tr => `<span class="taglink">${A('triggers/' + U(tr.name), tr.name)} <small class="muted">[${E((tr.events || []).join('/') || 'DML')}${tr.disabled ? ' · DISABLED' : ''}]</small></span>`).join('')}</div>
  </div>` : '';

  const colsHtml = `<h2>Columns &amp; Key Meanings (${td.cols.length})</h2>
  <div class="panel mb-sm"><div class="row"><input id="colFilter" type="search" placeholder="Filter columns by name, UI label, data type, or meaning"><button type="button" class="chip active" data-col-flag="ALL">All (${td.cols.length})</button><button type="button" class="chip" data-col-flag="PK">Primary Key</button><button type="button" class="chip" data-col-flag="FK">Foreign Key</button><button type="button" class="chip" data-col-flag="REQ">Required (NOT NULL)</button></div></div>
  <div id="colDictTable"></div>`;

  el.innerHTML = overviewHtml + keysHtml + fkHtml + trgHtml + colsHtml;

  let activeFlag = 'ALL';
  const drawCols = (q = '') => {
    const ql = q.trim().toLowerCase();
    const rows = td.cols.map((c, idx) => ({ idx: idx + 1, c })).filter(({ c }) => {
      if (activeFlag === 'PK' && !c[5].includes('PK')) return false;
      if (activeFlag === 'FK' && !c[5].includes('FK')) return false;
      if (activeFlag === 'REQ' && c[2] !== 0) return false;
      if (!ql) return true;
      return c[0].toLowerCase().includes(ql) || c[1].toLowerCase().includes(ql) || c[4].toLowerCase().includes(ql) || c[6].toLowerCase().includes(ql);
    });
    $('colDictTable').innerHTML = `<p class="muted">${rows.length} of ${td.cols.length} columns shown</p><div class="scroll"><table class="col-dict-table"><thead><tr><th>#</th><th>Column</th><th>Name Meaning / UI Label</th><th>Type</th><th>Null</th><th>Keys &amp; Default</th><th>Explanation</th></tr></thead><tbody>${rows.map(({ idx, c }) => {
      const badges = (c[5] ? c[5].split(',') : []).map(f => `<span class="pill ${f === 'PK' ? 'ok' : ''}">${E(f)}</span>`).join(' ');
      const def = c[3] ? `<code>${E(c[3])}</code>` : '';
      return `<tr><td class="tabular muted">${idx}</td><td><code>${E(c[0])}</code></td><td><strong>${E(c[4])}</strong></td><td><code>${E(c[1])}</code></td><td>${c[2] ? '<span class="muted">NULL</span>' : '<strong>NOT NULL</strong>'}</td><td>${badges} ${def}</td><td class="col-explain">${E(c[6])}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  };
  $('colFilter').oninput = e => drawCols(e.target.value);
  el.querySelectorAll('[data-col-flag]').forEach(btn => {
    btn.onclick = () => {
      activeFlag = btn.dataset.colFlag;
      el.querySelectorAll('[data-col-flag]').forEach(b => b.classList.toggle('active', b === btn));
      drawCols($('colFilter').value);
    };
  });
  drawCols();
}

function buildErSvg(t) {
  const kt = (codeMeta.key_tables || {})[t];
  const mmd = codeMeta.er_edges || [];
  let parents = [], children = [];
  if (kt) {
    const pMap = new Map(), cMap = new Map();
    kt.out_fks.forEach(fk => { const pt = fk.to.split('.')[0]; if (pt !== t && !pMap.has(pt)) pMap.set(pt, fk.from.split('.')[1] || fk.from); });
    kt.in_fks.forEach(fk => { const ct = fk.from.split('.')[0]; if (ct !== t && !cMap.has(ct)) cMap.set(ct, fk.from.split('.')[1] || fk.from); });
    parents = [...pMap.entries()].slice(0, 10);
    children = [...cMap.entries()].slice(0, 12);
  }
  if (!parents.length && !children.length) {
    const pSet = new Map(), cSet = new Map();
    mmd.forEach(e => {
      if (e.child === t && e.parent !== t && !pSet.has(e.parent)) pSet.set(e.parent, e.col);
      if (e.parent === t && e.child !== t && !cSet.has(e.child)) cSet.set(e.child, e.col);
    });
    parents = [...pSet.entries()].slice(0, 10);
    children = [...cSet.entries()].slice(0, 12);
  }
  const rows = Math.max(parents.length, children.length, 1);
  const h = Math.max(260, rows * 46 + 44);
  const cy = h / 2;
  let edgesSvg = '', nodesSvg = '';
  const drawEdge = (name, x1, y1, x2, y2, lbl, lx, ly) => {
    const dx = Math.abs(x2 - x1) * 0.45;
    const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    const lw = Math.min(116, Math.max(38, lbl.length * 6.4 + 12));
    edgesSvg += `<g class="er-link-group" data-er-edge="${E(name)}"><path class="er-edge" d="${d}"/><circle class="er-port" cx="${x1}" cy="${y1}" r="2.5"/><circle class="er-port" cx="${x2}" cy="${y2}" r="2.5"/><rect class="er-lbl-bg" x="${lx - lw / 2}" y="${ly - 9}" width="${lw}" height="17" rx="4"/><text class="er-lbl" x="${lx}" y="${ly + 3}" text-anchor="middle">${E(lbl)}</text></g>`;
  };
  parents.forEach(([name, lbl], i) => {
    const y = 26 + i * ((h - 68) / Math.max(parents.length, 1));
    drawEdge(name, 204, y + 16, 344, cy, lbl, 268, y + 16);
    nodesSvg += `<g class="er-node" data-er-node="${E(name)}"><rect x="14" y="${y}" width="190" height="32"/><text x="24" y="${y + 20}">${E(name)}</text></g>`;
  });
  if (!parents.length) {
    nodesSvg += `<g class="er-empty"><rect x="14" y="${cy - 16}" width="190" height="32" rx="8"/><text x="109" y="${cy + 4}" text-anchor="middle">No outbound parent FKs</text></g>`;
  }
  children.forEach(([name, lbl], i) => {
    const y = 26 + i * ((h - 68) / Math.max(children.length, 1));
    drawEdge(name, 516, cy, 656, y + 16, lbl, 592, y + 16);
    nodesSvg += `<g class="er-node" data-er-node="${E(name)}"><rect x="656" y="${y}" width="190" height="32"/><text x="666" y="${y + 20}">${E(name)}</text></g>`;
  });
  if (!children.length) {
    nodesSvg += `<g class="er-empty"><rect x="656" y="${cy - 16}" width="190" height="32" rx="8"/><text x="751" y="${cy + 4}" text-anchor="middle">No inbound child FKs</text></g>`;
  }
  nodesSvg += `<g class="er-node center" data-er-node="${E(t)}"><rect x="344" y="${cy - 21}" width="172" height="42"/><text x="430" y="${cy + 4}" text-anchor="middle">${E(t)}</text></g>`;
  return `<div class="er-legend"><span>Parents (outbound FK: ${parents.length})</span><span>Focus Table</span><span>Children (inbound FK: ${children.length})</span></div><svg class="er-svg" viewBox="0 0 860 ${h}" width="100%" role="img" aria-label="Entity relationship diagram for ${E(t)}">${edgesSvg}${nodesSvg}</svg>`;
}

function erPage(t = 'R5EVENTS') {
  const edges = extended.relations.filter(x => x.some(y => y.split('.')[0] === t));
  const names = [...new Set([...extended.relations.flatMap(x => x.map(y => y.split('.')[0])), ...Object.keys(codeMeta.key_tables || {})])].sort();
  const presets = ['R5OBJECTS', 'R5EVENTS', 'R5ACTIVITIES', 'R5PARTS', 'R5STOCK', 'R5ORDERS', 'R5REQUISITIONS', 'R5PPMS', 'R5ORGANIZATION'];
  const tblInfo = catalog.tables.find(x => x[0] === t);
  return H('Technical reference', 'Visual ER relationship explorer', `Derived from all 2,020 verified foreign keys in EAM 11.6. Click any parent (left) or child (right) table node to re-center.${tblInfo?.[7] ? ' · ' + tblInfo[7] : ''}`)
    + `<div class="row"><label for="erPick">Focus table</label><select id="erPick">${names.map(n => `<option ${n === t ? 'selected' : ''}>${E(n)}</option>`).join('')}</select>${A('table/' + U(t), 'Table details', 'button')}${A('triggers/' + U(t), 'Table triggers', 'button')}</div>`
    + `<div class="row mt-md"><small>Core domains:</small>${presets.map(p => A('er/' + U(p), p, p === t ? 'chip active button' : 'chip button')).join('')}</div>`
    + `<div class="er-wrap">${buildErSvg(t)}</div>`
    + `<h2>${E(t)} · ${edges.length} indexed column links</h2>`
    + table(['Child column', 'Parent column'], edges)
    + `<p class="note">Multiple links may belong to one composite key. Verify actual constraints before writing production joins.</p>`;
}

function downloadCsv(result) {
  function cell(value) {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"','""') + '"';
  }
  const csv = [result.columns, ...result.rows].map(row => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url; link.download = 'eam-query.csv'; link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}
function historyMarkup() {
  return sqlHist.length ? `<details><summary>Recent query history (${sqlHist.length})</summary>${sqlHist.map((q, idx) => `<div class="list-item"><button type="button" data-load-sql="${idx}">Load</button> <code class="ml-sm">${E(q.slice(0, 120))}</code></div>`).join('')}</details>` : '';
}
function sqlPage(id) {
  const l = lessons.find(x => x.id === id && x.type === 'technical');
  return H('SQL practice · technical only', 'Read-only SQL lab', 'All records are fictional and the SQLite schema is not the production R5 schema. Click schema columns to insert them, or use Check my output on lesson challenges.')
    + `<div class="sql-workspace"><div class="panel"><div class="sql-toolbar"><label for="sqlExample">Choose a lesson query</label><select id="sqlExample"><option value="">Custom query</option>${lessons.filter(x => x.type === 'technical').map(x => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${E(x.title)}</option>`).join('')}</select></div>`
    + `<p class="mt-md mb-sm"><label for="sqlText">SQL statement</label></p><div class="editor-shell"><div class="editor-head"><span>SQLite · Read-only</span><span class="editor-hint"><kbd>⌘↵</kbd> Run</span></div><textarea id="sqlText" spellcheck="false">${E(l?.sql || 'SELECT * FROM work_orders ORDER BY id;')}</textarea></div>`
    + `<div class="row mt-sm"><button id="runSQL" class="primary">${ICON_PLAY}<span>Run read-only query</span></button><button id="checkSQL" class="${l ? '' : 'is-hidden'}">${ICON_CHECK}<span>Check my output</span></button><small>SELECT / CTE · max 200 displayed rows</small></div>`
    + `<p id="sqlExpected" class="note">${E(l?.verify || 'Select a lesson for an expected result.')}</p><div id="sqlCheckMsg"></div><div id="sqlResult"></div></div>`
    + '<aside class="panel sql-browser"><h2>Training schema</h2><div id="sqlSchema">Loading schema…</div></aside></div>'
    + '<div id="queryHistory">' + historyMarkup() + '</div>'
    + `<details><summary>Training table → Production R5 crosswalk (28 tables)</summary>${table(['Training table', 'Approximate R5 table', 'Purpose'], crosswalk)}</details>`;
}

function progressPage() {
  const valid = lessons.filter(l => done.includes(l.id));
  const qTot = Object.keys(quizState).length;
  const qOk = Object.values(quizState).filter(Boolean).length;
  return H('Personal learning', 'Your learning progress', 'Progress, quiz results, notes and bookmarks are stored locally in this browser.')
    + `<div class="panel mb-md"><div class="dashboard-head"><div><strong>Overall curriculum progress</strong><p class="muted mb-sm">${valid.length} of ${lessons.length} lessons completed</p></div>${progressRing(valid.length, lessons.length)}</div>${progress(valid.length, lessons.length)}</div>`
    + `<div class="metrics">${metric(valid.length, 'Completed')}${metric(marks.length, 'Bookmarked')}${metric(Object.keys(notes).filter(k => notes[k]).length, 'Lessons with notes')}${metric(qTot ? `${qOk}/${qTot}` : '0', 'Quiz score')}</div>`
    + '<p>' + A('practice','SQL practice · ' + read('practiceSolved',[]).length + ' solved') + '</p>'
    + `<h2>Module progress</h2>`
    + Object.entries(groups).map(([m, ls]) => `<div class="list-item"><div class="row between">${A('module/' + U(m), m)}<small>${ls.filter(l => done.includes(l.id)).length}/${ls.length}</small></div>${progress(ls.filter(l => done.includes(l.id)).length, ls.length)}</div>`).join('')
    + `<h2>Bookmarks</h2>${lessons.filter(l => marks.includes(l.id)).map(l => `<div class="list-item">${lessonLink(l)}</div>`).join('') || '<p>No bookmarks yet.</p>'}`
    + `<h2>Revision notes</h2>${lessons.filter(l => notes[l.id]).map(l => `<div class="list-item">${lessonLink(l)}<p>${E(notes[l.id])}</p></div>`).join('') || '<p>No notes yet.</p>'}`
    + `<div class="row mt-lg"><button id="exportProgress" class="primary">Export progress JSON</button><label class="button" for="importFile">Import progress JSON</label><input id="importFile" type="file" accept=".json,application/json" ><button id="resetProgress">Reset local progress</button></div><div id="importMsg" class="mt-sm"></div>`;
}

function assess() {
  return H('Assessments & Quizzes', 'Interactive quizzes & scenario checks', 'Test your understanding with module multiple-choice quizzes, then review written scenario explanations.')
    + `<div class="row"><label for="assessPick">Module</label><select id="assessPick">${Object.keys(groups).map(m => `<option>${E(m)}</option>`).join('')}</select><label><input id="missedOnly" type="checkbox" ${read('missedOnly',false) ? 'checked' : ''}> Review missed questions</label></div><div id="quizScore" class="score-strip" aria-live="polite"></div><div id="assessList"></div>`;
}
function quizReport(items) {
  const correct = items.filter(q => quizState[q.id] === true).length;
  const missed = items.filter(q => quizState[q.id] === false).length;
  const open = items.length - correct - missed;
  return `<span class="pill ok tabular">${ICON_CHECK}<span>${correct} correct</span></span><span class="pill warn tabular">${ICON_ALERT}<span>${missed} missed</span></span><span class="pill tabular">${open} unanswered</span>`;
}
function renderAssess(m) {
  const mQuizzes = quizzes.filter(q => q.module === m);
  const missed = $('missedOnly').checked;
  const bank = missed ? mQuizzes.filter(q => quizState[q.id] === false) : mQuizzes;
  $('quizScore').innerHTML = quizReport(mQuizzes);
  $('assessList').innerHTML = `<h2>${missed ? 'Missed questions' : 'Module quiz'}</h2>`
    + (bank.length ? quizBlock(bank) : '<p class="muted">No questions in this selection.</p>')
    + `<h2>Written scenario checks</h2>`
    + groups[m].map((l, i) => `<details><summary>${i + 1}. ${E(l.title)} — ${E(l.scenario)}</summary><p><strong>Question:</strong> Explain the business purpose, the required sequence, and how you would verify the outcome.</p><p><strong>Answer guidance:</strong> ${E(l.concept)}</p>${l.walkthrough.length ? `<ol>${l.walkthrough.map(x => `<li>${E(x)}</li>`).join('')}</ol>` : `<pre>${E(l.sql)}</pre>`}<p><strong>Validation:</strong> ${E(l.verify)}</p>${lessonLink(l)}</details>`).join('');
}

async function route() {
  const current = ++generation;
  const hash = location.hash.slice(1) || 'home';
  const pos = hash.indexOf('/');
  const r = pos < 0 ? hash : hash.slice(0, pos);
  let id = '';
  try { id = pos < 0 ? '' : decodeURIComponent(hash.slice(pos + 1)); } catch {}
  document.body.dataset.view = r;
  renderNav(r, id);
  const main = $('main');
  try {
    switch (r) {
      case 'home': main.innerHTML = fieldHome(); break;
      case 'workshops': case 'workshop': main.innerHTML = workshopPage(id); break;
      case 'pump': main.innerHTML = pumpPage(); break;
      case 'practice': case 'exercise': await showPractice(r,id,current); break;
      case 'sql-course': main.innerHTML = sqlCourse(); break;
      case 'coverage':
        main.innerHTML = coveragePage(id);
        $('coverageModule').onchange = e => { location.hash = 'coverage/' + U(e.target.value); };
        break;
      case 'learn':
        main.innerHTML = H('Curriculum', 'Tutorials', `${lessons.length} written lessons across ${Object.keys(groups).length} modules.`)
          + '<div class="row footer-links">' + A('lesson/INTRO01','Start here · What is EAM?','button primary') + A('paths','Learning paths','button') + A('assess','Assessments','button') + A('coverage','Lesson coverage','button') + '</div>'
          + introReading()
          + '<div class="grid">' + Object.entries(groups).map(([m, ls]) => {
            const comp = ls.filter(l => done.includes(l.id)).length;
            return `<a class="tile" href="#module/${U(m)}"><div class="row between mb-sm"><h3>${E(m)}</h3><span class="pill tabular">${comp}/${ls.length}</span></div><p class="mb-sm">${ls.length} lessons</p>${progress(comp, ls.length)}</a>`;
          }).join('') + '</div>';
        break;
      case 'module': main.innerHTML = modulePage(id); break;
      case 'lesson': main.innerHTML = lessonPage(id); attachLessonContents(); break;
      case 'paths': main.innerHTML = paths(); break;
      case 'path': main.innerHTML = path(id); break;
      case 'flows': main.innerHTML = flowsPage(); break;
      case 'reference': main.innerHTML = reference(); break;
      case 'search':
        main.innerHTML = searchPage(id);
        $('searchForm').onsubmit = e => { e.preventDefault(); doSearch($('searchQ').value); };
        $('sourceFilter').onchange = () => doSearch($('searchQ').value);
        $('moduleFilter').onchange = () => doSearch($('searchQ').value);
        doSearch(id);
        break;
      case 'doc': {
        main.innerHTML = '<p>Loading source page…</p>';
        const d = await api('/api/doc?id=' + U(id));
        if (current !== generation) return;
        const refs = lessons.filter(l => l.source.hex.id === d.id || l.source.hex.pages.some(p => p.id === d.id) || l.source.infor?.id === d.id);
        main.innerHTML = H(d.source, d.title, `Offline page ${d.page ?? 'not numbered'}`)
          + `<p class="note">Supplied source text. Repeated export header/footer lines are hidden by default for readability.</p>`
          + `<div class="row"><a class="button" href="#reference">${ICON_ARROW_LEFT}<span>Reference</span></a>${d.page > 1 ? A('doc/' + (Number(d.id) - 1), 'Previous page', 'button') : ''}${d.page < (d.source === 'Hexagon EAM Help' ? 1149 : 974) ? A('doc/' + (Number(d.id) + 1), 'Next page', 'button') : ''}<button type="button" id="toggleRawDoc">Show raw extract</button></div>`
          + (refs.length ? `<div class="panel mt-md mb-md"><strong>Referenced by lessons:</strong> ${refs.map(l => lessonLink(l)).join(' · ')}</div>` : '')
          + `<div class="panel source-text mt-md" id="docBody">${E(cleanDocText(d.body))}</div>`;
        let raw = false;
        $('toggleRawDoc').onclick = () => { raw = !raw; $('docBody').textContent = raw ? d.body : cleanDocText(d.body); $('toggleRawDoc').textContent = raw ? 'Clean headers' : 'Show raw extract'; };
        break;
      }
      case 'topics': main.innerHTML = topics(); $('topicFilter').oninput = e => renderTopics(e.target.value); renderTopics(); break;
      case 'fields': main.innerHTML = fields(); $('fieldFilter').oninput = e => renderFields(e.target.value); renderFields(); break;
      case 'glossary': main.innerHTML = glossaryPage(); break;
      case 'crosswalk':
        main.innerHTML = H('Technical Library','Training-to-R5 crosswalk','Approximate mappings between the fictional training database and product tables. Verify joins in your installed release.') + table(['Training table','Approximate R5 table','Purpose'],crosswalk) + A('sql','Open training SQL lab');
        break;
      case 'technical': main.innerHTML = technical(); break;
      case 'triggers':
      case 'procedures': {
        const kind = r === 'triggers' ? 'trigger' : 'procedure';
        main.innerHTML = codeExplorerPage(kind, id);
        $('codeSearchForm').onsubmit = e => { e.preventDefault(); runCodeSearch(kind, 0); };
        main.querySelectorAll('[data-code-chip]').forEach(btn => {
          btn.onclick = () => {
            const v = btn.dataset.codeChip;
            if (!v) { $('codeQ').value = ''; $('codeTable').value = ''; }
            else if (v.startsWith('R5')) { $('codeTable').value = v; $('codeQ').value = ''; }
            else { $('codeQ').value = v; $('codeTable').value = ''; }
            runCodeSearch(kind, 0);
          };
        });
        runCodeSearch(kind, 0);
        break;
      }
      case 'codes':
        main.innerHTML = codesHubPage();
        main.querySelectorAll('.tabs button').forEach(b => { b.onclick = () => renderCodesTab(b.dataset.codetab); });
        renderCodesTab(id || 'sql');
        break;
      case 'code': {
        main.innerHTML = '<p>Loading SQL object…</p>';
        const html = await codeItemPage(id);
        if (current !== generation) return;
        main.innerHTML = html;
        $('copySqlBtn').onclick = async () => {
          const btn = $('copySqlBtn'), txt = $('rawSqlCode').textContent;
          try {
            await navigator.clipboard.writeText(txt);
            btn.innerHTML = `${ICON_CHECK}<span>Copied</span>`;
            setTimeout(() => { if ($('copySqlBtn')) $('copySqlBtn').innerHTML = `${ICON_COPY}<span>Copy SQL</span>`; }, 1500);
          } catch {}
        };
        $('dlSqlBtn').onclick = () => {
          const txt = $('rawSqlCode').textContent;
          const a = document.createElement('a'), url = URL.createObjectURL(new Blob([txt], { type: 'text/sql' }));
          a.href = url; a.download = 'recovered_eam_object.sql'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
        break;
      }
      case 'tables':
        main.innerHTML = tablesPage();
        $('tableFilter').oninput = () => renderTables($('tableFilter').value, $('tableArea').value);
        $('tableArea').onchange = () => renderTables($('tableFilter').value, $('tableArea').value);
        renderTables();
        break;
      case 'table':
        main.innerHTML = tablePage(id);
        api('/api/tables/item?name=' + U(id)).then(td => {
          if (current !== generation) return;
          renderTableDetail(id, td);
        }).catch(err => {
          if (current === generation && $('tableFullDetail')) $('tableFullDetail').innerHTML = `<p class="warning">${E(err.message)}</p>`;
        });
        api('/api/code/search?table=' + U(id)).then(res => {
          if (current !== generation || !$('tableCodeRefs')) return;
          if (!res.items.length) { $('tableCodeRefs').innerHTML = '<p class="muted">No recovered SQL objects matched this table name.</p>'; return; }
          $('tableCodeRefs').innerHTML = `<p class="muted">${res.total} matching SQL objects (showing up to 40)</p><div class="panel">${res.items.map(it => `${A('code/' + it.id, `${it.name} (${it.kind})`, 'taglink')}`).join('')}</div>`;
        }).catch(() => {});
        break;
      case 'er': {
        main.innerHTML = erPage(id || 'R5EVENTS');
        $('erPick').onchange = e => { location.hash = 'er/' + U(e.target.value); };
        const erSvg = main.querySelector('.er-svg');
        const setEdgeHover = name => {
          if (!erSvg) return;
          erSvg.classList.toggle('has-hover', Boolean(name));
          erSvg.querySelectorAll('[data-er-edge]').forEach(g => g.classList.toggle('is-highlighted', g.dataset.erEdge === name));
        };
        main.querySelectorAll('[data-er-node]').forEach(g => {
          g.setAttribute('role', 'link');
          g.setAttribute('tabindex', '0');
          g.onclick = () => { location.hash = 'er/' + U(g.dataset.erNode); };
          g.onkeydown = e => { if (e.key === 'Enter') g.onclick(); };
          if (!g.classList.contains('center')) {
            g.onmouseenter = () => setEdgeHover(g.dataset.erNode);
            g.onmouseleave = () => setEdgeHover('');
            g.onfocus = () => setEdgeHover(g.dataset.erNode);
            g.onblur = () => setEdgeHover('');
          }
        });
        break;
      }
      case 'sql': {
        main.innerHTML = sqlPage(id);
        const exercise = /^pump-([0-3])$/.exec(id);
        if (exercise) {
          const q = pumpQueries[Number(exercise[1])];
          $('sqlText').value = q.sql;
          $('sqlExpected').textContent = q.result;
          $('sqlResult').after(document.createRange().createContextualFragment(A('pump', 'Return to the pump case study')));
        }
        const wireSql = () => {
          const curLesson = lessons.find(x => x.id === $('sqlExample').value);
          if ($('checkSQL')) $('checkSQL').classList.toggle('is-hidden', !curLesson);
        };
        $('sqlExample').onchange = e => {
          const l = lessons.find(x => x.id === e.target.value);
          if (l) { $('sqlText').value = l.sql; $('sqlExpected').textContent = l.verify; $('sqlCheckMsg').innerHTML = ''; }
          wireSql();
        };
        $('queryHistory').onclick = e => {
          const button = e.target.closest('[data-load-sql]');
          if (button) $('sqlText').value = sqlHist[Number(button.dataset.loadSql)];
        };
        $('sqlText').onkeydown = e => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); $('runSQL').click(); }
        };
        $('runSQL').onclick = async () => {
          const b = $('runSQL'), q = $('sqlText').value;
          b.disabled = true; $('sqlResult').textContent = 'Running…'; $('sqlCheckMsg').innerHTML = '';
          try {
            const v = await api('/api/sql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: q }) });
            if (current !== generation) return;
            sqlHist = [q, ...sqlHist.filter(x => x !== q)].slice(0, 10);
            write('sqlhist', sqlHist);
            $('queryHistory').innerHTML = historyMarkup();
            $('sqlResult').innerHTML = `<div class="result-head"><span class="tabular"><strong>${v.rows.length} rows</strong>${v.truncated ? ' (truncated at 200)' : ''} · ${v.columns.length} columns</span><button id="saveCsv">${ICON_DOWNLOAD}<span>Export CSV</span></button></div>` + table(v.columns, v.rows);
            $('saveCsv').onclick = () => downloadCsv(v);
          } catch (e) {
            if (current === generation) $('sqlResult').textContent = 'Query rejected or failed: ' + e.message;
          } finally { b.disabled = false; }
        };
        if ($('checkSQL')) $('checkSQL').onclick = async () => {
          const l = lessons.find(x => x.id === $('sqlExample').value);
          if (!l) return;
          const msg = $('sqlCheckMsg');
          msg.innerHTML = '<p class="muted">Comparing output against expected lesson query…</p>';
          try {
            const [got, exp] = await Promise.all([
              api('/api/sql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: $('sqlText').value }) }),
              api('/api/sql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: l.sql }) }),
            ]);
            const norm = r => JSON.stringify(r.rows);
            const ok = !got.truncated && !exp.truncated && got.columns.length === exp.columns.length && norm(got) === norm(exp);
            msg.innerHTML = ok
              ? `<div class="note ok">${ICON_CHECK} <span>Output matches expected result (${exp.rows.length} rows, ${exp.columns.length} columns).</span></div>`
              : `<div class="note warn">${ICON_ALERT} <span>Result differs: got ${got.rows.length} rows × ${got.columns.length} cols, expected ${exp.rows.length} rows × ${exp.columns.length} cols. Check joins, filters, or ORDER BY.</span></div>`;
          } catch (e) { msg.innerHTML = `<div class="note warn">Check failed: ${E(e.message)}</div>`; }
        };
        api('/api/schema').then(v => {
          if (current !== generation) return;
          $('sqlSchema').innerHTML = v.tables.map(t => {
            const pk = t.columns.filter(c => c.pk).sort((a,b) => a.pk-b.pk).map(c => c.name);
            const purpose = crosswalk.find(row => row[0] === t.name)?.[2] || '';
            return '<details><summary><span>' + E(t.name) + '</span><small class="tabular">' + t.columns.length + ' cols</small></summary><p>' + E(purpose) + '</p><p>' +
              (pk.length ? 'One row per unique ' + E(pk.join(' + ')) + '.' : 'No declared primary key.') + '</p>' +
              t.links.map(link => '<p>' + E(link) + '</p>').join('') +
              '<div class="schema-cols">' +
              t.columns.map(c => '<button class="schema-col" data-ins="' + E(c.name) + '">' + E(c.name) + ' <small>' + E(c.type) + '</small></button>').join('') +
              '</div><div class="row schema-actions mt-sm"><button data-ins="' + E(t.name) + '">Insert table</button><button data-preview="' + E(t.name) + '">Show 5 sample rows</button></div><div data-sample-out aria-live="polite"></div></details>';
          }).join('');
          $('sqlSchema').querySelectorAll('[data-preview]').forEach(button => {
            button.onclick = async () => {
              const output = button.closest('details').querySelector('[data-sample-out]');
              button.disabled = true;
              try {
                const name = button.dataset.preview;
                if (!v.tables.some(t => t.name === name)) return;
                const sample = await runTrainingQuery('SELECT * FROM "' + name.replaceAll('"','""') + '" LIMIT 5');
                output.innerHTML = table(sample.columns,sample.rows);
              } catch (error) { output.textContent = error.message; }
              finally { button.disabled = false; }
            };
          });
          $('sqlSchema').querySelectorAll('[data-ins]').forEach(el => {
            el.onclick = ev => {
              ev.preventDefault(); ev.stopPropagation();
              const ta = $('sqlText'), val = el.dataset.ins, st = ta.selectionStart ?? ta.value.length, en = ta.selectionEnd ?? ta.value.length;
              ta.value = ta.value.slice(0, st) + val + ta.value.slice(en);
              ta.focus(); ta.setSelectionRange(st + val.length, st + val.length);
              el.classList.add('is-inserted');
              setTimeout(() => { if (el.isConnected) el.classList.remove('is-inserted'); }, 900);
            };
          });
        }).catch(e => { if (current === generation) $('sqlSchema').textContent = e.message; });
        break;
      }
      case 'assess':
        main.innerHTML = assess();
        $('missedOnly').onchange = e => { write('missedOnly', e.target.checked); renderAssess($('assessPick').value); };
        $('assessPick').onchange = e => renderAssess(e.target.value);
        renderAssess($('assessPick').value);
        break;
      case 'progress':
        main.innerHTML = progressPage();
        $('exportProgress').onclick = () => {
          const a = document.createElement('a'), url = URL.createObjectURL(new Blob([JSON.stringify({ activity: read('activity',[]), lastLesson: read('lastLesson',''), activePath: read('activePath',''), sqlHist, done, marks, notes, quiz: quizState, practiceSolved: read('practiceSolved',[]), practiceDrafts:read('practiceDrafts',{}) }, null, 2)], { type: 'application/json' }));
          a.href = url; a.download = 'eam-learning-progress.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
        $('importFile').onchange = async e => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const d = JSON.parse(await f.text());
            if (Array.isArray(d.activity)) write('activity', d.activity.filter(v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)));
            for (const key of ['lastLesson','activePath']) if (typeof d[key] === 'string') write(key,d[key]);
            if (Array.isArray(d.sqlHist)) { sqlHist = d.sqlHist.filter(v => typeof v === 'string').slice(0,10); write('sqlhist',sqlHist); }
            if (Array.isArray(d.practiceSolved)) write('practiceSolved',[...new Set(d.practiceSolved.filter(id=>Number.isInteger(id) && id>=1))]);
            if (d.practiceDrafts && typeof d.practiceDrafts==='object') write('practiceDrafts',Object.fromEntries(Object.entries(d.practiceDrafts).filter(([id,sql])=>Number.isInteger(+id) && +id>=1 && typeof sql==='string' && sql.length<=20000)));
            if (Array.isArray(d.done)) { done = d.done; write('done', done); }
            if (Array.isArray(d.marks)) { marks = d.marks; write('marks', marks); }
            if (d.notes && typeof d.notes === 'object') { notes = d.notes; write('notes', notes); }
            if (d.quiz && typeof d.quiz === 'object') { quizState = d.quiz; write('quiz', quizState); }
            route();
          } catch (err) { $('importMsg').innerHTML = `<p class="warning">Invalid JSON: ${E(err.message)}</p>`; }
        };
        $('resetProgress').onclick = () => {
          if (!confirm('Clear all local completion, bookmarks, notes, quiz scores, and SQL practice history?')) return;
          done = []; marks = []; notes = {}; quizState = {}; sqlHist = [];
          write('sqlhist', []); write('activity', []);
          write('practiceSolved',[]); write('practiceDrafts',{}); write('activePath',''); write('lastLesson','');
          write('done', done); write('marks', marks); write('notes', notes); write('quiz', quizState);
          route();
        };
        break;
      default:
        main.innerHTML = H('Not found', 'This page is no longer available', 'Functional simulator and old competition sections were removed.') + A('home', 'Return home', 'button');
    }
    if (current === generation) {
      if (r === 'module' && workshops.some(w => w.module === id)) main.insertAdjacentHTML('afterbegin','<p class="workshop-link">' + A('workshop/' + U(id),'Open the module workshop') + '</p>');
      enhanceCodeBlocks(main);
      main.classList.remove('view-enter');
      void main.offsetWidth;
      main.classList.add('view-enter');
      const ref = $('refSearch');
      if (ref) ref.onsubmit = e => { e.preventDefault(); location.hash = 'search/' + U($('refQ').value); };
      document.title = (main.querySelector('h1')?.textContent || 'Learning') + ' · EAM Academy';
      window.scrollTo(0, 0);
      setDrawer(false);
      setMobileNav(false);
    }
  } catch (e) {
    if (current === generation) main.innerHTML = `<p class="warning">${E(e.message)}</p>`;
  }
}

$('main').addEventListener('click', e => {
  const pathStart = e.target.closest('[data-start-path]');
  if (pathStart) write('activePath',pathStart.dataset.startPath);
  const b = e.target.closest('button[data-mark],button[data-done]');
  if (b) {
    const k = b.dataset.mark ? 'marks' : 'done', id = b.dataset.mark || b.dataset.done;
    let arr = k === 'marks' ? marks : done, has = arr.includes(id);
    arr = has ? arr.filter(x => x !== id) : [...arr, id];
    if (k === 'marks') marks = arr; else done = arr;
    write(k, arr);
    b.classList.toggle('is-active', k === 'marks' ? !has : false);
    b.classList.toggle('is-completed', k === 'done' ? !has : false);
    b.innerHTML = k === 'marks'
      ? (has ? `${ICON_BOOKMARK}<span>Bookmark</span>` : `${ICON_BOOKMARK_FILL}<span>Bookmarked</span>`)
      : (has ? `${ICON_CHECK_CIRCLE}<span>Mark complete</span>` : `${ICON_CHECK_CIRCLE}<span>Completed · undo</span>`);
    renderNav('lesson', id);
    return;
  }
  const qb = e.target.closest('button[data-check-quiz]');
  if (qb) {
    const qid = qb.dataset.checkQuiz, q = quizzes.find(x => x.id === qid);
    if (!q) return;
    const sel = document.querySelector(`input[name="quiz_${qid}"]:checked`);
    const fb = $('qf_' + qid);
    if (!sel) { fb.innerHTML = '<p class="warning">Select an option first.</p>'; return; }
    const ok = Number(sel.value) === q.answer;
    quizState[qid] = ok; logActivity();
    write('quiz', quizState);
    if ($('quizScore')) $('quizScore').innerHTML = quizReport(quizzes.filter(item => item.module === $('assessPick').value));
    const status = qb.closest('.quiz-box').querySelector('.pill');
    if (status) status.remove();
    fb.innerHTML = `<div class="note ${ok ? 'ok' : 'warn'}">${ok ? ICON_CHECK : ICON_ALERT} <span><strong>${ok ? 'Correct.' : 'Not quite.'}</strong> ${E(q.explain)}</span></div>`;
  }
});

$('main').addEventListener('change', e => {
  if (e.target.dataset.note) {
    notes[e.target.dataset.note] = e.target.value;
    write('notes', notes);
    const st = $('noteSaveState');
    if (st) {
      st.textContent = 'Saved';
      st.classList.add('is-saved');
      setTimeout(() => { if (st.isConnected) { st.textContent = 'Saved in browser'; st.classList.remove('is-saved'); } }, 1400);
    }
  }
});
$('quick').onsubmit = e => {
  e.preventDefault();
  const q = $('quickInput').value;
  if (location.hash === '#search/' + U(q)) doSearch(q); else location.hash = 'search/' + U(q);
};
document.querySelector('.skip').addEventListener('click', e => { e.preventDefault(); $('main').focus(); });
function setDrawer(open) {
  if (open) setMobileNav(false);
  $('side').classList.toggle('open', open);
  $('sideBackdrop')?.classList.toggle('open', open);
  $('menu').setAttribute('aria-expanded', String(open));
}
function setMobileNav(open) {
  if (open) {
    $('side').classList.remove('open');
    $('sideBackdrop')?.classList.remove('open');
    $('menu').setAttribute('aria-expanded', 'false');
  }
  $('topnav')?.classList.toggle('is-open', open);
  $('mobileNavBackdrop')?.classList.toggle('open', open);
  $('mobileNavBtn')?.classList.toggle('is-open', open);
  $('mobileNavBtn')?.setAttribute('aria-expanded', String(open));
  $('mobileMoreBtn')?.setAttribute('aria-expanded', String(open));
}
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault(); $('quickInput').focus(); $('quickInput').select(); return;
  }
  if (e.key === 'Escape') {
    if ($('topnav')?.classList.contains('is-open')) { setMobileNav(false); $('mobileNavBtn')?.focus(); return; }
    if ($('side').classList.contains('open')) { setDrawer(false); $('menu').focus(); return; }
  }
  if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    e.preventDefault(); $('quickInput')?.focus();
  }
});
$('menu').onclick = () => setDrawer(!$('side').classList.contains('open'));
$('sideBackdrop')?.addEventListener('click', () => setDrawer(false));
$('mobileNavBtn')?.addEventListener('click', () => setMobileNav(!$('topnav')?.classList.contains('is-open')));
$('mobileMoreBtn')?.addEventListener('click', () => setMobileNav(!$('topnav')?.classList.contains('is-open')));
$('mobileNavBackdrop')?.addEventListener('click', () => setMobileNav(false));
$('topnav')?.addEventListener('click', e => { if (e.target.closest('a')) setMobileNav(false); });
window.addEventListener('hashchange', route);

Promise.all(['curriculum.json', 'catalog.json', 'extended.json', 'enrichment.json', 'code_meta.json', 'quizzes.json', 'introduction.json'].map(p => fetch(p).then(r => { if (!r.ok) throw Error('Unable to load ' + p); return r.json(); })))
  .then(([l, c, x, en, cm, qz, intro]) => {
    lessons = [...intro.map(item => ({
      ...item, module: 'Introduction to EAM', level: 'Beginner', type: 'intro',
      source: l.find(lesson => lesson.id === item.reference).source
    })), ...l]; catalog = c; extended = x; enrichment = en; codeMeta = cm; quizzes = qz;
    for (const a of lessons) (groups[a.module] ??= []).push(a);
    // Remove loading placeholder before first route render
    const ls = $('loadingState');
    if (ls) ls.remove();
    route();
  })
  .catch(e => {
    const main = $('main');
    const ls = $('loadingState');
    if (ls) ls.remove();
    main.innerHTML = `<div class="error-state" role="alert">
      <h1>Unable to load EAM Academy</h1>
      <p>The academy content could not be fetched. This usually means the page was opened directly from the filesystem rather than a local server.</p>
      <h2>How to run locally</h2>
      <pre>python3 -m http.server 8000</pre>
      <p>Then open <a href="http://localhost:8000">localhost:8000</a>.</p>
      <p class="muted">Technical detail: ${E(e.message)}</p>
      <p><a class="button" href="https://github.com/pandarichundru/eam-academy/issues/new?template=bug_report.md">Report this issue on GitHub</a></p>
    </div>`;
  });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
