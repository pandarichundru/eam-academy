/* Present the same source-linked reading in the Academy and Database Reference. */
function renderObjectTrace(record, escape, unmatched) {
  const trace = objectTrace(record);
  if (!trace) return '';
  const details = trace.sections.map(section => `<details><summary>${escape(section.title)} <span>(${section.items.length})</span></summary><ul>${section.items.map(item => `<li><p>${escape(item.text)}</p>${item.line ? `<small>Source line ${Number(item.line)}</small>` : ''}${item.sql ? `<pre><code>${escape(item.sql)}</code></pre>` : ''}</li>`).join('')}</ul></details>`).join('');
  const match = unmatched.includes(Number(record.id)) ? 'The recorded backup offset did not match this candidate’s prefix.' : 'The backup audit matched this candidate’s prefix at its recorded offset.';
  return `<section class="trace-reader"><h2>Inside this ${escape(record.kind === 'procedure' ? 'stored procedure' : record.kind)}</h2><p class="trace-summary">${escape(trace.summary)}</p><p class="trace-coverage"><strong>Source coverage</strong> ${escape(trace.coverage)} ${match}</p>${details}</section>`;
}
