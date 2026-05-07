// ============================================================
// JACS POS - QuickBooks Online OAuth + Sale Push
// server/qbo.js
// ============================================================
import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = join(__dirname, 'data', 'qbo_tokens.json');
const router = express.Router();

// ── Token helpers ─────────────────────────────────────────
function loadTokens() {
  try {
    if (existsSync(TOKEN_FILE)) return JSON.parse(readFileSync(TOKEN_FILE, 'utf8'));
  } catch {}
  return null;
}
function saveTokens(data) {
  const dir = join(__dirname, 'data');
  if (!existsSync(dir)) { import('fs').then(fs => fs.mkdirSync(dir, { recursive: true })); }
  try { writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2)); } catch {}
}

// ── GET /api/qbo/status ───────────────────────────────────
router.get('/status', (req, res) => {
  const tokens = loadTokens();
  if (!tokens) return res.json({ connected: false });
  const expired = Date.now() > new Date(tokens.expires_at).getTime();
  res.json({
    connected: !expired,
    realm_id: tokens.realm_id,
    connected_at: tokens.connected_at,
    expires_at: tokens.expires_at,
    expired,
  });
});

// ── GET /api/qbo/connect ──────────────────────────────────
router.get('/connect', (req, res) => {
  const clientId = process.env.QBO_CLIENT_ID;
  if (!clientId) {
    return res.status(400).json({ error: 'QBO_CLIENT_ID not configured in .env file. See INSTRUCTIONS.md Step 5.' });
  }
  const state = Math.random().toString(36).substring(2);
  res.cookie('qbo_state', state, { httpOnly: true, maxAge: 600000 });
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: process.env.QBO_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/qbo/callback`,
    response_type: 'code',
    access_type: 'offline',
    state,
  });
  res.redirect(`https://appcenter.intuit.com/connect/oauth2?${params}`);
});

// ── GET /api/qbo/callback ─────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code, realmId, state } = req.query;
  if (!code || !realmId) return res.redirect('/?qbo_error=Missing+code+or+realmId');

  try {
    const clientId = process.env.QBO_CLIENT_ID;
    const clientSecret = process.env.QBO_CLIENT_SECRET;
    const redirectUri = process.env.QBO_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/qbo/callback`;

    const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('[QBO] Token exchange failed:', err);
      return res.redirect(`/?qbo_error=${encodeURIComponent('Token exchange failed: ' + err)}`);
    }

    const tokens = await tokenRes.json();
    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      realm_id: realmId,
      connected_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    };
    saveTokens(tokenData);
    console.log('[QBO] ✅ Connected to QuickBooks! Realm:', realmId);
    res.redirect('/?qbo_connected=true');
  } catch (err) {
    console.error('[QBO] Callback error:', err);
    res.redirect(`/?qbo_error=${encodeURIComponent(err.message)}`);
  }
});

// ── POST /api/qbo/disconnect ──────────────────────────────
router.post('/disconnect', (req, res) => {
  try {
    if (existsSync(TOKEN_FILE)) writeFileSync(TOKEN_FILE, '{}');
  } catch {}
  res.json({ success: true });
});

// ── POST /api/qbo/push-sale ───────────────────────────────
router.post('/push-sale', async (req, res) => {
  const tokens = loadTokens();
  if (!tokens || !tokens.access_token) {
    return res.status(400).json({ error: 'QuickBooks not connected. Visit /api/qbo/connect first.' });
  }

  const { items = [], total, paymentMethod = 'cash', customerName = 'Walk-in Customer', saleDate } = req.body;
  const env = process.env.QBO_ENVIRONMENT === 'production' ? 'quickbooks.api.intuit.com' : 'sandbox-quickbooks.api.intuit.com';
  const itemId = process.env.QBO_DEFAULT_ITEM_ID || '1';

  const salesReceipt = {
    CustomerRef: { value: '1', name: customerName },
    TxnDate: saleDate || new Date().toISOString().split('T')[0],
    PaymentMethodRef: { value: paymentMethod === 'cash' ? '1' : '2' },
    Line: items.length > 0
      ? items.map((item, idx) => ({
          Id: String(idx + 1),
          LineNum: idx + 1,
          Amount: parseFloat((item.price * item.qty).toFixed(2)),
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: {
            ItemRef: { value: itemId, name: item.name },
            Qty: item.qty,
            UnitPrice: item.price,
          },
        }))
      : [{
          Id: '1',
          LineNum: 1,
          Amount: parseFloat(total.toFixed(2)),
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: { ItemRef: { value: itemId, name: 'Sale' }, Qty: 1, UnitPrice: total },
        }],
    TotalAmt: parseFloat(total.toFixed(2)),
  };

  try {
    const qboRes = await fetch(
      `https://${env}/v3/company/${tokens.realm_id}/salesreceipt?minorversion=65`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(salesReceipt),
      }
    );

    if (!qboRes.ok) {
      const err = await qboRes.json();
      console.error('[QBO] Push failed:', JSON.stringify(err));
      return res.status(400).json({ error: 'QBO push failed', details: err });
    }

    const result = await qboRes.json();
    console.log('[QBO] ✅ Sale pushed! Receipt ID:', result.SalesReceipt?.Id);
    res.json({ success: true, receiptId: result.SalesReceipt?.Id });
  } catch (err) {
    console.error('[QBO] Push error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
