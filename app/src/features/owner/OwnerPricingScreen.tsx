import { useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { useOwnerDashboard } from './hooks/useOwnerDashboard';

interface OwnerPricingScreenProps {
  onBack: () => void;
}

interface PricingRule {
  id: string;
  name: string;
  shortName: string;
  price: string;
  color: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = ['6AM', '7AM', '8AM', '9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM', '6PM', '7PM', '8PM', '9PM'];
const COLOR_SWATCHES = ['#f59e0b', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#426383', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#64748b', '#4b5b70'];
const CLOSED_COLOR = '#4b5b70';

const INITIAL_RULES: PricingRule[] = [
  { id: 'weekday-peak', name: 'Weekday Evening Peak', shortName: 'Peak', price: '350', color: '#f59e0b' },
  { id: 'weekend-prime', name: 'Weekend Prime Slot', shortName: 'Wknd Prime', price: '450', color: '#8b5cf6' },
  { id: 'holiday-special', name: 'Holiday Special', shortName: 'Holiday', price: '500', color: '#f59e0b' },
  { id: 'early-bird', name: 'Early Bird Discount', shortName: 'Early Bird', price: '150', color: '#426383' },
];

const blankRule = (): PricingRule => ({
  id: '',
  name: '',
  shortName: '',
  price: '',
  color: '#f59e0b',
});

const cellKey = (day: string, hour: string) => `${day}:${hour}`;

function cellLabel(rule: PricingRule | null) {
  return rule ? `${rule.shortName} · ₱${rule.price}` : 'Closed · ₱0';
}

export function OwnerPricingScreen({ onBack }: OwnerPricingScreenProps) {
  const { venues, status } = useOwnerDashboard({ withAnalytics: false });
  const [venue, setVenue] = useState('');
  const [rules, setRules] = useState<PricingRule[]>(INITIAL_RULES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PricingRule>(blankRule());
  const [activeRuleId, setActiveRuleId] = useState(INITIAL_RULES[0]?.id ?? '');
  const [paintedCells, setPaintedCells] = useState<Record<string, string>>({});
  const [tooltip, setTooltip] = useState<{ label: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!venue && venues.length > 0) setVenue(venues[0].slug || venues[0].id);
  }, [venue, venues]);

  useEffect(() => {
    if (rules.length > 0 && !rules.some((rule) => rule.id === activeRuleId)) setActiveRuleId(rules[0].id);
  }, [activeRuleId, rules]);

  const hasVenues = venues.length > 0;
  const isEditing = editingId !== null;
  const formOpen = editingId !== null;
  const activeRule = rules.find((rule) => rule.id === activeRuleId) ?? null;

  const paintCell = (day: string, hour: string) => {
    if (!activeRule) return;
    setPaintedCells((cells) => ({ ...cells, [cellKey(day, hour)]: activeRule.id }));
  };

  const ruleForCell = (day: string, hour: string) => {
    const ruleId = paintedCells[cellKey(day, hour)];
    return rules.find((rule) => rule.id === ruleId) ?? null;
  };

  const showCellTooltip = (target: HTMLElement, label: string) => {
    const rect = target.getBoundingClientRect();
    setTooltip({ label, x: rect.left + rect.width / 2, y: rect.top });
  };

  const openAdd = () => {
    setEditingId('new');
    setDraft({ ...blankRule(), shortName: 'Prime' });
  };

  const openEdit = (rule: PricingRule) => {
    setEditingId(rule.id);
    setDraft(rule);
  };

  const closeForm = () => {
    setEditingId(null);
    setDraft(blankRule());
  };

  const saveRule = () => {
    const name = draft.name.trim();
    const shortName = draft.shortName.trim();
    const price = draft.price.replace(/[^\d.]/g, '');
    if (!name || !shortName || !price) return;
    const next: PricingRule = {
      ...draft,
      id: editingId === 'new' ? `rule-${Date.now()}` : draft.id,
      name,
      shortName,
      price,
    };
    setRules((list) => (editingId === 'new' ? [...list, next] : list.map((rule) => (rule.id === next.id ? next : rule))));
    setActiveRuleId(next.id);
    closeForm();
  };

  const deleteRule = (id: string) => {
    setRules((list) => list.filter((rule) => rule.id !== id));
    if (activeRuleId === id) setActiveRuleId('');
    if (editingId === id) closeForm();
  };

  return (
    <div className="scroll safe-top safe-bottom bg-[var(--bg)]">
      <div className="px-5 pt-4 sm:px-0 sm:pt-0">
        <div className="bg-[var(--surface)] text-[var(--ink)] rounded-[8px] sm:rounded-none px-3 py-2.5 border border-[var(--hairline)] sm:border-x-0 sm:border-t-0 shadow-[var(--shadow-card)] sm:shadow-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex items-start gap-2">
              <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="mt-0.5 h-7 w-7 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] sm:hidden flex items-center justify-center shrink-0"
              >
                <Icon name="chevron" size={18} className="rotate-180" />
              </button>
              <div className="min-w-0">
                <div className="font-heading font-extrabold text-[17px] leading-tight">Pricing Override</div>
                <div className="mt-0.5 text-[12px] leading-snug text-[var(--muted)]">Drag to paint time blocks - changes apply immediately</div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                aria-label="Venue"
                disabled={!hasVenues || status === 'loading'}
                className="h-9 min-w-0 flex-1 sm:flex-none sm:min-w-[156px] rounded-[4px] border border-[var(--field-border)] bg-[var(--surface-2)] px-3 text-[12px] font-medium text-[var(--ink)] outline-none disabled:opacity-70"
              >
                {status === 'loading' && <option value="">Loading venues...</option>}
                {status !== 'loading' && !hasVenues && <option value="">No venues yet</option>}
                {venues.map((v) => {
                  const id = v.slug || v.id;
                  return <option key={id} value={id}>{v.displayName || 'Venue'}</option>;
                })}
              </select>
              <button
                type="button"
                className="h-9 px-4 rounded-[4px] bg-[#f59e0b] text-[#111827] text-[12px] font-extrabold shadow-sm active:scale-[0.98] shrink-0"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Metric label="Peak Hours / Week" value="15" tone="amber" />
            <Metric label="Weekly Rev Potential" value="₱25,250" />
            <Metric label="Active Rules" value={String(rules.length)} tone="green" />
          </div>

          {formOpen && (
            <div className="fixed inset-0 z-[1400] flex items-end sm:items-center justify-center bg-black/45 px-4 py-6" role="dialog" aria-modal="true" aria-label={isEditing && editingId !== 'new' ? 'Edit rule' : 'Add rule'}>
              <div className="w-full max-w-[560px] rounded-t-[18px] sm:rounded-[12px] border border-[var(--hairline)] bg-[var(--surface)] shadow-xl animate-slide-up">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--hairline)]">
                  <div className="font-heading font-extrabold text-[15px] text-[var(--ink)]">{isEditing && editingId !== 'new' ? 'Edit rule' : 'Add rule'}</div>
                  <button type="button" onClick={closeForm} aria-label="Close rule editor" className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-2)]">
                    <Icon name="close" size={16} />
                  </button>
                </div>

                <div className="px-4 py-4 space-y-3">
                  <label className="block">
                    <span className="block text-[11px] font-bold text-[var(--muted)] mb-1">Rule name</span>
                    <input value={draft.name} onChange={(e) => setDraft((r) => ({ ...r, name: e.target.value }))} className="h-11 w-full rounded-[6px] border border-[var(--field-border)] bg-[var(--surface-2)] px-3 text-[14px] text-[var(--ink)] outline-none focus:border-[#f59e0b]" placeholder="Weekday Evening Peak" />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-bold text-[var(--muted)] mb-1">Paint label</span>
                    <input value={draft.shortName} onChange={(e) => setDraft((r) => ({ ...r, shortName: e.target.value }))} className="h-11 w-full rounded-[6px] border border-[var(--field-border)] bg-[var(--surface-2)] px-3 text-[14px] text-[var(--ink)] outline-none focus:border-[#f59e0b]" placeholder="Peak" maxLength={14} />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-bold text-[var(--muted)] mb-1">Rule price</span>
                    <input value={draft.price} onChange={(e) => setDraft((r) => ({ ...r, price: e.target.value.replace(/[^\d.]/g, '') }))} inputMode="decimal" className="h-11 w-full rounded-[6px] border border-[var(--field-border)] bg-[var(--surface-2)] px-3 text-[14px] text-[var(--ink)] outline-none focus:border-[#f59e0b]" placeholder="350" />
                  </label>
                  <div>
                    <span className="block text-[11px] font-bold text-[var(--muted)] mb-2">Rule color</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {COLOR_SWATCHES.map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={`Use ${color}`}
                          onClick={() => setDraft((r) => ({ ...r, color }))}
                          className={`w-8 h-8 rounded-[6px] border ${draft.color === color ? 'border-[var(--ink)] ring-2 ring-[#f59e0b]/30' : 'border-[var(--field-border)]'}`}
                          style={{ background: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--hairline)]">
                  <button type="button" onClick={closeForm} className="h-9 px-3 rounded-[4px] border border-[var(--field-border)] text-[12px] font-bold text-[var(--muted)]">Cancel</button>
                  <button type="button" onClick={saveRule} className="h-9 px-4 rounded-[4px] bg-[#f59e0b] text-[#111827] text-[12px] font-extrabold">Save rule</button>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
            <span className="font-bold uppercase tracking-wide">Paint tool:</span>
            {rules.map((rule) => {
              const active = activeRuleId === rule.id;
              return (
                <button
                  key={rule.id}
                  type="button"
                  onClick={() => setActiveRuleId(rule.id)}
                  aria-pressed={active}
                  className={`h-8 px-3 rounded-[4px] border font-extrabold bg-[var(--surface)] ${active ? '' : 'border-transparent'}`}
                  style={{ borderColor: active ? rule.color : 'transparent', color: active ? rule.color : 'var(--muted)' }}
                >
                  <span className="inline-block w-2 h-2 rounded-[2px] mr-2" style={{ background: rule.color }} /> {rule.shortName} · ₱{rule.price}
                </button>
              );
            })}
            <span className="ml-1">Click or drag to paint blocks</span>
          </div>

          <div className="overflow-x-auto rounded-[8px] border border-[var(--hairline)] bg-[var(--surface)]">
            <div className="min-w-[960px]">
              <div className="grid grid-cols-[42px_repeat(16,minmax(52px,1fr))] border-b border-[var(--hairline)] text-[11px] text-[var(--muted)]">
                <div className="px-2 py-3">Day</div>
                {HOURS.map((hour) => <div key={hour} className="px-1 py-3 text-center">{hour}</div>)}
              </div>
              {DAYS.map((day) => (
                <div key={day} className="grid grid-cols-[42px_repeat(16,minmax(52px,1fr))] border-b border-[var(--hairline)] last:border-b-0">
                  <div className="px-2 py-2 text-[12px] text-[var(--ink)]">{day}</div>
                  {HOURS.map((hour) => {
                    const rule = ruleForCell(day, hour);
                    const label = cellLabel(rule);
                    return (
                      <button
                        key={`${day}-${hour}`}
                        type="button"
                        aria-label={`${day} ${hour} ${label}`}
                        title={`${day} ${hour} · ${label}`}
                        onClick={() => paintCell(day, hour)}
                        onMouseEnter={(e) => showCellTooltip(e.currentTarget, label)}
                        onMouseLeave={() => setTooltip(null)}
                        className="relative p-1 border-l border-[var(--hairline)]"
                      >
                        <span className="block h-4 rounded-[2px]" style={{ background: rule?.color ?? CLOSED_COLOR }} />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[var(--muted)]">
            {rules.map((rule) => <Legend key={rule.id} color={rule.color} label={`${rule.shortName} - ₱${rule.price}/hr`} />)}
            <Legend color={CLOSED_COLOR} label="Closed - No charge" />
          </div>

          <div className="rounded-[8px] border border-[var(--hairline)] bg-[var(--surface)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--hairline)]">
              <div className="font-heading font-extrabold text-[14px] text-[var(--ink)]">Active Override Rules</div>
              <button type="button" onClick={openAdd} className="text-[11px] font-extrabold text-[#f59e0b]">+ Add Rule</button>
            </div>
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--hairline)] last:border-b-0">
                <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: rule.color }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-extrabold text-[var(--ink)] leading-tight truncate">{rule.name}</div>
                </div>
                <div className="text-[13px] font-extrabold shrink-0" style={{ color: rule.color }}>₱{rule.price}/hr</div>
                <button type="button" onClick={() => openEdit(rule)} className="h-7 px-2 rounded-[4px] border border-[var(--field-border)] text-[11px] text-[var(--muted)]">Edit</button>
                <button type="button" onClick={() => deleteRule(rule.id)} className="h-7 px-2 rounded-[4px] border border-red-500/50 text-[11px] text-red-500">Del</button>
              </div>
            ))}
          </div>
        </div>
      </div>
      {tooltip && (
        <div
          className="pointer-events-none fixed z-[1600] -translate-x-1/2 -translate-y-[calc(100%+6px)] whitespace-nowrap rounded-[4px] bg-[#111827] px-2 py-1 text-[10px] font-bold text-white shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'amber' | 'green' }) {
  const color = tone === 'amber' ? 'text-[#f59e0b]' : tone === 'green' ? 'text-[#22c55e]' : 'text-[var(--ink)]';
  return (
    <div className="rounded-[6px] border border-[var(--field-border)] bg-[var(--surface)] px-3 py-3 shadow-sm">
      <div className="text-[11px] text-[var(--muted)]">{label}</div>
      <div className={`mt-1 font-heading font-extrabold text-[17px] leading-tight ${color}`}>{value}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: color }} />
      {label}
    </span>
  );
}
