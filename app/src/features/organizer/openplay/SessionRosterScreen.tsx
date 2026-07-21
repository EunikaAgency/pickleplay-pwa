import { useEffect, useState } from 'react';
import { ScreenHeader } from '../../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../../shared/components/ui/ErrorState';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import {
  getOpenPlayRegistrations, manageOpenPlayRegistration,
  type ApiTournamentRegistration, type ManageRegistrationBody,
} from '../../../shared/lib/api';
import { ParticipantRow } from '../components/ParticipantRow';

interface SessionRosterScreenProps {
  sessionId: string;
  onBack: () => void;
}

export function SessionRosterScreen({ sessionId, onBack }: SessionRosterScreenProps) {
  const [roster, setRoster] = useState<ApiTournamentRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [prevFetchKey, setPrevFetchKey] = useState(`${sessionId}|${reloadKey}`);
  const fetchKey = `${sessionId}|${reloadKey}`;
  if (fetchKey !== prevFetchKey) {
    setPrevFetchKey(fetchKey);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let alive = true;
    getOpenPlayRegistrations(sessionId)
      .then((r) => { if (alive) setRoster(r); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load the roster.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sessionId, reloadKey]);

  const onManage = async (regId: string, body: ManageRegistrationBody) => {
    try {
      await manageOpenPlayRegistration(sessionId, regId, body);
      const fresh = await getOpenPlayRegistrations(sessionId);
      setRoster(fresh);
    } catch {
      setReloadKey((k) => k + 1);
    }
  };

  const paidCount = roster.filter((r) => r.paid).length;
  const presentCount = roster.filter((r) => r.attended).length;

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} title="Session roster" eyebrow="Open play" />

      <div className="px-5">
        {loading ? (
          <LoadingSkeleton variant="card" count={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : roster.length === 0 ? (
          <EmptyState icon="groups" title="No one's joined yet" description="Players who join this session will appear here for check-in and payment." />
        ) : (
          <>
            <div className="t-eyebrow mb-2.5">{roster.length} joined · {presentCount} checked in · {paidCount} paid</div>
            <div className="flex flex-col gap-2.5">
              {roster.map((reg) => <ParticipantRow key={reg.id} reg={reg} onManage={onManage} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
