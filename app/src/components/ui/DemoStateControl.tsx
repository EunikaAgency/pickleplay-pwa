import { useState } from 'react';
import { Icon } from './Icon';
import { useDemoState, type DemoState } from '../../lib/demoState';

export function DemoStateControl() {
  const states: { id: DemoState; label: string; icon: string }[] = [
    { id: 'normal', label: 'Normal', icon: 'check_circle' },
    { id: 'loading', label: 'Loading', icon: 'sync' },
    { id: 'empty', label: 'Empty', icon: 'inbox' },
    { id: 'error', label: 'Error', icon: 'error' },
    { id: 'offline', label: 'Offline', icon: 'cloud_off' },
  ];
  const { state, setState, enabled } = useDemoState();
  const [open, setOpen] = useState(false);
  if (!enabled) return null;

  return (
    <div className="fixed bottom-24 right-4 z-[10001] md:bottom-4">
      {open ? (
        <div
          className="rounded-[14px] bg-surface-container-lowest p-3 border border-outline-variant/40"
          style={{ boxShadow: 'var(--shadow-modal)' }}
        >
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">Demo state</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Collapse demo control"
              className="-mr-1 flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface-container-high"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {states.map((s) => {
              const isActive = state === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setState(s.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-body-md font-bold transition active:scale-[0.98] ${
                    isActive
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  <Icon name={s.icon} size={18} filled={isActive} />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full bg-tertiary-container px-4 py-2 font-heading text-body-md font-bold text-on-tertiary-container transition active:scale-95 hover:brightness-105"
          style={{ boxShadow: '0 8px 24px -8px rgba(207, 48, 0, 0.4)' }}
        >
          <Icon name="science" size={18} />
          Demo: {state}
        </button>
      )}
    </div>
  );
}
