// Minimal service worker for Web Push (Announcement Module). Registered at
// scope "/" from usePushNotifications.ts. Only handles push delivery and
// notification clicks — no offline caching/asset strategy is implemented
// here, that's a separate concern from push.

self.addEventListener("push", (event) => {
  let payload = { title: "New notification", body: "" };
  try {
    if (event.data) payload = event.data.json();
  } catch {
    // Non-JSON payloads are ignored — every push sent by this app is JSON.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.svg",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
