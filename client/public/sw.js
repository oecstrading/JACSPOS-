// ============================================================
// JACS POS - Service Worker (Offline Sync + PWA)
// File: client/public/sw.js
// ============================================================

const CACHE_NAME = 'jacs-pos-v2';
const OFFLINE_QUEUE_KEY = 'jacs-offline-sales';

// Files to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ── Install: cache static assets ──────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: serve from cache, fallback to network ──────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't intercept API calls (let them go to network)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        // If offline and it's a sale POST, queue it
        if (request.method === 'POST' && url.pathname === '/api/sales') {
          return request.clone().json().then((body) => {
            queueOfflineSale(body);
            return new Response(
              JSON.stringify({ queued: true, message: 'Sale saved offline. Will sync when online.' }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          });
        }
        return new Response(
          JSON.stringify({ error: 'You are offline. Please check your connection.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // For all other requests: cache-first strategy
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cache successful GET responses
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Return cached index.html for navigation requests (SPA fallback)
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// ── Background Sync: flush queued sales when online ───────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-sales') {
    event.waitUntil(syncQueuedSales());
  }
});

// ── Message handler: manual sync trigger from app ─────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_NOW') {
    syncQueuedSales().then(() => {
      event.ports[0]?.postMessage({ type: 'SYNC_COMPLETE' });
    });
  }
  if (event.data && event.data.type === 'QUEUE_SALE') {
    queueOfflineSale(event.data.sale);
    event.ports[0]?.postMessage({ type: 'QUEUED' });
  }
});

// ── Helper: save a sale to IndexedDB offline queue ────────
async function queueOfflineSale(sale) {
  const db = await openDB();
  const tx = db.transaction('offlineSales', 'readwrite');
  tx.objectStore('offlineSales').add({
    ...sale,
    _queuedAt: new Date().toISOString(),
    _synced: false,
  });
  return tx.complete;
}

// ── Helper: push all queued sales to server ───────────────
async function syncQueuedSales() {
  const db = await openDB();
  const tx = db.transaction('offlineSales', 'readwrite');
  const store = tx.objectStore('offlineSales');
  const all = await getAllFromStore(store);

  const pending = all.filter((s) => !s._synced);
  if (pending.length === 0) return;

  for (const sale of pending) {
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sale),
      });
      if (res.ok) {
        const updateTx = db.transaction('offlineSales', 'readwrite');
        updateTx.objectStore('offlineSales').put({ ...sale, _synced: true });
        await updateTx.complete;
      }
    } catch (err) {
      console.warn('[SW] Sync failed for sale:', sale._queuedAt, err);
    }
  }

  // Notify all open tabs that sync is done
  const clients = await self.clients.matchAll();
  clients.forEach((client) =>
    client.postMessage({ type: 'SYNC_COMPLETE', synced: pending.length })
  );
}

// ── IndexedDB helpers ─────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('jacspos-offline', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('offlineSales')) {
        db.createObjectStore('offlineSales', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
