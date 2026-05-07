// ============================================================
// JACS POS - Offline Indicator Banner
// File: client/src/components/OfflineIndicator.jsx  ← REPLACE existing file
// ============================================================
// HOW TO USE in App.jsx:
//   import OfflineIndicator from './components/OfflineIndicator';
//   Add <OfflineIndicator /> near the top of your app layout
// ============================================================

import React from 'react';
import { useOfflineSync } from '../hooks/useOfflineSync';

export default function OfflineIndicator() {
  const { isOnline, pendingCount, isSyncing, lastSyncTime, syncNow } = useOfflineSync();

  // Don't show anything when online with no pending sales
  if (isOnline && pendingCount === 0) return null;

  const bannerStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    padding: '10px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    fontSize: 13,
    fontWeight: 600,
    background: isOnline ? 'rgba(245, 158, 11, 0.95)' : 'rgba(239, 68, 68, 0.95)',
    color: 'white',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
  };

  return (
    <div style={bannerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{isOnline ? '⚠️' : '📵'}</span>
        <span>
          {isOnline
            ? `${pendingCount} sale${pendingCount !== 1 ? 's' : ''} waiting to sync to server`
            : `You are offline — sales are being saved locally (${pendingCount} pending)`}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {lastSyncTime && (
          <span style={{ fontSize: 11, opacity: 0.8 }}>
            Last sync: {lastSyncTime.toLocaleTimeString()}
          </span>
        )}
        {isOnline && pendingCount > 0 && (
          <button
            onClick={syncNow}
            disabled={isSyncing}
            style={{
              padding: '6px 14px',
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: 8,
              color: 'white',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 600,
              opacity: isSyncing ? 0.6 : 1,
            }}
          >
            {isSyncing ? '⏳ Syncing...' : '🔄 Sync Now'}
          </button>
        )}
      </div>
    </div>
  );
}
