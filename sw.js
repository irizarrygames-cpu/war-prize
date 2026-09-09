// Deliberately does not cache anything.
//
// A service worker is what makes the game installable, but caching would be a trap:
// every screen here needs the server anyway (matches are dealt and judged there), so
// an offline copy could only ever show a broken game -- and a stale cache is how
// players end up stuck on an old version after an update, with no way to force a
// refresh. So this passes every request straight through to the network.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => e.respondWith(fetch(e.request)));
