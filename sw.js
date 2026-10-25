// オフラインでも うごくように ファイルを とっておく
const CACHE = 'aiueo-v3';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/strokes.js', 'js/kana.js', 'js/speech.js', 'js/write.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'voice/index.js',
];
// ずんだもんの こえも さいしょに ぜんぶ とっておく
self.window = self;
importScripts('voice/index.js');
const VOICE_FILES = Object.values(self.VOICE || {}).map(f => 'voice/' + f);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([...FILES, ...VOICE_FILES])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// さきに ネットを みて、つながらなければ とっておいた ものを つかう（フォントも ここで とっておく）
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
