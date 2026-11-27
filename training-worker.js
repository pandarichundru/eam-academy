importScripts('sql-asm.js');
onmessage = async ({data}) => {
  const sql = typeof data === 'string' ? data : data.sql;
  const dataset = ['practice-0','practice-1'].includes(data.dataset) ? data.dataset : 'training';
  let db;
  try {
    if (typeof sql !== 'string' || sql.length > 20000 || !/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*(select|with)\b/i.test(sql)) throw Error('Enter one SELECT or WITH query.');
    const [engine,file] = await Promise.all([initSqlJs(),fetch('data/' + dataset + '.db', {cache: 'no-cache'})]);
    if (!file.ok) throw Error('Training data unavailable.');
    db = new engine.Database(new Uint8Array(await file.arrayBuffer()));
    db.run('PRAGMA query_only=ON');
    const stmts = db.iterateStatements(sql);
    const statement = stmts.next().value;
    if (!statement || statement.getRemainingSQL?.().trim()) throw Error('Enter one query.');
    const columns = statement.getColumnNames(), rows = [];
    while (rows.length < 201 && statement.step()) rows.push(statement.get());
    if (!stmts.next().done) throw Error('Enter one query.');
    postMessage({columns,rows:rows.slice(0,200),truncated:rows.length>200});
  } catch (err) { postMessage({error:err.message}); }
  finally { if (db) db.close(); }
};
