const files = [
  "academy.svg",
  "social-preview.png",
  "app.js",
  "study.css",
  "pump-scene.css",
  "appearance.js",
  "lesson-visuals.js",
  "pump-scene.js",
  "lesson-notes.json",
  "lesson-records.json",
  "data/object-trace.js",
  "data/trace-view.js",
  "data/db-evidence.json",
  "data/database-reference.html",
  "data/database-reference.js",
  "catalog.json",
  "challenges.js",
  "challenges.json",
  "code_meta.json",
  "curriculum.json",
  "introduction.json",
  "lesson-diagrams.json",
  "data/lesson-illustrations.svg",
  "data/eam-introduction-pages-2-3.pdf",
  "data/code-0.json",
  "data/code-1.json",
  "data/code-10.json",
  "data/code-2.json",
  "data/code-3.json",
  "data/code-4.json",
  "data/code-5.json",
  "data/code-6.json",
  "data/code-7.json",
  "data/code-8.json",
  "data/code-9.json",
  "data/code.json",
  "data/docs-0.json",
  "data/docs-1.json",
  "data/docs-2.json",
  "data/docs-3.json",
  "data/docs-4.json",
  "data/docs.json",
  "data/practice-0.db",
  "data/practice-1.db",
  "data/schema.json",
  "data/tables.json",
  "data/tables-0.json",
  "data/tables-1.json",
  "data/tables-2.json",
  "data/tables-3.json",
  "data/training.db",
  "enrichment.json",
  "extended.json",
  "field-guide.js",
  "index.html",
  "library.js",
  "manifest.webmanifest",
  "profiles.js",
  "query-client.js",
  "quizzes.json",
  "sql-asm.js",
  "style.css",
  "training-worker.js",
  "workshops.js"
];
const prefix = 'eam-academy:' + self.registration.scope + ':';
const version = prefix + '3';
const cacheName = version + ':r5-vanilla-v3';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(files.map(file => new Request(file, {cache:'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(prefix) && key !== cacheName).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !url.href.startsWith(self.registration.scope)) return;
  const key = event.request.mode === 'navigate' && url.href === self.registration.scope ? new URL('index.html',self.registration.scope).href : event.request;
  const matchOptions = {ignoreSearch: url.pathname.endsWith('/style.css')};
  const isDataAsset = url.pathname.includes('/data/') && url.pathname.endsWith('.json');
  const freshShell = !isDataAsset && (event.request.mode === 'navigate' || /\.(html|js|css|db)$/.test(url.pathname));
  event.respondWith(caches.open(cacheName).then(async cache => {
    if (freshShell) {
      try {
        const response = await fetch(event.request, {cache: 'no-cache'});
        if (response.ok) {
          await cache.put(key, response.clone());
          return response;
        }
        return await cache.match(key, matchOptions) || response;
      } catch (error) {
        const saved = await cache.match(key, matchOptions);
        if (saved) return saved;
        throw error;
      }
    }
    return await cache.match(key, matchOptions) || fetch(event.request);
  }));
});
