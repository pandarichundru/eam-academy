/* Read-only notes on recovered SQL Server definitions. Every observation points to
   its original candidate line; comments and generated SQL strings are never parsed as actions. */
(() => {
  'use strict';
  const identifier = /^(?:[A-Za-z_#][\w$#@]*|\[(?:[^\]]|\]\])*\]|"(?:[^"]|"")*")$/;
  const argument = /^@[\w$#]+$/;
  const compact = value => value.trim().replace(/\s+/g, ' ');
  const clip = (value, limit = 250) => value.length > limit ? value.slice(0, limit - 1) + '…' : value;

  function tokenize(body) {
    const pattern = /\s+|--[^\r\n]*|\/\*|N?'(?:[^']|'')*(?:'|$)|\[(?:[^\]]|\]\])*(?:\]|$)|"(?:[^"]|"")*(?:"|$)|[A-Za-z_@#][\w$@#]*|\d+(?:\.\d+)?|<>|!=|>=|<=|[\s\S]/giy;
    const tokens = [];
    let line = 1;
    while (pattern.lastIndex < body.length) {
      const start = pattern.lastIndex;
      const match = pattern.exec(body);
      let value = match[0];
      if (value === '/*') {
        let depth = 1;
        const comments = /\/\*|\*\//g;
        comments.lastIndex = pattern.lastIndex;
        let boundary;
        while (depth && (boundary = comments.exec(body))) depth += boundary[0] === '/*' ? 1 : -1;
        pattern.lastIndex = depth ? body.length : comments.lastIndex;
        value = body.slice(start, pattern.lastIndex);
      } else if (!/^\s|^--/.test(value)) {
        tokens.push({value, key: value.toUpperCase(), line, start, end: pattern.lastIndex});
      }
      line += (value.match(/\n/g) || []).length;
    }
    return tokens;
  }

  function nameAt(tokens, at) {
    if (!identifier.test(tokens[at]?.value || '')) return null;
    let end = at + 1;
    while (tokens[end]?.value === '.' && identifier.test(tokens[end + 1]?.value || '')) end += 2;
    return {name: tokens.slice(at, end).map(t => t.value).join(''), end};
  }
  const skippedSources = new Set(['SELECT', 'WHERE', 'SET', 'INTO', 'JOIN', 'OPEN', 'EXEC', 'EXECUTE',
    'BEGIN', 'IF', 'AS', 'OUTPUT', 'WITH', 'VALUES', 'TOP', 'NEXT', 'CURRENT', 'TABLE', 'END', 'RETURN']);
  const changes = {INSERT:'Adds rows to', UPDATE:'Changes rows through', DELETE:'Removes rows through', MERGE:'Matches source rows against'};
  const steps = new Set(['IF','BEGIN','END','ELSE','RETURN','RAISERROR','THROW','SET','EXEC','EXECUTE',
    'INSERT','UPDATE','DELETE','MERGE','COMMIT','ROLLBACK','DECLARE','CLOSE','DEALLOCATE','FETCH','OPEN','BREAK','PRINT','WHILE']);

  function analyze(record) {
    if (!record || !['trigger','procedure'].includes(record.kind)) return null;
    const body = record.body || '';
    const lines = body.split(/\r?\n/);
    const tokens = tokenize(body);
    const at = i => tokens[i]?.key || '';
    const range = (i, end) => compact(body.slice(tokens[i].start, tokens[end - 1].end));
    const sections = new Map();
    const seen = new Set();
    function add(title, text, i, end = i + 1, key = text) {
      const fingerprint = title + '\n' + key;
      if (seen.has(fingerprint)) return;
      seen.add(fingerprint);
      const t = tokens[i];
      const sql = t ? (end > i + 1 ? range(i, end) : lines[t.line - 1].trim()) : '';
      if (!sections.has(title)) sections.set(title, []);
      sections.get(title).push({text, line:t?.line || 0, sql:clip(sql)});
    }

    const declared = nameAt(tokens, 2);
    const beginBody = tokens.findIndex((t,i) => i >= 2 && t.key === 'AS'
      && !argument.test(tokens[i-1]?.value || '') && at(i-1) !== 'EXECUTE');
    const isTrigger = record.kind === 'trigger';
    const on = declared?.end;
    const target = at(on) === 'ON' ? nameAt(tokens, on + 1) : null;
    const header = beginBody < 0 ? '' : range(0, beginBody + 1);
    const event = target && header.match(/\b(INSTEAD\s+OF|AFTER|FOR)\s+((?:INSERT|UPDATE|DELETE)(?:\s*,\s*(?:INSERT|UPDATE|DELETE))*)\b/i);
    const validHeader = ['CREATE','ALTER'].includes(at(0)) && declared && beginBody > 1 &&
      (isTrigger ? at(1) === 'TRIGGER' && target && event : ['PROC','PROCEDURE'].includes(at(1)));
    const kind = isTrigger ? 'trigger' : 'procedure';
    let summary, coverage = 'Partial-source evidence. The recovered text establishes the statements shown here. Its completeness and the definition installed in a particular system are unverified.';
    const order = ['Recovery boundary','When it runs','Call signature','Parameters','Worked example','Row sources','Changes and calls','Branch decisions','Output assignments','Outcomes','Other expressions','Available body'];
    const finish = () => ({summary, coverage, sections:order.filter(title => sections.has(title)).map(title => ({title, items: sections.get(title)}))});
    if (!validHeader) {
      summary = 'This candidate does not expose a fixed ' + kind + ' declaration with a recoverable ' + (isTrigger?'target and event.':'parameter boundary.');
      const dynamic = /\+\s*@\w+|:\w+|\bprint\s+@/i.test(body.slice(0, 350));
      add('Recovery boundary', dynamic
        ? 'The opening text contains a substitution or generated statement. Its final identifiers depend on values outside this fragment.'
        : 'The declaration is incomplete. The catalog name alone cannot establish what invokes this object.', 0);
      return finish();
    }

    const outputNames = new Set();
    const operations = [];
    const examples = [];
    const noteOperation = text => {
      if (!operations.includes(text)) operations.push(text);
    };
    if (isTrigger) {
      const timing = event[1].toUpperCase().replace(/\s+/g,' ') === 'INSTEAD OF' ? 'instead of' : 'after';
      const operations = event[2].toUpperCase().split(/\s*,\s*/).join(' or ');
      summary = declared.name + ' is declared to run ' + timing + ' ' + operations + ' on ' + target.name + '.';
      add('When it runs', summary, 0, beginBody + 1);
      const repl = tokens.findIndex((t,i) => i < beginBody && t.key === 'REPLICATION' && at(i-2) === 'NOT');
      if (repl >= 0) add('When it runs','The declaration suppresses the trigger for changes made by replication agents.',repl-2,repl+1);
    } else {
      const params = [];
      const wrapped = at(declared.end) === '(';
      const signatureEnd = wrapped && at(beginBody - 1) === ')' ? beginBody - 1 : beginBody;
      let start = declared.end + (wrapped ? 1 : 0), depth = 0;
      function readParameter(end) {
        // SQL Server permits parameter declarations surrounded by parentheses.
        while (start < end && at(start) === '(') start++;
        if (!argument.test(tokens[start]?.value || '')) return;
        let i = start + 1;
        if (at(i) === 'AS') i++;
        const type = nameAt(tokens, i);
        if (!type) return;
        i = type.end;
        if (at(i) === '(') {
          while (i < end && at(i) !== ')') i++;
          if (i < end) i++;
        }
        const arg = tokens[start].value;
        const typeName = range(at(start + 1) === 'AS' ? start+2 : start+1,i);
        const output = tokens.slice(i,end).some(t => /^(OUTPUT|OUT)$/.test(t.key));
        if (output) outputNames.add(arg.toUpperCase());
        let equal = i;
        while (equal < end && at(equal) !== '=') equal++;
        const def = equal+1 >= end ? '' : ' The declaration supplies the default ' + range(equal+1, Math.min(end,equal + (at(equal+1)==='-'?3:2))) + '.';
        params.push(arg);
        add('Parameters',arg+' accepts '+typeName+'.'+(output?' Its OUTPUT declaration lets the caller receive an updated value.':'')+def,start,end);
      }
      for (let i=start; i<=signatureEnd; i++) {
        if (i===signatureEnd || (at(i)===',' && depth===0)) {readParameter(i);start=i+1;}
        else if (at(i)==='(') depth++;
        else if (at(i)===')') depth=Math.max(0,depth-1);
      }
      summary = declared.name+' is declared with '+(params.length===0?'no named parameters':params.length+' named parameter'+(params.length===1?'':'s'))+
        (outputNames.size?' including '+outputNames.size+' OUTPUT parameter'+(outputNames.size===1?'':'s'):'')+'.';
      add('Call signature',summary,0,beginBody+1);
    }

    function rowSource(j) {
      const s = nameAt(tokens,j);
      if (!s || skippedSources.has(at(j))) return null;
      const subject = s.name.toLowerCase();
      const role = isTrigger && subject === 'inserted' ? 'Reads the new row images supplied by the triggering statement.'
        : isTrigger && subject === 'deleted' ? 'Reads the old row images supplied by the triggering statement.'
        : 'Uses '+s.name+' as a row source in the visible query.';
      add('Row sources', role, j,s.end,subject);
      return s;
    }
    function operation(i) {
      let j=i+1;
      if (['INTO','FROM'].includes(at(j))) j++;
      const s = nameAt(tokens,j);
      if (!s || skippedSources.has(at(j))) return null;
      const verb = at(i);
      const column = at(s.end)==='SET' ? nameAt(tokens,s.end+1) : null;
      const firstColumn = column && at(column.end)==='=' ? column.name : '';
      const text=changes[verb]+' '+s.name+(firstColumn?' and assigns '+firstColumn:'')+'.';
      const key=verb+' '+s.name.toUpperCase()+' '+firstColumn.toUpperCase();
      add('Changes and calls',text,i,firstColumn?column.end:s.end,key);
      const verbText={INSERT:'add rows to',UPDATE:'update',DELETE:'delete from',MERGE:'merge into'}[verb];
      noteOperation(verbText+' '+s.name+(firstColumn?' ('+firstColumn+')':''));
      return s;
    }
    function result(i) {
      const next=tokens[i+1];
      if (!next || next.line > tokens[i].line || [';','END','ELSE','BEGIN'].includes(next.key)) return 'exits this routine';
      if (at(i+1)==='-' && /^\d+$/.test(at(i+2))) return 'returns the code -'+at(i+2);
      if (/^\d+$/.test(next.key)) return 'returns the code '+next.value;
      if(argument.test(next.value))return 'returns the value of '+next.value;
      return 'returns to the caller';
    }
    function literalAssignment(start) {
      let end=start;
      if (at(end)==='-'||at(end)==='+') end++;
      if (!tokens[end] || !/^(?:NULL|N?'(?:[^']|'')*'|\d+(?:\.\d+)?|@[\w$#]+)$/i.test(tokens[end].value)) return '';
      end++;
      if (end<tokens.length && ![',',';','FROM','WHERE'].includes(at(end)) && !steps.has(at(end)) && at(end)!=='SELECT') return '';
      return range(start,end);
    }
    function describeGuard(i) {
      let depth=0,j=i+1;
      for (;j<tokens.length && j-i<110;j++) {
        const word=at(j);
        if (!depth && j>i+1 && (steps.has(word) || word==='SELECT' || word===';')) break;
        if (word==='(') depth++;
        if (word===')') depth=Math.max(0,depth-1);
      }
      if (j===tokens.length || j-i>=110 || j===i+1) return;
      let effect = j;
      while (['BEGIN',';'].includes(at(effect))) effect++;
      const predicate = clip(range(i+1,j),150);
      const branch = at(effect);
      let consequence;
      if (branch==='RETURN') consequence=result(effect);
      if (branch==='ROLLBACK') consequence='rolls back the specified transaction or savepoint';
      if (branch==='COMMIT') consequence='executes a COMMIT';
      if (branch==='THROW'||branch==='RAISERROR') consequence='raises a SQL error';
      if (branch==='BREAK') consequence='leaves the current loop';
      if (branch==='SET' && argument.test(tokens[effect+1]?.value||'') && at(effect+2)==='=') {
        const value=literalAssignment(effect+3);
        consequence='assigns '+(value||'a value')+' to '+tokens[effect+1].value;
      }
      if (branch==='UPDATE' && nameAt(tokens,effect+1) && !skippedSources.has(at(effect+1))) consequence='runs an UPDATE on '+nameAt(tokens,effect+1).name;
      if (!consequence) return;
      const comparison = j===i+4 && argument.test(tokens[i+1].value) && at(i+2)==='=' && /^(?:N?'(?:[^']|'')*'|-?\d+)$/i.test(tokens[i+3].value);
      if (comparison && ['RETURN','SET','ROLLBACK','BREAK'].includes(branch)) {
        examples.push({text:'Suppose '+tokens[i+1].value+' has the value '+tokens[i+3].value+' when this check runs. The matching branch '+consequence+'.',i,end:j});
      }
      add('Branch decisions','When '+predicate+' is true, this branch '+consequence+'.',i,j,predicate+' '+consequence);
    }

    for (let i=beginBody+1; i<tokens.length; i++) {
      const word = at(i);
      if (word==='FROM'||word==='JOIN') {
        if (['FETCH','NEXT','PRIOR','FIRST','LAST','DELETE'].includes(at(i-1))) continue;
        const first=rowSource(i+1);
        if (first && word==='FROM') {
          let j=first.end;
          if (at(j)==='AS') j++;
          if (identifier.test(tokens[j]?.value||'') && !skippedSources.has(at(j))) j++;
          while(at(j)===',') {
            const next=rowSource(j+1);
            if(!next) break;
            j=next.end;
            if (at(j)==='AS') j++;
            if (identifier.test(tokens[j]?.value||'')&&!skippedSources.has(at(j))) j++;
          }
        }
      } else if (Object.hasOwn(changes,word)) {
        operation(i);
      } else if (word==='EXEC'||word==='EXECUTE') {
        let j=i+1;
        if (argument.test(tokens[j]?.value||'') && at(j+1)==='=') j+=2;
        if (at(j)==='(' || argument.test(tokens[j]?.value||'') || /^N?'/.test(tokens[j]?.value||'')) {
          add('Changes and calls','Executes a value constructed or supplied at runtime. Its destination and effects depend on that value.',i);
        } else {
          const proc=nameAt(tokens,j);
          if(proc && !skippedSources.has(at(j))) {
            const status = j===i+3 ? tokens[i+1].value : '';
            const systemDynamic=/(?:^|\.)\[?sp_executesql\]?$/i.test(proc.name);
            add('Changes and calls','Calls '+proc.name+(status?' and captures its return code in '+status:'')+'. '+(systemDynamic?'The SQL text supplied by the caller determines the operations.':'The called routine supplies the implementation.'),i,proc.end,'call '+proc.name.toUpperCase()+' '+status);
            if (!operations.length) noteOperation('call '+proc.name);
          }
        }
      } else if (word==='IF') {
        describeGuard(i);
      } else if (word==='RETURN') {
        const phrase=result(i);
        add('Outcomes',phrase[0].toUpperCase()+phrase.slice(1)+' on this path.',i);
      } else if (word==='COMMIT'||word==='ROLLBACK') {
        add('Outcomes',word==='COMMIT'?'Issues COMMIT on this path. Persistence depends on the surrounding transaction.':'Issues ROLLBACK on this path. Inspect the statement for any named savepoint.',i);
      } else if (word==='THROW'||word==='RAISERROR') {
        add('Outcomes','Uses '+word+' to signal an error on this path.',i);
      } else if ((word==='SET'||word==='SELECT') && outputNames.has(at(i+1)) && at(i+2)==='=') {
        const value = literalAssignment(i+3);
        add('Output assignments','Assigns '+(value||'an expression result')+' to '+tokens[i+1].value+' on this path.',i,i+1,compact(lines[tokens[i].line-1]).toUpperCase());
        if(value && !operations.length) noteOperation('set '+tokens[i+1].value+' to '+value);
      }
    }

    // Only show numerical examples when the actual predicate and assignment match.
    const executable = tokens.slice(beginBody+1).map(t=>t.key).join(' ');
    const revision = executable.match(/UPDATE ([\w.]+) SET (\w+_UPDATECOUNT) = ISNULL \( (@\w+) , - 1 \) \+ 1/);
    if (revision && executable.includes('IF ISNULL ( '+revision[3]+' , - 1 ) = ISNULL ( @NOLDUPDATECOUNT , - 1 )')) {
      const i=tokens.findIndex((t,k)=>k>beginBody&&t.key==='UPDATE'&&at(k+1)===revision[1]&&at(k+3)===revision[2]);
      add('Worked example','On the path that reaches this assignment, equal incoming and old counts of 4 yield 5 in '+revision[1]+'.'+revision[2]+'. The comparison includes a fallback of −1 for NULL.',i);
    }
    if (declared.name.toUpperCase()==='COLUMNDELETETABLESTATUSUPDATE' && /UPDATE DATALAKE_TABLE SET STATUS = 'INACTIVE' WHERE TABLEID IN \( SELECT TABLEID FROM DELETED \) AND STATUS <> 'INACTIVE'/.test(executable)) {
      const i=tokens.findIndex((t,k)=>k>beginBody&&t.key==='UPDATE');
      add('Worked example','Suppose two deleted columns both belong to table 41. A matching DataLake_Table row with status ACTIVE becomes INACTIVE. The membership test selects that parent row once. A row with a different TableId is outside the update.',i);
    }
    if (declared.name.toUpperCase()==='O7FLXPKG_O7FLXCHK' && executable.includes("IF @SOBJUPD = N'TRUE' RETURN 0") && executable.includes('O7FLXPKG_O7FLXEXEC')) {
      const i=tokens.findIndex((t,k)=>k>beginBody&&t.key==='IF'&&at(k+1)==='@SOBJUPD');
      add('Worked example','When the object-update session check sets @sObjupd to TRUE, this invocation returns 0 before it reaches the later O7FLXPKG_O7FLXEXEC call.',i);
    }
    if(declared.name.toUpperCase()==='ADRV' && executable.includes("WHERE INS_CODE = N'~SLEEP~' IF @@ROWCOUNT = 0 SET @NTIMEOUT = 300")){
      const i=tokens.findIndex((t,k)=>k>beginBody&&t.key==='IF'&&at(k+1)==='@@ROWCOUNT'&&at(k+4)==='SET'&&at(k+5)==='@NTIMEOUT');
      add('Worked example','On the lock-acquired path, a lookup for ~SLEEP~ with no matching row gives @@ROWCOUNT = 0. That branch sets @nTimeout to 300. The candidate supplies no unit in this assignment.',i);
    }
    if (!sections.has('Worked example') && examples.length) {
      const example=examples[0];
      add('Worked example',example.text,example.i,example.end);
    }
    if (!sections.has('Changes and calls') && !sections.has('Row sources') && !sections.has('Output assignments')) {
      for (let i=beginBody+1;i<tokens.length;i++) {
        if(at(i)==='SELECT' || (at(i)==='SET' && argument.test(tokens[i+1]?.value||'') && at(i+2)==='=')) {
          const assigns = argument.test(tokens[i+1]?.value||'') && at(i+2)==='=';
          add('Other expressions',assigns?'Assigns a value to '+tokens[i+1].value+' in the visible expression.':'Evaluates this SELECT expression. The surrounding statement determines how the value is used.',i,i+1,compact(lines[tokens[i].line-1]).toUpperCase());
        }
      }
    }
    if(operations.length) summary+=' Visible paths can '+operations.slice(0,2).join(' and ')+'.';
    if (!sections.has('Other expressions') && !sections.has('Changes and calls') && !sections.has('Outcomes') && !sections.has('Output assignments') && !sections.has('Row sources')) {
      add('Available body','Inspect the recovered lines below for local assignments, expressions or comments. This excerpt establishes no further named operation in the trace.',beginBody);
    }
    return finish();
  }
  globalThis.objectTrace = analyze;
})();
