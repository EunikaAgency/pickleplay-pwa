import { useEffect, useId, type ReactNode } from 'react';
import { Icon } from './Icon';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  height?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function BottomSheet({ open, onClose, title, subtitle, height, children, footer }: BottomSheetProps) {
  const headingId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <>
      <div className={`sheet-backdrop ${open ? 'open' : ''}`} onClick={onClose} />
      <div
        className={`sheet ${open ? 'open' : ''}`}
        style={height ? { height } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? headingId : undefined}
      >
        <div className="sheet-handle" />
        {(title || subtitle) && (
          <div className="sheet-head">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 id={headingId}>{title}</h2>
              )}
              {subtitle && <div className="t-sm mt-0.5">{subtitle}</div>}
            </div>
            <button className="close" onClick={onClose} aria-label="Close">
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
        <div className="sheet-body">{children}</div>
        {footer && (
          <div
            className="shrink-0 px-5 pt-3 border-t-[0.5px] border-[var(--hairline)] bg-[var(--bg)] pb-[calc(96px+env(safe-area-inset-bottom))]"
          >
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
