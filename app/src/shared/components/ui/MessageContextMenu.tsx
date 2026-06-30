import { useEffect, useState } from 'react';
import { Icon } from './Icon';

export interface MessageContextAction {
  key: string;
  label: string;
  icon: string;
  danger?: boolean;
  visible?: boolean;
  onPress: () => void;
}

interface MessageContextMenuProps {
  open: boolean;
  onClose: () => void;
  /** Position hint: 'left' anchors to start (received msg), 'right' to end (sent msg). */
  side: 'left' | 'right';
  actions: MessageContextAction[];
}

/**
 * Messenger-style floating context menu that appears anchored near the
 * long-pressed message — no backdrop, no blur, no modal. The message stays
 * fully visible underneath.
 */
export function MessageContextMenu({ open, onClose, side, actions }: MessageContextMenuProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
  }, [open]);

  // Dismiss on scroll or outside tap
  useEffect(() => {
    if (!open) return;
    const dismiss = () => onClose();
    window.addEventListener('scroll', dismiss, { capture: true });
    // Small delay so the long-press release doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('click', dismiss, { once: true }), 100);
    return () => {
      window.removeEventListener('scroll', dismiss, { capture: true });
      clearTimeout(t);
      document.removeEventListener('click', dismiss);
    };
  }, [open, onClose]);

  if (!open) return null;

  const isRight = side === 'right';

  return (
    <div
      className={`absolute z-40 ${isRight ? 'right-0' : 'left-0'} -top-1 -translate-y-full flex items-center gap-1.5 transition-all duration-200 ${
        visible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {actions.filter((a) => a.visible !== false).map((a) => (
        <button
          key={a.key}
          type="button"
          onClick={(e) => { e.stopPropagation(); a.onPress(); onClose(); }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-semibold shadow-[0_4px_16px_rgba(0,0,0,0.12)] active:scale-95 transition-transform duration-150 whitespace-nowrap ${
            a.danger ? 'bg-[var(--coral)] text-white' : 'bg-[var(--surface)] text-[var(--ink)] border-[0.5px] border-[var(--hairline)]'
          }`}
        >
          <Icon name={a.icon} size={14} />
          <span>{a.label}</span>
        </button>
      ))}
    </div>
  );
}
