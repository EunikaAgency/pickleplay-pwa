import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { Button } from '../../../shared/components/ui/Button';
import { ScreenHeader } from '../../../shared/components/ui/ScreenHeader';
import { LoadingSkeleton } from '../../../shared/components/ui/LoadingSkeleton';
import { ErrorState } from '../../../shared/components/ui/ErrorState';
import {
  getTournament, getTournamentRegistrations, manageTournamentRegistration,
  openTournamentRegistration, cancelTournament, updateTournament, uploadTournamentMedia, apiImageUrl,
  type ApiTournament, type ApiTournamentRegistration, type ManageRegistrationBody,
} from '../../../shared/lib/api';
import type { Navigate } from '../../../shared/lib/navigation';
import { OrganizerSection } from '../components/OrganizerSection';
import { ParticipantRow } from '../components/ParticipantRow';
import { AnnouncementsPanel } from '../components/AnnouncementsPanel';
import { StatusChip } from '../components/StatusChip';
import { money, prettyDate, tournamentStatusChip } from '../organizerDisplay';

interface TournamentDetailScreenProps {
  tournamentId: string;
  onNavigate: Navigate;
  onBack: () => void;
}

// Status groups that drive which actions show.
const CAN_REQUEST_VENUE = ['draft', 'rejected'];
const HAS_PARTICIPANTS = ['registration_open', 'ongoing', 'completed'];

export function TournamentDetailScreen({ tournamentId, onNavigate, onBack }: TournamentDetailScreenProps) {
  const [t, setT] = useState<ApiTournament | null>(null);
  const [regs, setRegs] = useState<ApiTournamentRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [acting, setActing] = useState(false);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const [prevFetchKey, setPrevFetchKey] = useState(`${tournamentId}|${reloadKey}`);
  const fetchKey = `${tournamentId}|${reloadKey}`;
  if (fetchKey !== prevFetchKey) {
    setPrevFetchKey(fetchKey);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let alive = true;
    getTournament(tournamentId)
      .then(async (tour) => {
        if (!alive) return;
        setT(tour);
        if (HAS_PARTICIPANTS.includes(tour.status)) {
          const r = await getTournamentRegistrations(tournamentId).catch(() => []);
          if (alive) setRegs(r);
        }
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load this tournament.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tournamentId, reloadKey]);

  const onManage = async (regId: string, body: ManageRegistrationBody) => {
    await manageTournamentRegistration(tournamentId, regId, body);
    const fresh = await getTournamentRegistrations(tournamentId);
    setRegs(fresh);
  };

  const handleOpenRegistration = async () => {
    setActing(true);
    try { await openTournamentRegistration(tournamentId); } finally { setActing(false); setReloadKey((k) => k + 1); }
  };

  const handleCancel = async () => {
    setActing(true);
    try { await cancelTournament(tournamentId); } finally { setActing(false); setReloadKey((k) => k + 1); }
  };

  // Optional banner — add or swap it any time. Upload creates the media record,
  // then we persist its URL on the tournament and refresh.
  const onPickBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBannerBusy(true);
    setBannerError(null);
    try {
      const url = await uploadTournamentMedia(tournamentId, f);
      if (!url) throw new Error('Upload failed');
      const updated = await updateTournament(tournamentId, { bannerUrl: url });
      setT(updated);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Could not update the image.');
    } finally {
      setBannerBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="scroll safe-top safe-bottom">
        <ScreenHeader onBack={onBack} title="Tournament" />
        <div className="px-5"><LoadingSkeleton variant="card" count={3} /></div>
      </div>
    );
  }
  if (error || !t) {
    return (
      <div className="scroll safe-top safe-bottom">
        <ScreenHeader onBack={onBack} title="Tournament" />
        <div className="px-5"><ErrorState message={error ?? 'Not found.'} onRetry={() => setReloadKey((k) => k + 1)} /></div>
      </div>
    );
  }

  const when = [prettyDate(t.startDate), t.endDate && t.endDate !== t.startDate ? prettyDate(t.endDate) : null].filter(Boolean).join(' – ');
  const paidCount = regs.filter((r) => r.paid).length;
  const showParticipants = HAS_PARTICIPANTS.includes(t.status);
  const canBracket = showParticipants;

  return (
    <div className="scroll pb-[100px] pt-[calc(20px+env(safe-area-inset-top))]">
      <ScreenHeader onBack={onBack} title={t.name} eyebrow="Tournament" />

      <div className="px-5 flex flex-col gap-4">
        {/* Banner — optional; trophy placeholder when unset */}
        <div>
          <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={onPickBanner} />
          <div
            className="relative overflow-hidden rounded-[16px] aspect-[16/9] bg-[var(--primary-tint)] text-[var(--primary)] flex items-center justify-center"
            style={apiImageUrl(t.bannerUrl) ? { backgroundImage: `url(${apiImageUrl(t.bannerUrl)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
          >
            {!apiImageUrl(t.bannerUrl) && <Icon name="trophy" size={48} />}
            <button
              type="button"
              onClick={() => bannerRef.current?.click()}
              disabled={bannerBusy}
              className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-bold text-[var(--ink)] shadow-sm disabled:opacity-60"
            >
              <Icon name={bannerBusy ? 'progress_activity' : 'photo_camera'} size={15} className={bannerBusy ? 'animate-spin' : undefined} />
              {bannerBusy ? 'Uploading…' : apiImageUrl(t.bannerUrl) ? 'Change' : 'Add image'}
            </button>
          </div>
          {bannerError && <div className="mt-1.5 text-[12px] font-semibold text-[var(--coral)]">{bannerError}</div>}
        </div>

        {/* Overview */}
        <div className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-heading font-semibold text-[17px] text-[var(--ink)]">{t.name}</div>
              <div className="t-sm mt-0.5">{when || 'Dates TBD'}</div>
            </div>
            <StatusChip chip={tournamentStatusChip(t.status)} />
          </div>
          <div className="mt-3 pt-3 border-t-[0.5px] border-[var(--hairline)] grid grid-cols-3 gap-2 text-center">
            <div><div className="font-heading font-bold text-[16px] text-[var(--ink)]">{t.venueName || '—'}</div><div className="t-eyebrow mt-0.5">Venue</div></div>
            <div><div className="font-heading font-bold text-[16px] text-[var(--ink)]">{money(t.price)}</div><div className="t-eyebrow mt-0.5">Entry</div></div>
            <div><div className="font-heading font-bold text-[16px] text-[var(--ink)]">{t.maxPlayers || '—'}</div><div className="t-eyebrow mt-0.5">Max</div></div>
          </div>
        </div>

        {/* Lifecycle actions */}
        <div className="flex flex-col gap-2.5">
          {CAN_REQUEST_VENUE.includes(t.status) && (
            <Button fullWidth variant="outline" onClick={() => onNavigate('organizer-venue-requests', { tournamentId: t.id })}>
              <Icon name="storefront" size={16} /> Request a venue
            </Button>
          )}
          {t.status === 'approved' && (
            <Button fullWidth onClick={handleOpenRegistration} disabled={acting}>{acting ? 'Opening…' : 'Open registration'}</Button>
          )}
          {canBracket && (
            <Button fullWidth variant="brand" onClick={() => onNavigate('organizer-bracket', { tournamentId: t.id })}>
              <Icon name="layers" size={16} /> Manage bracket
            </Button>
          )}
          {showParticipants && (
            <Button fullWidth variant="outline" onClick={() => onNavigate('tournament-chat', { id: t.id, name: t.name })}>
              <Icon name="chat" size={16} /> Chat with participants
            </Button>
          )}
        </div>

        {/* Participants */}
        {showParticipants && (
          <OrganizerSection title={`Participants (${regs.length})`} icon="groups" description={`${paidCount} paid · ${regs.filter((r) => r.attended).length} checked in`}>
            {regs.length === 0 ? (
              <div className="text-[13px] text-[var(--muted)] py-2">No registrations yet.</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {regs.map((r) => <ParticipantRow key={r.id} reg={r} onManage={onManage} />)}
              </div>
            )}
          </OrganizerSection>
        )}

        {/* Announcements */}
        {showParticipants && (
          <OrganizerSection title="Announcements" icon="bell" description="Broadcast to every registrant.">
            <AnnouncementsPanel tournamentId={t.id} />
          </OrganizerSection>
        )}

        {/* Danger zone */}
        {['draft', 'pending_venue_approval', 'approved', 'registration_open'].includes(t.status) && (
          <button type="button" onClick={handleCancel} disabled={acting} className="text-[13px] font-bold text-[var(--coral)] py-2 disabled:opacity-50">
            Cancel tournament
          </button>
        )}
      </div>
    </div>
  );
}
