// ============================================================
// JACS POS - QuickBooks Online Connect Button
// File: client/src/components/QBOConnect.jsx
// ============================================================
// HOW TO USE in your app:
//   import QBOConnect from './components/QBOConnect';
//   <QBOConnect />
// ============================================================

import React, { useState, useEffect } from 'react';

export default function QBOConnect() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Check if QBO is already connected
  useEffect(() => {
    checkStatus();

    // Check URL params for success/error after OAuth redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('qbo_connected') === 'true') {
      setError('');
      window.history.replaceState({}, '', window.location.pathname);
      checkStatus();
    }
    if (params.get('qbo_error')) {
      setError(decodeURIComponent(params.get('qbo_error')));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/qbo/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    // Redirect to QBO OAuth flow
    window.location.href = '/api/qbo/connect';
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect QuickBooks Online? You can reconnect at any time.')) return;
    try {
      await fetch('/api/qbo/disconnect', { method: 'POST' });
      setStatus({ connected: false });
    } catch {
      setError('Failed to disconnect. Please try again.');
    }
  };

  const containerStyle = {
    background: 'rgba(30, 41, 59, 0.8)',
    border: '1px solid rgba(51, 65, 85, 0.5)',
    borderRadius: 16,
    padding: 24,
    maxWidth: 480,
    color: 'white',
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ color: '#94A3B8', textAlign: 'center' }}>Checking QuickBooks status...</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 32 }}>📊</span>
        <div>
          <h3 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>QuickBooks Online</h3>
          <p style={{ color: '#94A3B8', fontSize: 13, margin: 0 }}>Sync sales automatically</p>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: '#FCA5A5' }}>
          ⚠️ {error}
        </div>
      )}

      {status?.connected ? (
        <div>
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ color: '#10B981', fontSize: 18 }}>✅</span>
              <span style={{ fontWeight: 600, color: '#10B981' }}>Connected</span>
            </div>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>
              Company ID: {status.realm_id}<br />
              Connected: {new Date(status.connected_at).toLocaleDateString()}<br />
              Token expires: {new Date(status.expires_at).toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleDisconnect}
              style={{ flex: 1, padding: '10px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#FCA5A5', cursor: 'pointer', fontSize: 13 }}
            >
              Disconnect
            </button>
            <button
              onClick={checkStatus}
              style={{ flex: 1, padding: '10px 16px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, color: '#818CF8', cursor: 'pointer', fontSize: 13 }}
            >
              Refresh Status
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p style={{ color: '#94A3B8', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
            Connect your QuickBooks Online account to automatically sync every sale as a Sales Receipt.
          </p>
          <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12, color: '#94A3B8' }}>
            <strong style={{ color: '#818CF8' }}>Before connecting:</strong><br />
            Make sure QBO_CLIENT_ID and QBO_CLIENT_SECRET are set in your .env file.
            <br /><br />
            <strong style={{ color: '#818CF8' }}>First time setup:</strong><br />
            1. Go to developer.intuit.com<br />
            2. Create an app → copy Client ID & Secret to .env<br />
            3. Add redirect URI: <code style={{ color: '#A78BFA' }}>{window.location.origin}/api/qbo/callback</code>
          </div>
          <button
            onClick={handleConnect}
            style={{
              width: '100%', padding: '14px 20px',
              background: 'linear-gradient(135deg, #2CA01C, #1A7A12)',
              border: 'none', borderRadius: 12, color: 'white',
              fontWeight: 700, fontSize: 15, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}
          >
            <span>🔗</span> Connect QuickBooks Online
          </button>
        </div>
      )}
    </div>
  );
}
