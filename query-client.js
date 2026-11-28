function runTrainingQuery(sql, dataset = 'training', tables = null) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('training-worker.js');
    const finish = () => { clearTimeout(timer); worker.terminate(); };
    const timer = setTimeout(() => {
      finish();
      reject(new Error('Query time limit reached. Narrow the joins or add a filter.'));
    }, 10000);
    worker.onerror = () => { finish(); reject(new Error('Training engine could not start')); };
    worker.onmessage = ({ data }) => {
      finish();
      if (data.error) reject(new Error(data.error));
      else resolve(data);
    };
    worker.postMessage(tables ? { sql, dataset, tables } : { sql, dataset });
  });
}
