/**
 * PlanTelligence service worker.
 *
 * Deliberately tiny and cache-free. It exists so the portal can be installed as an app (browsers
 * require a service worker for a PWA) and so the installed app keeps working like a normal page.
 *
 * No precache and no offline shell: a plan's content is live, per-participant data behind a slug,
 * and serving a stale copy of somebody's benefits portal is worse than showing the browser's
 * offline page. The fetch handler is a pure pass-through — it never calls `respondWith`, so every
 * request takes the network path exactly as it would without a service worker.
 *
 * It also owns WEB PUSH, which is why it exists on the dashboard too and not only on the portal.
 * `push` and `notificationclick` are one-way events: the browser wakes this worker, we show a
 * notification, and a tap opens the URL the payload names. Neither event can influence a request,
 * so the "network for everything" rule above still holds — do not be tempted to add caching when
 * touching the push code below.
 *
 * One worker serves BOTH surfaces: the dashboard and every plan portal live on the same origin under
 * scope `/`. A `PushSubscription` therefore belongs to the browser, not to the installed app, and
 * the payload — not the registration — decides where a tap lands. See plans/web-push-notifications.md.
 */

self.addEventListener("install", () => {
  // Activate this worker immediately instead of waiting for every portal tab to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intentionally empty: network for everything. See the header comment.
});

/* ─────────────────────────────── Web push ─────────────────────────────── */

/** Title used when a payload arrives without one (or with an unusable one). */
const FALLBACK_TITLE = "PlanTelligence";

/** Where a tap goes when the payload names nowhere safe. */
const FALLBACK_URL = "/";

/**
 * Read the push payload without trusting it.
 *
 * A payload is attacker-influenced data from our own server, but it crosses the app boundary into a
 * privileged context, so every field is treated as unknown: `json()` throws on a non-JSON body, and
 * a bare `text()` push (what `web-push` sends when a sender omits the payload entirely) is still a
 * perfectly valid message that must not crash the handler.
 */
function readPayload(event) {
  if (!event.data) return {};
  try {
    const parsed = event.data.json();
    if (parsed && typeof parsed === "object") return parsed;
    // A JSON scalar or array is not a shape we send; keep the text as the body rather than dropping
    // the notification, which would look like push silently failing.
    return { body: String(parsed) };
  } catch {
    try {
      return { body: event.data.text() };
    } catch {
      return {};
    }
  }
}

function safeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Resolve a payload URL to an ABSOLUTE same-origin URL.
 *
 * Same-origin is a security rule, not a convenience: a notification tap is a navigation the user did
 * not type, so a payload that could name `https://evil.test/…` would turn every push into a phishing
 * redirect. Anything off-origin collapses to the fallback.
 */
function resolveUrl(value) {
  const raw = safeString(value);
  if (!raw) return new URL(FALLBACK_URL, self.location.origin).href;
  try {
    const resolved = new URL(raw, self.location.origin);
    if (resolved.origin !== self.location.origin) {
      return new URL(FALLBACK_URL, self.location.origin).href;
    }
    return resolved.href;
  } catch {
    return new URL(FALLBACK_URL, self.location.origin).href;
  }
}

self.addEventListener("push", (event) => {
  const payload = readPayload(event);

  const title = safeString(payload.title) || FALLBACK_TITLE;
  const tag = safeString(payload.tag);

  const options = {
    body: safeString(payload.body) || "",
    icon: safeString(payload.icon) || "/pwa/icon-192.png",
    badge: safeString(payload.badge) || "/pwa/icon-192.png",
    // `tag` COLLAPSES: a newer notification with the same tag replaces the older one instead of
    // stacking, which is what a thread wants — five replies are one tray entry, not five.
    tag: tag || undefined,
    // `renotify` is only legal alongside a tag (the spec throws otherwise), and it is what makes a
    // replacement buzz again instead of silently swapping the text.
    renotify: tag ? true : undefined,
    // The click handler reads this back; nothing else is trusted from the payload.
    data: {
      url: resolveUrl(payload.url),
      type: safeString(payload.type),
      id: safeString(payload.id),
    },
  };

  // A failed showNotification (e.g. the permission was revoked between send and delivery) must not
  // surface as an unhandled rejection, so the promise is caught rather than left dangling.
  event.waitUntil(
    self.registration.showNotification(title, options).catch(() => undefined),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target =
    event.notification.data && typeof event.notification.data.url === "string"
      ? resolveUrl(event.notification.data.url)
      : resolveUrl(null);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Prefer a tab that is already ours: focus it, then send it to the deep link. `navigate` is
      // same-origin only, which `resolveUrl` has already guaranteed.
      for (const client of windows) {
        try {
          await client.focus();
          if (typeof client.navigate === "function") {
            await client.navigate(target);
          } else {
            // Older/limited clients cannot be navigated; ask the page to route instead.
            client.postMessage({ type: "push:navigate", url: target });
          }
          return;
        } catch {
          // Try the next window rather than abandoning the tap entirely.
        }
      }

      // No window open: launch the installed app (or a tab) at the deep link.
      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })(),
  );
});
