import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

/**
 * The app's single on-brand dropdown. One look everywhere — the rounded menu
 * card with a blue, checkmarked active row — ported from the Nearby sort
 * dropdown so every dropdown (form fields and sort pills) matches it.
 *
 * Two triggers share the same menu:
 *  - `field` — a full-width form control. Pass `triggerClassName` so the closed
 *    box matches its sibling inputs (e.g. `control` or `field-input`); the open
 *    menu is the shared on-brand one (no OS-native <select> popup).
 *  - `pill`  — the compact "Sort: Distance ▾" pill.
 *
 * Self-contained (shared/ must not import a feature slice). Styled with Tailwind
 * + globally-defined tokens (`--surface`/`--ink`/`--muted`/`--hairline`) and the
 * brand blue, so it looks identical inside or outside the `.pb-v2` scope. The
 * menu is viewport-aware: it flips up when there's no room below and caps its
 * height so it never runs off-screen.
 */

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Optional leading icon name (see `Icon`); shown in the trigger + menu rows. */
  icon?: string;
  /** Optional icon colour; ignored on the active (blue) menu row so it stays white. */
  iconColor?: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  variant?: 'field' | 'pill';
  /** Field variant: classes for the closed box so it matches sibling inputs. */
  triggerClassName?: string;
  /** Shown when no option matches `value` (field variant). */
  placeholder?: string;
  /** Horizontal anchor of the menu. Defaults: field → stretch, pill → right. */
  menuAlign?: 'left' | 'right' | 'stretch';
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  'aria-label'?: string;
}

const DESIRED_MAX = 280; // px — caps the menu height before it scrolls

export function Dropdown({
  value,
  onChange,
  options,
  variant = 'field',
  triggerClassName = '',
  placeholder = 'Select',
  menuAlign,
  disabled,
  invalid,
  id,
  'aria-label': ariaLabel,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'down' | 'up'>('down');
  const [maxH, setMaxH] = useState(DESIRED_MAX);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const align = menuAlign ?? (variant === 'pill' ? 'right' : 'stretch');

  // Measure the trigger and decide placement/height/anchor. The menu renders in a
  // body portal with fixed positioning (so no ancestor's overflow can clip it),
  // so we feed it viewport coords. Recomputed on open and on scroll/resize.
  const reposition = useCallback(() => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 12;
    const below = window.innerHeight - rect.bottom - margin;
    const above = rect.top - margin;
    const down = below >= above;
    setPlacement(down ? 'down' : 'up');
    setMaxH(Math.max(160, Math.min(DESIRED_MAX, down ? below : above)));
    setPos({
      top: down ? rect.bottom + 6 : rect.top - 6,
      left: align === 'right' ? rect.right : rect.left,
      width: rect.width,
    });
  }, [align]);

  const openMenu = () => { reposition(); setOpen(true); };

  // Close on outside-click / Escape; reveal the current choice on open; keep the
  // portalled menu glued to the trigger as the page scrolls or resizes.
  useEffect(() => {
    if (!open) return;
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
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

  const choose = (opt: DropdownOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  };

  const caret = (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );

  const pillTrigger =
    'h-8 px-2.5 inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#3355FF] ' +
    'bg-[var(--surface)] text-[#3355FF] text-[12px] font-semibold disabled:opacity-50';
  const fieldTrigger = `${triggerClassName} flex items-center justify-between gap-2 text-left ${
    invalid ? 'border-[var(--coral)]!' : ''
  }`;

  return (
    <div ref={wrapRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={variant === 'pill' ? pillTrigger : fieldTrigger}
      >
        {variant === 'pill' ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              {selected?.icon && (
                <Icon name={selected.icon} size={15} className="shrink-0" style={selected.iconColor ? { color: selected.iconColor } : undefined} />
              )}
              {selected?.label ?? placeholder}
            </span>
            {caret}
          </>
        ) : (
          <>
            <span className={`flex items-center gap-2 min-w-0 ${selected ? '' : 'text-[var(--muted)]'}`}>
              {selected?.icon && (
                <Icon name={selected.icon} size={18} className="shrink-0" style={selected.iconColor ? { color: selected.iconColor } : undefined} />
              )}
              <span className="truncate">{selected?.label ?? placeholder}</span>
            </span>
            <span className="text-[var(--muted)]">{caret}</span>
          </>
        )}
      </button>

      {open && createPortal(
        <ul
          ref={menuRef}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            maxHeight: maxH,
            ...(align === 'stretch' ? { width: pos.width } : { minWidth: 180 }),
            transform: `${align === 'right' ? 'translateX(-100%)' : ''} ${placement === 'up' ? 'translateY(-100%)' : ''}`.trim(),
          }}
          className="z-[60] p-1.5 m-0 list-none overflow-y-auto rounded-2xl bg-[var(--surface)] border border-[var(--hairline)] shadow-lg"
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value} role="option" aria-selected={active}>
                <button
                  ref={active ? selectedRef : undefined}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => choose(opt)}
                  className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-[10px] text-[14px] font-semibold ${
                    active
                      ? 'bg-[#3355FF] text-white'
                      : opt.disabled
                        ? 'text-[var(--muted)] opacity-50 cursor-not-allowed'
                        : 'text-[var(--ink)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    {opt.icon && (
                      <Icon
                        name={opt.icon}
                        size={18}
                        className="shrink-0"
                        style={!active && opt.iconColor ? { color: opt.iconColor } : undefined}
                      />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </span>
                  {active && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>,
        document.body,
      )}
    </div>
  );
}
