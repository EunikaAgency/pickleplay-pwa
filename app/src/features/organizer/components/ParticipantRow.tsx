import { useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { getInitials } from '../../../shared/lib/initials';
import type { ApiTournamentRegistration, ManageRegistrationBody } from '../../../shared/lib/api';
import { regStatusChip } from '../organizerDisplay';
import { StatusChip } from './StatusChip';

interface ParticipantRowProps {
  reg: ApiTournamentRegistration;
  /** Persist a change for this registration; resolves when the server confirms. */
  onManage: (regId: string, body: ManageRegistrationBody) => Promise<void>;
}

const isPending = (s: string) => s === 'pending' || s === 'waitlisted';
const isConfirmed = (s: string) => s === 'registered' || s === 'approved' || s === 'confirmed';

/**
 * One participant in a tournament or open-play session roster. Pending /
 * waitlisted players get Approve / Decline; confirmed players get attendance +
 * paid toggles (the paid/owe ledger). Shared by the tournament detail and the
 * session roster screens — both use the same `{action} | {attended} | {paid}`
 * manage contract.
 */
export function ParticipantRow({ reg, onManage }: ParticipantRowProps) {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, body: ManageRegistrationBody) => {
    setBusy(key);
    try {
      await onManage(reg.id, body);
    } catch {
      /* onManage surfaces errors itself — just unset busy */
    } finally {
      setBusy(null);
    }
  };

  const name = reg.player?.name || 'Player';

  return (
    <div className="rounded-xl bg-[var(--surface-2)] p-3">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-[var(--primary-soft)] text-[var(--primary-deep)] flex items-center justify-center overflow-hidden font-heading font-semibold text-[13px] shrink-0">
          {reg.player?.avatar ? <img src={reg.player.avatar} alt="" className="w-full h-full object-cover" /> : getInitials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-heading font-semibold text-[14px] text-[var(--ink)] truncate">{name}</div>
          {reg.player?.email && <div className="text-[12px] text-[var(--muted)] truncate">{reg.player.email}</div>}
        </div>
        <StatusChip chip={regStatusChip(reg.status)} />
      </div>

      {isPending(reg.status) && (
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => run('approve', { action: 'approve' })}
            className="flex-1 h-9 rounded-lg bg-[var(--lime)] text-[var(--ink)] font-heading font-semibold text-[13px] disabled:opacity-50"
          >
            {busy === 'approve' ? 'Approving…' : 'Approve'}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => run('decline', { action: 'decline' })}
            className="flex-1 h-9 rounded-lg bg-[var(--surface-3)] text-[var(--ink)] font-heading font-semibold text-[13px] disabled:opacity-50"
          >
            {busy === 'decline' ? 'Declining…' : 'Decline'}
          </button>
        </div>
      )}

      {isConfirmed(reg.status) && (
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => run('attended', { attended: !reg.attended })}
            className={`flex-1 h-9 rounded-lg font-heading font-semibold text-[13px] flex items-center justify-center gap-1 disabled:opacity-50 ${
              reg.attended ? 'bg-[var(--lime-soft)] text-[var(--lime-ink)]' : 'bg-[var(--surface-3)] text-[var(--ink)]'
            }`}
          >
            <Icon name="check" size={14} /> {reg.attended ? 'Checked in' : 'Check in'}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => run('paid', { paid: !reg.paid })}
            className={`flex-1 h-9 rounded-lg font-heading font-semibold text-[13px] disabled:opacity-50 ${
              reg.paid ? 'bg-[var(--lime-soft)] text-[var(--lime-ink)]' : 'bg-[var(--coral)]/15 text-[var(--coral)]'
            }`}
          >
            {reg.paid ? 'Paid' : 'Owes'}
          </button>
        </div>
      )}
    </div>
  );
}
