/* Present the same source-linked reading in the Academy and Database Reference. */
function renderObjectTrace(record, escape, unmatched) {
  const trace = objectTrace(record);
  if (!trace) return '';
  const details = trace.sections.map(section => `<details><summary>${escape(section.title)} <span>(${section.items.length})</span></summary><ul>${section.items.map(item => `<li><p>${escape(item.text)}</p>${item.line ? `<small>Source line ${Number(item.line)}</small>` : ''}${item.sql ? `<pre><code>${escape(item.sql)}</code></pre>` : ''}</li>`).join('')}</ul></details>`).join('');
  const match = unmatched.includes(Number(record.id)) ? 'The recorded backup offset did not match this candidate’s prefix.' : 'The backup audit matched this candidate’s prefix at its recorded offset.';
  return `<section class="trace-reader"><h2>Inside this ${escape(record.kind === 'procedure' ? 'stored procedure' : record.kind)}</h2><p class="trace-summary">${escape(trace.summary)}</p><p class="trace-coverage"><strong>Source coverage</strong> ${escape(trace.coverage)} ${match}</p>${details}</section>`;
}

let fieldIndex;
async function getFieldIndex() {
  if (!fieldIndex) fieldIndex = (async () => {
    const dictionary = typeof tableIndex === 'function' ? await tableIndex() : tables;
    const index = new Map();
    for (const table of dictionary.values()) for (const column of table.cols) {
      const name = column[0].toUpperCase();
      if (!index.has(name)) index.set(name, []);
      index.get(name).push({table,column});
    }
    return index;
  })().catch(error => { fieldIndex = null; throw error; });
  return fieldIndex;
}
document.addEventListener('toggle', async event => {
  const details = event.target;
  if (!details.open || !details.closest('.trace-reader') || details.dataset.indexed) return;
  let index;
  try { index = await getFieldIndex(); } catch { return; }
  if (!details.isConnected || details.dataset.indexed) return;
  details.dataset.indexed = '1';
  for (const el of details.querySelectorAll('li p, li pre code')) {
    const source = el.textContent;
    const fragments = source.split(/(\b[A-Za-z][A-Za-z0-9]*_[\w]+\b)/g);
    el.replaceChildren(...fragments.map((token,i) => {
      if (i % 2 === 0 || !index.has(token.toUpperCase())) return token;
      const button = document.createElement('button');
      button.className = 'inspect-field'; button.type = 'button';
      button.textContent = token; button.title = 'Inspect field definition';
      button.onclick = () => showField(token,index.get(token.toUpperCase()));
      return button;
    }));
  }
}, true);
function showField(name, entries) {
  const dialog = document.createElement('dialog');
  dialog.className = 'field-dialog'; dialog.setAttribute('aria-label',name+' field definition');
  const heading = document.createElement('h2'); heading.textContent = name;
  const close = document.createElement('button'); close.textContent = 'Close'; close.onclick = () => dialog.close();
  dialog.append(close,heading);
  const examples = {ACT_EVENT:'WO-1001', ACT_ACT:'10', EVT_CODE:'WO-1001', OBJ_CODE:'P-101A', BOO_HOURS:'1.5', TRL_QTY:'1'};
  for (const {table,column} of entries) {
    const h = document.createElement('h3'); h.textContent = table.name+' · '+(table.title || table.area);
    dialog.append(h);
    const key = table.pk.includes(column[0]) ? (table.pk_source==='pk'?'Primary key':'Logical key')+' · '+table.pk.join(' + ') : '';
    const foreign = table.out_fks.filter(f=>f.cols.some(([c])=>c===column[0])).map(f=>f.name+' · '+f.explain);
    for (const value of [column[4], column[1]+' · '+(column[2]?'nullable':'required'),column[6],key,...foreign,examples[column[0]]&&'Training example · '+examples[column[0]]]) {
      if(value){const p=document.createElement('p');p.textContent=value;dialog.append(p);}
    }
  }
  document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
}
