const files = [
  "academy.svg",
  "app.js",
  "catalog.json",
  "challenges.js",
  "challenges.json",
  "code_meta.json",
  "curriculum.json",
  "introduction.json",
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
  "data/training.db",
  "enrichment.json",
  "extended.json",
  "field-guide.js",
  "index.html",
  "library.js",
  "manifest.webmanifest",
  "query-client.js",
  "quizzes.json",
  "sql-asm.js",
  "style.css",
  "training-worker.js",
  "workshops.js"
];
const prefix = 'eam-academy:' + self.registration.scope + ':';
const version = prefix + '1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(version).then(cache => cache.addAll(files.map(file => new Request(file, {cache:'reload'})))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(prefix) && key !== version).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !url.href.startsWith(self.registration.scope)) return;
  const key = event.request.mode === 'navigate' ? new URL('index.html',self.registration.scope).href : event.request;
  event.respondWith(caches.open(version).then(async cache => await cache.match(key) || fetch(event.request)));
});
