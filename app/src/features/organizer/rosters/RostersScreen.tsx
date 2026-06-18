import { useEffect, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { Button } from '../../../shared/components/ui/Button';
import { ScreenHeader } from '../../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../../shared/components/ui/ErrorState';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { FormField } from '../../../shared/components/forms/FormField';
import { listRosters, createRoster, type ApiRoster } from '../../../shared/lib/api';
import type { Navigate } from '../../../shared/lib/navigation';
import { OrganizerSection } from '../components/OrganizerSection';

interface RostersScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

export function RostersScreen({ onNavigate, onBack }: RostersScreenProps) {
  const [rosters, setRosters] = useState<ApiRoster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    listRosters()
      .then((r) => { if (alive) setRosters(r); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load your player lists.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  const submit = async () => {
    if (!name.trim()) { setFormError('Give the list a name.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      await createRoster({ name: name.trim(), description: description.trim() || undefined });
      setName(''); setDescription(''); setCreating(false);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not create the list.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader
        onBack={onBack}
        title="Player Lists"
        eyebrow="Reusable rosters"
        action={
          <button type="button" onClick={() => setCreating((c) => !c)} aria-label="New list" className="w-9 h-9 rounded-full bg-[var(--primary)] text-white flex items-center justify-center">
            <Icon name={creating ? 'close' : 'plus'} size={18} />
          </button>
        }
      />

      <div className="px-5 flex flex-col gap-4">
        {creating && (
          <OrganizerSection title="New list" icon="groups" description="Group your regulars so you can invite them fast.">
            <div className="flex flex-col gap-3">
              <FormField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tuesday Regulars" required />
              <FormField label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Advanced 4.0+ crew" />
              {formError && <div className="text-[13px] font-semibold text-[var(--coral)]">{formError}</div>}
              <Button fullWidth onClick={submit} disabled={saving}>{saving ? 'Creating…' : 'Create list'}</Button>
            </div>
          </OrganizerSection>
        )}

        {loading ? (
          <LoadingSkeleton variant="card" count={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : rosters.length === 0 && !creating ? (
          <EmptyState icon="groups" title="No player lists yet" description="Create a reusable list of your regulars." action={{ label: 'New list', onPress: () => setCreating(true) }} />
        ) : (
          rosters.map((r) => (
            <button key={r.id} type="button" onClick={() => onNavigate('organizer-roster', { id: r.id })} className="card p-4 w-full text-left flex items-center gap-3.5">
              <span className="w-10 h-10 rounded-xl bg-[var(--coral)] text-white flex items-center justify-center shrink-0">
                <Icon name="groups" size={18} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-heading font-semibold text-[16px] text-[var(--ink)] truncate">{r.name}</span>
                <span className="t-sm block">{r.memberCount} member{r.memberCount === 1 ? '' : 's'}{r.description ? ` · ${r.description}` : ''}</span>
              </span>
              <Icon name="chevron" size={18} className="text-[var(--surface-3)] shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
