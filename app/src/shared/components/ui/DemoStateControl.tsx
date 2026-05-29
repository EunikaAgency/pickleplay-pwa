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
    <div className="demo-control fixed right-4 z-[1001] bottom-[calc(96px+env(safe-area-inset-bottom))]">
      {open ? (
        <div className="flex flex-col gap-1 min-w-[160px] p-2.5 rounded-2xl bg-[var(--surface)] border-[0.5px] border-[var(--hairline)] shadow-[var(--shadow-pop)]">
          <div className="flex items-center justify-between px-1.5 py-1">
            <span className="t-eyebrow">Demo state</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Collapse demo control"
              className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--muted)]"
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
                className={`flex items-center gap-2 px-2.5 py-2 rounded-[10px] font-bold text-[13px] ${
                  isActive ? 'bg-[var(--lime-soft)] text-[var(--lime-ink)]' : 'bg-transparent text-[var(--ink-2)]'
                }`}
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
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[var(--coral-soft)] text-[var(--coral)] font-heading font-semibold text-[12px] shadow-[0_8px_24px_-8px_rgba(207,48,0,0.4)]"
        >
          <Icon name="bolt" size={14} />
          Demo: {state}
        </button>
      )}
    </div>
  );
}
