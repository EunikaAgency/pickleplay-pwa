import { useEffect, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { Avatar } from '../../shared/components/ui/Avatar';
import { ScreenHeader } from '../../shared/components/ui/ScreenHeader';
import { OwnerSection } from './components/OwnerSection';
import { useAuthStore } from '../../shared/lib/authStore';
import { userHasPermission } from '../../shared/lib/permissions';
import {
  listStaffAccounts,
  createStaffAccount,
  updateStaffAccount,
  removeStaffAccount,
  ApiError,
  type StaffAccount,
} from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface OwnerStaffScreenProps {
  onNavigate: Navigate;
  onBack: () => void;
}

// Org-level staff: an owner creates login accounts that manage ALL of their
// venues, bookings, and clubs. Distinct from the per-venue "Team" tab inside a
// single venue editor. Gated by owner.staff.manage (owners + admins).
export function OwnerStaffScreen({ onBack }: OwnerStaffScreenProps) {
  const user = useAuthStore((s) => s.user);
  const canManage = userHasPermission(user, 'owner.staff.manage');

  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Bumped by the Retry button to re-run the load effect.
  const [reloadKey, setReloadKey] = useState(0);

  // Add-account form
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [addStatus, setAddStatus] = useState<'idle' | 'saving'>('idle');
  const [addError, setAddError] = useState('');

  // Per-row state
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [rowError, setRowError] = useState('');

  // Load on mount, when the management gate flips (auth restore), or when Retry
  // bumps reloadKey. State is set only inside async callbacks — never
  // synchronously in the effect body (react-hooks/set-state-in-effect). The
  // non-manage branch renders its own UI regardless of `loading`, so we just skip.
  useEffect(() => {
    if (!canManage) return;
    let alive = true;
    listStaffAccounts()
      .then((d) => { if (alive) { setStaff(d); setError(false); } })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [canManage, reloadKey]);

  const retry = () => { setLoading(true); setError(false); setReloadKey((k) => k + 1); };

  const onAdd = async () => {
    if (addStatus === 'saving') return;
    const name = displayName.trim();
    const mail = email.trim();
    if (!name || !mail || password.length < 6) {
      setAddError('Enter a name, email, and a password of at least 6 characters.');
      return;
    }
    setAddStatus('saving');
    setAddError('');
    try {
      const created = await createStaffAccount({ displayName: name, email: mail, password });
      setStaff((s) => [created, ...s]);
      setDisplayName('');
      setEmail('');
      setPassword('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setAddError('That email is already registered.');
      else if (err instanceof ApiError && err.status === 400) setAddError('Staff can only be created under a venue owner account.');
      else setAddError("Couldn't create the account. Try again.");
    } finally {
      setAddStatus('idle');
    }
  };

  const onRemove = async (m: StaffAccount) => {
    setBusyId(m.id);
    setRowError('');
    try {
      await removeStaffAccount(m.id);
      setStaff((s) => s.filter((x) => x.id !== m.id));
      setConfirmRemove(null);
    } catch {
      setRowError("Couldn't remove that account. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const onResetPassword = async (m: StaffAccount) => {
    if (resetPassword.length < 6) { setRowError('New password must be at least 6 characters.'); return; }
    setBusyId(m.id);
    setRowError('');
    try {
      await updateStaffAccount(m.id, { password: resetPassword });
      setResetFor(null);
      setResetPassword('');
    } catch {
      setRowError("Couldn't reset the password. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const header = (
    <ScreenHeader
      onBack={onBack}
      eyebrow="Owner console"
      title="Staff"
      subtitle="Accounts that help you run your venues, bookings and clubs."
    />
  );

  if (!canManage) {
    return (
      <div className="scroll safe-top safe-bottom px-5">
        {header}
        <div className="card p-4 t-sm text-[var(--muted)]">
          <Icon name="lock" size={14} className="inline mr-1" />
          You need the <span className="font-semibold">Manage venue staff</span> permission to create staff accounts.
        </div>
      </div>
    );
  }

  return (
    <div className="scroll safe-top safe-bottom px-5">
      {header}

      {/* What staff can do */}
      <div className="card p-4 mb-4 t-sm text-[var(--muted)]">
        <Icon name="info" size={13} className="inline mr-1" />
        A staff account can manage <span className="font-semibold text-[var(--ink)]">all of your venues, bookings, and clubs</span>. They can't create other staff or list new venues.
      </div>

      {/* Add a staff account */}
      <div className="mb-4">
        <OwnerSection title="Add a staff account" icon="person_add" description="They sign in with this email and password.">
          <div className="space-y-3">
            <div className="field p-0!">
              <label className="lbl">Full name</label>
              <input
                className="control"
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); setAddError(''); }}
                placeholder="e.g. Maria Santos"
                autoComplete="off"
              />
            </div>
            <div className="field p-0!">
              <label className="lbl">Email</label>
              <input
                className="control"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setAddError(''); }}
                placeholder="staff@example.com"
                autoComplete="off"
              />
            </div>
            <div className="field p-0!">
              <label className="lbl">Temporary password</label>
              <input
                className="control"
                type="text"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setAddError(''); }}
                placeholder="At least 6 characters"
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              onClick={onAdd}
              disabled={addStatus === 'saving'}
              className="w-full h-11 rounded-xl bg-[var(--primary)] text-white font-heading font-bold text-[14px] flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {addStatus === 'saving'
                ? (<><span className="inline-flex animate-spin"><Icon name="spinner" size={16} /></span> Creating…</>)
                : (<><Icon name="person_add" size={16} /> Create staff account</>)}
            </button>
            {addError && <div className="t-sm text-[var(--coral)] font-bold">{addError}</div>}
          </div>
        </OwnerSection>
      </div>

      {/* Existing staff */}
      <OwnerSection title="Your staff" icon="group" description={`${staff.length} account${staff.length === 1 ? '' : 's'}`}>
        {loading ? (
          <div className="t-sm">Loading…</div>
        ) : error ? (
          <div className="t-sm text-[var(--coral)]">Couldn't load your staff. <button type="button" className="underline font-bold" onClick={retry}>Retry</button></div>
        ) : staff.length === 0 ? (
          <div className="t-sm text-[var(--muted)]">No staff accounts yet. Add your first one above.</div>
        ) : (
          <div className="space-y-1">
            {staff.map((m) => {
              const isBusy = busyId === m.id;
              return (
                <div key={m.id} className="py-2.5 px-2 -mx-2 rounded-xl hover:bg-[var(--surface-2)]">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.displayName || ''} src={m.avatarUrl ?? undefined} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[14px] text-[var(--ink)] truncate">{m.displayName || 'Unnamed'}</div>
                      <div className="t-sm truncate">{m.email}</div>
                    </div>
                  </div>
                  {confirmRemove === m.id ? (
                    <div className="flex items-center gap-2 mt-2 pl-[46px]">
                      <span className="t-sm text-[var(--ink-2)]">Remove this account?</span>
                      <button
                        type="button"
                        onClick={() => onRemove(m)}
                        disabled={isBusy}
                        className="text-[12px] font-bold text-[var(--coral)] hover:underline disabled:opacity-50"
                      >
                        {isBusy ? 'Removing…' : 'Yes, remove'}
                      </button>
                      <span className="text-[var(--hairline)]">·</span>
                      <button
                        type="button"
                        onClick={() => setConfirmRemove(null)}
                        className="text-[12px] font-bold text-[var(--muted)] hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-2 pl-[46px]">
                      <button
                        type="button"
                        onClick={() => { setResetFor(resetFor === m.id ? null : m.id); setResetPassword(''); setRowError(''); }}
                        className="text-[12px] font-bold text-[var(--primary)] hover:underline"
                      >
                        Reset password
                      </button>
                      <span className="text-[var(--hairline)]">·</span>
                      <button
                        type="button"
                        onClick={() => { setConfirmRemove(m.id); setRowError(''); }}
                        className="text-[12px] font-bold text-[var(--coral)] hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {resetFor === m.id && (
                    <div className="flex items-center gap-2 mt-2 pl-[46px]">
                      <input
                        className="control flex-1"
                        type="text"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        placeholder="New password (min 6)"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => onResetPassword(m)}
                        disabled={isBusy}
                        className="h-9 px-3 rounded-lg bg-[var(--primary)] text-white font-bold text-[13px] disabled:opacity-60"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {rowError && <div className="t-sm text-[var(--coral)] font-bold mt-2">{rowError}</div>}
      </OwnerSection>
    </div>
  );
}
