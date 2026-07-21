import { useEffect, useState, useCallback } from 'react';

/**
 * /plan-pdfs — a public viewer for the audit/plan PDFs that live in the repo's
 * `plan/` directory. The Vite dev server exposes them via `/__plan/list.json`
 * (enumerate) and `/__plan/file/<name>` (stream inline); see `planPdfServer()`
 * in vite.config.ts. Tapping a report previews the PDF full-screen in the
 * browser's native viewer. Replaces the old /flowchart page.
 */

interface PlanPdf {
  name: string;
  size: number;
  mtime: number;
}

const ACCENT = '#14b8a6';
const INK = '#1a2138';

function prettyTitle(name: string): string {
  const base = name.replace(/\.pdf$/i, '');
  // Keep an explicit "project-gap-prevention:" style prefix readable, and turn
  // the rest of the slug into spaced words.
  const spaced = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatDate(ms: number): string {
  try {
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function PlanPdfsPage() {
  const [items, setItems] = useState<PlanPdf[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selected, setSelected] = useState<PlanPdf | null>(null);

  const load = useCallback(() => {
    setStatus('loading');
    fetch('/__plan/list.json', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { items?: PlanPdf[] }) => {
        setItems(Array.isArray(data.items) ? data.items : []);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const goHome = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.assign('/');
  };

  const wrap: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#f6f8fc',
    color: INK,
    fontFamily: "'Nunito Sans', -apple-system, 'Segoe UI', Roboto, sans-serif",
    zIndex: 1,
  };

  const header: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    paddingTop: 'max(14px, env(safe-area-inset-top))',
    background: '#fff',
    borderBottom: '1px solid #e6eaf3',
    flexShrink: 0,
  };

  const iconBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: 12,
    border: '1px solid #e6eaf3',
    background: '#fff',
    color: INK,
    fontSize: 20,
    cursor: 'pointer',
    flexShrink: 0,
  };

  // ── Preview mode ──────────────────────────────────────────────
  if (selected) {
    return (
      <div style={wrap}>
        <div style={header}>
          <button style={iconBtn} onClick={() => setSelected(null)} aria-label="Back to list">←</button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 16, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {prettyTitle(selected.name)}
            </div>
            <div style={{ fontSize: 12, color: '#6b7488' }}>{formatSize(selected.size)} · {formatDate(selected.mtime)}</div>
          </div>
          <a
            href={`/__plan/file/${encodeURIComponent(selected.name)}`}
            target="_blank"
            rel="noreferrer"
            style={{ ...iconBtn, width: 'auto', padding: '0 14px', textDecoration: 'none', fontSize: 13, fontWeight: 700, color: ACCENT }}
          >
            Open ↗
          </a>
        </div>
        <iframe
          title={selected.name}
          src={`/__plan/file/${encodeURIComponent(selected.name)}#view=FitH`}
          style={{ flex: 1, width: '100%', border: 0, background: '#525659' }}
        />
      </div>
    );
  }

  // ── List mode ─────────────────────────────────────────────────
  return (
    <div style={wrap}>
      <div style={header}>
        <button style={iconBtn} onClick={goHome} aria-label="Home">←</button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 18, lineHeight: 1.15 }}>Operational Gaps</div>
          <div style={{ fontSize: 12, color: '#6b7488' }}>Reliability audit reports</div>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${ACCENT}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🛡️</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {status === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1, 2].map((k) => (
                <div key={k} style={{ height: 84, borderRadius: 16, background: 'linear-gradient(90deg,#eef1f7,#f6f8fc,#eef1f7)', backgroundSize: '200% 100%', animation: 'opgShimmer 1.3s infinite' }} />
              ))}
            </div>
          )}

          {status === 'error' && (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>⚠️</div>
              <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 18, marginBottom: 6 }}>Couldn't load reports</div>
              <div style={{ color: '#6b7488', fontSize: 14, marginBottom: 18 }}>The plan directory couldn't be read.</div>
              <button
                onClick={load}
                style={{ padding: '10px 20px', borderRadius: 12, border: 0, background: ACCENT, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Try again
              </button>
            </div>
          )}

          {status === 'ready' && items.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
              <div style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 18, marginBottom: 6 }}>No reports yet</div>
              <div style={{ color: '#6b7488', fontSize: 14 }}>No PDF reports were found in the plan directory.</div>
            </div>
          )}

          {status === 'ready' && items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map((it) => (
                <button
                  key={it.name}
                  onClick={() => setSelected(it)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
                    padding: 16, borderRadius: 16, border: '1px solid #e6eaf3', background: '#fff', cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(26,33,56,0.05)',
                  }}
                >
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: '#fdecec', color: '#d64545', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📕</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 15, lineHeight: 1.25, color: INK }}>{prettyTitle(it.name)}</div>
                    <div style={{ fontSize: 12, color: '#6b7488', marginTop: 3 }}>PDF · {formatSize(it.size)} · {formatDate(it.mtime)}</div>
                  </div>
                  <div style={{ color: ACCENT, fontSize: 20, flexShrink: 0 }}>›</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes opgShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
    </div>
  );
}
