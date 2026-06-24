import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { suggestPlaces, ApiError, type GeocodeSuggestion } from '../../../shared/lib/api';

/**
 * A true type-ahead address field. As the owner types, it debounces and asks the
 * API for ranked place suggestions (OSM Nominatim, proxied) and shows them in a
 * dropdown. Picking one fires `onSelect` with coordinates + parsed city/region/area
 * so the caller can drop the map pin and auto-fill those fields in one tap.
 *
 * Controlled: the caller owns the text via `value`/`onChange`; this component owns
 * only the suggestion list + dropdown UI. Shared by the venue create form and the
 * Location editor tab so both behave identically.
 */

interface AddressAutocompleteProps {
  label?: string;
  required?: boolean;
  value: string;
  placeholder?: string;
  /** ISO2 country bias passed to the geocoder (default 'ph'). */
  country?: string;
  hint?: string;
  /** Plain text edits (typing into the field). */
  onChange: (value: string) => void;
  /** A suggestion was picked from the dropdown. */
  onSelect: (suggestion: GeocodeSuggestion) => void;
}

const MIN_QUERY = 3;
const DEBOUNCE_MS = 350;

export function AddressAutocomplete({
  label,
  required,
  value,
  placeholder = 'Start typing an address or place…',
  country = 'ph',
  hint,
  onChange,
  onSelect,
}: AddressAutocompleteProps) {
  const [items, setItems] = useState<GeocodeSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(-1); // keyboard-highlighted row

  // After a pick we overwrite `value` with the full label — suppress the one
  // debounced lookup that change would otherwise trigger (no point re-searching
  // the address we just resolved).
  const skipNext = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const listId = `${inputId}-listbox`;

  // Debounced lookup whenever the query text changes. All state updates happen
  // inside the timeout (never synchronously in the effect body), so typing
  // doesn't trigger a cascade of renders and the spinner only shows once the
  // debounce actually fires a request.
  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const q = value.trim();
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      if (q.length < MIN_QUERY) {
        setItems([]);
        setLoading(false);
        setError(false);
        return;
      }
      setLoading(true);
      suggestPlaces(q, { country, limit: 6, signal: ctrl.signal })
        .then((res) => {
          setItems(res);
          setError(false);
          setActive(-1);
          setOpen(true);
        })
        .catch((e) => {
          if (e instanceof ApiError && e.code === 'ABORTED') return;
          setItems([]);
          setError(true);
          setOpen(true);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [value, country]);

  // Dismiss the dropdown on an outside click.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  const pick = (s: GeocodeSuggestion) => {
    skipNext.current = true;
    onChange(s.label);
    onSelect(s);
    setItems([]);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    }
  };

  const showDropdown = open && (loading || error || items.length > 0);

  return (
    <div className="field p-0!" ref={rootRef}>
      {label && (
        <label htmlFor={inputId} className="lbl">
          {label}
          {required && <span className="ml-0.5 text-[var(--coral)]">*</span>}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none">
          <Icon name="search" size={18} />
        </span>
        <input
          id={inputId}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          className="control pl-[42px]! pr-[44px]!"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { if (items.length > 0) setOpen(true); }}
          onKeyDown={onKeyDown}
        />
        {loading && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none inline-flex animate-spin">
            <Icon name="spinner" size={16} />
          </span>
        )}
      </div>

      {showDropdown && (
        <ul
          id={listId}
          role="listbox"
          className="mt-1.5 max-h-[260px] overflow-auto rounded-xl border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] shadow-sm"
        >
          {error ? (
            <li className="px-3.5 py-3 t-sm text-[var(--coral)]">Couldn’t reach the address search. Type the address and set the pin on the map instead.</li>
          ) : items.length === 0 ? (
            <li className="px-3.5 py-3 t-sm text-[var(--ink-2)]">{loading ? 'Searching…' : 'No matches — try a more specific address.'}</li>
          ) : (
            items.map((s, i) => {
              const [primary, ...rest] = s.label.split(',');
              return (
                <li key={`${s.lat},${s.lng},${i}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onClick={() => pick(s)}
                    onMouseEnter={() => setActive(i)}
                    className={`w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 ${i === active ? 'bg-[var(--primary-tint)]' : ''}`}
                  >
                    <Icon name="location" size={16} className="shrink-0 text-[var(--primary)] mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-bold text-[var(--ink)] truncate">{primary.trim()}</span>
                      {rest.length > 0 && <span className="block text-[12px] text-[var(--ink-2)] truncate">{rest.join(',').trim()}</span>}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}

      {hint && <p className="mt-1.5 text-[12px] text-[var(--muted)]">{hint}</p>}
    </div>
  );
}
