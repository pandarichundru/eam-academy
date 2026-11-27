'use strict';
const reader = document.getElementById('reader');
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link = (key,title) => '<a href="#'+encodeURIComponent(key)+'">'+esc(title)+'</a>';
const academy = (route,label) => '<a href="../#'+esc(route)+'">'+esc(label)+'</a>';
const section = (heading,body) => '<h2>'+esc(heading)+'</h2>'+body;
const para = s => '<p>'+esc(s)+'</p>';
const block = s => '<pre>'+esc(s)+'</pre>';
const id = s => '['+String(s).replace(/]/g,']]')+']';
const panel = (name,html) => '<details><summary>'+esc(name)+'</summary>'+html+'</details>';
const objects = new Map();
const tables = new Map();
let evidence,selected='',term='',page=0;
function entry(type,name,key,data,parent) {objects.set(key,{type,name,key,data,parent});}
async function readJSON(path){const r=await fetch(path);if(!r.ok)throw Error('Could not load '+path);return r.json();}
async function shards(kind){const paths=await readJSON(kind+'.json');return (await Promise.all(paths.map(p=>readJSON('../'+p)))).flat();}
const guides = {
 'Work-order labor':[
 ['Identify the grain','The event is the job header. An activity is a planned task within that event. A booking is an individual time entry. A report that compares actual and planned hours needs exactly one output row per planned activity, including activities without bookings.'],
 ['Follow the keys','The schema export identifies R5ACTIVITIES by ACT_EVENT and ACT_ACT and identifies each R5BOOKEDHOURS record by BOO_CODE. The booking index R5IDX1_BOO lists BOO_EVENT followed by BOO_ACT. That pair supports a candidate match to the activity key. The supplied booking-table foreign-key list does not establish an enforced constraint for that pair.'],
 ['Trace a wrong answer','In the original Academy lesson fixture, activity 10 has bookings of 2 hours on order 101, 5 on 102, and 4 on 104. Joining on the activity number alone assigns 11 hours to each of those three tasks. Activity 20 still looks right at 1 hour. A single successful spot check can conceal the error.'],
 ['Reconcile the report','With both identifiers, the four totals are 2, 1, 5 and 4. Their sum of 12 reconciles to the source bookings. The incomplete join totals 34. Keep planned hours at activity grain; summing them after joining two bookings would also double the plan. The example below uses the training names.']
 ],
 'Issued parts view':[
 ['Start from the output grain','The candidate dbo.R5PARTISSUED defines five output columns. PAI_STOCK is the aggregated quantity; the four remaining columns identify an event, activity, part and part organization. The view describes issue-line quantities grouped at that level. A store balance or a count of issue transactions answers a different question.'],
 ['Walk two lines through the definition','The input is R5TRANSLINES. Only rows with TRL_RTYPE equal to I and TRL_IO equal to -1 reach the group. For each row, the expression first takes TRL_ORIGQTY, then TRL_QTY if the original is NULL, then zero if both are NULL. A stored original quantity of zero therefore wins over a nonzero current quantity.'],
 ['Predict a boundary case','For two qualifying lines of the same group, let the original/current quantities be NULL/3 and 2/9. The output quantity is 5. Change the part organization on the second row and the view produces two groups. Joining this view to orders using the event alone can repeat header costs once for every part and activity.']
 ],
 'Error-message function':[
 ['Follow one call','BAIMERROR_GETERRORMESSAGE takes an integer error code and declares an nvarchar(255) return. It casts the code to text, reads the DEFLANG entry from R5INSTALL and matches that language to R5ERRTEXTS. The same numeric input can yield different text when the configured language differs.'],
 ['Distinguish three outcomes','One matching row supplies ERT_TEXT. Zero rows select the missing-message fallback. More than one selects the retrieval-error fallback. The fallback concatenates the captured @@ERROR value, so the number printed there should not be assumed to be the input error code.'],
 ['Check the output width','The recovered body takes SUBSTRING from position 1 for 240 characters before returning. A 245-character source message therefore yields at most the first 240 characters even though the declared return type can hold 255. Inspect the lookup cardinality and length before attributing a shortened label to the user interface.']
 ],
 'Trigger and procedure traces':[
 ['A deletion can change another table','COLUMNDELETETABLESTATUSUPDATE is an AFTER DELETE trigger on DataLake_Column. Its UPDATE targets DataLake_Table records whose TableId appears in deleted and whose status differs from INACTIVE. If two removed columns belong to the same table, membership still selects that parent once. A NULL status fails the inequality under standard NULL semantics. The visible statement changes metadata status; it does not itself delete a parent table.'],
 ['A procedure can commit in stages','ADRV reads PRODUCTS and ASPJOBS through O7DFLT. The observed branch proceeds for D7I or an enabled ASPJOBS setting; lookup failures return -1. It examines the ~ADRV~ control record, conditionally inserts it and commits that insertion. Later, a cursor reads R5OBJECTAUDITS interface rows in transaction-ID order. A commit inside the procedure matters when reasoning about what a later failure could leave behind.'],
 ['Trace a timeout precisely','In the visible ADRV branch, a lookup for ~SLEEP~ reads INS_DESC as an integer. When that lookup returns no row, the code assigns 300 to the local timeout variable. This is evidence for a fallback on that path. It does not establish an installed parameter value, the units of the timeout, or that every invocation reaches that path.']
 ],
 'Flex configuration':[
 ['Separate a rule from its runtime','R5FLEXSQL identifies a configuration row by FLX_TABLE, FLX_TRIGGER and FLX_SEQ. Two rules may belong to the same table and trigger and still be distinct because their sequence differs. FLX_STMT stores statement text; FLX_ACTIVE, FLX_ABORTONFAILURE and FLX_MSGFAILURE are separate configuration fields. A stored procedure with FLEX in its name is a different kind of object.'],
 ['Trace one update','PREUPD2_FLX is declared FOR UPDATE on R5FLEXSQL. Its observed body pairs inserted and deleted rows by FLX_SQLIDENTITY and iterates the pairs. In the non-SYS branch it compares old and new update counts. Equal normalized values lead to an increment and timestamp update. The alternate branch raises an error through O7RAE and rolls back. Reading the trigger name alone would miss both the user check and the change to revision metadata.'],
 ['Trace execution separately','O7FLXPKG_O7FLXCHK accepts a table, trigger and row ID. Session checks in the recovered body return early during object renumbering, forget-me processing or person organization updates. O7FLXPKG_O7FLXEXEC exposes status and message output parameters. Follow the route that applies to the session before assuming the presence of a configured row means the rule ran. The eight indexed Flex-related candidates are routines or triggers; they are not an inventory of installed rule rows.']
 ],
 'Classes, categories and parameters':[
 ['Resolve classification in context','R5CLASSES uses CLS_ENTITY, CLS_CODE and CLS_ORG together. Two exported equipment class codes, ACCOMMOD and ACM, both carry the description Accommodation. Grouping on that description could merge distinct codes. Conversely, joining on CLS_CODE alone could cross organization or entity boundaries. Start with the equipment identifier and organization, then inspect its class fields and the relevant class record.'],
 ['Distinguish asset categories','R5OBJECTS has separate OBJ_CLASS and OBJ_CATEGORY fields. The supplied asset category list includes the literal code 1000205 with the label Motor pump. Keep the identifier as text, even when it looks numeric. This lookup establishes a label. To explain a mandatory-field or processing rule, locate the screen rule or SQL predicate that consumes the category.'],
 ['Read a setting through a consumer','The ACCOUNT guide excerpt on HxGN page 671 describes different behavior for YES and NO, including when Accounted is required. The parameter dictionary links that page for context. R5INSTALL is keyed by INS_CODE; recovered SQL for the error-message function reads INS_DESC for DEFLANG. These are different evidence types: documented behavior, schema location, and an actual read in code. None alone establishes the value configured on a running system.']
 ],
 'Index access paths':[
 ['Follow the leading columns','R5PRIK_ACT is recorded as a unique primary-key index on ACT_EVENT, ACT_ACT. A predicate for event 101 can use its leading key; adding the activity narrows the lookup to the pair. A predicate for activity 10 across all events does not supply the leading event value. Estimates, statistics and other indexes determine the actual execution plan.'],
 ['Compare two access paths','R5IDX1_BOO is recorded on BOO_EVENT, BOO_ACT and is nonunique. It can help find multiple bookings for the same task. The unique booking key BOO_CODE answers a different question: retrieve one time entry by its own identity. Replacing the activity pair with the booking key would prevent the report from grouping all entries for a task.'],
 ['Check enforcement and omissions','A named foreign key provides its child-to-parent column mapping. An index with the same column names supplies an access path and may have different uniqueness. The table catalog lists index names, column order and uniqueness flags. Included-column status, filtered predicates, sort direction and observed optimizer choices require more evidence than this export provides.']
 ]
};
const laborSQL='SELECT a.wo, a.activity, a.planned_hours,\n       COALESCE(SUM(l.hours), 0) AS booked_hours\nFROM activities AS a\nLEFT JOIN labor_entries AS l\n  ON l.wo = a.wo AND l.activity = a.activity\nGROUP BY a.wo, a.activity, a.planned_hours\nORDER BY a.wo, a.activity;';
const related={
 'Work-order labor':['Table:R5ACTIVITIES','Table:R5BOOKEDHOURS','Table:R5EVENTS'],
 'Issued parts view':['Code:4993','Table:R5TRANSLINES'],
 'Error-message function':['Code:4035','Table:R5INSTALL','Table:R5ERRTEXTS'],
 'Trigger and procedure traces':['Code:6','Code:2406'],
 'Flex configuration':['Table:R5FLEXSQL','Code:1504','Code:3191','Code:3192'],
 'Classes, categories and parameters':['Table:R5CLASSES','Table:R5OBJECTS','Parameter:ACCOUNT'],
 'Index access paths':['Index:R5ACTIVITIES:R5PRIK_ACT','Index:R5BOOKEDHOURS:R5IDX1_BOO']
};
function connections(keys){return keys.filter(k=>objects.has(k)).map(k=>link(k,objects.get(k).name)).join(' · ');}
function study(name){return guides[name].map(([h,p])=>section(h,para(p))).join('')+(name==='Work-order labor'?block(laborSQL)+academy('sql/L130','Run the activity comparison in the SQL lab'):'')+section('Inspect the evidence','<p>'+connections(related[name])+'</p>');}
function tablePage(t){
 const keys=t.pk||[], name=id(t.name);
 let body=para(t.desc)+section('Identify one record',para(t.pk_explain||'The export does not identify a primary key.'));
 if(keys.length)body+=para('Check how often the recorded key occurs before using it to count records or join a report. A result from this query identifies a combination that occurs more than once in the data you inspected.')+block('SELECT '+keys.map(id).join(', ')+', COUNT_BIG(*) AS occurrences\nFROM '+name+'\nGROUP BY '+keys.map(id).join(', ')+'\nHAVING COUNT_BIG(*) > 1;');
 body+=section('Follow relationships',para('Each example keeps child records whose parent does not match. Inspect the mapped parent key to distinguish a missing match from an empty descriptive field. Keep every comparison in a composite relationship.'));
 for(const fk of t.out_fks)body+=panel(fk.name,connections(['Table:'+fk.to])+block('SELECT TOP (25) c.*, '+(fk.cols.length?'p.'+id(fk.cols[0][1])+' AS matched_parent':'p.*')+'\nFROM '+name+' AS c\nLEFT JOIN '+id(fk.to)+' AS p\n  ON '+fk.cols.map(([c,p])=>'c.'+id(c)+' = p.'+id(p)).join('\n AND ')+';'));
 if(!t.out_fks.length)body+=para('The export lists no outbound foreign key for this table.');
 if(t.in_fks.length)body+=panel('Tables that reference this record',t.in_fks.map(f=>para(f.explain)+connections(['Table:'+f.from])).join(''));
 body+=section('Columns and access paths',panel(t.cols.length+' column definitions',t.cols.map(([n,ty,nu,df,label,flags,exp])=>'<p><strong>'+esc(n)+'</strong> · '+esc(ty)+' · '+(nu?'nullable':'required')+'<br>'+esc([label,flags,exp,df?'Default '+df:''].filter(Boolean).join(' · '))+'</p>').join(''))+connections(t.indexes.map(i=>'Index:'+t.name+':'+i.name)));
 if(t.triggers.length)body+=section('Events on this table',t.triggers.map(v=>para(v.name+' — '+v.events.join(', ')+(v.disabled?' (disabled in export)':' (enabled in export)'))+connections(codeKeys(v.name))).join(''));
 return body+academy('table/'+encodeURIComponent(t.name),'Open the Academy table dictionary');
}
function indexPage(x,t){
 const cols=x.cols.map(id), where=cols.map((c,i)=>c+' = @value'+(i+1)).join('\n  AND ');
 return para('On '+t.name+', '+x.name+' records the columns '+x.cols.join(', ')+' in that order. '+(x.pk?'This index backs the primary key.':x.unique?'The catalog marks the index unique.':'Multiple rows can share this indexed combination.'))+section('Use the ordered key',para('Supply typed values for the parameters in this lookup. '+(cols.length>1?'The first predicate uses the leading column. Test it alone and then with the rest of the key to see how many rows each condition selects.':'Compare the estimated and actual row counts for a common value and a rare value.'))+block('SELECT '+cols.join(', ')+'\nFROM '+id(t.name)+'\nWHERE '+where+';'))+section('Interpret the execution plan',para('Inspect the chosen index, seek predicates, residual predicates and actual rows read. A scan can cost less for a value shared by many rows. The catalog identifies a possible access path. The optimizer makes its choice using the live data distribution and available statistics.'))+connections(['Table:'+t.name,'Study:Index access paths']);
}
const norm=s=>s.replace(/[\\\s]+$/g,'').replace(/^dbo\./i,'').toUpperCase();
const byName=new Map();
function codeKeys(n){return byName.get(norm(n))||[];}
const tips={
 view:'Identify the row source in FROM, then read each JOIN and WHERE condition. Determine which rows disappear before interpreting computed columns. Aggregation or a one-to-many join can change what one output row represents.',
 trigger:'Locate the target and firing events in the declaration. Trace how inserted and deleted contribute rows. Check whether the logic handles a multirow statement and what later writes or calls can run inside the same transaction.',
 procedure:'Start with the parameter declarations. Follow validation and early returns, then trace reads, writes and called procedures in order. Distinguish result sets, output parameters and return codes when describing the caller’s contract.',
 function:'Read the arguments and RETURNS declaration together. Follow each return path and examine lookups for missing rows or NULL inputs. Identify whether the caller receives one value or a table.',
 table_ddl:'Read each column declaration together with its type and constraints. Compare the fragment with the table dictionary before relying on a key or default.'
};
function codePage(d){
 const lines=(d.body||'').split(/\r?\n/);
 const refs=(d.tables||'').split(/,\s*/).map(s=>'Table:'+s.trim()).filter(k=>objects.has(k));
 const patterns=[['Declaration',/\b(?:CREATE|ALTER)\s+(?:PROC(?:EDURE)?|TRIGGER|FUNCTION|VIEW|TABLE)\b/i],['Row sources and joins',/\b(?:FROM|JOIN)\s+\S/i],['Conditions and return paths',/\b(?:WHERE|HAVING|IF|RETURN)\b/i],['Changes and calls',/\b(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM|EXEC(?:UTE)?)\s+\S/i]];
 return para('Recovered '+d.kind+' candidate '+d.candidate+' at recorded offset '+d.offset+'. '+(evidence.unmatched.includes(d.id)?'Its prefix could not be matched at the recorded offset.':'The beginning of this candidate matched bytes in the supplied backup.'))+section('Read this candidate',para(tips[d.kind]||'Inspect the recovered text and its surrounding context before treating the inferred object name or type as a declaration.'))+patterns.map(([h,re])=>{const hits=lines.map((s,i)=>re.test(s)?(i+1)+'  '+s.trim():'').filter(Boolean).slice(0,6);return hits.length?panel(h,block(hits.join('\n'))):'';}).join('')+section('Trace the evidence',para('The excerpts are textual matches and may include comments or generated SQL. Follow their branches in the complete recovered candidate. Referenced table names are navigation leads.')+connections(refs))+panel('Recovered SQL · '+lines.length+' lines',block(d.body))+academy('code/'+d.id,'Open annotated Academy source');
}
function configPage(o){
 const d=o.data;
 if(o.type==='Parameter')return para('Look up '+o.name+' by INS_CODE in R5INSTALL. A guide describes how the application interprets a setting. The active value depends on the installation.')+block('SELECT INS_CODE, INS_DESC\nFROM R5INSTALL\nWHERE INS_CODE = N\''+d.code.replace(/'/g,"''")+'\';')+section('Documented use',d.refs.map(r=>para(r.context)+academy('doc/'+r.doc_id,'Guide · page '+r.page)).join('')||para('No guide excerpt is listed.'))+connections(['Table:R5INSTALL','Study:Classes, categories and parameters']);
 if(o.type==='Flex')return para('The flex-related source inventory associates '+o.name+' with '+d.source+'. Open its recovered candidate to locate the rule lookup, event and conditional branches. A source entry alone does not establish the active rule or execution order for a particular table.')+section('Follow the configuration',connections([...codeKeys(o.name),'Table:R5FLEXSQL','Study:Flex configuration']));
 const isClass=o.type==='Class';
 return para('The supplied '+(isClass?'equipment class':'asset category')+' list records '+d.code+' as “'+d.desc+'”.')+section('Apply the code to equipment',para(isClass?'Start by finding equipment carrying this class. Keep the equipment organization and class organization in the result. Look up the class definition using the entity and organization context from the dictionary before assigning a description.':'Use the exact category code to find equipment carrying this classification. Compare the equipment class and organization alongside the category. The label describes the category, while behavior tied to it requires a separate rule or application lookup.')+block('SELECT TOP (25) OBJ_CODE, OBJ_ORG, OBJ_CLASS, OBJ_CATEGORY\nFROM R5OBJECTS\nWHERE '+(isClass?'OBJ_CLASS':'OBJ_CATEGORY')+" = N'"+d.code.replace(/'/g,"''")+"';"))+connections(['Table:R5OBJECTS',...(isClass?['Table:R5CLASSES']:[]),'Study:Classes, categories and parameters']);
}
const arr=()=>Array.from(objects.values());
function results(){
 const list=arr().filter(o=>(!selected||o.type===selected)&&(!term||(o.name+' '+(o.parent?.name||'')+' '+(o.data?.desc||'')).toLowerCase().includes(term)));
 const start=page*40;
 document.getElementById('rows').innerHTML=para(list.length+' matching entries')+list.slice(start,start+40).map(o=>'<div class="dbrow">'+link(o.key,o.name+(o.type==='Index'?' · '+o.parent.name:''))+'<small>'+esc(o.type)+'</small></div>').join('')+'<p><button id="prev" '+(page?'':'disabled')+'>Previous</button> <button id="next" '+(start+40<list.length?'':'disabled')+'>Next</button></p>';
 document.getElementById('prev').onclick=()=>{page--;results();};document.getElementById('next').onclick=()=>{page++;results();};
}
function saved(key,fallback){try{return JSON.parse(localStorage.getItem('eam3:'+key))??fallback;}catch{return fallback;}}
function save(key,value){try{localStorage.setItem('eam3:'+key,JSON.stringify(value));}catch{}}
function objectMap(o){
 const d=o.data;
 let question,steps;
 if(o.type==='Table'){
  question='How do I identify and connect a '+o.name+' record?';
  steps=[['Record',d.title||d.name],['Recorded key',d.pk.join(' + ')||'No key recorded'],['Outbound links',d.out_fks.length+' recorded constraints']];
 }else if(o.type==='Index'){
  question='Which columns can I use to look up rows in '+o.parent.name+'?';
  steps=d.cols.map((c,i)=>['Key position '+(i+1),c]);
 }else if(o.key.startsWith('Code:')){
  question='What does the recovered '+d.kind+' text show?';
  const lines=(d.body||'').split(/\r?\n/);
  const pick=r=>lines.find(l=>r.test(l))?.trim().slice(0,150)||'Inspect recovered source';
  steps=[['Declaration',pick(/\b(create|alter)\b/i)],['Condition',pick(/^\s*(where|if|when|having)\b/i)],['Action or output',pick(/^\s*(select|return|update|insert|delete|exec)\b/i)]];
 }else return '';
 return '<section class="object-map"><h2>'+esc(question)+'</h2><ol>'+steps.map(([k,v])=>'<li><small>'+esc(k)+'</small><code>'+esc(v)+'</code></li>').join('')+'</ol></section>';
}
function joinLab(){
 return '<section class="join-lab"><h2>Trace the matching rows</h2><label>Join condition <select id="joinMode"><option value="single">Activity alone</option><option value="pair">Work order + activity</option><option value="left">LEFT JOIN with an unbooked activity</option></select></label> <button id="stepJoin">Next activity</button><div id="joinRows" aria-live="polite"></div><p>'+connections(['Table:R5ACTIVITIES'])+' · '+academy('exercise/53','Try activity variance')+'</p></section>';
}
function wireJoin(){
 const mode=document.getElementById('joinMode');if(!mode)return;
 const bookings=[[101,10,2],[101,20,1],[102,10,5],[104,10,4]];let step=0;
 function draw(){
  const activities=bookings.map(([w,a])=>[w,a]);
  if(mode.value==='left')activities.push([105,30]);
  const matches=([w,a])=>bookings.filter(([bw,ba])=>a===ba&&(mode.value==='single'||w===bw));
  const sum=rows=>rows.reduce((n,r)=>n+r[2],0);
  const active=activities[step],rows=matches(active);
  document.getElementById('joinRows').innerHTML='<p>Activity '+(step+1)+' of '+activities.length+' · Work order <b>'+active[0]+'</b> · Activity <b>'+active[1]+'</b></p><div class="match-grid">'+bookings.map(row=>'<div class="'+(rows.includes(row)?'matched':'')+'"><small>'+ (rows.includes(row)?'Matched':'No match')+'</small><code>'+row[0]+' / '+row[1]+'</code><b>'+row[2]+' h</b></div>').join('')+'</div>'+para(rows.length?'This activity receives '+rows.map(r=>r[2]).join(' + ')+' = '+sum(rows)+' booked hours.':'The added training activity has no booking. LEFT JOIN preserves it with NULL booking fields. COALESCE converts its missing total to zero hours.')+'<strong>Report total · '+activities.reduce((n,a)=>n+sum(matches(a)),0)+' hours</strong>';
  document.getElementById('stepJoin').onclick=()=>{step=(step+1)%activities.length;draw();};
 }
 mode.onchange=()=>{step=mode.value==='left'?4:0;draw();};draw();
}
function bookmarkList(){
 const keys=saved('dbBookmarks',[]).filter(k=>objects.has(k));
 return keys.length?section('Your bookmarks',keys.map(k=>'<div>'+link(k,objects.get(k).name)+'</div>').join('')):'';
}

function render(){
 let k;try{k=decodeURIComponent(location.hash.slice(1));}catch{k='?';}
 const o=objects.get(k);
 if(o){save('dbLast',{key:o.key,name:o.name});reader.innerHTML='<p>'+esc(o.type)+'</p><article><h1>'+esc(o.name)+'</h1><button id="bookmarkEntry"></button>'+objectMap(o)+(o.name==='Work-order labor'?joinLab():'')+(o.type==='Study'?study(o.name):o.type==='Table'?tablePage(o.data):o.type==='Index'?indexPage(o.data,o.parent):o.key.startsWith('Code:')?codePage(o.data):configPage(o))+'</article>';document.title=o.name+' · Database Reference';const bookmark=document.getElementById('bookmarkEntry');
 function showBookmark(){const on=saved('dbBookmarks',[]).includes(o.key);bookmark.textContent=on?'Bookmarked':'Bookmark entry';bookmark.setAttribute('aria-pressed',String(on));}
 bookmark.onclick=()=>{const list=saved('dbBookmarks',[]);save('dbBookmarks',list.includes(o.key)?list.filter(k=>k!==o.key):[...list,o.key]);showBookmark();};showBookmark();wireJoin();window.scrollTo(0,0);return;}
 document.title='Database Reference · EAM Academy';
 reader.innerHTML=(k?para('The requested entry was not found.'):'')+'<h1>Database Reference</h1>'+para('Follow a worked example, then use the catalog to investigate a related object.')+bookmarkList()+section('Guided investigations',Object.keys(guides).map(s=>'<div>'+link('Study:'+s,s)+'</div>').join(''))+section('Search the database catalog','<div class="controls"><label>Object name or description<input id="term" type="search"></label><label>Object type<select id="type"><option value="">All types</option>'+[...new Set(arr().map(o=>o.type))].sort().map(t=>'<option>'+esc(t)+'</option>').join('')+'</select></label></div><div id="rows"></div>')+panel('Source and coverage',para('The table and index descriptions use the Academy schema export. Of 5,296 recovered SQL candidates, '+evidence.matched.toLocaleString()+' had a matching text prefix at a recorded byte offset in 116_van.bak. Seven did not match. A prefix match does not verify a complete definition, runtime behavior or the current installation. Classes, categories and parameter excerpts come from the supplied Academy catalogs.')+para('Backup SHA-256 '+evidence.sha256));
 const input=document.getElementById('term'),type=document.getElementById('type');input.value=term;type.value=selected;input.oninput=()=>{term=input.value.toLowerCase();page=0;results();};type.onchange=()=>{selected=type.value;page=0;results();};results();
}
async function start(){
 const [ts,cs,meta,audit]=await Promise.all([shards('tables'),shards('code'),readJSON('../code_meta.json'),readJSON('db-evidence.json')]);evidence=audit;
 Object.keys(guides).forEach(n=>entry('Study',n,'Study:'+n));
 ts.forEach(t=>{tables.set(t.name,t);entry('Table',t.name,'Table:'+t.name,t);t.indexes.forEach(i=>entry('Index',i.name,'Index:'+t.name+':'+i.name,i,t));});
 cs.forEach(c=>{const key='Code:'+c.id,n=norm(c.name);entry('Recovered '+c.kind,c.name,key,c);if(!byName.has(n))byName.set(n,[]);byName.get(n).push(key);});
 for(const [type,rows] of [['Class',meta.equipment_classes],['Category',meta.asset_categories],['Parameter',meta.install_params],['Flex',meta.flex_sql]])rows.forEach(d=>{const n=d.code||norm(d.name);entry(type,n,type+':'+n,d);});
 render();window.addEventListener('hashchange',render);
}
start().catch(e=>{reader.textContent='The database catalog could not open. Reload to retry. '+e.message;});
