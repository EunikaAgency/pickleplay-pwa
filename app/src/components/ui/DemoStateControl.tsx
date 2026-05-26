import { useState } from 'react';
import { Icon } from './Icon';
import { useDemoState, type DemoState } from '../../lib/demoState';

export function DemoStateControl() {
  const states: { id: DemoState; label: string; icon: string }[] = [
    { id: 'normal', label: 'Normal', icon: 'check' },
    { id: 'loading', label: 'Loading', icon: 'spinner' },
    { id: 'empty', label: 'Empty', icon: 'paddle' },
    { id: 'error', label: 'Error', icon: 'close' },
    { id: 'offline', label: 'Offline', icon: 'wifi_off' },
  ];
  const { state, setState, enabled } = useDemoState();
  const [open, setOpen] = useState(false);
  if (!enabled) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 'calc(96px + env(safe-area-inset-bottom))',
        zIndex: 1001,
      }}
    >
      {open ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '0.5px solid var(--hairline)',
            borderRadius: 16,
            padding: 10,
            boxShadow: 'var(--shadow-pop)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            minWidth: 160,
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px' }}
          >
            <span className="t-eyebrow">Demo state</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Collapse demo control"
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--muted)',
              }}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
          {states.map((s) => {
            const isActive = state === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setState(s.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: isActive ? 'var(--lime-soft)' : 'transparent',
                  color: isActive ? 'var(--lime-ink)' : 'var(--ink-2)',
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                <Icon name={s.icon} size={14} />
                {s.label}
              </button>
            );
          })}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 999,
            background: 'var(--coral-soft)',
            color: 'var(--coral)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 600,
            fontSize: 12,
            boxShadow: '0 8px 24px -8px rgba(207, 48, 0, 0.4)',
          }}
        >
          <Icon name="bolt" size={14} />
          Demo: {state}
        </button>
      )}
    </div>
  );
}
