import { useEffect, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { Button } from '../../../shared/components/ui/Button';
import { ScreenHeader } from '../../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../../shared/components/ui/ErrorState';
import { FormField } from '../../../shared/components/forms/FormField';
import { getInitials } from '../../../shared/lib/initials';
import {
  listRosters, addRosterMember, removeRosterMember, type ApiRoster,
} from '../../../shared/lib/api';
import { OrganizerSection } from '../components/OrganizerSection';

interface RosterDetailScreenProps {
  rosterId: string;
  onBack: () => void;
}

export function RosterDetailScreen({ rosterId, onBack }: RosterDetailScreenProps) {
  const [roster, setRoster] = useState<ApiRoster | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    // No single-roster GET endpoint; the list carries members, so find ours.
    listRosters()
      .then((all) => {
        if (!alive) return;
        const found = all.find((r) => r.id === rosterId) ?? null;
        if (!found) setError('This list no longer exists.');
        setRoster(found);
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load this list.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [rosterId, reloadKey]);

  const addMember = async () => {
    if (!memberName.trim() || adding) return;
    setAdding(true);
    try {
      const updated = await addRosterMember(rosterId, { name: memberName.trim(), email: memberEmail.trim() || undefined });
      setRoster(updated);
      setMemberName(''); setMemberEmail('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the member.');
    } finally {
      setAdding(false);
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const updated = await removeRosterMember(rosterId, memberId);
      setRoster(updated);
    } catch {
      setReloadKey((k) => k + 1);
    }
  };

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} title={roster?.name || 'Player list'} eyebrow="Player list" />

      <div className="px-5 flex flex-col gap-4">
        {loading ? (
          <LoadingSkeleton variant="card" count={3} />
        ) : error && !roster ? (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : roster ? (
          <>
            <OrganizerSection title="Add member" icon="plus">
              <div className="flex flex-col gap-3">
                <FormField label="Name" value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Jordan Cruz" required />
                <FormField label="Email (optional)" type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="jordan@email.com" />
                <Button fullWidth onClick={addMember} disabled={adding || !memberName.trim()}>{adding ? 'Adding…' : 'Add to list'}</Button>
              </div>
            </OrganizerSection>

            <OrganizerSection title={`Members (${roster.members.length})`} icon="groups">
              {roster.members.length === 0 ? (
                <div className="text-[13px] text-[var(--muted)] py-2">No members yet — add your regulars above.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {roster.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] p-3">
                      <span className="w-9 h-9 rounded-full bg-[var(--primary-soft)] text-[var(--primary-deep)] flex items-center justify-center font-heading font-semibold text-[13px] shrink-0">
                        {getInitials(m.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-heading font-semibold text-[14px] text-[var(--ink)] truncate">{m.name}</div>
                        {m.email && <div className="text-[12px] text-[var(--muted)] truncate">{m.email}</div>}
                      </div>
                      <button type="button" onClick={() => removeMember(m.id)} aria-label={`Remove ${m.name}`} className="w-8 h-8 rounded-full bg-[var(--surface-3)] text-[var(--coral)] flex items-center justify-center shrink-0">
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </OrganizerSection>
          </>
        ) : null}
      </div>
    </div>
  );
}
