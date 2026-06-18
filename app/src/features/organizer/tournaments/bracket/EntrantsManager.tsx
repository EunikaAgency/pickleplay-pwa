import { useState } from 'react';
import { Icon } from '../../../../shared/components/ui/Icon';
import { Button } from '../../../../shared/components/ui/Button';
import { FormField } from '../../../../shared/components/forms/FormField';
import {
  buildEntrants, addEntrant, updateEntrant, removeEntrant, seedEntrants,
  type ApiEntrant,
} from '../../../../shared/lib/api';
import { OrganizerSection } from '../../components/OrganizerSection';

interface EntrantsManagerProps {
  tid: string;
  entrants: ApiEntrant[];
  onChanged: () => void;
}

/** Build the field for a tournament: pull entrants from approved registrations,
 *  add manual entries, set seeds, auto-seed. Feeds the BracketGenerator. */
export function EntrantsManager({ tid, entrants, onChanged }: EntrantsManagerProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [manualName, setManualName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try { await fn(); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    finally { setBusy(null); }
  };

  return (
    <OrganizerSection title={`Entrants (${entrants.length})`} icon="groups" description="Build the field, then seed it before generating the bracket.">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => run('build', () => buildEntrants(tid, { mode: 'auto' }))} disabled={!!busy}>
            {busy === 'build' ? 'Building…' : 'From registrations'}
          </Button>
          <Button variant="outline" onClick={() => run('seed', () => seedEntrants(tid, { method: 'auto' }))} disabled={!!busy || entrants.length === 0}>
            {busy === 'seed' ? 'Seeding…' : 'Auto-seed'}
          </Button>
        </div>

        <div className="flex gap-2 items-end">
          <FormField containerClassName="flex-1" label="Add entrant" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Cruz / Reyes" />
          <button
            type="button"
            disabled={!manualName.trim() || !!busy}
            onClick={() => run('add', async () => { await addEntrant(tid, { displayName: manualName.trim() }); setManualName(''); })}
            className="h-12 px-4 rounded-xl bg-[var(--primary)] text-white font-heading font-semibold text-[13px] disabled:opacity-50 shrink-0"
          >
            Add
          </button>
        </div>

        {error && <div className="text-[13px] font-semibold text-[var(--coral)]">{error}</div>}

        {entrants.length > 0 && (
          <div className="flex flex-col gap-2">
            {entrants.map((en) => (
              <div key={en.id} className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] p-2.5">
                <input
                  type="number" inputMode="numeric" defaultValue={en.seed ?? ''} placeholder="–"
                  onBlur={(e) => { const v = Number(e.target.value); if (v && v !== en.seed) run(`seed-${en.id}`, () => updateEntrant(tid, en.id, { seed: v })); }}
                  className="w-12 h-9 rounded-lg bg-[var(--surface)] text-center font-heading font-bold text-[13px] text-[var(--ink)]"
                  aria-label={`Seed for ${en.displayName}`}
                />
                <div className="flex-1 min-w-0 font-heading font-semibold text-[14px] text-[var(--ink)] truncate">{en.displayName}</div>
                <button type="button" disabled={!!busy} onClick={() => run(`rm-${en.id}`, () => removeEntrant(tid, en.id))} aria-label={`Remove ${en.displayName}`} className="w-8 h-8 rounded-full bg-[var(--surface-3)] text-[var(--coral)] flex items-center justify-center shrink-0">
                  <Icon name="close" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </OrganizerSection>
  );
}
