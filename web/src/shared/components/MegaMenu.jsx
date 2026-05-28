import { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function MegaMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const isActive = items.some(i => pathname.startsWith(i.to));
  const timeoutRef = useRef(null);

  const handleEnter = () => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div
      className="relative shrink-0"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 rounded-full px-2.5 py-2 text-base font-bold transition-colors xl:px-3 xl:text-base ${
          open
            ? 'bg-primary-container text-on-primary-container'
            : isActive
              ? 'bg-primary-fixed text-on-primary-fixed'
              : 'text-on-surface-variant hover:bg-surface-container-high'
        }`}
      >
        {label}
        <span className={`text-lg leading-none transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="fixed left-0 right-0 top-12 z-50 animate-slide-up border-b border-surface-variant bg-surface-container-lowest shadow-fab">
          <div className="mx-auto max-w-7xl px-5 py-6">
            <div className="grid grid-cols-3 gap-3">
              {items.map(i => (
                <Link
                  key={i.to}
                  to={i.to}
                  onClick={() => setOpen(false)}
                  className={`group flex items-center gap-4 rounded-xl p-4 no-underline transition-colors ${
                    pathname.startsWith(i.to)
                      ? 'bg-primary-container'
                      : 'hover:bg-surface-container-high'
                  }`}
                >
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl ${
                    pathname.startsWith(i.to) ? 'bg-white/30' : 'bg-surface-container-high group-hover:bg-surface-container-highest'
                  }`}>
                    {i.emoji}
                  </div>
                  <div>
                    <p className={`text-base font-bold ${pathname.startsWith(i.to) ? 'text-on-primary-container' : 'text-on-surface'}`}>
                      {i.label}
                    </p>
                    <p className={`text-base mt-0.5 ${pathname.startsWith(i.to) ? 'text-on-primary-container/70' : 'text-on-surface-variant'}`}>
                      {i.desc}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
          {/* Backdrop click to close */}
          <div className="fixed inset-0 top-[calc(3rem+theme(spacing.6)+theme(spacing.1))] bg-black/5 -z-10" onClick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
