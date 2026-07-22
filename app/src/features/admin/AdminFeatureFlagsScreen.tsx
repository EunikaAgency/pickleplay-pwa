import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { AdminScreen } from './AdminScaffold';
import { getSettings, updateSettings, type AppSettings } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface Props {
  onNavigate: Navigate;
  onBack: () => void;
}

interface FlagDef {
  key: keyof Pick<AppSettings, 'allowNonOrganizerEvents' | 'allowPlayerApprovalLobbies'>;
  title: string;
  icon: string;
  on: string;
  off: string;
  note?: string;
}

const FLAGS: FlagDef[] = [
  {
    key: 'allowNonOrganizerEvents',
    title: 'Players can create events',
    icon: 'emoji_events',
    on: 'Any player can post an event — a competitive format.',
    off: 'Only players with an organizer subscription can post an event.',
    note: 'This was already true before 17 July — no gate had ever existed.',
  },
  {
    key: 'allowPlayerApprovalLobbies',
    title: 'Players can require approval to join their lobby',
    icon: 'how_to_reg',
    on: 'A host can mark their play "approve players before they join".',
    off: 'New and edited plays are open-join.',
    note: 'Turning this off never drops players already queued.',
  },
];

const ALL_OFF: Record<string, boolean> = Object.fromEntries(FLAGS.map((f) => [f.key, false]));
const ALL_ON: Record<string, boolean> = Object.fromEntries(FLAGS.map((f) => [f.key, true]));

/**
 * Admin console: feature-flag kill switches for the 17 July Open Play work.
 * Each flag is a hard gate (server enforces; hiding the UI is cosmetic).
 * Gated by `admin.settings.manage`.
 */
export function AdminFeatureFlagsScreen({ onNavigate }: Props) {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [confirmOff, setConfirmOff] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    try {
      const s = await getSettings();
      if (id !== reqId.current) return;
      setFlags(Object.fromEntries(FLAGS.map((f) => [f.key, s[f.key] ?? true])));
    } catch { /* keep defaults */ }
    setLoaded(true);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function write(patch: Record<string, boolean>) {
    const prev = flags;
    setFlags((f) => ({ ...f, ...patch }));
    setSave('saving');
    try {
      await updateSettings(patch as Partial<AppSettings>);
      setSave('saved');
      setTimeout(() => setSave('idle'), 1800);
    } catch {
      setFlags(prev);
      setSave('error');
    }
  }

  const offCount = FLAGS.filter((f) => !flags[f.key]).length;
  const allOff = offCount === FLAGS.length;
  const busy = !loaded || save === 'saving';

  return (
    <AdminScreen onBack={() => onNavigate('admin-hub')} title="Feature flags" subtitle="Per-feature kill switches for player capabilities. Changes apply instantly.">
      {/* Master switch */}
      <section className="card p-4 mt-4">
        <h2 className="hd-2 flex items-center gap-2">
          <Icon name="power_settings_new" size={18} /> All of it, at once
        </h2>
        <p className="t-sm mt-1">Switches off only the {FLAGS.length} abilities on this page.</p>
        <div className="flex flex-wrap gap-3 mt-4">
          {!confirmOff ? (
            <button type="button" disabled={busy || allOff} onClick={() => setConfirmOff(true)}
              className="chip font-bold text-[var(--coral)] disabled:opacity-40">
              <Icon name="power_settings_new" size={16} />
              {allOff ? 'Everything here is already off' : `Turn off all ${FLAGS.length}`}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border-[1.5px] border-[var(--coral)] px-4 py-3">
              <span className="text-[13px] font-bold">Turn off {FLAGS.length} abilities?</span>
              <button type="button" disabled={busy} onClick={async () => { await write(ALL_OFF); setConfirmOff(false); }}
                className="chip font-bold text-[var(--coral)] disabled:opacity-40">Yes, turn off</button>
              <button type="button" onClick={() => setConfirmOff(false)}
                className="chip font-bold">Cancel</button>
            </div>
          )}
          {offCount > 0 && !confirmOff && (
            <button type="button" disabled={busy} onClick={() => write(ALL_ON)}
              className="chip font-bold disabled:opacity-40">
              <Icon name="restart_alt" size={16} /> Turn everything back on
            </button>
          )}
        </div>
        <div className={`mt-3 flex items-center gap-2 rounded-xl px-4 py-3 text-[13px] font-bold ${offCount === 0 ? 'bg-[var(--lime-ink)]/20' : 'bg-[var(--amber)]/20'}`}>
          <Icon name={offCount === 0 ? 'check_circle' : 'warning'} size={16} />
          {offCount === 0 ? 'All on.' : `${offCount} of ${FLAGS.length} switched off.`}
          {save === 'saving' && <span className="ml-auto opacity-70">Saving…</span>}
          {save === 'saved' && <span className="ml-auto opacity-70">Saved ✓</span>}
          {save === 'error' && <span className="ml-auto text-[var(--coral)]">Couldn't save</span>}
        </div>
      </section>

      {/* Individual flags */}
      {FLAGS.map((f) => (
        <section key={f.key} className="card p-4 mt-4">
          <h2 className="hd-2 flex items-center gap-2">
            <Icon name={f.icon} size={18} /> {f.title}
          </h2>
          <label className="mt-4 flex cursor-pointer items-start gap-4 rounded-2xl border-[1.5px] border-[var(--hairline)] p-4">
            <input type="checkbox" checked={!!flags[f.key]} disabled={busy}
              onChange={(e) => write({ [f.key]: e.target.checked })}
              className="mt-1 size-5 shrink-0 accent-[var(--blue)]" />
            <div>
              <p className="font-bold">{flags[f.key] ? 'On' : 'Off'}</p>
              <p className="t-sm">{flags[f.key] ? f.on : f.off}</p>
            </div>
          </label>
          {f.note && <p className="t-sm mt-3 flex items-start gap-2"><Icon name="info" size={14} className="mt-0.5 shrink-0" />{f.note}</p>}
        </section>
      ))}

      <p className="t-sm mt-6 flex items-start gap-2 pb-8">
        <Icon name="lock" size={14} className="mt-0.5 shrink-0" />
        Open Play using the real lobby has no switch — it was a correctness fix, not a feature.
      </p>
    </AdminScreen>
  );
}
