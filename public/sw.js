// 하이파이브 아카이브 알림용 서비스워커 — 화면이 닫혀 있어도 휴대폰 알림을 띄운다
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "하이파이브 아카이브", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "하이파이브 아카이브";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: "./icon-192.png",
    badge: "./badge-96.png",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { link: data.link || "./" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "./";
  const target = new URL(link.startsWith("#") ? "./" + link : link, self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.registration.scope)) {
        await client.focus();
        client.postMessage({ type: "open-link", link });
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
