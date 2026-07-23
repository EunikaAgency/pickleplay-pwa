import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

/**
 * The app's row-level "⋮" overflow menu — a list of ACTIONS, not a value picker
 * (that's `Dropdown`). It owns its own trigger button so a list row only has to
 * hand it the actions.
 *
 * Same on-brand menu card as `Dropdown` (rounded surface, hairline border,
 * hover rows) and the same viewport-aware placement: the menu renders in a body
 * portal with fixed positioning, so no ancestor's `overflow` can clip it, and it
 * flips up when there's no room below.
 *
 * Rows in a scrollable list are usually clickable themselves, so every pointer
 * event on the trigger stops propagating — opening the menu must never also
 * open the row.
 */

export interface MenuAction {
  key: string;
  label: string;
  /** Optional leading icon name (see `Icon`). */
  icon?: string;
  /** Renders the row in the coral destructive colour. */
  danger?: boolean;
  disabled?: boolean;
  /** Hide without disturbing the caller's array shape. */
  visible?: boolean;
  onSelect: () => void;
}

interface ActionMenuProps {
  actions: MenuAction[];
  'aria-label'?: string;
  /** Which edge of the trigger the menu lines up with. Defaults to right. */
  align?: 'left' | 'right';
  /** Extra classes for the trigger button. */
  triggerClassName?: string;
  size?: number;
}

const DESIRED_MAX = 320; // px — caps the menu height before it scrolls

export function ActionMenu({
  actions,
  'aria-label': ariaLabel = 'More actions',
  align = 'right',
  triggerClassName = '',
  size = 18,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'down' | 'up'>('down');
  const [maxH, setMaxH] = useState(DESIRED_MAX);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const items = actions.filter((a) => a.visible !== false);

  // Measure the trigger and decide placement/height/anchor, in viewport coords
  // for the fixed-position portal. Recomputed on open and on scroll/resize.
  const reposition = useCallback(() => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 12;
    const below = window.innerHeight - rect.bottom - margin;
    const above = rect.top - margin;
    const down = below >= above;
    setPlacement(down ? 'down' : 'up');
    setMaxH(Math.max(140, Math.min(DESIRED_MAX, down ? below : above)));
    setPos({
      top: down ? rect.bottom + 6 : rect.top - 6,
      left: align === 'right' ? rect.right : rect.left,
    });
  }, [align]);

  // Close on outside-click / Escape; keep the portalled menu glued to the
  // trigger as the page scrolls or resizes.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onReflow = () => reposition();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [open, reposition]);

  const choose = (a: MenuAction) => {
    if (a.disabled) return;
    setOpen(false);
    a.onSelect();
  };

  if (!items.length) return null;

  return (
    <div ref={wrapRef} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onKeyDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (open) { setOpen(false); return; }
          reposition();
          setOpen(true);
        }}
        className={`w-8 h-8 rounded-full flex items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] ${
          open ? 'bg-[var(--surface-2)] text-[var(--ink)]' : ''
        } ${triggerClassName}`}
      >
        <Icon name="more_vert" size={size} />
      </button>

      {open && createPortal(
        <ul
          ref={menuRef}
          role="menu"
          aria-label={ariaLabel}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            maxHeight: maxH,
            minWidth: 208,
            transform: `${align === 'right' ? 'translateX(-100%)' : ''} ${placement === 'up' ? 'translateY(-100%)' : ''}`.trim(),
          }}
          className="z-[60] p-1.5 m-0 list-none overflow-y-auto rounded-2xl bg-[var(--surface)] border border-[var(--hairline)] shadow-lg"
        >
          {items.map((a) => (
            <li key={a.key} role="none">
              <button
                role="menuitem"
                type="button"
                disabled={a.disabled}
                onClick={(e) => { e.stopPropagation(); choose(a); }}
                className={`w-full flex items-center gap-2.5 text-left px-3 py-2.5 rounded-[10px] text-[14px] font-semibold ${
                  a.disabled
                    ? 'text-[var(--muted)] opacity-50 cursor-not-allowed'
                    : a.danger
                      ? 'text-[var(--coral)] hover:bg-[var(--surface-2)]'
                      : 'text-[var(--ink)] hover:bg-[var(--surface-2)]'
                }`}
              >
                {a.icon && <Icon name={a.icon} size={18} className="shrink-0" />}
                <span className="truncate">{a.label}</span>
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
