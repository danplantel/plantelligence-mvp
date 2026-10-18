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
