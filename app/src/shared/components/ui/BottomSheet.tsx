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
  /** Extra classes for the sheet panel (e.g. opt into the height transition). */
  sheetClassName?: string;
  /** Drop the tab-bar clearance under the footer (use when no tab bar sits behind the sheet). */
  flushFooter?: boolean;
}

export function BottomSheet({ open, onClose, title, subtitle, height, children, footer, sheetClassName, flushFooter }: BottomSheetProps) {
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
      <div className={`sheet-backdrop ${open ? 'open' : ''}`} onClick={onClose} aria-hidden="true" />
      <div
        className={`sheet ${open ? 'open' : ''} ${sheetClassName ?? ''}`}
        style={height ? { height } : undefined}
        role="dialog"
        aria-modal={open ? 'true' : undefined}
        aria-labelledby={title ? headingId : undefined}
        // A closed sheet stays mounted for the slide transition; hide it from
        // assistive tech + keyboard focus so it isn't reachable off-screen.
        aria-hidden={open ? undefined : true}
        inert={open ? undefined : true}
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
            className={`shrink-0 px-5 pt-3 border-t-[0.5px] border-[var(--hairline)] bg-[var(--bg)] ${flushFooter ? 'pb-[calc(16px+env(safe-area-inset-bottom))]' : 'pb-[calc(96px+env(safe-area-inset-bottom))]'}`}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
