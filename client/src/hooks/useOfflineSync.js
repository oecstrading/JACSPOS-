// ============================================================
// JACS POS - Offline Sync Hook
// File: client/src/hooks/useOfflineSync.js
// ============================================================
import { useState, useEffect, useCallback } from 'react';

const DB_NAME = 'jacspos-offline';
const DB_VERSION = 1;
const STORE_NAME = 'offlineSales';

// ── Open IndexedDB ────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

// ── Save a sale to IndexedDB ──────────────────────────────
async function saveOfflineSale(sale) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).add({
      ...sale,
      _queuedAt: new Date().toISOString(),
      _synced: false,
    });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Get all pending (unsynced) sales ──────────────────────
async function getPendingSales() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result.filter((s) => !s._synced));
    req.onerror = () => reject(req.error);
  });
}

// ── Mark a sale as synced ─────────────────────────────────
async function markSynced(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        record._synced = true;
        store.put(record);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// ── Main Hook ─────────────────────────────────────────────
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when we come back online
      syncNow();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for sync completion from service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_COMPLETE') {
          setLastSyncTime(new Date());
          refreshPendingCount();
        }
      });
    }

    // Initial count
    refreshPendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await getPendingSales();
      setPendingCount(pending.length);
    } catch (err) {
      console.warn('[OfflineSync] Could not count pending sales:', err);
    }
  }, []);

  // Save a sale — goes to server if online, IndexedDB if offline
  const saveSale = useCallback(async (saleData) => {
    if (isOnline) {
      try {
        const res = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saleData),
        });
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const result = await res.json();
        setLastSyncTime(new Date());
        return { success: true, online: true, data: result };
      } catch (err) {
        // Server failed — save offline as fallback
        console.warn('[OfflineSync] Server save failed, saving offline:', err);
        await saveOfflineSale(saleData);
        await refreshPendingCount();
        return { success: true, online: false, queued: true };
      }
    } else {
      // Definitely offline — save to IndexedDB
      await saveOfflineSale(saleData);
      await refreshPendingCount();
      return { success: true, online: false, queued: true };
    }
  }, [isOnline, refreshPendingCount]);

  // Manually trigger sync of all pending sales
  const syncNow = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);

    try {
      const pending = await getPendingSales();
      let synced = 0;

      for (const sale of pending) {
        try {
          const res = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sale),
          });
          if (res.ok) {
            await markSynced(sale.id);
            synced++;
          }
        } catch (err) {
          console.warn('[OfflineSync] Failed to sync sale:', sale.id, err);
        }
      }

      setLastSyncTime(new Date());
      await refreshPendingCount();
      return { synced, total: pending.length };
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, refreshPendingCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncTime,
    saveSale,
    syncNow,
    refreshPendingCount,
  };
}
