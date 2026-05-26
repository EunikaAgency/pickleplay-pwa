import { useEffect, useId, type ReactNode } from 'react';
import { Icon } from './Icon';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Optional max-width on md+ (defaults to max-w-xl). */
  size?: 'md' | 'lg';
  children: ReactNode;
  /** Optional footer pinned to the bottom of the sheet (won't scroll with content). */
  footer?: ReactNode;
}

export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  footer,
}: BottomSheetProps) {
  const headingId = useId();

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const widthClass = size === 'lg' ? 'max-w-2xl' : 'max-w-xl';

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? headingId : undefined}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-slide-up"
      />

      {/* Sheet */}
      <div
        className={`relative z-10 flex max-h-[90vh] w-full ${widthClass} flex-col rounded-t-[24px] bg-surface-container-lowest md:rounded-[24px] md:max-h-[80vh] animate-slide-up`}
        style={{
          paddingBottom: footer ? undefined : 'env(safe-area-inset-bottom)',
          boxShadow: 'var(--shadow-modal-up)',
        }}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="h-1 w-10 rounded-full bg-outline-variant" />
        </div>

        {/* Header */}
        {(title || subtitle) && (
          <div className="flex items-start justify-between px-5 pt-4 pb-2 md:px-7 md:pt-7">
            <div className="min-w-0 flex-1">
              {title && (
                <h2
                  id={headingId}
                  className="font-heading text-headline-md font-bold text-on-surface md:text-headline-lg"
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="mt-1 text-body-md text-on-surface-variant">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Icon name="close" size={22} />
            </button>
          </div>
        )}

        {/* Scrollable body */}
        <div className="scrollbar-none flex-1 overflow-y-auto px-5 pb-6 md:px-7">
          {children}
        </div>

        {/* Footer (sticky) */}
        {footer && (
          <div
            className="shrink-0 border-t border-outline-variant/40 bg-surface-container-lowest px-5 py-4 md:px-7"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
