'use strict';
const $ = id => document.getElementById(id);
const E = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const U = encodeURIComponent;
const HMark = v => E(v).replace(/\[\[H\]\]/g, '<mark>').replace(/\[\[\/H\]\]/g, '</mark>');
const read = (k, d) => {
  const pid = window.EAMProfiles?.getActiveProfileId();
  if (pid) return window.EAMProfiles.readFor(pid, k, d);
  try { return JSON.parse(localStorage.getItem('eam3:' + k)) ?? d; } catch { return d; }
};
const write = (k, v) => {
  const pid = window.EAMProfiles?.getActiveProfileId();
  if (pid) { window.EAMProfiles.writeFor(pid, k, v); return; }
  try { localStorage.setItem('eam3:' + k, JSON.stringify(v)); } catch {}
};

let recoveryAudit;
let lessons = [], catalog = {}, extended = {}, enrichment = {}, codeMeta = {}, quizzes = [], groups = {};
let done = [], marks = [], notes = {}, quizState = {}, sqlHist = [];
let generation = 0;

function reloadProfileState() {
  done = read('done', []);
  marks = read('marks', []);
  notes = read('notes', {});
  quizState = read('quiz', {});
  sqlHist = read('sqlhist', []);
}
reloadProfileState();

function renderProfileMenu() {
  const host = $('profileMenu');
  if (!host || !window.EAMProfiles) return;
  const p = window.EAMProfiles.getActiveProfile();
  if (!p) { host.innerHTML = ''; return; }
  const syncLabel = window.EAMProfiles.getSyncStatus();
  host.innerHTML = `<button type="button" class="profile-trigger" id="profileMenuBtn" aria-expanded="false" aria-haspopup="menu">`
    + `<span class="profile-avatar" aria-hidden="true">${E(p.initials)}</span>`
    + `<span class="profile-name-label">${E(p.name)}</span>`
    + `</button>`
    + `<div class="profile-dropdown" id="profileDropdown" role="menu" hidden>`
    + `<div class="profile-drop-head"><strong>${E(p.name)}</strong><small>${E(syncLabel)}</small></div>`
    + `<button type="button" class="profile-drop-item" role="menuitem" id="menuSwitchProfile">Switch profile</button>`
    + `<button type="button" class="profile-drop-item" role="menuitem" id="menuMyProgress">My learning progress</button>`
    + `<button type="button" class="profile-drop-item" role="menuitem" id="menuSignOut">Sign out</button>`
    + `</div>`;
  const btn = $('profileMenuBtn'), drop = $('profileDropdown');
  const setDropOpen = (open, focusFirst = false) => {
    drop.toggleAttribute('hidden', !open);
    btn.setAttribute('aria-expanded', String(open));
    if (open && focusFirst) drop.querySelector('.profile-drop-item')?.focus();
  };
  btn.onclick = ev => {
    ev.stopPropagation();
    setDropOpen(drop.hasAttribute('hidden'));
  };
  btn.onkeydown = ev => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      ev.stopPropagation();
      setDropOpen(true, true);
    } else if (ev.key === 'Escape' && !drop.hasAttribute('hidden')) {
      ev.preventDefault();
      ev.stopPropagation();
      setDropOpen(false);
    }
  };
  drop.onkeydown = ev => {
    const items = [...drop.querySelectorAll('.profile-drop-item')];
    const idx = items.indexOf(document.activeElement);
    if (ev.key === 'ArrowDown') { ev.preventDefault(); items[(idx + 1) % items.length]?.focus(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); setDropOpen(false); btn.focus(); }
  };
  $('menuSwitchProfile').onclick = () => {
    setDropOpen(false);
    location.hash = 'profiles';
  };
  $('menuMyProgress').onclick = () => {
    setDropOpen(false);
    location.hash = 'progress';
  };
  $('menuSignOut').onclick = () => {
    setDropOpen(false);
    window.EAMProfiles.setActiveProfileId('');
    reloadProfileState();
    renderProfileMenu();
    route();
  };
}

document.addEventListener('click', ev => {
  const drop = $('profileDropdown'), btn = $('profileMenuBtn');
  if (drop && !drop.hasAttribute('hidden') && !ev.target.closest('#profileMenu')) {
    drop.setAttribute('hidden', '');
    btn?.setAttribute('aria-expanded', 'false');
  }
});

function profileWelcomeScreen() {
  const cards = window.EAMProfiles.LEARNERS.map(p => {
    const s = window.EAMProfiles.getProfileSummary(p.id, lessons.length);
    const meta = s.completed > 0
      ? `${s.pct}% · ${s.completed}/${lessons.length} lessons${s.streak ? ` · ${s.streak}d` : ''}`
      : 'Ready to start';
    return `<button type="button" class="profile-card" data-select-profile="${E(p.id)}">`
      + `<span class="profile-avatar lg" aria-hidden="true">${E(p.initials)}</span>`
      + `<span class="profile-card-text"><strong>${E(p.name)}</strong><small>${E(meta)}</small></span>`
      + `</button>`;
  }).join('');
  return `<section class="profile-welcome-shell" aria-labelledby="welcomeHeading">`
    + `<div class="profile-welcome-panel">`
    + `<div class="profile-welcome-logo"><span class="brandmark" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="2.5"></rect><path d="M5.5 6h5M5.5 8.2h3.5M5.5 10.4h5"></path></svg></span><span class="brand-text">EAM <b>Academy</b> <small class="muted">Field Manual</small></span></div>`
    + `<h1 id="welcomeHeading">Who's learning today?</h1>`
    + `<p class="muted">Choose your profile to enter EAM Academy with your own progress, notes, quizzes, and SQL practice.</p>`
    + `<div class="profile-grid">${cards}</div><label class="welcome-theme">Theme ${document.querySelector('[data-appearance]').outerHTML}</label>`
    + `</div>`
    + `</section>`;
}

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
  ['R5ORGANIZATION', 'Organization Master', 'Owning organization codes & currency context (ORG_CODE, ORG_CURR)'],
  ['R5MRCS', 'Departments (MRCs)', 'Maintenance departments / MRCs (MRC_CODE, MRC_ORG)'],
  ['R5OBJECTS', 'Equipment Master', 'Assets (OBJ_OBTYPE=A) and Locations (OBJ_OBTYPE=L)'],
  ['R5STRUCTURES', 'Equipment Hierarchies', 'Parent-child equipment hierarchy links (STC_PARENT, STC_CHILD)'],
  ['R5EVENTS', 'Work Orders & Events', 'Work orders, PM events, project links (EVT_CODE, EVT_OBJECT, EVT_PROJECT)'],
  ['R5EVENTCOST', 'Work Order Cost Rollup', 'Labor, material, tool & total cost per work order (EVO_EVENT, EVO_TOTAL)'],
  ['R5ACTIVITIES', 'Work Order Activities', 'Tasks scoped by composite key (ACT_EVENT, ACT_ACT)'],
  ['R5TRADES', 'Labor Trades', 'Craft / labor trade master definitions (TRD_CODE)'],
  ['R5TRADERATES', 'Trade Hourly Rates', 'Standard & overtime rates by MRC and trade (TRR_TRADE, TRR_NTRATE)'],
  ['R5PERSONNEL', 'Employees / Technicians', 'Employee / technician master records (PER_CODE, PER_TRADE)'],
  ['R5BOOKEDHOURS', 'Booked Labor Hours', 'Actual booked labor hours against work activities (BOO_EVENT, BOO_ACT)'],
  ['R5PARTS', 'Parts Catalog', 'Inventory part catalog master (PAR_CODE, PAR_UOM)'],
  ['R5STORES', 'Storerooms', 'Stock-holding warehouse stores (STR_CODE, STR_ORG)'],
  ['R5BINS', 'Warehouse Bins', 'Storage bins inside a store (BIN_STORE, BIN_CODE)'],
  ['R5STOCK', 'Store Stock Levels', 'Part-store stock levels & reorder points (STO_PART, STO_STORE)'],
  ['R5PICKLISTS', 'Material Pick Lists', 'Work order material pick list headers (PIC_CODE, PIC_EVENT, PIC_STORE)'],
  ['R5PICKLISTPARTS', 'Pick List Part Lines', 'Reserved & issued part quantities per pick list (PIP_PICKLIST, PIP_PART)'],
  ['R5ISSUES', 'Material Issues', 'Posted issue transactions to work orders (ISS_EVENT, ISS_PART)'],
  ['R5COMPANIES', 'Suppliers & Companies', 'Suppliers & manufacturers (COM_CODE, COM_DESC)'],
  ['R5REQUISITIONS', 'Purchase Requisitions', 'Purchase requisition headers (REQ_CODE, REQ_STATUS)'],
  ['R5REQUISLINES', 'Requisition Lines', 'Purchase requisition line items (RQL_REQ, RQL_REQLINE)'],
  ['R5ORDERS', 'Purchase Orders', 'Purchase order headers (ORD_CODE, ORD_SUPPLIER)'],
  ['R5ORDERLINES', 'Purchase Order Lines', 'Purchase order line items (ORL_ORDER, ORL_ORDLINE)'],
  ['R5DOCKLINES', 'Dock Receiving Lines', 'PO receiving quantities against PO lines (DKL_ORDER, DKL_ORDLINE)'],
  ['R5METERS', 'Equipment Meters', 'Physical/logical meter definitions (MET_CODE, MET_OBJECT)'],
  ['R5READINGS', 'Meter Readings', 'Recorded meter readings (REA_METER, REA_DATE, REA_READING)'],
  ['R5PPMOBJECTS', 'PM Equipment Schedules', 'Preventive maintenance schedule assignments (PPO_PPM, PPO_OBJECT)'],
  ['R5ACTCHECKLISTS', 'Activity Checklists', 'Inspection checklists, findings & dates (ACK_CODE, ACK_OBJECT, ACK_UPDATED)'],
  ['R5PROJECTS', 'Projects', 'Capital / shutdown project headers (PRJ_CODE, PRJ_ORIGBUD)'],
];

const u5AndFamilyCrosswalk = [
  ['U5* (Custom Tables)', 'u5 (0 tables in 116_van.bak)', 'Site-created custom tables in HxGN/Infor EAM (e.g. U5MYTABLE). Not present in vanilla 116_van.bak; registered via R5UDFSCREENS & R5UDFSCREENFIELDS and joined to R5OBJECTS / R5EVENTS by custom keys.'],
  ['R5UDFSCREENS / R5UDFSCREENFIELDS', 'udf (0 rows in 116_van.bak)', 'Metadata registry for user-defined screens and custom table fields (USC_SCREENNAME, USC_TABLENAME, USF_FIELDNAME).'],
  ['R5USERDEFINEDFIELDSETUP', 'udf (5,524 source / 5,000 exported)', 'User-defined field definitions (udfchar*, udfnum*, udfdate*, udfchkbox*) attached to core R5 entities via UDF_RENTITY = R5ENTITIES.ENT_RENTITY.'],
  ['R5USERDEFINEDFIELDDEPENDENCIES', 'udf (342 rows)', 'Links UDF entity setup to EAM pages and grids via UFD_RENTITY = ENT_RENTITY and UFD_PAGENAME = R5FUNCTIONS.FUN_CODE.'],
  ['R5USERDEFINEDFIELDLOVVALS', 'udf (0 rows in 116_van.bak)', 'Custom List-of-Values dropdown entries for UDF fields (UDL_RENTITY, UDL_FIELD, UDL_CODE).'],
  ['R5FLEXTABLES / R5FLEXSQL', 'r5 (3 / 6 rows)', 'Flex SQL extensibility triggers & rules bound to R5 tables (R5REQUISITIONS, R5REQUISLINES, R5OBJECTS).'],
  ['DATALAKE_TABLE / DATALAKE_COLUMN', 'datalake (17 / 249 rows)', 'Infor Data Lake ingestion catalog mapping EAM tables and columns to analytics schedules.'],
  ['TABLECOUNT_MSSQL / SEQ_S5*', 'other (1,248 / 276 tables)', 'SQL Server table row inventory and sequence generators (SEQ_S5DATALAKE_TABLE, SEQ_S5EVENT, etc.).'],
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
      { label: 'PM Schedule', lesson: 'Creating PM schedules', table: 'R5PPMS' },
      { label: 'PM Activities & Parts', lesson: 'PM work order activities', table: 'R5PPMACTS' },
      { label: 'Equipment Association', lesson: 'Equipment association with PM schedules', table: 'R5PPMOBJECTS' },
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
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'AS', 'ON', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS',
  'GROUP', 'BY', 'ORDER', 'ASC', 'DESC', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT', 'UNION', 'ALL', 'WITH', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'CAST', 'COALESCE', 'OVER', 'PARTITION', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
  'CREATE', 'TABLE', 'VIEW', 'TRIGGER', 'PROCEDURE', 'FUNCTION', 'INDEX', 'UNIQUE', 'PRIMARY', 'KEY', 'REFERENCES', 'ALTER', 'DROP',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'BEGIN', 'DECLARE', 'IF', 'RETURN', 'RETURNS', 'EXEC', 'EXECUTE', 'EXISTS', 'BETWEEN', 'LIKE'
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
      } catch { }
    };
    pre.parentNode.insertBefore(wrap, pre);
    wrap.append(btn, pre);
  });
}

const H = (tag, title, desc = '') => `<div class="eyebrow">${E(tag)}</div><h1>${E(title)}</h1>${desc ? `<p class="muted">${E(desc)}</p>` : ''}`;
const A = (route, label, cls = '') => `<a ${cls ? `class="${cls}"` : ''} href="#${route}">${E(label)}</a>`;
const ext = (url, label) => `<a class="ext-link" href="${E(url)}" target="_blank" rel="noopener noreferrer"><span>${E(label)}</span>${ICON_EXTERNAL}</a>`;
const table = (headers, rows) => `<div class="scroll"><table><thead><tr>${headers.map(v => `<th scope="col">${E(v)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(v => `<td>${v === null || v === undefined ? '<span class="null-val">NULL</span>' : v==='' ? '<span class="empty-value">Empty string</span>' : E(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const tiles = items => `<div class="grid">${items.map(([r, t, d]) => `<a class="tile" href="#${r}"><h3>${E(t)}</h3><p>${E(d)}</p></a>`).join('')}</div>`;
const progress = (n, total) => `<div class="bar" role="progressbar" aria-label="Completion" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${n}"><i style="width:${total ? n / total * 100 : 0}%"></i></div>`;
const lessonLink = l => `<a class="lesson-link${done.includes(l.id) ? ' is-done' : ''}" href="#lesson/${E(l.id)}">${done.includes(l.id) ? ICON_CHECK : ''}<span>${E(l.title)}</span></a>`;
const metric = (n, t) => `<div class="metric"><strong>${E(n)}</strong><span>${E(t)}</span></div>`;
const sourceLink = (id, label) => A('doc/' + id, label);

function findLessonByTitle(t) {
  return lessons.find(l => l.title.toLowerCase() === t.toLowerCase()) || lessons.find(l => l.title.toLowerCase().includes(t.toLowerCase()));
}

function renderNav(route, id) {
  const groupMap = {
    learn: ['home', 'learn', 'lesson', 'module', 'paths', 'path', 'workshops', 'workshop', 'pump', 'flows', 'progress', 'assess', 'coverage'],
    sql: ['sql-course', 'practice', 'exercise', 'sql', 'sql-real'],
    library: ['technical', 'triggers', 'procedures', 'codes', 'code', 'tables', 'table', 'er', 'crosswalk', 'reference', 'doc', 'search', 'glossary', 'fields', 'topics']
  };
  const activeGroup = Object.keys(groupMap).find(g => groupMap[g].includes(route)) || 'learn';
  document.querySelectorAll('.nav-group-btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.navGroup === activeGroup);
  });
  for (const link of $('topnav').querySelectorAll('a')) {
    const h = link.hash.slice(1);
    if (h === route || (h === 'er/R5EVENTS' && route === 'er')) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const bottomNav = $('mobileBottomNav');
  if (bottomNav) {
    const mobileTargets = { home: '#home', learn: '#learn', sql: '#sql-real', library: '#technical' };
    const activeTarget = route === 'home' ? '#home' : mobileTargets[activeGroup] || '';
    for (const link of bottomNav.querySelectorAll('a')) {
      if (link.hash === activeTarget) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    $('mobileMoreBtn')?.classList.toggle('is-active', ['progress', 'workshops', 'paths', 'reference'].includes(route));
  }
  const selected = lessons.find(l => l.id === id);
  const c = codeMeta.counts || {};
  const menuBtnLabel = $('menu')?.querySelector('span');

  if (activeGroup === 'sql') {
    if (menuBtnLabel) menuBtnLabel.textContent = 'SQL Tools';
    $('side').innerHTML = '<div class="eyebrow">SQL Workspace</div>'
      + A('sql-course', 'Learn SQL (10 lessons)', route === 'sql-course' ? 'active' : '')
      + A('practice', 'Solve an exercise (110)', route === 'practice' || route === 'exercise' ? 'active' : '')
      + A('sql', 'Run query · Synthetic DB (28)', route === 'sql' ? 'active' : '')
      + A('sql-real', 'Run query · Restored 11.6 (1,681)', route === 'sql-real' ? 'active' : '')
      + '<a href="sql-formatter/">Format SQL · Offline tool</a>'
      + '<hr><div class="eyebrow">Schema &amp; Crosswalk</div>'
      + A('tables', 'Database Dictionary (1,681)', '')
      + A('er/R5EVENTS', 'Visual ER Explorer', '')
      + A('crosswalk', 'R5 & U5 Crosswalk', '');
  } else if (activeGroup === 'library') {
    if (menuBtnLabel) menuBtnLabel.textContent = 'Library';
    $('side').innerHTML = '<div class="eyebrow">Technical Objects</div>'
      + A('technical', 'Library Overview', route === 'technical' ? 'active' : '')
      + A('triggers', `Triggers — Full (${c.trigger ?? 2405})`, route === 'triggers' ? 'active' : '')
      + A('procedures', `Stored Procedures (${c.procedure ?? 1629})`, route === 'procedures' ? 'active' : '')
      + A('codes', 'Views, Functions & DDL', route === 'codes' || route === 'code' ? 'active' : '')
      + '<hr><div class="eyebrow">Database &amp; Reference</div>'
      + A('tables', 'Database Dictionary (1,681)', route === 'tables' || route === 'table' ? 'active' : '')
      + A('er/R5EVENTS', 'Visual ER Explorer', route === 'er' ? 'active' : '')
      + A('crosswalk', 'R5 & U5 Crosswalk', route === 'crosswalk' ? 'active' : '')
      + A('reference', 'Learning References', route === 'reference' || route === 'doc' ? 'active' : '')
      + A('glossary', 'EAM Glossary', route === 'glossary' ? 'active' : '');
  } else {
    if (menuBtnLabel) menuBtnLabel.textContent = 'Curriculum';
    $('side').innerHTML = '<div class="eyebrow">Course curriculum</div>'
      + Object.entries(groups).map(([m, ls]) => {
        const doneCnt = ls.filter(l => done.includes(l.id)).length;
        return `<details class="module" ${selected?.module === m || (route === 'module' && id === m) ? 'open' : ''}><summary>${E(m)} <span class="${doneCnt === ls.length && ls.length ? 'mod-complete' : ''}">${doneCnt}/${ls.length}</span></summary>${A('module/' + U(m), 'Module overview')}${ls.map(l => {
          const isDone = done.includes(l.id);
          const cls = [l.id === id ? 'active' : '', isDone ? 'is-done' : ''].filter(Boolean).join(' ');
          return `<a ${cls ? `class="${cls}"` : ''} href="#lesson/${E(l.id)}">${isDone ? ICON_CHECK : ''}<span>${E(l.title)}</span></a>`;
        }).join('')}</details>`;
      }).join('');
  }
  const activeSide = $('side').querySelector('a.active');
  if (activeSide) activeSide.scrollIntoView({ block: 'nearest' });
  const bc = $('subbarBreadcrumb');
  if (bc) {
    const sep = ' <span class="sep">/</span> ';
    if (route === 'home') bc.innerHTML = `HxGN EAM${sep}Infor EAM`;
    else if (route === 'lesson' && selected) bc.innerHTML = `${A('learn', 'Curriculum')}${sep}${A('module/' + U(selected.module), selected.module)}${sep}<span class="bc-cur">${E(selected.id)}</span>`;
    else if (route === 'module' && id) bc.innerHTML = `${A('learn', 'Curriculum')}${sep}<span class="bc-cur">${E(id)}</span>`;
    else if (route === 'er') bc.innerHTML = `${A('technical', 'Library')}${sep}ER Explorer${id ? sep + `<span class="bc-cur">${E(id)}</span>` : ''}`;
    else if (route === 'table' && id) bc.innerHTML = `${A('technical', 'Library')}${sep}${A('tables', 'Dictionary')}${sep}<span class="bc-cur">${E(id)}</span>`;
    else if (route === 'exercise' && id) bc.innerHTML = `${A('practice', 'SQL Exercises')}${sep}<span class="bc-cur">Exercise #${E(id)}</span>`;
    else if (route === 'workshop' && id) bc.innerHTML = `${A('workshops', 'Workshops')}${sep}<span class="bc-cur">${E(id)}</span>`;
    else if (route === 'path' && id) bc.innerHTML = `${A('paths', 'Role paths')}${sep}<span class="bc-cur">${E(id)}</span>`;
    else {
      const labels = { learn: 'Curriculum', workshops: 'Workshops', 'sql-course': 'Learn SQL', sql: 'Synthetic SQL Lab', 'sql-real': 'Restored EAM 11.6 SQL Lab', technical: 'Technical Library', triggers: 'Triggers', procedures: 'Stored Procedures', codes: 'All Codes', tables: 'Database Dictionary', crosswalk: 'R5 & U5 Crosswalk', practice: 'SQL Exercises', reference: 'Reference', search: 'Search', glossary: 'Glossary', fields: 'Field Dictionary', topics: 'Topic Index', progress: 'My Learning', assess: 'Assessments', coverage: 'Coverage', flows: 'Process Flows', pump: 'Pump Case Study', paths: 'Role Paths' };
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
  { title: 'Check the schedule', sql: "SELECT PPO_OBJECT, PPO_PPM, PPO_FREQ, PPO_ISSTYPE\nFROM R5PPMOBJECTS\nWHERE PPO_OBJECT = 'PUMP-001';", result: 'PUMP-001 · PUMP30 · 30 · Days. This confirms the configured interval. The training database does not store a PM-to-work-order link, so this result cannot establish which order the schedule generated.' },
  { title: 'Inspect the open orders', sql: "SELECT EVT_OBJECT, EVT_CODE\nFROM R5EVENTS\nWHERE EVT_STATUS = 'Open'\nORDER BY EVT_OBJECT, EVT_CODE;", result: 'COMP-001 has order 103. PUMP-001 has order 101. At this stage each row represents one open work order.' },
  { title: 'Find assets with multiple open orders', sql: "SELECT EVT_OBJECT, COUNT(*) AS open_orders\nFROM R5EVENTS\nWHERE EVT_STATUS = 'Open'\nGROUP BY EVT_OBJECT\nHAVING COUNT(*) > 1;", result: 'Zero rows is the correct answer. WHERE removes closed orders before grouping. HAVING keeps only groups with two or more orders. Change > 1 to >= 1 to see both assets with a count of one.' },
  { title: 'Diagnose an inflated count', sql: "SELECT w.EVT_OBJECT, COUNT(*) AS joined_rows,\n       COUNT(DISTINCT w.EVT_CODE) AS open_orders\nFROM R5EVENTS w\nLEFT JOIN R5ACTIVITIES a ON a.ACT_EVENT = w.EVT_CODE\nWHERE w.EVT_STATUS = 'Open'\nGROUP BY w.EVT_OBJECT\nORDER BY w.EVT_OBJECT;", result: 'PUMP-001 shows two joined rows but one order because order 101 has two activities. COMP-001 shows one row and one order because the left join preserves order 103 even without an activity. For a pure order count, use the simpler orders-only query.' }
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

const sqlDeepDive = {
  L127: {
    grain: '1 row = 1 work order / event (PK: EVT_CODE)',
    realTable: 'R5EVENTS',
    execOrder: '1. FROM R5EVENTS → 2. WHERE EVT_STATUS = \'Open\' → 3. SELECT columns → 4. ORDER BY EVT_CODE',
    clauses: [
      ['SELECT EVT_CODE, EVT_DESC, EVT_OBJECT, EVT_STATUS', 'Projects only the 4 required columns instead of SELECT *, reducing memory, I/O, and network transfer while keeping the output stable if columns are added later.'],
      ['FROM R5EVENTS', 'Reads the work-order/event header table where each row represents one work order, PM event, or inspection event.'],
      ['WHERE EVT_STATUS = \'Open\'', 'Evaluated before SELECT and ORDER BY. Filters out closed/cancelled history early so downstream sorting only touches active work.'],
      ['ORDER BY EVT_CODE', 'Guarantees deterministic ordering. Without ORDER BY, SQL engines return rows in arbitrary heap/index scan order.']
    ],
    columns: [
      ['EVT_CODE', 'Primary Key. Unique work order / event identifier across the EAM organization.'],
      ['EVT_DESC', 'Short work order summary displayed in list grids and mobile screens.'],
      ['EVT_OBJECT', 'Foreign Key to R5OBJECTS.OBJ_CODE identifying the target asset or location.'],
      ['EVT_STATUS', 'Lifecycle status code (e.g. Open, Released, Closed) governed by R5UCODES / status authorizations.']
    ],
    antiPattern: {
      bad: 'SELECT * FROM R5EVENTS WHERE UPPER(EVT_STATUS) = \'OPEN\';',
      why: 'Two production bugs: (1) SELECT * breaks downstream consumers when columns change and wastes I/O; (2) wrapping EVT_STATUS in UPPER() disables B-tree index seeks (non-SARGable), forcing a full table scan.'
    },
    pitfall: 'Omitting ORDER BY produces non-deterministic pagination; wrapping indexed columns in functions prevents index seeks.',
    perf: 'In SQL Server (116_van.bak), keep predicates SARGable (col = literal) so indexes on EVT_STATUS / EVT_ORG can seek directly.',
    interview: ['Why can you not filter by a SELECT alias inside the WHERE clause?', 'Because SQL evaluates WHERE before SELECT. Use a CTE or subquery if you need to filter on a computed alias.']
  },
  L128: {
    grain: '1 row = 1 work order enriched with its 1 matching equipment master row (N:1 join)',
    realTable: 'R5OBJECTS',
    execOrder: '1. FROM R5EVENTS → 2. JOIN R5OBJECTS ON PK → 3. SELECT → 4. ORDER BY',
    clauses: [
      ['FROM R5EVENTS AS e', 'Starts at the child/many side (many work orders can reference one piece of equipment).'],
      ['JOIN R5OBJECTS AS o ON o.OBJ_CODE = e.EVT_OBJECT', 'N:1 lookup onto the parent equipment Primary Key. Guaranteed not to multiply work-order rows because OBJ_CODE is unique per org.']
    ],
    columns: [
      ['OBJ_CODE / OBJ_ORG', 'Composite natural key of R5OBJECTS in multi-organization EAM databases.'],
      ['OBJ_DESC', 'Human-readable asset description; never join on descriptions because they are not unique.'],
      ['OBJ_OBTYPE', 'Object type: A = Asset, L = Location, P = Position, S = System.']
    ],
    antiPattern: {
      bad: 'SELECT e.EVT_CODE, o.OBJ_DESC FROM R5EVENTS e JOIN R5OBJECTS o ON o.OBJ_DESC = e.EVT_DESC;',
      why: 'Joining on descriptions instead of keys silently drops records when text differs and causes Cartesian fan-out when two assets share a name like "Centrifugal Pump".'
    },
    pitfall: 'In multi-org EAM, joining on OBJ_CODE alone without EVT_OBJECT_ORG = OBJ_ORG can match the wrong site\'s asset.',
    perf: 'Joining child FK → parent PK uses a clustered/unique index seek on R5OBJECTS (O(log N) per row).',
    interview: ['When does an INNER JOIN change the row count of the left table?', 'Whenever the join key is not unique on the right table (fan-out) or when the left row has NULL/unmatched FK values (dropped rows).']
  },
  L129: {
    grain: '1 row = 1 equipment record (preserving idle assets with 0 work orders)',
    realTable: 'R5EVENTCOST',
    execOrder: '1. FROM R5OBJECTS → 2. LEFT JOIN R5EVENTS → 3. LEFT JOIN R5EVENTCOST → 4. GROUP BY → 5. SELECT → 6. ORDER BY',
    clauses: [
      ['FROM R5OBJECTS AS o LEFT JOIN R5EVENTS AS e', 'Anchors the query on R5OBJECTS so equipment with zero work orders remains in the result set with NULL event columns.'],
      ['LEFT JOIN R5EVENTCOST AS c ON c.EVO_EVENT = e.EVT_CODE', 'Preserves work orders that have not yet posted a cost rollup row.'],
      ['COUNT(e.EVT_CODE) vs COUNT(*)', 'COUNT(e.EVT_CODE) ignores NULLs and returns 0 for idle assets; COUNT(*) counts the NULL-padded row as 1!'],
      ['COALESCE(SUM(c.EVO_TOTAL), 0)', 'Replaces NULL sums with 0 so totals are numeric and sortable.']
    ],
    columns: [
      ['EVO_EVENT / EVO_TOTAL', 'Work order FK and total rolled-up cost (labor + material + services + tools) in R5EVENTCOST.'],
      ['OBJ_CODE / OBJ_DESC', 'Grouping key defining the asset-level output grain.']
    ],
    antiPattern: {
      bad: 'SELECT o.OBJ_CODE, COUNT(*) AS orders FROM R5OBJECTS o LEFT JOIN R5EVENTS e ON e.EVT_OBJECT = o.OBJ_CODE GROUP BY o.OBJ_CODE;',
      why: 'COUNT(*) counts NULL-padded LEFT JOIN rows, reporting 1 work order for an idle asset that actually has 0!'
    },
    pitfall: 'Using COUNT(*) on a LEFT JOIN or placing a right-table filter in WHERE (turning the LEFT JOIN into an INNER JOIN).',
    perf: 'Filter right-table predicates inside the ON clause (not WHERE) to preserve outer-join semantics without extra subqueries.',
    interview: ['Why does WHERE e.EVT_STATUS = \'Open\' after a LEFT JOIN drop idle assets?', 'Because idle assets have e.EVT_STATUS IS NULL, and NULL = \'Open\' evaluates to UNKNOWN (filtered out by WHERE). Put it in the ON clause instead.']
  },
  L130: {
    grain: '1 row = 1 work-order activity (Composite PK: ACT_EVENT + ACT_ACT)',
    realTable: 'R5ACTIVITIES',
    execOrder: '1. FROM R5EVENTS → 2. JOIN R5ACTIVITIES → 3. LEFT JOIN R5BOOKEDHOURS (2-col key) → 4. GROUP BY',
    clauses: [
      ['JOIN R5ACTIVITIES AS a ON a.ACT_EVENT = e.EVT_CODE', 'Expands each work order to its task lines (10, 20, 30...).'],
      ['LEFT JOIN R5BOOKEDHOURS AS b ON b.BOO_EVENT = a.ACT_EVENT AND b.BOO_ACT = a.ACT_ACT', 'Matches the full 2-column composite key so labor hours attach only to the exact activity they were booked against.']
    ],
    columns: [
      ['ACT_EVENT / ACT_ACT', 'Composite Primary Key of R5ACTIVITIES. ACT_ACT (10, 20, ...) repeats across different work orders.'],
      ['BOO_EVENT / BOO_ACT / BOO_HOURS', 'Work order, activity sequence, and actual booked labor hours in R5BOOKEDHOURS.']
    ],
    antiPattern: {
      bad: 'LEFT JOIN R5BOOKEDHOURS b ON b.BOO_EVENT = a.ACT_EVENT',
      why: 'Omitting BOO_ACT joins every labor entry on the work order to EVERY activity on that work order — multiplying total labor hours by the number of activities (classic fan-out bug).'
    },
    pitfall: 'Partial composite-key joins silently inflate SUM(BOO_HOURS) while still returning plausible-looking numbers.',
    perf: 'Composite PK/FK indexes in SQL Server require the leading key (ACT_EVENT) and secondary key (ACT_ACT) together for an exact range/point seek.',
    interview: ['How do you detect a fan-out join bug in an aggregated report?', 'Compare SUM(hours) before and after adding the join; if the total increases after joining a detail table, your join key is under-specified.']
  },
  L131: {
    grain: '1 row = 1 part in 1 storeroom (Composite PK: STO_PART + STO_STORE)',
    realTable: 'R5STOCK',
    execOrder: '1. FROM R5STOCK → 2. JOIN R5PARTS → 3. WHERE s.STO_QTY < s.STO_REORDER → 4. ORDER BY',
    clauses: [
      ['FROM R5STOCK AS s JOIN R5PARTS AS p ON p.PAR_CODE = s.STO_PART', 'Enriches store-level inventory balances with part descriptions and units of measure.'],
      ['WHERE s.STO_QTY < s.STO_REORDER', 'Evaluates shortage at the exact part-store grain before any reporting rollup.']
    ],
    columns: [
      ['STO_PART / STO_STORE', 'Composite Primary Key of R5STOCK: inventory is tracked per part per storeroom.'],
      ['STO_QTY / STO_REORDER', 'Current on-hand quantity and minimum reorder point for that storeroom.']
    ],
    antiPattern: {
      bad: 'SELECT STO_PART, SUM(STO_QTY), SUM(STO_REORDER) FROM R5STOCK GROUP BY STO_PART HAVING SUM(STO_QTY) < SUM(STO_REORDER);',
      why: 'Surplus stock in a remote warehouse masks an urgent stockout at the main plant storeroom.'
    },
    pitfall: 'Evaluating reorder thresholds after aggregating across storerooms hides local shortages.',
    perf: 'Compare numeric columns directly without arithmetic on the indexed column when possible.',
    interview: ['What is the difference between R5PARTS and R5STOCK?', 'R5PARTS is the global/org part catalog (1 row per part); R5STOCK is storeroom inventory (1 row per part per store).']
  },
  L132: {
    grain: '1 row = 1 stock record (STO_PART + STO_STORE) with pre-aggregated reservations',
    realTable: 'R5PICKLISTS',
    execOrder: '1. CTE reserved (GROUP BY part, store) → 2. FROM R5STOCK → 3. LEFT JOIN reserved → 4. SELECT net_available',
    clauses: [
      ['WITH reserved AS (... GROUP BY PIP_PART, PIC_STORE)', 'Collapses multiple open pick-list lines to the exact same (part, store) grain as R5STOCK BEFORE joining.'],
      ['s.STO_QTY - COALESCE(r.res_qty, 0)', 'Computes net available stock without losing unreserved parts (NULL becomes 0).']
    ],
    columns: [
      ['PIP_PICKLIST / PIP_PART / PIP_QTY', 'Pick-list header FK, part code, and reserved quantity in R5PICKLISTPARTS.'],
      ['PIC_STORE', 'Storeroom code on R5PICKLISTS header.']
    ],
    antiPattern: {
      bad: 'SELECT s.STO_PART, s.STO_QTY - SUM(p.PIP_QTY) FROM R5STOCK s LEFT JOIN R5PICKLISTPARTS p ON p.PIP_PART = s.STO_PART GROUP BY s.STO_PART, s.STO_QTY;',
      why: 'Two bugs: (1) omits store scope (PIC_STORE = STO_STORE), subtracting MAIN reservations from REMOTE stock; (2) joining two 1:N tables before aggregating duplicates STO_QTY.'
    },
    pitfall: 'Always aggregate child tables to the parent grain in a CTE before subtracting from parent quantities.',
    perf: 'CTE pre-aggregation shrinks the hash/merge join input to one row per active (part, store).',
    interview: ['Why use a CTE here instead of joining R5STOCK -> R5PICKLISTS -> R5PICKLISTPARTS directly?', 'Because a direct join creates a fan-out if a part has multiple pick lists, inflating SUM(s.STO_QTY) if you are not careful.']
  },
  L133: {
    grain: '1 row = 1 purchase order line (Composite PK: ORL_ORDER + ORL_ORDLINE)',
    realTable: 'R5ORDERLINES',
    execOrder: '1. CTE rec (GROUP BY DKL_ORDER, DKL_ORDLINE) → 2. FROM R5ORDERLINES → 3. LEFT JOIN rec → 4. SELECT open_qty',
    clauses: [
      ['WITH rec AS (... GROUP BY DKL_ORDER, DKL_ORDLINE)', 'Aggregates partial dock deliveries to the PO-line grain before joining.'],
      ['LEFT JOIN rec ...', 'Keeps PO lines with zero receipts so open_qty = ORL_ORDQTY - 0.']
    ],
    columns: [
      ['ORL_ORDER / ORL_ORDLINE / ORL_ORDQTY', 'PO number, line number, and ordered quantity on R5ORDERLINES.'],
      ['DKL_RECVQTY', 'Received quantity per dock receipt line on R5DOCKLINES.']
    ],
    antiPattern: {
      bad: 'JOIN R5DOCKLINES d ON d.DKL_ORDER = ol.ORL_ORDER AND d.DKL_ORDLINE = ol.ORL_ORDLINE',
      why: 'An INNER JOIN silently drops every PO line that has not had a delivery yet — the exact open lines procurement needs to expedite!'
    },
    pitfall: 'Using INNER JOIN when reconciling expected vs. actual transactions hides zero-activity open items.',
    perf: 'Pre-aggregating R5DOCKLINES by (DKL_ORDER, DKL_ORDLINE) aligns with its FK index.',
    interview: ['How would you filter for only partially or unreceived PO lines?', 'Add WHERE ol.ORL_ORDQTY > COALESCE(rec.recv_qty, 0) after the LEFT JOIN.']
  },
  L134: {
    grain: '1 row = 1 meter reading compared to the preceding reading on the same meter',
    realTable: 'R5READINGS',
    execOrder: '1. FROM R5READINGS → 2. SELECT + WINDOW LAG() OVER (PARTITION BY ... ORDER BY ...) → 3. ORDER BY',
    clauses: [
      ['PARTITION BY REA_METER', 'Resets the window boundary for every meter so readings from different meters never mix.'],
      ['ORDER BY REA_DATE, REA_ID', 'Establishes a deterministic tie-broken sequence when two readings occur on the same date.'],
      ['LAG(REA_READING)', 'Accesses the previous row\'s value without a costly self-join; returns NULL for each meter\'s first reading.']
    ],
    columns: [
      ['REA_METER / REA_DATE / REA_READING', 'Meter identifier, reading timestamp, and cumulative reading value in R5READINGS.']
    ],
    antiPattern: {
      bad: 'LAG(REA_READING) OVER (ORDER BY REA_DATE)',
      why: 'Without PARTITION BY REA_METER, the first reading of Meter B is subtracted from the last reading of Meter A — producing meaningless negative or huge deltas.'
    },
    pitfall: 'Window functions execute AFTER WHERE and GROUP BY; wrap in a CTE if you want to filter on the computed delta.',
    perf: 'A composite index on (REA_METER, REA_DATE, REA_ID) lets the engine stream LAG() in a single ordered pass without a sort.',
    interview: ['Why does the first reading of every meter have NULL delta?', 'Because there is no preceding row in that meter\'s partition; NULL honestly represents "no prior baseline" rather than 0.']
  },
  L135: {
    grain: '1 row = 1 requisition scoped to a specific organization & status',
    realTable: 'R5REQUISITIONS',
    execOrder: '1. FROM R5REQUISITIONS → 2. JOIN R5ORGANIZATION → 3. WHERE org + status → 4. ORDER BY',
    clauses: [
      ['JOIN R5ORGANIZATION AS org ON org.ORG_CODE = req.REQ_ORG', 'Attaches organization currency and description context.'],
      ['WHERE req.REQ_ORG = \'PLANT01\' AND req.REQ_STATUS = \'Approved\'', 'Enforces multi-organization isolation and approval status together.']
    ],
    columns: [
      ['REQ_CODE / REQ_ORG / REQ_STATUS', 'Requisition ID, owning organization (MOS boundary), and approval status.'],
      ['ORG_CODE / ORG_CURR', 'Organization master key and base currency in R5ORGANIZATION.']
    ],
    antiPattern: {
      bad: 'SELECT REQ_CODE FROM R5REQUISITIONS WHERE REQ_STATUS = \'Approved\';',
      why: 'In multi-site EAM (Multi-Org Security), omitting *_ORG mixes requisitions across plants and currencies.'
    },
    pitfall: 'Assuming codes are globally unique across organizations; always carry *_ORG in joins and filters.',
    perf: 'Leading the WHERE predicate with REQ_ORG matches EAM\'s multi-org composite indexes.',
    interview: ['What is Multi-Org Security (MOS) in EAM SQL?', 'A data-isolation pattern where operational tables carry *_ORG and queries/joins must scope by organization to prevent cross-site data leakage.']
  },
  L136: {
    grain: '1 row = 1 table DDL / catalog metadata record',
    realTable: 'R5USERTABCOLUMNS',
    execOrder: '1. Query system catalog (sqlite_master / INFORMATION_SCHEMA) → 2. Verify PKs, FKs, and types',
    clauses: [
      ['SELECT sql FROM sqlite_master WHERE name = \'R5ACTIVITIES\'', 'Reads the exact physical schema definition rather than guessing column names or key cardinality.']
    ],
    columns: [
      ['sqlite_master (SQLite)', 'Stores exact CREATE TABLE / INDEX DDL in SQLite training & real-data labs.'],
      ['INFORMATION_SCHEMA / sys.tables (SQL Server)', 'Enterprise catalog views used in 116_van.bak to inventory 1,681 tables and 34,711 columns.']
    ],
    antiPattern: {
      bad: 'Writing multi-table joins from memory without checking PK/FK definitions.',
      why: 'Assuming a single-column PK on a composite-key table (like R5ACTIVITIES or R5STOCK) causes silent row multiplication.'
    },
    pitfall: 'Always inspect PKs, unique constraints, and NULLability before writing production reports.',
    perf: 'Catalog queries are metadata-only and instantaneous; use them to verify indexed join paths before running heavy queries.',
    interview: ['What 3 things do you check in schema metadata before joining two EAM tables?', '1) Primary/Unique keys (to know the grain), 2) Composite org keys (*_ORG), and 3) NULLability (to decide INNER vs LEFT JOIN and COALESCE).']
  }
};

function pumpPage() {
  return H('Maintenance planning', 'From pump to preventive work order', 'Follow PUMP-001 from its asset record to a 30-day maintenance schedule. Use each linked lesson for the full procedure.')
    + '<div class="reader">'
    + pumpSteps.map(([id, title, body], i) => {
      const l = lessons.find(x => x.id === id);
      return '<section class="decision"><small>Step ' + String(i + 1).padStart(2, '0') + ' of 04</small><h2>' + E(title) + '</h2><p>' + E(body) + '</p><div class="row">' + lessonLink(l) + sourceLink(l.source.hex.id, 'HxGN guide · p. ' + l.source.hex.page) + '</div></section>';
    }).join('')
    + '</div><h2>Verify with SQL</h2><p class="muted">Use the fictional SQLite training records below. Predict each result before opening the explanation.</p>'
    + pumpQueries.map((q, i) => '<section class="section"><h3>' + E(q.title) + '</h3><pre>' + E(q.sql) + '</pre>' + A('sql/pump-' + i, 'Open in SQL lab', 'button') + '<details><summary>Explain the result</summary><p>' + E(q.result) + '</p></details></section>').join('');
}

const sqlStages = [
  { title: 'Find open work', question: 'Which orders still need attention?', grain: 'One row per open work order.', sql: 'L127', functional: 'INTRO05', exercise: 3 },
  { title: 'Connect assets and orders', question: 'Which physical asset does each order describe?', grain: 'One row per matched work order.', sql: 'L128', functional: 'INTRO03', exercise: 26 },
  { title: 'Summarize work by asset', question: 'How much work belongs to each asset?', grain: 'One row per asset in the summary. Start from equipment to include idle assets.', sql: 'L129', functional: 'INTRO07', exercise: 30 },
  { title: 'Diagnose repeated charges', question: 'Did the join count the same activity twice?', grain: 'One row per order and activity before attaching labor. Both keys matter.', sql: 'L130', functional: 'L068', exercise: 53 },
  { title: 'Read a meter trend', question: 'How much did a meter advance between readings?', grain: 'One row per reading, compared with the previous reading on the same meter.', sql: 'L134', functional: 'INTRO06', exercise: 107 }
];
function stageLinks(stage) {
  return '<div class="row">' + A('lesson/' + stage.functional, 'EAM example') + A('lesson/' + stage.sql, 'Worked SQL lesson') +
    A('sql/' + stage.sql, 'Run example') + A('exercise/' + stage.exercise, 'Practice challenge') + '</div>';
}
function sqlCourse() {
  return H('SQL learning', 'Read, explain and test a query', 'Master EAM SQL from first principles: logical execution order, relational grain, composite keys, anti-patterns, and performance. Practice in the Synthetic Lab or jump to the Restored EAM 11.6 Lab (1,681 real tables).')
    + '<div class="row footer-links">' + A('practice', 'Open SQL Exercises', 'button primary') + A('sql', 'Synthetic SQL Lab', 'button') + A('sql-real', 'Restored EAM 11.6 Lab (1,681 tables)', 'button') + A('technical', 'Technical library', 'button') + A('workshop/' + U('Database and SQL'), 'Join troubleshooting workshop', 'button') + '</div>'
    + `<section class="section"><h2>Logical SQL Execution Pipeline</h2><p class="muted">SQL is written top-to-bottom (<code>SELECT ... FROM ... WHERE ...</code>), but the engine executes it in the order below — which explains why <code>WHERE</code> cannot reference a <code>SELECT</code> alias and why <code>LEFT JOIN</code> filters in <code>WHERE</code> drop NULL rows.</p><div class="diagram"><span>1. FROM / JOIN</span><span class="diagram-arrow">${ICON_FLOW_ARROW}</span><span>2. WHERE</span><span class="diagram-arrow">${ICON_FLOW_ARROW}</span><span>3. GROUP BY</span><span class="diagram-arrow">${ICON_FLOW_ARROW}</span><span>4. HAVING</span><span class="diagram-arrow">${ICON_FLOW_ARROW}</span><span>5. SELECT</span><span class="diagram-arrow">${ICON_FLOW_ARROW}</span><span>6. WINDOW (OVER)</span><span class="diagram-arrow">${ICON_FLOW_ARROW}</span><span>7. ORDER BY / LIMIT</span></div></section>`
    + `<section class="section"><h2>EAM 11.6 Join Grain Cheat Sheet</h2>${table(['Pattern', 'When to use in EAM', 'Classic bug if done wrong'], [
      ['N:1 Lookup (INNER JOIN)', 'Work order → Equipment (EVT_OBJECT = OBJ_CODE)', 'Joining on description instead of key causes duplicates.'],
      ['1:N Summary (LEFT JOIN + COUNT(col))', 'Equipment → Work orders including idle assets', 'COUNT(*) counts NULL-padded rows as 1 instead of 0.'],
      ['Composite Key Join', 'Activity → Booked Hours (BOO_EVENT + BOO_ACT)', 'Omitting ACT multiplies hours by activity count.'],
      ['CTE Pre-Aggregation', 'Stock − Reserved Pick Lists (part + store grain)', 'Joining two 1:N tables before GROUP BY inflates stock.'],
      ['Window Partitioning', 'Meter Reading Delta (PARTITION BY REA_METER)', 'Omitting PARTITION BY subtracts across different meters.'],
    ])}</section>`
    + '<h2>Five-stage SQL learning path</h2><div class="stage-list">' + sqlStages.map((stage, idx) => '<div class="panel stage-card"><div class="eyebrow tabular">Stage ' + String(idx + 1).padStart(2, '0') + '</div><h3>' + E(stage.title) +
      '</h3><p class="mb-sm">' + E(stage.question) + '</p><p class="muted">' + E(stage.grain) + '</p>' + stageLinks(stage) + '</div>').join('') + '</div>'
    + '<div class="mt-md mb-md">' + A('exercise/30', 'Fix a query that counts an idle asset as an order', 'button') + '</div>'
    + '<h2>All SQL lessons (with grain, anti-patterns &amp; deep-dives)</h2>' + lessons.filter(l => l.type === 'technical').map(l => '<section class="list-item"><h3>' + lessonLink(l) + '</h3><p class="muted">' + E(sqlDeepDive[l.id]?.grain || sqlReading[l.id]?.[0] || l.concept) + '</p>' + (sqlDeepDive[l.id] ? `<p><small class="muted"><strong>Key pitfall:</strong> ${E(sqlDeepDive[l.id].pitfall)}</small></p>` : '') + '<div class="row">' + A('sql/' + l.id, 'Run in Synthetic Lab') + (sqlDeepDive[l.id]?.realTable ? A('sql-real/' + U(sqlDeepDive[l.id].realTable), 'Inspect ' + sqlDeepDive[l.id].realTable + ' in Real-Data Lab') : A('sql-real', 'Explore in Real-Data Lab')) + '</div></section>').join('');
}

function coveragePage(moduleName) {
  const visible = moduleName ? lessons.filter(l => l.module === moduleName) : lessons;
  return H('Curriculum', 'Curriculum coverage', 'Inspect the teaching material available for each topic. An excerpt count measures availability, not accuracy or instructional quality.')
    + '<label for="coverageModule">Choose a module</label> <select id="coverageModule"><option value="">All modules</option>' + Object.keys(groups).map(m => '<option ' + (m === moduleName ? 'selected' : '') + '>' + E(m) + '</option>').join('') + '</select>'
    + '<div class="scroll"><table><thead><tr><th>Lesson</th><th>HxGN page</th><th>Infor 11.6</th><th>Source excerpts</th><th>Teaching material</th></tr></thead><tbody>' + visible.map(l => {
      const s = l.source, ev = s.evidence, more = enrichment[String(s.hex.page)];
      const materials = [l.scenario && 'Scenario', l.verify && 'verification', more?.example?.length && 'worked example', l.sql && 'SQL exercise', quizzes.some(q => q.lesson.toLowerCase() === l.title.toLowerCase()) && 'quiz'].filter(Boolean);
      return '<tr><td>' + lessonLink(l) + '</td><td>' + sourceLink(s.hex.id, String(s.hex.page)) + '</td><td>' + (s.infor ? sourceLink(s.infor.id, String(s.infor.page)) : 'No mapped page') + '</td><td>' + ev.steps.length + ' steps · ' + ev.fields.length + ' fields</td><td>' + E(materials.join(', ')) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

function modulePage(m) {
  const ls = groups[m];
  if (!ls) return H('Not found', 'Module not found');
  const comp = ls.filter(l => done.includes(l.id)).length;
  return H('Curriculum', m, `${ls.length} lessons · written walkthroughs and source references`)
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
    const j = Math.floor(Math.random() * (i + 1));
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
  write('lastLesson', l.id);
  const recent = read('recentLessons', []);
  write('recentLessons', [l.id, ...(Array.isArray(recent) ? recent.filter(x => x !== l.id) : [])].slice(0, 5));
  logActivity();
  const activePath = read('activePath', '');
  const pathModules = roles[activePath];
  const inPath = Array.isArray(pathModules) && pathModules.includes(l.module);
  const sequence = inPath ? pathModules.flatMap(m => groups[m]) : groups[l.module];
  const i = sequence.indexOf(l), s = l.source, ev = s.evidence;
  const more = l.type === 'intro' ? {} : enrichment[String(s.hex.page)] || {};
  const related = sequence.filter(x => x.id !== id).slice(Math.max(0, i - 2), Math.max(0, i - 2) + 4);
  const lQuizzes = quizzes.filter(q => q.lesson.toLowerCase() === l.title.toLowerCase());
  const isMarked = marks.includes(id), isDone = done.includes(id);
  return `<div class="lesson-layout"><article class="lesson-content">${H(l.module, l.title, `${l.id} · ${l.level} · ${l.type === 'technical' ? 'Technical SQL lesson' : l.type === 'consulting' ? 'Consultant guidance' : 'Written functional tutorial'}`)}`
    + `<div class="lesson-toolbar"><div class="row lesson-meta"><span class="pill">${l.type === 'intro' ? 'Academy introduction' : 'HxGN primary'}</span>${s.infor ? '<span class="pill">Infor supporting</span>' : ''}</div><div class="row lesson-actions"><button type="button" id="focusLesson" aria-pressed="false">Focus mode</button><button type="button" data-present-lesson="${E(id)}">Present lesson</button><button data-mark="${id}" class="${isMarked ? 'is-active' : ''}">${isMarked ? `${ICON_BOOKMARK_FILL}<span>Bookmarked</span>` : `${ICON_BOOKMARK}<span>Bookmark</span>`}</button><button class="primary${isDone ? ' is-completed' : ''}" data-done="${id}">${isDone ? `${ICON_CHECK_CIRCLE}<span>Completed · undo</span>` : `${ICON_CHECK_CIRCLE}<span>Mark complete</span>`}</button></div></div>`
    + '<progress class="reader-progress" aria-label="Reading progress" max="100" value="0"></progress>'
    + lessonVisual(l)
    + (workshops.some(w => w.module === l.module) ? '<p class="mt-md">' + A('workshop/' + U(l.module), 'Open module workshop') + '</p>' : '')
    + sqlStages.filter(stage => [stage.sql, stage.functional].includes(id)).map(stage => '<section class="section"><h2>' + E(stage.title) + '</h2>' + stageLinks(stage) + '</section>').join('')
    + (inPath ? '<p class="muted">' + A('path/' + U(activePath), activePath) + ' · Lesson ' + (i + 1) + ' of ' + sequence.length + '</p>' : '')
    + (pumpSteps.some(([step]) => step === id) ? '<p class="note">' + A('pump', 'Case study · From pump to preventive work order') + '</p>' : '')
    + (sqlResults[id] ? '<details class="sql-output"><summary>Inspect the expected training output</summary>' + table(sqlResults[id].columns, sqlResults[id].rows) + '</details>' : '')
    + (sqlReading[id] ? '<section class="section"><h2>How to read this query</h2><div class="callout-panel"><strong>' + E(sqlReading[id][0]) + '</strong><p class="mt-sm">' + E(sqlReading[id][1]) + '</p><h3>Try a variation</h3><p class="mb-sm">' + E(sqlReading[id][2]) + '</p></div></section>' : '')
    + (sqlDeepDive[id] ? `<section class="section"><h2>Engineering deep-dive · Grain, Execution &amp; Anti-Patterns</h2><div class="panel mb-md"><p><strong>Output grain:</strong> ${E(sqlDeepDive[id].grain)}</p><p><strong>Logical execution order:</strong> <code>${E(sqlDeepDive[id].execOrder)}</code></p><p class="muted mb-sm"><strong>Performance &amp; indexing:</strong> ${E(sqlDeepDive[id].perf)}</p>${sqlDeepDive[id].realTable ? A('sql-real/' + U(sqlDeepDive[id].realTable), 'Inspect ' + sqlDeepDive[id].realTable + ' in Real-Data SQL Lab', 'button') : ''}</div><h3>Clause-by-clause breakdown</h3>${table(['SQL Clause', 'What it does & why'], sqlDeepDive[id].clauses)}<h3 class="mt-md">Column meanings in EAM 11.6</h3>${table(['Column', 'Meaning & key role'], sqlDeepDive[id].columns)}<h3 class="mt-md">Broken anti-pattern vs. production rule</h3><div class="note warn">${ICON_ALERT}<div><pre class="mb-sm">${E(sqlDeepDive[id].antiPattern.bad)}</pre><p class="mb-sm">${E(sqlDeepDive[id].antiPattern.why)}</p></div></div><details class="mt-sm"><summary>Senior engineer self-check: ${E(sqlDeepDive[id].interview[0])}</summary><p>${E(sqlDeepDive[id].interview[1])}</p></details></section>` : '')
    + `<section class="section"><h2>What you will learn</h2><p>${E(l.concept)}</p><p>By the end, you should be able to explain the business purpose, describe the steps for the scenario, and identify how to check the result.</p></section>`
    + `<section class="section"><h2>Business scenario</h2><div class="scenario">${E(l.scenario)}</div><p class="muted">Fictional PLANT01 example for learning; not a live EAM transaction.</p></section>`
    + (l.reading ? '<section class="section"><h2>Read the sources</h2><ul>' + l.reading.map(([label, url]) => '<li>' + ext(url, label) + '</li>').join('') + '</ul></section>' : '')
    + `${more.context && l.type === 'functional' ? `<section class="section"><h2>How it works</h2>${more.context.map(x => `<p>${E(x)}</p>`).join('')}${more.flow ? `<div class="diagram">${more.flow.map((v, idx) => `${idx ? `<span class="diagram-arrow" aria-hidden="true">${ICON_FLOW_ARROW}</span>` : ''}<span>${E(v)}</span>`).join('')}</div>` : ''}</section>` : ''}`
    + `<section class="section"><h2>${l.type === 'technical' ? 'Technical walkthrough' : 'Prerequisites and written walkthrough'}</h2>${l.type === 'technical' ? `<p>Use the local synthetic dataset, not a production database. ${A('sql', 'Open Synthetic SQL Lab')} · ${A('sql-real', 'Open Real-Data SQL Lab (1,681 tables)')}</p><pre>${E(l.sql)}</pre><div class="row mb-md">${A('sql/' + id, 'Open this query in Synthetic SQL lab', 'button primary')}${A('sql-real', 'Explore real EAM 11.6 tables', 'button')}</div>${l.walkthrough?.length ? `<h3>Step-by-step SQL walkthrough</h3><ol class="steps">${l.walkthrough.map(x => `<li>${E(x)}</li>`).join('')}</ol>` : ''}` : `<p>${l.type === 'intro' ? 'Follow the example in order.' : l.type === 'consulting' ? 'Agree the business scope, owners and test environment before applying the guidance.' : 'Before starting, confirm the relevant organization, authorized role, and referenced master data. Use the documented screen for your release.'}</p><ol class="steps">${l.walkthrough.map(x => `<li>${E(x)}</li>`).join('')}</ol>`}</section>`
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
  const searchText = q.trim().replace(/\bwo\b/gi, 'work order').replace(/\bpm\b/gi, 'preventive maintenance');
  const source = $('sourceFilter')?.value || '';
  const mod = $('moduleFilter')?.value || '';
  if (!offset) {
    const terms = searchText.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const names = q.trim() ? catalog.tables.filter(([name]) => name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 20) : [];
    const workshopHits = terms.length ? workshops.filter(w => (!mod || w.module === mod) && terms.every(t => [w.title, w.situation, w.module, w.role].join(' ').toLowerCase().includes(t))) : [];
    const hits = lessons.filter(l => (!mod || l.module === mod) && (!terms.length || terms.every(t => [l.title, l.module, l.concept, l.scenario, l.source.hex.title].join(' ').toLowerCase().includes(t))));
    $('lessonResults').innerHTML = (q || mod)
      ? (hits.length ? hits.slice(0, 30).map(l => `<div class="list-item">${lessonLink(l)}<p class="muted">${E(l.module)} · ${E(l.concept)}</p></div>`).join('') : '<p>No matching authored lesson. Try fewer terms or use the source results.</p>')
      : '<p>Enter a term or select a module to filter tutorials.</p>';
    if (terms.length) {
      const fields = lessons.filter(l => (!mod || l.module === mod) && l.source.evidence?.fields?.some(f =>
        terms.every(t => (f.name + ' ' + f.meaning).toLowerCase().includes(t))));
      if (fields.length) $('lessonResults').innerHTML += '<h2>Field guide</h2>' + fields.slice(0, 20).map(l => '<p>' + lessonLink(l) + '</p>').join('');
    }
    if (workshopHits.length) $('lessonResults').innerHTML += '<h2>Matching workshops</h2>' + workshopCards(workshopHits);
    if (names.length && !mod) $('lessonResults').innerHTML += '<h2>Database dictionary</h2>' + names.map(([name]) => A('table/' + U(name), name, 'taglink')).join(' ');
    if (!mod && terms.length && terms.every(t => ('pump asset preventive maintenance schedule open work orders').includes(t))) {
      $('lessonResults').innerHTML += '<h2>Guided case study</h2>' + A('pump', 'From pump to preventive work order');
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
      if (code.items.length) $('lessonResults').insertAdjacentHTML('beforeend', '<h2>SQL library</h2>' +
        code.items.slice(0, 10).map(item => '<p>' + A('code/' + item.id, item.name) + '</p>').join(''));
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
      ['sql-real', 'Restored EAM 11.6 SQL Lab (1,681 tables)', 'Read-only real-data SQL lab across 7 table families (r5, u5, udf, cor, tx, datalake, other) and 55 verified exercises.'],
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
      return `<div class="list-item"><div class="row between code-item-head"><div>${A('code/' + it.id, it.name)} <span class="pill">${E(it.kind.toUpperCase())}</span> <small class="tabular">Candidate ${E(it.candidate)} · ${it.line_count} lines</small></div><a class="button" href="#code/${E(it.id)}"><span>${['procedure', 'trigger'].includes(it.kind) ? 'Explanation and SQL' : 'View full SQL'}</span>${ICON_ARROW_RIGHT}</a></div>${tblLinks ? `<div class="mt-sm">${tblLinks}</div>` : ''}<pre class="code-excerpt">${HMark(it.excerpt)}</pre></div>`;
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
  const realLabLinks = (item.tables || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 6).map(t => A('sql-real/' + U(t), `Query ${t}`, 'taglink')).join('');
  const sibs = (item.siblings || []).length > 1
    ? `<div class="row mt-md"><small>Candidates for ${E(item.norm_name)}:</small>${item.siblings.map(sb => A('code/' + sb.id, `Candidate ${sb.candidate} (${sb.line_count}L)`, sb.id === item.id ? 'button primary' : 'button')).join('')}</div>`
    : '';
  const lineCount = item.body.split('\n').length;
  const gutter = Array.from({ length: lineCount }, (_, idx) => `<span>${idx + 1}</span>`).join('');
  return H('Recovered SQL Source', item.name, `${item.kind.toUpperCase()} · Candidate ${item.candidate} · ${item.line_count} lines${item.offset ? ` · backup byte ${item.offset}` : ''}`)
    + `<div class="note warn">${ICON_ALERT}<span>RECOVERY REFERENCE ONLY — NOT A VERIFIED OR DEPLOYABLE SCRIPT. Never run against production or training SQLite.</span></div>`
    + `<div class="row"><a class="button" href="#${backRoute}">${ICON_ARROW_LEFT}<span>${backLabel}</span></a><button type="button" id="copySqlBtn" class="primary">${ICON_COPY}<span>Copy SQL</span></button><button type="button" id="dlSqlBtn">${ICON_DOWNLOAD}<span>Download .sql</span></button></div>`
    + sibs
    + renderObjectTrace(item, E, recoveryAudit.unmatched)
    + (tblLinks ? `<div class="panel mt-md mb-md"><strong>Referenced R5 tables:</strong><div class="mt-sm">${tblLinks}</div>${realLabLinks ? `<div class="mt-sm"><small class="muted">Real-Data SQL Lab:</small> ${realLabLinks}</div>` : ''}</div>` : '')
    + `<div class="code-viewer mt-md"><div class="code-viewer-head"><span>T-SQL · ${lineCount} lines</span><span class="tabular">Candidate ${E(item.candidate)}</span></div><div class="code-viewer-body"><div class="code-gutter" aria-hidden="true">${gutter}</div><pre class="code-view" id="rawSqlCode">${E(item.body)}</pre></div></div>`;
}

function tablesPage() {
  const areas = [...new Set(catalog.tables.map(t => t[6]).filter(Boolean))].sort();
  const st = catalog.stats || {};
  return H('Technical reference', 'Database table dictionary',
    `Complete EAM 11.6 schema: ${(st.tables || catalog.tables.length).toLocaleString()} tables · ${(st.columns || 34711).toLocaleString()} columns · ${(st.fks || 2020).toLocaleString()} foreign keys · ${(st.triggers || 2382).toLocaleString()} triggers.`)
    + `<div class="panel mb-md"><div class="row"><label>Density <select id="referenceDensity"><option>Compact</option><option>Comfortable</option></select></label><input aria-label="Filter database tables" id="tableFilter" type="search" placeholder="Search table name, meaning, or PK column (e.g. R5EVENTS, Work Order, OBJ_CODE)"><select id="tableArea" class="input-narrow"><option value="">All domains (${areas.length})</option>${areas.map(a => `<option value="${E(a)}">${E(a)}</option>`).join('')}</select></div></div><div id="tableList" class="mt-md"></div>`;
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
    + `<div class="row mb-md">${A('er/' + U(t), 'Open Visual ER Diagram', 'button primary')}${A('sql-real/' + U(t), 'Open in Real-Data SQL Lab', 'button')}${A('triggers/' + U(t), 'Search Triggers for ' + t, 'button')}${A('procedures/' + U(t), 'Search Procedures for ' + t, 'button')}${A('tables', 'All Tables', 'button')}</div>`
    + (t === 'R5EVENTS' ? '<p>' + A('lesson/L127', 'Worked training example · Find open work orders') + '</p>' : '')
    + `<div id="tableFullDetail"><p class="muted">Loading full column dictionary, keys, relationships, and triggers for ${E(t)}…</p></div>`
    + `<div id="tableRealExercises"></div>`
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
      return `<tr><td class="tabular muted">${idx}</td><td><button type="button" data-inspect-col="${idx - 1}"><code>${E(c[0])}</code></button></td><td><strong>${E(c[4])}</strong></td><td><code>${E(c[1])}</code></td><td>${c[2] ? '<span class="muted">NULL</span>' : '<strong>NOT NULL</strong>'}</td><td>${badges} ${def}</td><td class="col-explain">${E(c[6])}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  };
  $('colDictTable').onclick = event => {
    const button = event.target.closest('[data-inspect-col]');
    if (button) inspectField(td, td.cols[Number(button.dataset.inspectCol)], button);
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

const NON_R5_ER_EDGES = [
  ['DATALAKE_TABLE.SCHEDULEID', 'DATALAKE_SCHEDULE.SCHEDULEID', 'Declared FK'],
  ['DATALAKE_COLUMN.TABLEID', 'DATALAKE_TABLE.TABLEID', 'Declared FK'],
  ['DATALAKE_SCHEMAUPLOAD.TABLEID', 'DATALAKE_TABLE.TABLEID', 'Declared FK'],
  ['DATALAKE_COLUMN.DATATYPE', 'DATALAKE_TYPECONVERSION.DATATYPE', 'Logical Join'],
  ['DATALAKE_TABLE.TABLEID', 'SEQ_S5DATALAKE_TABLE.SEQ_NEXTVALUE', 'Sequence Parity'],
  ['DATALAKE_COLUMN.COLUMNID', 'SEQ_S5DATALAKE_COLUMN.SEQ_NEXTVALUE', 'Sequence Parity'],
  ['DATALAKE_SCHEMAUPLOAD.TABLEID', 'SEQ_S5DATALAKE_SCHEMAUPLOAD.SEQ_NEXTVALUE', 'Sequence Parity'],
  ['DATALAKE_TABLE.NAME', 'TABLECOUNT_MSSQL.TABLE_NAME', 'Cross-Family Join'],
  ['DATALAKE_TABLE.NAME', 'R5USERTABCOLUMNS.UTC_TABLENAME', 'Cross-Family Join'],
  ['R5USERDEFINEDFIELDSETUP.UDF_RENTITY', 'R5ENTITIES.ENT_RENTITY', 'UDF-to-R5 Join'],
  ['R5USERDEFINEDFIELDDEPENDENCIES.UFD_RENTITY', 'R5ENTITIES.ENT_RENTITY', 'UDF-to-R5 Join'],
  ['R5USERDEFINEDFIELDDEPENDENCIES.UFD_PAGENAME', 'R5FUNCTIONS.FUN_CODE', 'UDF-to-R5 Join'],
  ['R5USERDEFINEDFIELDDEPENDENCIES.UFD_RENTITY', 'R5USERDEFINEDFIELDSETUP.UDF_RENTITY', 'Within-UDF Join'],
  ['R5USERDEFINEDFIELDLOVVALS.UDL_RENTITY', 'R5USERDEFINEDFIELDSETUP.UDF_RENTITY', 'Within-UDF Join'],
  ['R5UDFSCREENS.USC_ENTITY', 'R5ENTITIES.ENT_RENTITY', 'UDF-to-R5 Join'],
  ['R5UDFSCREENFIELDS.USF_SCREENNAME', 'R5UDFSCREENS.USC_SCREENNAME', 'Within-UDF Join'],
  ['TXUSERDEFINEDFIELDSETUP.UDF_RENTITY', 'R5USERDEFINEDFIELDSETUP.UDF_RENTITY', 'TX/UDF Parity'],
  ['TXUSERDEFINEDFIELDDEPENDENCIES.UFD_RENTITY', 'R5USERDEFINEDFIELDDEPENDENCIES.UFD_RENTITY', 'TX/UDF Parity'],
  ['TXENTITIES.ENT_RENTITY', 'R5ENTITIES.ENT_RENTITY', 'TX-to-R5 Join'],
  ['TXFUNCTIONS.FUN_CODE', 'R5FUNCTIONS.FUN_CODE', 'TX-to-R5 Join'],
  ['TXCLASSES.TXC_RENTITY', 'TXENTITIES.ENT_RENTITY', 'Within-TX Join'],
  ['TABLECOUNT_MSSQL.TABLE_NAME', 'R5USERTABCOLUMNS.UTC_TABLENAME', 'Other-to-R5 Join'],
  ['R5FLEXTABLES.FLT_TABLE', 'TABLECOUNT_MSSQL.TABLE_NAME', 'R5-to-Other Join'],
];

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
    NON_R5_ER_EDGES.forEach(([ch, pa]) => {
      const ct = ch.split('.')[0], pt = pa.split('.')[0];
      const col = ch.split('.')[1] || pa.split('.')[1] || '';
      if (ct === t && pt !== t && !pSet.has(pt)) pSet.set(pt, col);
      if (pt === t && ct !== t && !cSet.has(ct)) cSet.set(ct, col);
    });
    parents = [...pSet.entries()].slice(0, 10);
    children = [...cSet.entries()].slice(0, 12);
  } else {
    const pMap = new Map(parents), cMap = new Map(children);
    NON_R5_ER_EDGES.forEach(([ch, pa]) => {
      const ct = ch.split('.')[0], pt = pa.split('.')[0];
      const col = ch.split('.')[1] || pa.split('.')[1] || '';
      if (ct === t && pt !== t && !pMap.has(pt) && pMap.size < 10) pMap.set(pt, col);
      if (pt === t && ct !== t && !cMap.has(ct) && cMap.size < 12) cMap.set(ct, col);
    });
    parents = [...pMap.entries()];
    children = [...cMap.entries()];
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
  return `<div class="er-legend"><span>Parents (outbound FK: ${parents.length})</span><span>Focus Table</span><span>Children (inbound FK: ${children.length})</span></div><svg class="er-svg" viewBox="0 0 860 ${h}" width="100%" role="group" aria-label="Entity relationship diagram for ${E(t)}">${edgesSvg}${nodesSvg}</svg>`;
}

function erPage(t = 'R5EVENTS') {
  const r5Edges = extended.relations.filter(x => x.some(y => y.split('.')[0] === t)).map(([c, p]) => [c, p, 'Declared FK']);
  const nonR5Edges = NON_R5_ER_EDGES.filter(([c, p]) => c.split('.')[0] === t || p.split('.')[0] === t);
  const edges = [...r5Edges, ...nonR5Edges];
  const names = [...new Set([
    ...extended.relations.flatMap(x => x.map(y => y.split('.')[0])),
    ...NON_R5_ER_EDGES.flatMap(([c, p]) => [c.split('.')[0], p.split('.')[0]]),
    ...Object.keys(codeMeta.key_tables || {})
  ])].sort();
  if (!names.includes(t)) names.unshift(t);
  const presets = ['R5OBJECTS', 'R5EVENTS', 'R5ACTIVITIES', 'R5PARTS', 'R5STOCK', 'R5ORDERS', 'R5REQUISITIONS', 'R5PPMS', 'R5ORGANIZATION'];
  const otherPresets = ['R5USERDEFINEDFIELDSETUP', 'R5USERDEFINEDFIELDDEPENDENCIES', 'DATALAKE_TABLE', 'DATALAKE_COLUMN', 'TXENTITIES', 'TXFUNCTIONS', 'TABLECOUNT_MSSQL', 'R5FLEXTABLES'];
  const tblInfo = catalog.tables.find(x => x[0] === t);
  return H('Technical reference', 'Visual ER relationship explorer', `Explore all 2,020 declared R5 foreign keys plus verified UDF, Data Lake, TX, and Other cross-family relationships. Click any parent (left) or child (right) table node to re-center.${tblInfo?.[7] ? ' · ' + tblInfo[7] : ''}`)
    + `<div class="row"><label for="erPick">Focus table</label><select id="erPick">${names.map(n => `<option ${n === t ? 'selected' : ''}>${E(n)}</option>`).join('')}</select>${A('table/' + U(t), 'Table details', 'button')}${A('sql-real/' + U(t), 'Query in Real-Data SQL Lab', 'button')}${A('triggers/' + U(t), 'Table triggers', 'button')}</div>`
    + `<div class="row mt-md"><small>Core R5:</small>${presets.map(p => A('er/' + U(p), p, p === t ? 'chip active button' : 'chip button')).join('')}</div>`
    + `<div class="row mt-sm"><small>UDF, Data Lake, TX &amp; Other:</small>${otherPresets.map(p => A('er/' + U(p), p, p === t ? 'chip active button' : 'chip button')).join('')}</div>`
    + `<div class="row"><label>Diagram zoom <input id="erZoom" type="range" min="50" max="250" step="10" value="100"></label><button id="erFit">Fit to view</button></div><div class="er-wrap" tabindex="0" aria-label="Relationship diagram, scroll to pan">${buildErSvg(t)}</div>`
    + `<h2>${E(t)} · ${edges.length} indexed &amp; cross-family links</h2>`
    + (edges.length ? table(['Child column', 'Parent column', 'Relationship basis'], edges) : '<p class="muted">No declared FKs or documented cross-family links for this table in 116_van.bak.</p>')
    + `<p class="note">Declared FKs come from SQL Server metadata; logical/cross-family links are verified against 116_van.bak.</p>`;
}

function downloadCsv(result) {
  function cell(value) {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^(?:\s*[=+@-]|[\t\r\n])/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }
  const csv = [result.columns, ...result.rows].map(row => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'eam-query.csv'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function historyMarkup() {
  return sqlHist.length ? `<details><summary>Recent query history (${sqlHist.length})</summary>${sqlHist.map((q, idx) => `<div class="list-item"><button type="button" data-load-sql="${idx}">Load</button> <code class="ml-sm">${E(q.slice(0, 120))}</code></div>`).join('')}</details>` : '';
}
// Report identifiers were checked against the EAM 11.6 vanilla backup.
const vanillaReports = [
  {
    "id": "van-status",
    "title": "Work orders by organization and status",
    "sql": "SELECT EVT_ORG, EVT_STATUS, COUNT(*) AS work_orders\nFROM R5EVENTS\nGROUP BY EVT_ORG, EVT_STATUS\nORDER BY EVT_ORG, EVT_STATUS;",
    "verify": "Each row counts work orders sharing one organization and status."
  },
  {
    "id": "van-equipment",
    "title": "Equipment workload, including idle assets",
    "sql": "SELECT o.OBJ_ORG, o.OBJ_CODE, COUNT(e.EVT_CODE) AS work_orders\nFROM R5OBJECTS AS o\nLEFT JOIN R5EVENTS AS e ON e.EVT_OBJECT = o.OBJ_CODE\n  AND e.EVT_OBJECT_ORG = o.OBJ_ORG\nGROUP BY o.OBJ_ORG, o.OBJ_CODE\nORDER BY work_orders DESC, o.OBJ_ORG, o.OBJ_CODE;",
    "verify": "Match both equipment code and equipment organization. A zero identifies equipment with no linked work orders."
  },
  {
    "id": "van-activities",
    "title": "Work orders without activity lines",
    "sql": "SELECT e.EVT_CODE, e.EVT_STATUS\nFROM R5EVENTS AS e\nWHERE NOT EXISTS (\n  SELECT 1 FROM R5ACTIVITIES AS a WHERE a.ACT_EVENT = e.EVT_CODE\n)\nORDER BY e.EVT_CODE;",
    "verify": "Each returned work order has no matching activity. An empty result means every work order has an activity."
  }
];
function sqlExampleById(id) {
  return vanillaReports.find(report => report.id === id) || lessons.find(lesson => lesson.type === 'technical' && lesson.id === id);
}
function sqlMobileTabsHtml() {
  return `<div class="sql-mobile-tabs" role="tablist" aria-label="SQL workspace panels">`
    + `<button type="button" class="chip active" role="tab" aria-selected="true" data-sql-tab="query">Query</button>`
    + `<button type="button" class="chip" role="tab" aria-selected="false" data-sql-tab="schema">Schema</button>`
    + `<button type="button" class="chip" role="tab" aria-selected="false" data-sql-tab="results">Results</button>`
    + `</div>`;
}
const ICON_FORMAT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="21" y1="6" x2="9" y2="6"></line><line x1="21" y1="12" x2="12" y2="12"></line><line x1="21" y1="18" x2="9" y2="18"></line><polyline points="4 9 7 12 4 15"></polyline></svg>';
function setSqlMobileTab(tab) {
  const ws = document.querySelector('.sql-workspace');
  if (!ws) return;
  ws.dataset.mobileTab = tab;
  document.querySelectorAll('[data-sql-tab]').forEach(b => {
    const on = b.dataset.sqlTab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
}
function isCompactSqlLayout() {
  return window.matchMedia('(max-width: 900px)').matches;
}
function wireSqlMobileTabs() {
  if (!document.querySelector('.sql-workspace')) return;
  setSqlMobileTab('query');
  document.querySelectorAll('[data-sql-tab]').forEach(btn => {
    btn.onclick = () => setSqlMobileTab(btn.dataset.sqlTab);
  });
}
function sqlEditorMarkup(engineLabel, sqlText, hasCheck, noteHint) {
  return `<p class="mt-md mb-sm sql-query-only"><label for="sqlText">SQL statement</label></p>`
    + `<div class="editor-shell"><div class="editor-head"><span>${E(engineLabel)}</span><span class="editor-hint"><kbd>⌘↵</kbd> Run · <kbd>⌘⇧F</kbd> Format</span></div><div class="sql-lines"><pre aria-hidden="true" id="lineNums"></pre><textarea id="sqlText" wrap="off" spellcheck="false">${E(sqlText)}</textarea></div></div>`
    + `<div class="row mt-sm sql-query-only"><button id="runSQL" class="primary">${ICON_PLAY}<span>Run read-only query</span></button><button id="checkSQL" class="${hasCheck ? '' : 'is-hidden'}">${ICON_CHECK}<span>Check my output</span></button><button type="button" id="formatSQL">${ICON_FORMAT}<span>Format SQL</span></button><button id="starterSQL">Reset starter</button><button id="clearSQL">Clear</button><small>${E(noteHint)}</small></div>`
    + `<div id="sqlFormatMsg" class="mt-sm sql-query-only" aria-live="polite"></div>`;
}
function focusCompactResults() {
  if (!isCompactSqlLayout()) return;
  setSqlMobileTab('results');
  (document.querySelector('.sql-mobile-tabs') || document.querySelector('.sql-results-pane'))?.scrollIntoView({ block: 'start' });
}
function wireSqlWorkspace(curGen, { runningLabel, runQuery, formatResultMeta, onCheck }) {
  const formatBtn = $('formatSQL'), fmtMsg = $('sqlFormatMsg'), sqlEl = $('sqlText');
  const starter = sqlEl.defaultValue;
  const syncLines = () => {
    $('lineNums').textContent = sqlEl.value.split('\n').map((_,i)=>i+1).join('\n');
    $('lineNums').scrollTop = sqlEl.scrollTop;
  };
  for (const [id,value] of [['starterSQL',starter],['clearSQL','']]) $(id).onclick=()=>{
    sqlEl.value=value;sqlEl.dispatchEvent(new Event('input',{bubbles:true}));sqlEl.focus();
  };
  sqlEl.addEventListener('input',syncLines);
  sqlEl.addEventListener('scroll',()=>{$('lineNums').scrollTop=sqlEl.scrollTop;});
  queueMicrotask(()=>{if(sqlEl.isConnected)syncLines();});
  if (formatBtn && sqlEl) {
    formatBtn.onclick = () => {
      if (fmtMsg) fmtMsg.innerHTML = '';
      const eng = window.SQLFormatterEngine;
      if (!eng || typeof eng.formatSQL !== 'function') {
        if (fmtMsg) fmtMsg.innerHTML = `<div class="note warn">${ICON_ALERT} <span>Formatter unavailable offline.</span></div>`;
        return;
      }
      const res = eng.formatSQL(sqlEl.value, { dialect: 'sqlite', indent: 2, keywordCase: 'upper', commaPosition: 'trailing' });
      if (res.error) {
        if (fmtMsg) fmtMsg.innerHTML = `<div class="note warn">${ICON_ALERT} <span>${E(res.error)}</span></div>`;
        return;
      }
      if (res.formatted && res.formatted !== sqlEl.value) {
        sqlEl.value = res.formatted;
        sqlEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      formatBtn.innerHTML = `${ICON_CHECK}<span>Formatted</span>`;
      setTimeout(() => { if ($('formatSQL') === formatBtn) formatBtn.innerHTML = `${ICON_FORMAT}<span>Format SQL</span>`; }, 1400);
    };
  }
  if (sqlEl) {
    sqlEl.onkeydown = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); $('runSQL')?.click(); }
      else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); $('formatSQL')?.click(); }
    };
  }
  if ($('runSQL')) {
    $('runSQL').onclick = async () => {
      const b = $('runSQL'), q = $('sqlText').value;
      focusCompactResults();
      b.disabled = true; $('sqlResult').textContent = runningLabel; $('sqlCheckMsg').innerHTML = '';
      if (fmtMsg) fmtMsg.innerHTML = '';
      try {
        const started=performance.now();
        const v = await runQuery(q);
        if (curGen !== generation) return;
        sqlHist = [q, ...sqlHist.filter(x => x !== q)].slice(0, 10);
        write('sqlhist', sqlHist);
        $('queryHistory').innerHTML = historyMarkup();
        const extra = formatResultMeta ? formatResultMeta(v) : '';
        $('sqlResult').innerHTML = `<div class="result-head"><span class="tabular"><strong>${v.rows.length} rows</strong>${v.truncated ? ' (truncated at 200)' : ''} · ${v.columns.length} columns · ${Math.round(performance.now()-started)} ms${extra}</span><button id="saveCsv">${ICON_DOWNLOAD}<span>Export CSV</span></button><button id="saveJson">Export JSON</button><button id="copyMd">Copy Markdown</button><small id="resultState" role="status"></small></div>` + (v.rows.length?table(v.columns, v.rows):'<p>No matching rows.</p>');
        $('saveCsv').onclick = () => downloadCsv(v);
        $('saveJson').onclick=()=>{
          const url=URL.createObjectURL(new Blob([JSON.stringify({columns:v.columns,rows:v.rows},null,2)],{type:'application/json'}));
          const a=document.createElement('a');a.href=url;a.download='eam-query.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        };
        $('copyMd').onclick=async()=>{
          const row=cells=>'| '+cells.map(c=>String(c??'NULL').replaceAll('|','\\|').replaceAll('\n',' ')).join(' | ')+' |';
          try{await navigator.clipboard.writeText([row(v.columns),row(v.columns.map(()=> '---')),...v.rows.map(row)].join('\n'));$('resultState').textContent='Copied';}
          catch{$('resultState').textContent='Clipboard unavailable';}
        };
        sqlEl.oninput=()=>{if($('resultState'))$('resultState').textContent=sqlEl.value===q?'':'Showing the previous query';};
        sqlEl.oninput();
      } catch (e) {
        if (curGen === generation) $('sqlResult').textContent = 'Query rejected or failed: ' + e.message;
      } finally { b.disabled = false; }
    };
  }
  if (onCheck && $('checkSQL')) {
    $('checkSQL').onclick = async () => {
      focusCompactResults();
      await onCheck();
    };
  }
}
function sqlPage(id) {
  const l = sqlExampleById(id);
  return H('SQL practice · technical only', 'Read-only SQL lab', 'All tables and columns use exact Infor EAM 11.6 (EAM116) vanilla R5 names with synthetic training rows. Click schema columns to insert them, or use Check my output on lesson challenges.')
    + `<div class="row mb-md">${A('sql', 'Synthetic Training Lab (28 tables)', 'chip active button')}${A('sql-real', 'Restored EAM 11.6 Lab (1,681 tables · Real Backup)', 'chip button')}<span class="pill ok">Active dataset: Synthetic Training DB</span></div>`
    + sqlMobileTabsHtml()
    + `<div class="sql-workspace" data-mobile-tab="query"><div class="panel sql-main-pane"><div class="sql-toolbar"><label for="sqlExample">Choose a report or lesson query</label><select id="sqlExample"><option value="">Custom query</option><optgroup label="EAM 11.6 vanilla reports">${vanillaReports.map(x => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${E(x.title)}</option>`).join('')}</optgroup><optgroup label="Lesson queries">${lessons.filter(x => x.type === 'technical').map(x => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${E(x.title)}</option>`).join('')}</optgroup></select></div>`
    + sqlEditorMarkup('SQLite · Read-only', l?.sql || 'SELECT * FROM R5EVENTS ORDER BY EVT_CODE;', Boolean(l), 'SELECT / CTE · max 200 displayed rows')
    + `<p id="sqlExpected" class="note">${E(l?.verify || 'Select a lesson for an expected result.')}</p><div class="sql-results-pane"><div id="sqlCheckMsg"></div><div id="sqlResult"></div></div></div>`
    + '<aside class="panel sql-browser"><h2>Training schema</h2><input type="search" id="findSchema" aria-label="Filter tables and columns" placeholder="Table or column"><div id="sqlSchema">Loading schema…</div></aside></div>'
    + '<div id="queryHistory">' + historyMarkup() + '</div>'
    + `<details><summary>Training database · 28 EAM 11.6 R5 tables</summary>${table(['R5 Table', 'Entity', 'Purpose'], crosswalk)}</details>`;
}

const REAL_FAMILY_META = [
  ['r5', 'R5 Core Tables', 'Standard EAM 11.6 R5* schema tables (excluding R5 UDF config tables).'],
  ['u5', 'U5 Custom Tables', 'User-defined U5* custom tables.'],
  ['udf', 'UDF & Custom Configuration', 'Verified UDF setup, dependency, screen, LOV, and custom registry tables (including R5/TX UDF config).'],
  ['cor', 'COR Integration Tables', 'COR_* inbox/outbox/property tables.'],
  ['tx', 'TX Translation & Staging', 'TX* translation, layout, and staging tables (excluding TX UDF config).'],
  ['datalake', 'Data Lake Catalog', 'DATALAKE_* ingestion schedule, table, column, and type conversion tables.'],
  ['other', 'Other Tables', 'SEQ_* sequences, TABLECOUNT_MSSQL, DUAL, ESB_*, O7*, V$SESSION, and utility tables.'],
];

function quoteIdentIfNeeded(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : '"' + name.replaceAll('"', '""') + '"';
}

let realManifestPromise = null;
let realExercisesPromise = null;
let realTableNamesPromise = null;
function loadRealManifest() {
  return realManifestPromise || (realManifestPromise = fetch('data/manifest-index.json', { cache: 'default' }).then(r => {
    if (!r.ok) throw Error('Restored database manifest unavailable.');
    return r.json();
  }).then(m => {
    m.tables.forEach(t => {
      if (t.columns.length && Array.isArray(t.columns[0])) {
        t.columns = t.columns.map(([name, sql_type]) => ({ name, sql_type }));
      }
    });
    return m;
  }));
}
function loadRealTableNames() {
  return realTableNamesPromise || (realTableNamesPromise = fetch('data/table-names.json', { cache: 'default' }).then(r => {
    if (!r.ok) throw Error('Table index unavailable.');
    return r.json();
  }));
}
function loadRealExercises() {
  return realExercisesPromise || (realExercisesPromise = fetch('data/real-exercises.json', { cache: 'default' }).then(r => {
    if (!r.ok) throw Error('Real-data exercises unavailable.');
    return r.json();
  }));
}

function realSqlPage(selectedTable = '', selectedExerciseId = '') {
  const starter = selectedTable
    ? `SELECT * FROM ${quoteIdentIfNeeded(selectedTable)} LIMIT 25;`
    : 'SELECT ORG_CODE, ORG_DESC, ORG_CURR FROM R5ORGANIZATION ORDER BY ORG_CODE;';
  return H('Restored backup · EAM 11.6 Vanilla (116_van.bak)', 'Real-Data Read-Only SQL Lab', 'Query real exported rows from the restored Microsoft SQL Server backup (1,681 tables across 7 families). Tables are lazy-loaded into read-only SQLite on demand; cross-family joins are supported.')
    + `<div class="row mb-md">${A('sql', 'Synthetic Training Lab (28 tables)', 'chip button')}${A('sql-real', 'Restored EAM 11.6 Lab (1,681 tables · Real Backup)', 'chip active button')}<span class="pill ok">Active dataset: Restored 116_van.bak</span></div>`
    + `<div id="realBackupSummary" class="panel mb-md"><p class="muted">Loading backup manifest and family inventory…</p></div>`
    + sqlMobileTabsHtml()
    + `<div class="sql-workspace" data-mobile-tab="query"><div class="panel sql-main-pane"><div class="sql-toolbar"><label for="realSqlExample">Choose a real-data exercise (55 across 5 populated families)</label><select id="realSqlExample"><option value="">Custom query</option></select></div>`
    + sqlEditorMarkup('SQLite · Read-only · Real Backup Exports', starter, Boolean(selectedExerciseId), 'One SELECT / WITH · max 200 displayed rows · 10s timeout')
    + `<p id="sqlExpected" class="note">${selectedTable ? `Selected table: ${E(selectedTable)}. Click Run or choose an exercise.` : 'Select an exercise or write any read-only SELECT / WITH query.'}</p><div class="sql-results-pane"><div id="sqlCheckMsg"></div><div id="sqlResult"></div></div></div>`
    + `<aside class="panel sql-browser"><h2>Restored Schema (7 Families)</h2><div class="row mb-sm"><input id="realSchemaSearch" type="search" placeholder="Search tables or columns…"></div><label class="row mb-sm"><input type="checkbox" id="realPopulatedOnly"> <small>Populated tables only</small></label><div id="sqlSchema">Loading 1,681 tables…</div></aside></div>`
    + '<div id="queryHistory">' + historyMarkup() + '</div>';
}

function progressPage() {
  const profile = window.EAMProfiles?.getActiveProfile();
  const valid = lessons.filter(l => done.includes(l.id));
  const qTot = Object.keys(quizState).length;
  const qOk = Object.values(quizState).filter(Boolean).length;
  const solved = read('practiceSolved', []);
  const realSolved = read('realSolved', []);
  const drafts = read('practiceDrafts', {});
  const draftIds = Object.keys(drafts).filter(id => drafts[id]?.trim());
  const recentIds = read('recentLessons', []);
  const recentItems = (Array.isArray(recentIds) ? recentIds : []).map(id => lessons.find(l => l.id === id)).filter(Boolean).slice(0, 5);
  const task = nextLearningTask();
  const nextTitle = task.label, nextHref = resumeLink(task);
  const nextCta = task.route === 'sql-real' ? 'Continue in Real-Data SQL Lab'
    : task.route === 'sql' ? 'Continue in SQL Lab'
      : task.route === 'exercise' ? 'Continue SQL exercise'
        : (/^Continue/i.test(nextTitle) ? 'Continue lesson' : 'Start lesson');

  return H('Personal learning', profile ? `${profile.name}'s Learning` : 'Your learning progress', `${window.EAMProfiles ? window.EAMProfiles.getSyncStatus() : 'Local storage'} · Progress, bookmarks, notes, and saved SQL exercises.`)
    + `<section class="panel mb-md"><div class="dashboard-head"><div><div class="eyebrow">Next step</div><h2>${E(nextTitle)}</h2><div class="row mt-sm">${A(nextHref, nextCta, 'button primary')}</div></div>${progressRing(valid.length, lessons.length)}</div></section>`
    + `<div class="grid mb-md">`
    + `<section class="panel"><h3>Recently visited lessons</h3>${recentItems.length ? recentItems.map(l => `<div class="list-item">${lessonLink(l)}</div>`).join('') : '<p class="muted">No lessons visited yet.</p>'}</section>`
    + `<section class="panel"><h3>Saved SQL exercises (${solved.length}/110 synthetic · ${realSolved.length}/55 real)</h3><p class="muted">${draftIds.length} in-progress draft(s)</p>${draftIds.length ? `<div class="row">${draftIds.slice(0, 8).map(id => A('exercise/' + id, 'Exercise #' + id, 'taglink')).join('')}</div>` : '<p class="muted">No saved drafts yet.</p>'}<div class="row mt-sm">${A('practice', 'Browse 110 SQL exercises', 'button')}${A('sql-real', 'Real-Data SQL Lab (55)', 'button')}</div></section>`
    + `</div>`
    + `<h2>Bookmarks (${marks.length})</h2>${lessons.filter(l => marks.includes(l.id)).map(l => `<div class="list-item">${lessonLink(l)}</div>`).join('') || '<p class="muted">No bookmarks yet.</p>'}`
    + `<h2>Revision notes</h2>${lessons.filter(l => notes[l.id]).map(l => `<div class="list-item">${lessonLink(l)}<p>${E(notes[l.id])}</p></div>`).join('') || '<p class="muted">No notes yet.</p>'}`
    + `<div class="metrics mt-lg">${metric(valid.length + '/' + lessons.length, 'Completed')}${metric(marks.length, 'Bookmarked')}${metric(Object.keys(notes).filter(k => notes[k]).length, 'Notes')}${metric(qTot ? `${qOk}/${qTot}` : '0', 'Quiz score')}</div>`
    + `<details class="mt-md"><summary>Module progress (${Object.keys(groups).length} modules)</summary>${Object.entries(groups).map(([m, ls]) => `<div class="list-item"><div class="row between">${A('module/' + U(m), m)}<small>${ls.filter(l => done.includes(l.id)).length}/${ls.length}</small></div>${progress(ls.filter(l => done.includes(l.id)).length, ls.length)}</div>`).join('')}</details>`
    + `<div class="row mt-lg"><button id="exportProgress" class="primary">Export progress JSON</button><label class="button" for="importFile">Import progress JSON</label><input id="importFile" type="file" accept=".json,application/json" ><button id="resetProgress">Reset local progress</button></div><div id="importMsg" class="mt-sm"></div>`;
}

function assess() {
  return H('Assessments & Quizzes', 'Interactive quizzes & scenario checks', 'Test your understanding with module multiple-choice quizzes, then review written scenario explanations.')
    + `<div class="row"><label for="assessPick">Module</label><select id="assessPick">${Object.keys(groups).map(m => `<option>${E(m)}</option>`).join('')}</select><label><input id="missedOnly" type="checkbox" ${read('missedOnly', false) ? 'checked' : ''}> Review missed questions</label></div><div id="quizScore" class="score-strip" aria-live="polite"></div><div id="assessList"></div>`;
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
  stopTrackingTask();
  const current = ++generation;
  const hash = location.hash.slice(1) || document.body.dataset.initialRoute || 'home';
  const pos = hash.indexOf('/');
  const r = pos < 0 ? hash : hash.slice(0, pos);
  let id = '';
  try { id = pos < 0 ? '' : decodeURIComponent(hash.slice(pos + 1)); } catch { }
  renderProfileMenu();
  if (window.EAMProfiles && (!window.EAMProfiles.getActiveProfileId() || r === 'profiles')) {
    document.body.dataset.view = 'profiles';
    renderNav('home', '');
    const main = $('main');
    main.innerHTML = profileWelcomeScreen();
    main.querySelector('[data-appearance]').value=document.querySelector('[data-appearance]').value;
    const active = window.EAMProfiles.getActiveProfileId();
    const selected = [...main.querySelectorAll('[data-select-profile]')].find(btn => btn.dataset.selectProfile === active);
    (selected || main.querySelector('[data-select-profile]'))?.focus({preventScroll:true});
    main.querySelectorAll('[data-select-profile]').forEach(btn => {
      btn.onclick = async () => {
        const pid = btn.dataset.selectProfile;
        window.EAMProfiles.setActiveProfileId(pid);
        reloadProfileState();
        renderProfileMenu();
        window.EAMProfiles.pullFromSupabase(pid, () => { reloadProfileState(); renderProfileMenu(); route(); });
        if (r === 'profiles') location.hash = 'home';
        else route();
      };
    });
    return;
  }
  document.body.dataset.view = r;
  renderNav(r, id);
  const main = $('main');
  try {
    switch (r) {
      case 'home': main.innerHTML = fieldHome(); break;
      case 'workshops': case 'workshop': main.innerHTML = workshopPage(id); break;
      case 'pump': main.innerHTML = pumpPage(); break;
      case 'practice': case 'exercise': await showPractice(r, id, current); break;
      case 'sql-course': main.innerHTML = sqlCourse(); break;
      case 'coverage':
        main.innerHTML = coveragePage(id);
        $('coverageModule').onchange = e => { location.hash = 'coverage/' + U(e.target.value); };
        break;
      case 'learn':
        main.innerHTML = H('Curriculum', 'Tutorials', `${lessons.length} written lessons across ${Object.keys(groups).length} modules.`)
          + '<div class="row footer-links">' + A('lesson/INTRO01', 'Start here · What is EAM?', 'button primary') + A('paths', 'Learning paths', 'button') + A('assess', 'Assessments', 'button') + A('coverage', 'Lesson coverage', 'button') + '</div>'
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
        main.innerHTML = H('Technical Library', 'Training-to-R5 crosswalk', 'Approximate mappings between the synthetic training database, core R5 tables, U5 custom conventions, and the 7 restored EAM 11.6 table families.')
          + `<h2>Core R5 Training Tables (28 tables)</h2>`
          + table(['R5 Table', 'Entity', 'Purpose'], crosswalk)
          + `<h2 class="mt-lg">U5 Custom Tables, UDFs &amp; Non-R5 Families (Verified against 116_van.bak)</h2>`
          + `<p class="muted">Infor/HxGN EAM sites create custom <code>U5*</code> tables via User Defined Screens; the vanilla <code>116_van.bak</code> backup contains <strong>0 <code>U5*</code> tables</strong> and stores UDF/extensibility metadata in the <code>udf</code>, <code>r5</code>, <code>datalake</code>, and <code>other</code> families below.</p>`
          + table(['Table / Prefix', 'Family &amp; Backup Count', 'Role &amp; Join Path'], u5AndFamilyCrosswalk)
          + `<div class="row mt-md">${A('sql', 'Open Synthetic SQL Lab', 'button')}${A('sql-real', 'Open Real-Data SQL Lab (1,681 tables)', 'button primary')}${A('er/R5USERDEFINEDFIELDSETUP', 'Explore UDF ER Diagram', 'button')}</div>`;
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
          } catch { }
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
        }).catch(() => { });
        loadRealExercises().then(data => {
          if (current !== generation || !$('tableRealExercises')) return;
          const hits = (data.exercises || []).filter(ex => ex.tables.some(tbl => tbl.toUpperCase() === id.toUpperCase()));
          if (!hits.length) return;
          $('tableRealExercises').innerHTML = `<div class="panel mb-md"><strong>Real-Data SQL Lab Exercises for ${E(id)} (${hits.length}):</strong><div class="row mt-sm">${hits.map(ex => A('sql-real/ex/' + U(ex.id), `${ex.title} (${ex.difficulty})`, 'taglink')).join('')}</div></div>`;
        }).catch(() => { });
        break;
      case 'er': {
        main.innerHTML = erPage(id || 'R5EVENTS');
        const viewport=main.querySelector('.er-wrap'), drawing=viewport.querySelector('svg');
        const scale=()=>{drawing.style.width=$('erZoom').value+'%';drawing.style.maxWidth='none';drawing.style.minWidth='0';};
        $('erZoom').oninput=scale;
        $('erFit').onclick=()=>{$('erZoom').value=100;scale();viewport.scrollTo(0,0);};
        let drag;
        viewport.onpointerdown=e=>{if(e.button!==0||e.target.closest('[data-er-node]'))return;drag=[e.clientX,e.clientY,viewport.scrollLeft,viewport.scrollTop];viewport.setPointerCapture(e.pointerId);};
        viewport.onpointermove=e=>{if(drag)viewport.scrollTo(drag[2]+drag[0]-e.clientX,drag[3]+drag[1]-e.clientY);};
        viewport.onlostpointercapture=()=>{drag=null;};
        $('erPick').onchange = e => { location.hash = 'er/' + U(e.target.value); };
        loadRealTableNames().then(rows => {
          if (current !== generation || !$('erPick')) return;
          const cur = id || 'R5EVENTS';
          const existing = new Set([...$('erPick').options].map(o => o.value));
          const extra = rows.filter(([tbl]) => !existing.has(tbl)).map(([tbl, fam]) => `<option value="${E(tbl)}" ${tbl === cur ? 'selected' : ''}>${E(tbl)} [${E(fam)}]</option>`).join('');
          if (extra) $('erPick').insertAdjacentHTML('beforeend', extra);
        }).catch(() => { });
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
        wireTrace(id);
        wireSqlMobileTabs();
        const exercise = /^pump-([0-3])$/.exec(id);
        if (exercise) {
          const q = pumpQueries[Number(exercise[1])];
          $('sqlText').value = q.sql;
          $('sqlExpected').textContent = q.result;
          $('sqlResult').after(document.createRange().createContextualFragment(A('pump', 'Return to the pump case study')));
        }
        $('sqlExample').onchange = e => {
          location.hash = e.target.value ? 'sql/' + U(e.target.value) : 'sql';
        };
        $('queryHistory').onclick = e => {
          const button = e.target.closest('[data-load-sql]');
          if (button) $('sqlText').value = sqlHist[Number(button.dataset.loadSql)];
        };
        wireSqlWorkspace(current, {
          runningLabel: 'Running…',
          runQuery: q => api('/api/sql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: q }) }),
          onCheck: async () => {
            const l = sqlExampleById($('sqlExample').value);
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
          },
        });
        api('/api/schema').then(v => {
          if (current !== generation) return;
          $('sqlSchema').innerHTML = v.tables.map(t => {
            const pk = t.columns.filter(c => c.pk).sort((a, b) => a.pk - b.pk).map(c => c.name);
            const purpose = crosswalk.find(row => row[0] === t.name)?.[2] || '';
            return '<details><summary><span>' + E(t.name) + '</span><small class="tabular">' + t.columns.length + ' cols</small></summary><p>' + E(purpose) + '</p><p>' +
              (pk.length ? 'One row per unique ' + E(pk.join(' + ')) + '.' : 'No declared primary key.') + '</p>' +
              t.links.map(link => '<p>' + E(link) + '</p>').join('') +
              '<div class="schema-cols">' +
              t.columns.map(c => '<button class="schema-col" data-ins="' + E(c.name) + '">' + E(c.name) + ' <small>' + E(c.type) + '</small></button>').join('') +
              '</div><div class="row schema-actions mt-sm"><button data-ins="' + E(t.name) + '">Insert table</button><button data-preview="' + E(t.name) + '">Show 5 sample rows</button></div><div data-sample-out aria-live="polite"></div></details>';
          }).join('');
          $('findSchema').oninput=()=>{const q=$('findSchema').value.trim().toLowerCase();for(const row of $('sqlSchema').children)row.hidden=!row.textContent.toLowerCase().includes(q);};
          $('sqlSchema').querySelectorAll('[data-preview]').forEach(button => {
            button.onclick = async () => {
              const output = button.closest('details').querySelector('[data-sample-out]');
              button.disabled = true;
              try {
                const name = button.dataset.preview;
                if (!v.tables.some(t => t.name === name)) return;
                const sample = await runTrainingQuery('SELECT * FROM "' + name.replaceAll('"', '""') + '" LIMIT 5');
                output.innerHTML = table(sample.columns, sample.rows);
              } catch (error) { output.textContent = error.message; }
              finally { button.disabled = false; }
            };
          });
          $('sqlSchema').querySelectorAll('[data-ins]').forEach(el => {
            el.onclick = ev => {
              ev.preventDefault(); ev.stopPropagation();
              const ta = $('sqlText'), val = el.dataset.ins, st = ta.selectionStart ?? ta.value.length, en = ta.selectionEnd ?? ta.value.length;
              ta.value = ta.value.slice(0, st) + val + ta.value.slice(en);
              ta.dispatchEvent(new Event('input',{bubbles:true})); ta.focus(); ta.setSelectionRange(st + val.length, st + val.length);
              el.classList.add('is-inserted');
              setTimeout(() => { if (el.isConnected) el.classList.remove('is-inserted'); }, 900);
            };
          });
        }).catch(e => { if (current === generation) $('sqlSchema').textContent = e.message; });
        break;
      }
      case 'sql-real': {
        const isEx = id.startsWith('ex/');
        const selectedExId = isEx ? id.slice(3) : '';
        const selectedTable = !isEx && id ? id : '';
        main.innerHTML = realSqlPage(selectedTable, selectedExId);
        wireSqlMobileTabs();
        let realManifest = null;
        let realExercises = [];

        const insertToken = val => {
          const ta = $('sqlText'), st = ta.selectionStart ?? ta.value.length, en = ta.selectionEnd ?? ta.value.length;
          ta.value = ta.value.slice(0, st) + val + ta.value.slice(en);
          ta.dispatchEvent(new Event('input',{bubbles:true})); ta.focus(); ta.setSelectionRange(st + val.length, st + val.length);
        };

        const renderFamilyBrowser = (q = '', popOnly = false) => {
          if (!realManifest) return;
          const ql = q.trim().toLowerCase();
          const selUpper = selectedTable.toUpperCase();
          $('sqlSchema').innerHTML = REAL_FAMILY_META.map(([fam, label, desc]) => {
            const ft = realManifest.family_totals[fam] || { tables: 0, populated_tables: 0, source_rows: 0, exported_rows: 0, truncated_tables: 0 };
            const allFam = realManifest.tables.filter(t => t.family === fam);
            const matches = allFam.filter(t => {
              if (popOnly && t.exported_rows === 0) return false;
              if (!ql) return true;
              return t.table.toLowerCase().includes(ql) || t.columns.some(c => c.name.toLowerCase().includes(ql));
            });
            const openFam = (selUpper && matches.some(t => t.table.toUpperCase() === selUpper)) || (ql && matches.length > 0) || fam === 'datalake' || fam === 'udf';
            let bodyHtml = '';
            if (ft.tables === 0) {
              bodyHtml = `<p class="muted">Empty family: 0 tables in 116_van.bak (vanilla EAM 11.6 has no ${E(fam.toUpperCase())}* tables).</p>`;
            } else if (ft.populated_tables === 0 && !ql && !popOnly) {
              bodyHtml = `<p class="muted">${ft.tables} tables, all 0 rows in 116_van.bak.</p>` + allFam.slice(0, 20).map(t => `<div class="list-item"><code>${E(t.full_name)}</code> <small class="muted">0 rows · ${t.columns.length} cols</small></div>`).join('');
            } else if (!matches.length) {
              bodyHtml = `<p class="muted">No matching tables in ${E(fam)}.</p>`;
            } else {
              const shown = matches.slice(0, 80);
              bodyHtml = (matches.length > shown.length ? `<p class="muted">Showing first ${shown.length} of ${matches.length} matching tables. Refine search to narrow.</p>` : '')
                + shown.map(t => {
                  const isSel = selUpper && t.table.toUpperCase() === selUpper;
                  const capBadge = t.truncated ? `<span class="pill warn">Capped: ${t.exported_rows.toLocaleString()} of ${t.source_rows.toLocaleString()}</span>` : `<small class="tabular muted">${t.source_rows.toLocaleString()} rows</small>`;
                  return `<details ${isSel ? 'open' : ''}><summary><span>${E(t.table)}</span>${capBadge}</summary>`
                    + `<p class="muted"><small>${E(t.full_name)} · ${E(t.ordering)} · ${t.exported_rows.toLocaleString()} exported / ${t.source_rows.toLocaleString()} source</small></p>`
                    + (t.truncated ? `<div class="note warn">Export capped at 5,000 rows (${t.source_rows.toLocaleString()} total in source backup).</div>` : '')
                    + `<div class="schema-cols">${t.columns.map(c => `<button type="button" class="schema-col" data-ins="${E(quoteIdentIfNeeded(c.name))}">${E(c.name)} <small>${E(c.sql_type)}</small></button>`).join('')}</div>`
                    + `<div class="row schema-actions mt-sm"><button type="button" data-ins="${E(quoteIdentIfNeeded(t.table))}">Insert table</button><button type="button" data-preview="${E(t.table)}">Show 5 sample rows</button></div><div data-sample-out aria-live="polite"></div></details>`;
                }).join('');
            }
            return `<details class="mb-sm" ${openFam ? 'open' : ''}><summary><strong>${E(fam.toUpperCase())}</strong> · ${E(label)} <small class="tabular muted">${ft.tables} tbls · ${ft.populated_tables} pop · ${ft.source_rows.toLocaleString()} src</small></summary><p class="muted"><small>${E(desc)}</small></p>${bodyHtml}</details>`;
          }).join('');

          $('sqlSchema').querySelectorAll('[data-ins]').forEach(el => {
            el.onclick = ev => {
              ev.preventDefault(); ev.stopPropagation();
              insertToken(el.dataset.ins);
              el.classList.add('is-inserted');
              setTimeout(() => { if (el.isConnected) el.classList.remove('is-inserted'); }, 900);
            };
          });
          $('findSchema').oninput=()=>{const q=$('findSchema').value.trim().toLowerCase();for(const row of $('sqlSchema').children)row.hidden=!row.textContent.toLowerCase().includes(q);};
          $('sqlSchema').querySelectorAll('[data-preview]').forEach(btn => {
            btn.onclick = async () => {
              const out = btn.closest('details').querySelector('[data-sample-out]');
              btn.disabled = true;
              try {
                const tname = btn.dataset.preview;
                const sample = await runTrainingQuery(`SELECT * FROM ${quoteIdentIfNeeded(tname)} LIMIT 5`, 'real', realManifest.tables);
                out.innerHTML = sample.rows.length ? table(sample.columns, sample.rows) : '<p class="muted">0 rows (empty table in 116_van.bak).</p>';
              } catch (err) { out.textContent = err.message; }
              finally { btn.disabled = false; }
            };
          });
        };

        let renderRealOptions = () => {};
        Promise.all([loadRealManifest(), loadRealExercises()]).then(([manifest, exData]) => {
          if (current !== generation) return;
          realManifest = manifest;
          realExercises = exData.exercises || [];
          const tot = manifest.totals;
          $('realBackupSummary').innerHTML = `<div class="row between"><div><strong>Backup:</strong> <code>${E(manifest.backup.file)}</code> · <code>${E(manifest.backup.sha256.slice(0, 16))}…</code> · <strong>${tot.tables.toLocaleString()}</strong> tables (${tot.populated_tables} populated) · <strong>${tot.source_rows.toLocaleString()}</strong> source rows · <strong>${tot.exported_rows.toLocaleString()}</strong> exported (${tot.truncated_tables} capped at 5,000)</div></div>`
            + `<p class="muted mt-sm mb-sm"><small><strong>Verified findings:</strong> ${E(exData.findings.u5_family)} ${E(exData.findings.cor_family)}</small></p>`;

          const byFam = {};
          for (const ex of realExercises) (byFam[ex.family] ||= []).push(ex);
          const sel = $('realSqlExample');
          renderRealOptions = () => {
            const cur = sel.value || selectedExId;
            const solvedRealSet = new Set(read('realSolved', []));
            sel.innerHTML = '<option value="">Custom query</option>' + Object.entries(byFam).map(([fam, list]) =>
              `<optgroup label="${E(fam.toUpperCase())} (${list.length} exercises)">${list.map(x => `<option value="${E(x.id)}" ${x.id === cur ? 'selected' : ''}>${solvedRealSet.has(x.id) ? '✓ ' : ''}[${E(x.difficulty)}] ${E(x.title)}</option>`).join('')}</optgroup>`
            ).join('');
          };
          renderRealOptions();

          if (selectedExId) {
            const ex = realExercises.find(x => x.id === selectedExId);
            if (ex) {
              $('sqlText').value = read('workspaceDrafts', {})['sql-real/' + id] ?? ex.sql;
              $('sqlExpected').textContent = `${ex.prompt} — ${ex.verify}`;
              $('checkSQL').classList.remove('is-hidden');
            }
          }
          renderFamilyBrowser($('realSchemaSearch').value, $('realPopulatedOnly').checked);
        }).catch(err => {
          if (current === generation && $('realBackupSummary')) $('realBackupSummary').innerHTML = `<div class="note warn">${E(err.message)}</div>`;
        });

        $('realSchemaSearch').oninput = () => renderFamilyBrowser($('realSchemaSearch').value, $('realPopulatedOnly').checked);
        $('realPopulatedOnly').onchange = () => renderFamilyBrowser($('realSchemaSearch').value, $('realPopulatedOnly').checked);
        $('realSqlExample').onchange = e => {
          location.hash = e.target.value ? 'sql-real/ex/' + U(e.target.value) : 'sql-real';
        };
        $('queryHistory').onclick = e => {
          const button = e.target.closest('[data-load-sql]');
          if (button) $('sqlText').value = sqlHist[Number(button.dataset.loadSql)];
        };
        wireSqlWorkspace(current, {
          runningLabel: 'Loading referenced tables and running read-only query…',
          runQuery: q => runTrainingQuery(q, 'real', realManifest ? realManifest.tables : null),
          formatResultMeta: v => (v.loadedTables?.length ? ` · loaded: ${E(v.loadedTables.join(', '))}` : ''),
          onCheck: async () => {
            const ex = realExercises.find(x => x.id === $('realSqlExample').value);
            if (!ex) return;
            const msg = $('sqlCheckMsg');
            msg.innerHTML = '<p class="muted">Comparing output against reference query…</p>';
            try {
              const tbls = realManifest ? realManifest.tables : null;
              const [got, exp] = await Promise.all([
                runTrainingQuery($('sqlText').value, 'real', tbls),
                runTrainingQuery(ex.sql, 'real', tbls),
              ]);
              const norm = r => JSON.stringify(ex.ordered ? r.rows : [...r.rows].sort());
              const ok = !got.truncated && !exp.truncated && got.columns.length === exp.columns.length && norm(got) === norm(exp);
              if (ok) {
                const nextRealSolved = [...new Set([...read('realSolved', []), ex.id])];
                write('realSolved', nextRealSolved);
                renderRealOptions();
              }
              msg.innerHTML = ok
                ? `<div class="note ok">${ICON_CHECK} <span>Output matches expected result (${exp.rows.length} rows, ${exp.columns.length} columns). Saved to your progress.</span></div>`
                : `<div class="note warn">${ICON_ALERT} <span>Result differs: got ${got.rows.length} rows × ${got.columns.length} cols, expected ${exp.rows.length} rows × ${exp.columns.length} cols. Check joins, filters, or ORDER BY.</span></div>`;
            } catch (e) { msg.innerHTML = `<div class="note warn">Check failed: ${E(e.message)}</div>`; }
          },
        });
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
          const a = document.createElement('a'), url = URL.createObjectURL(new Blob([JSON.stringify({ resumeTask: read('resumeTask', null), workspaceDrafts: read('workspaceDrafts', {}), readingPositions: read('readingPositions', {}), activity: read('activity', []), lastLesson: read('lastLesson', ''), activePath: read('activePath', ''), sqlHist, done, marks, notes, quiz: quizState, practiceSolved: read('practiceSolved', []), realSolved: read('realSolved', []), practiceDrafts: read('practiceDrafts', {}) }, null, 2)], { type: 'application/json' }));
          a.href = url; a.download = 'eam-learning-progress.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
        $('importFile').onchange = async e => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const d = JSON.parse(await f.text());
            if (d.resumeTask && ['sql','sql-real','exercise','lesson'].includes(d.resumeTask.route) &&
                typeof d.resumeTask.id === 'string' && typeof d.resumeTask.label === 'string') write('resumeTask', d.resumeTask);
            if (d.workspaceDrafts && typeof d.workspaceDrafts === 'object') write('workspaceDrafts',
              Object.fromEntries(Object.entries(d.workspaceDrafts).filter(([key, sql]) => /^sql(?:-real)?\//.test(key) && typeof sql === 'string' && sql.length <= 20000)));
            if (d.readingPositions && typeof d.readingPositions === 'object') write('readingPositions',
              Object.fromEntries(Object.entries(d.readingPositions).filter(([key, pos]) => key.startsWith('lesson/') && Number.isFinite(pos) && pos >= 0)));
            if (Array.isArray(d.activity)) write('activity', d.activity.filter(v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)));
            for (const key of ['lastLesson', 'activePath']) if (typeof d[key] === 'string') write(key, d[key]);
            if (Array.isArray(d.sqlHist)) { sqlHist = d.sqlHist.filter(v => typeof v === 'string').slice(0, 10); write('sqlhist', sqlHist); }
            if (Array.isArray(d.practiceSolved)) write('practiceSolved', [...new Set(d.practiceSolved.filter(id => Number.isInteger(id) && id >= 1))]);
            if (Array.isArray(d.realSolved)) write('realSolved', [...new Set(d.realSolved.filter(id => typeof id === 'string' && id.trim() && id.length <= 64))]);
            if (d.practiceDrafts && typeof d.practiceDrafts === 'object') write('practiceDrafts', Object.fromEntries(Object.entries(d.practiceDrafts).filter(([id, sql]) => Number.isInteger(+id) && +id >= 1 && typeof sql === 'string' && sql.length <= 20000)));
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
          write('practiceSolved', []); write('realSolved', []); write('practiceDrafts', {}); write('lastExercise', 0); write('resumeTask', null); write('workspaceDrafts', {}); write('readingPositions', {}); write('dbBookmarks', []); write('dbLast', null); write('activePath', ''); write('lastLesson', '');
          write('done', done); write('marks', marks); write('notes', notes); write('quiz', quizState);
          route();
        };
        break;
      default:
        main.innerHTML = H('Not found', 'This page is no longer available', 'Functional simulator and old competition sections were removed.') + A('home', 'Return home', 'button');
    }
    if (current === generation) {
      if (r === 'module' && workshops.some(w => w.module === id)) main.insertAdjacentHTML('afterbegin', '<p class="workshop-link">' + A('workshop/' + U(id), 'Open the module workshop') + '</p>');
      enhanceCodeBlocks(main);
      main.classList.remove('view-enter');
      void main.offsetWidth;
      main.classList.add('view-enter');
      const ref = $('refSearch');
      if (ref) ref.onsubmit = e => { e.preventDefault(); location.hash = 'search/' + U($('refQ').value); };
      document.title = (main.querySelector('h1')?.textContent || 'Learning') + ' · EAM Academy';
      window.scrollTo({top:0, behavior:'instant'});
      document.body.classList.remove('reader-focus');
      if(r==='lesson' && $('focusLesson')){
        const article=main.querySelector('article');
        const estimate=document.createElement('small');
        estimate.textContent=Math.max(1,Math.ceil(article.innerText.trim().split(/\s+/).length/220))+' min read';
        main.querySelector('.lesson-meta').append(estimate);
        $('focusLesson').onclick=e=>{const on=document.body.classList.toggle('reader-focus');e.currentTarget.setAttribute('aria-pressed',String(on));};
        updateReadingProgress();
      }
      document.body.classList.toggle('nav-folded',read('navFolded',false));
      if($('referenceDensity')){
        const picker=$('referenceDensity');picker.value=read('referenceDensity','Compact');
        const applyDensity=()=>{main.dataset.density=picker.value;write('referenceDensity',picker.value);};applyDensity();picker.onchange=applyDensity;
      }else delete main.dataset.density;
      trackTask(r, id);
      setDrawer(false);
      setMobileNav(false);
    }
  } catch (e) {
    if (current === generation) main.innerHTML = `<p class="warning">${E(e.message)}</p>`;
  }
}

$('main').addEventListener('click', e => {
  const pathStart = e.target.closest('[data-start-path]');
  if (pathStart) write('activePath', pathStart.dataset.startPath);
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
  openTaskSearch($('quickInput').value);
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
function closeNavDropdowns(returnFocus = false) {
  let originBtn = null;
  document.querySelectorAll('.nav-dropdown:not([hidden])').forEach(d => {
    originBtn = originBtn || d.closest('.nav-group')?.querySelector('.nav-group-btn');
    d.setAttribute('hidden', '');
  });
  document.querySelectorAll('.nav-group-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
  if (returnFocus && originBtn) originBtn.focus();
}
function closeProfileMenu(returnFocus = false) {
  const drop = $('profileDropdown'), btn = $('profileMenuBtn');
  if (drop && !drop.hasAttribute('hidden')) {
    drop.setAttribute('hidden', '');
    btn?.setAttribute('aria-expanded', 'false');
    if (returnFocus) btn?.focus();
    return true;
  }
  return false;
}
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault(); openTaskSearch(); return;
  }
  if (e.key === 'Escape') {
    if (closeProfileMenu(true)) return;
    if (document.querySelector('.nav-dropdown:not([hidden])')) { closeNavDropdowns(true); return; }
    if ($('topnav')?.classList.contains('is-open')) { setMobileNav(false); $('mobileNavBtn')?.focus(); return; }
    if ($('side').classList.contains('open')) { setDrawer(false); $('menu').focus(); return; }
  }
  if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    e.preventDefault(); openTaskSearch();
  }
});
$('menu').onclick = () => {
  if(!matchMedia('(min-width:1100px)').matches){setDrawer(!$('side').classList.contains('open'));return;}
  const folded=document.body.classList.toggle('nav-folded');write('navFolded',folded);$('menu').setAttribute('aria-expanded',String(!folded));
};
$('sideBackdrop')?.addEventListener('click', () => setDrawer(false));
$('mobileNavBtn')?.addEventListener('click', () => setMobileNav(!$('topnav')?.classList.contains('is-open')));
$('mobileMoreBtn')?.addEventListener('click', () => setMobileNav(!$('topnav')?.classList.contains('is-open')));
$('mobileNavBackdrop')?.addEventListener('click', () => setMobileNav(false));
$('topnav')?.addEventListener('click', e => {
  const gbtn = e.target.closest('.nav-group-btn');
  if (gbtn) {
    e.stopPropagation();
    const group = gbtn.closest('.nav-group');
    const drop = group.querySelector('.nav-dropdown');
    const open = drop.hasAttribute('hidden');
    closeNavDropdowns(false);
    if (open) { drop.removeAttribute('hidden'); gbtn.setAttribute('aria-expanded', 'true'); }
    return;
  }
  if (e.target.closest('a')) {
    closeNavDropdowns(false);
    setMobileNav(false);
  }
});
$('topnav')?.addEventListener('keydown', e => {
  const gbtn = e.target.closest('.nav-group-btn');
  const inDrop = e.target.closest('.nav-dropdown');
  if (gbtn && e.key === 'ArrowDown') {
    e.preventDefault();
    const drop = gbtn.closest('.nav-group')?.querySelector('.nav-dropdown');
    closeNavDropdowns(false);
    drop?.removeAttribute('hidden');
    gbtn.setAttribute('aria-expanded', 'true');
    drop?.querySelector('a[href]')?.focus();
  } else if (inDrop) {
    const links = [...inDrop.querySelectorAll('a[href]')];
    const idx = links.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); links[(idx + 1) % links.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); links[(idx - 1 + links.length) % links.length]?.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeNavDropdowns(true); }
  }
});
document.addEventListener('click', e => {
  if (!e.target.closest('.nav-group')) closeNavDropdowns(false);
});
window.addEventListener('hashchange', route);

Promise.all(['curriculum.json', 'catalog.json', 'extended.json', 'enrichment.json', 'code_meta.json', 'quizzes.json', 'introduction.json', 'lesson-diagrams.json', 'lesson-notes.json', 'lesson-records.json', 'data/db-evidence.json'].map(p => fetch(p, { cache: 'no-cache' }).then(r => { if (!r.ok) throw Error('Unable to load ' + p); return r.json(); })))
  .then(([l, c, x, en, cm, qz, intro, diagrams, diagramNotes, records, audit]) => {
    lessons = [...intro.map(item => ({
      ...item, module: 'Introduction to EAM', level: 'Beginner', type: 'intro',
      source: l.find(lesson => lesson.id === item.reference).source
    })), ...l]; catalog = c; extended = x; enrichment = en; codeMeta = cm; quizzes = qz; recoveryAudit = audit;
    for (const lesson of lessons) {
      lesson.diagram = diagrams[lesson.id];
      lesson.diagramNotes = diagramNotes[lesson.id];
      lesson.records = records[lesson.id];
      (groups[lesson.module] ??= []).push(lesson);
    }
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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => { });

function updateReadingProgress(){
  const bar=document.querySelector('.reader-progress');if(!bar)return;
  const rect=bar.closest('article').getBoundingClientRect();
  bar.value=100*Math.max(0,Math.min(1,-rect.top/Math.max(1,rect.height-innerHeight)));
}
window.addEventListener('scroll',updateReadingProgress,{passive:true});
