// Mochila service worker: offline copy of the app + school alerts.
const C = "mochila-v1";
const API = "https://tkorpuzmxftlplzeztbl.supabase.co/rest/v1/rpc/get_app";
const KEY = "sb_publishable_owO1bzkFxYcrUCgCNGscGw_Bl6dw3a1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(C).then((c) => c.addAll(SHELL)).catch(() => {}));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network first, so updates arrive straight away; the saved copy is only used when offline.
self.addEventListener("fetch", (e) => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== "GET" || u.origin !== location.origin || u.pathname.endsWith("version.json") || u.pathname.endsWith("sw.js")) return;
  const key = req.mode === "navigate" ? "./index.html" : req;
  e.respondWith(
    fetch(req).then((r) => {
      if (r.ok && r.type === "basic") { const cp = r.clone(); caches.open(C).then((c) => c.put(key, cp)); }
      return r;
    }).catch(() => caches.match(key).then((r) => r || caches.match("./index.html")))
  );
});

const ICONS = { dana: "⚠️ ", esalert: "🚨 ", cancel: "❌ ", holiday: "🏖️ ", dayoff: "📅 ", public: "📅 ", general: "📣 " };
self.addEventListener("push", (e) => {
  e.waitUntil((async () => {
    let lang = "en";
    try { const r = await caches.match("./__lang"); if (r && (await r.text()) === "es") lang = "es"; } catch (x) {}
    let title = "Mochila", body = lang === "es" ? "Hay una noticia nueva del colegio." : "There is new school news.";
    try {
      const r = await fetch(API, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: "{}" });
      const j = await r.json();
      const n = ((j && j.pub && j.pub.news) || [])[0];
      if (n) {
        title = (ICONS[n.cat] || "") + ((lang === "es" && n.title_es) || n.title);
        body = String((lang === "es" && n.text_es) || n.text || "").slice(0, 200);
      }
    } catch (x) {}
    await self.registration.showNotification(title, { body, icon: "icon-192.png", badge: "icon-192.png", tag: "mochila-news", renotify: true, data: { url: "./" } });
  })());
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((l) => {
    for (const c of l) if ("focus" in c) return c.focus();
    return self.clients.openWindow("./");
  }));
});
