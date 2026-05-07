import React, { useState, useEffect } from 'react';
import LightningCheckout from './components/LightningCheckout.jsx';
import OfflineIndicator from './components/OfflineIndicator.jsx';
import QBOConnect from './components/QBOConnect.jsx';

// ── Global styles ─────────────────────────────────────────
const globalStyle = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0F172A; color: white; overflow-x: hidden; }
  :root {
    --color-bg: #0F172A;
    --color-surface: #1E293B;
    --color-border: rgba(51,65,85,0.6);
    --color-accent: #6366F1;
    --color-success: #10B981;
    --color-warning: #F59E0B;
    --color-danger: #EF4444;
    --color-text-muted: #64748B;
  }
  .btn-premium {
    background: linear-gradient(135deg, #6366F1, #8B5CF6);
    border: none; border-radius: 12px; color: white;
    font-weight: 700; cursor: pointer; transition: all 0.2s;
  }
  .btn-premium:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(99,102,241,0.4); }
  .btn-premium:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  input, select { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.4); border-radius: 3px; }
`;

const INDUSTRIES = [
  { id: 'restaurant', name: 'Restaurant / Café', icon: '🍽️', desc: 'Tables, tips, kitchen display' },
  { id: 'retail', name: 'Retail Store', icon: '🛍️', desc: 'Barcode scanning, inventory' },
  { id: 'wholesale', name: 'Wholesale / Distribution', icon: '🏭', desc: 'Bulk pricing, net terms' },
  { id: 'wholesale_retail', name: 'Wholesale + Retail', icon: '🏪🏭', desc: 'Dual-mode: retail POS + wholesale orders, bulk & unit pricing' },
  { id: 'medical', name: 'Medical Practice', icon: '🏥', desc: 'Patient check-in, copay' },
  { id: 'airbnb', name: 'Airbnb / Vacation Rental', icon: '🏡', desc: 'Booking calendar, channels' },
  { id: 'hotel', name: 'Small Hotel / Motel', icon: '🏨', desc: 'Front desk, housekeeping' },
  { id: 'transport', name: 'Bus & Taxi Service', icon: '🚌', desc: 'Dispatch, fare tracking' },
  { id: 'service', name: 'Service Business', icon: '🔧', desc: 'Appointments, time tracking' },
];

// ── Onboarding Screen ─────────────────────────────────────
function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [classifying, setClassifying] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const classifyBusiness = async () => {
    if (!businessName.trim()) return;
    setClassifying(true);
    try {
      const res = await fetch('/api/classify-business', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: businessName }),
      });
      const data = await res.json();
      setAiResult(data);
      const match = INDUSTRIES.find(i => i.id === data.primaryType);
      if (match) setSelectedIndustry(match);
      setStep(2);
    } catch {
      setStep(2);
    } finally {
      setClassifying(false);
    }
  };

  const handleComplete = () => {
    const config = { businessName, industry: selectedIndustry?.id || 'retail', ...aiResult };
    localStorage.setItem('jacs_config', JSON.stringify(config));
    onComplete(config);
  };

  const cardStyle = (selected) => ({
    background: selected ? 'rgba(99,102,241,0.15)' : 'rgba(30,41,59,0.8)',
    border: `2px solid ${selected ? '#6366F1' : 'rgba(51,65,85,0.5)'}`,
    borderRadius: 16, padding: 20, cursor: 'pointer', transition: 'all 0.2s',
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #0F172A 100%)' }}>
      <div style={{ maxWidth: 640, width: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🏪</div>
          <h1 style={{ fontSize: 36, fontWeight: 900, background: 'linear-gradient(135deg, #6366F1, #A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>JACS POS</h1>
          <p style={{ color: '#94A3B8', fontSize: 16 }}>AI-Powered Point of Sale · QuickBooks Online Ready</p>
        </div>

        {step === 1 && (
          <div style={{ background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 24, padding: 40 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>What is your business name?</h2>
            <p style={{ color: '#94A3B8', marginBottom: 24, fontSize: 14 }}>Our AI will automatically configure the POS for your industry.</p>
            <input
              type="text"
              placeholder="e.g. Mario's Pizza, City Pharmacy, Sunset Hotel..."
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && businessName.trim() && classifyBusiness()}
              style={{ width: '100%', padding: '16px 20px', background: 'rgba(15,23,42,0.8)', border: '2px solid rgba(99,102,241,0.4)', borderRadius: 14, color: 'white', fontSize: 16, outline: 'none', marginBottom: 16 }}
              autoFocus
            />
            <button onClick={classifyBusiness} disabled={!businessName.trim() || classifying} className="btn-premium" style={{ width: '100%', padding: 16, fontSize: 16 }}>
              {classifying ? '🧠 AI is analyzing your business...' : '🚀 Set Up My POS'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 13 }}>Skip — choose industry manually →</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            {aiResult && (
              <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 16, padding: 16, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>🧠</span>
                <div>
                  <div style={{ fontWeight: 600, color: '#A78BFA' }}>AI detected: {aiResult.subCategory}</div>
                  <div style={{ fontSize: 13, color: '#94A3B8' }}>{aiResult.confidence}% confidence · Pre-selected below</div>
                </div>
              </div>
            )}
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Confirm your industry</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
              {INDUSTRIES.map(ind => (
                <div key={ind.id} style={cardStyle(selectedIndustry?.id === ind.id)} onClick={() => setSelectedIndustry(ind)}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{ind.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{ind.name}</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>{ind.desc}</div>
                </div>
              ))}
            </div>
            <button onClick={handleComplete} disabled={!selectedIndustry} className="btn-premium" style={{ width: '100%', padding: 16, fontSize: 16 }}>
              ✅ Launch {selectedIndustry?.name || 'POS'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Settings Panel ────────────────────────────────────────
function Settings({ config, onBack }) {
  const [healthData, setHealthData] = useState(null);
  const [salesData, setSalesData] = useState(null);

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setHealthData).catch(() => {});
    fetch('/api/sales?limit=10').then(r => r.json()).then(setSalesData).catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', padding: 24 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <button onClick={onBack} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '8px 16px', color: '#818CF8', cursor: 'pointer' }}>← Back to POS</button>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>⚙️ Settings & Status</h1>
        </div>

        {/* System Health */}
        <div style={{ background: '#1E293B', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 20, padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 16, fontSize: 16 }}>🔍 System Health</h2>
          {healthData ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Server', value: healthData.status, ok: healthData.status === 'healthy' },
                { label: 'DeepSeek AI', value: healthData.ai, ok: healthData.ai?.includes('Active') },
                { label: 'QuickBooks', value: healthData.qbo, ok: healthData.qbo?.includes('Configured') },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(15,23,42,0.5)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{item.ok ? '✅' : '⚠️'}</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: item.ok ? '#10B981' : '#F59E0B', marginTop: 4 }}>{item.value}</div>
                </div>
              ))}
            </div>
          ) : <div style={{ color: '#64748B' }}>Loading...</div>}
        </div>

        {/* Business Info */}
        <div style={{ background: '#1E293B', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 20, padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 16, fontSize: 16 }}>🏪 Business Configuration</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Business Name</div>
              <div style={{ fontWeight: 600 }}>{config?.businessName || 'Not set'}</div>
            </div>
            <div style={{ background: 'rgba(15,23,42,0.5)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Industry</div>
              <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{config?.industry || 'retail'}</div>
            </div>
          </div>
          <button onClick={() => { localStorage.removeItem('jacs_config'); window.location.reload(); }}
            style={{ marginTop: 16, padding: '10px 20px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#FCA5A5', cursor: 'pointer', fontSize: 13 }}>
            🔄 Reset & Re-run Onboarding
          </button>
        </div>

        {/* QuickBooks */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 16, fontSize: 16 }}>📊 QuickBooks Online</h2>
          <QBOConnect />
        </div>

        {/* Recent Sales */}
        <div style={{ background: '#1E293B', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 20, padding: 24 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 16, fontSize: 16 }}>💰 Recent Sales ({salesData?.sales?.length || 0})</h2>
          {salesData?.sales?.length > 0 ? (
            <div>
              {salesData.sales.map(sale => (
                <div key={sale.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(51,65,85,0.3)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>${sale.total?.toFixed(2)}</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{sale.paymentMethod} · {sale.items?.length || 0} items</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', textAlign: 'right' }}>
                    {new Date(sale.savedAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748B', textAlign: 'center', padding: 20 }}>No sales yet. Complete a transaction in the POS to see it here.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────
export default function App() {
  const [config, setConfig] = useState(null);
  const [view, setView] = useState('pos'); // 'pos' | 'settings'
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('jacs_config');
    if (saved) {
      try { setConfig(JSON.parse(saved)); } catch {}
    }
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  if (!config) return <><style>{globalStyle}</style><Onboarding onComplete={c => setConfig(c)} /></>;

  if (view === 'settings') return <><style>{globalStyle}</style><Settings config={config} onBack={() => setView('pos')} /></>;

  const industry = INDUSTRIES.find(i => i.id === config.industry) || INDUSTRIES[1];

  return (
    <>
      <style>{globalStyle}</style>
      <OfflineIndicator />
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* Top Nav */}
        <div style={{ background: '#1E293B', borderBottom: '1px solid rgba(51,65,85,0.5)', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>🏪</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'white' }}>JACS POS</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>{config.businessName || 'My Business'} · {industry.icon} {industry.name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setView('settings')} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '6px 14px', color: '#818CF8', cursor: 'pointer', fontSize: 13 }}>⚙️ Settings</button>
          </div>
        </div>

        {/* POS Area */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <LightningCheckout config={{ paymentMethods: ['cash', 'card', 'contactless', 'gift_card'], ...config }} />
        </div>
      </div>
    </>
  );
}
