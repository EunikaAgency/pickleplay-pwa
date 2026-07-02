import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../../shared/components/ui/Icon';
import { FormSelect } from '../../../shared/components/forms/FormSelect';
import { OwnerSection } from '../components/OwnerSection';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { useAuthStore } from '../../../shared/lib/authStore';
import { userHasPermission } from '../../../shared/lib/permissions';
import {
  listVenueStaff,
  addVenueStaff,
  removeVenueStaff,
  searchOwnerStaff,
  ApiError,
  type VenueStaffMember,
  type ApiPlayer,
} from '../../../shared/lib/api';

interface StaffEditorTabProps {
  venueId: string;
  onNavigate: (screen: string, params?: any, opts?: { replace?: boolean }) => void;
}

const STAFF_ROLES = [
  { value: 'manager', label: 'Manager — full venue access (bookings, analytics, listing)' },
  { value: 'front_desk', label: 'Front desk — today\'s schedule, check-ins, manual entries' },
];

export function StaffEditorTab({ venueId, onNavigate }: StaffEditorTabProps) {
  const user = useAuthStore((s) => s.user);
  const canManage = userHasPermission(user, 'owner.staff.manage');

  const [staff, setStaff] = useState<VenueStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Add-a-member form state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ApiPlayer[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ApiPlayer | null>(null);
  const [selectedRole, setSelectedRole] = useState('manager');
  const [addStatus, setAddStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [addError, setAddError] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchReq = useRef(0);

  // Remove-a-member state (per-row confirm)
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState('');
  const [retryCtr, setRetryCtr] = useState(0);

  useEffect(() => {
    if (!venueId) return;
    setLoading(true);
    setError(false);
    listVenueStaff(venueId)
      .then((d) => { setStaff(d); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [venueId, retryCtr]);

  // Debounced staff-only search fired from the add form.
  const doSearch = (q: string) => {
    setQuery(q);
    setSelectedUser(null);
    setAddError('');
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const trimmed = q.trim();
    setSearching(true);
    const reqId = ++searchReq.current;
    const ownerId = user?.id;
    if (!ownerId) { setSearching(false); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        // searchOwnerStaff scopes to staff created by this owner.
        const hits = await searchOwnerStaff(ownerId, trimmed || undefined);
        if (reqId === searchReq.current) {
          // Filter out people already on the team.
          const staffIds = new Set(staff.map((s) => s.userId));
          setResults(hits.filter((h) => !staffIds.has(h.id)));
        }
      } catch {
        if (reqId === searchReq.current) setResults([]);
      } finally {
        if (reqId === searchReq.current) setSearching(false);
      }
    }, 350);
  };

  const onSearch = (q: string) => doSearch(q);

  // On focus with an empty field, show all staff of this owner as suggestions.
  const onFocus = () => {
    if (!query.trim() && results.length === 0 && !searching) {
      doSearch('');
    }
  };

  const onAdd = async () => {
    if (!selectedUser || addStatus === 'saving') return;
    setAddStatus('saving');
    setAddError('');
    try {
      const created = await addVenueStaff(venueId, selectedUser.id, selectedRole);
      setStaff((s) => [...s, created]);
      setQuery('');
      setResults([]);
      setSelectedUser(null);
      setSelectedRole('manager');
      setAddStatus('idle');
    } catch (err) {
      setAddStatus('error');
      if (err instanceof ApiError && err.status === 409) {
        setAddError('This person is already on the team.');
      } else if (err instanceof ApiError && err.status === 404) {
        setAddError('User not found. Try a different name.');
      } else {
        setAddError('Couldn\'t add this person. Try again.');
      }
    }
  };

  const onRemove = async (staffId: string) => {
    setRemoving(staffId);
    setRemoveError('');
    try {
      await removeVenueStaff(staffId);
      setStaff((s) => s.filter((m) => m.id !== staffId));
    } catch {
      setRemoveError('Couldn\'t remove. Try again.');
    } finally {
      setRemoving(null);
    }
  };

  // ── Read-only view (no owner.staff.manage) ──
  if (!canManage) {
    return (
      <div className="space-y-4">
        <OwnerSection title="Team" icon="group" description="People who help run this venue.">
          {loading ? (
            <div className="t-sm">Loading…</div>
          ) : error ? (
            <div className="t-sm text-[var(--coral)]">Couldn't load the team.</div>
          ) : staff.length === 0 ? (
            <div className="t-sm text-[var(--muted)]">No team members yet.</div>
          ) : (
            <div className="space-y-2">
              {staff.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-2">
                  <Avatar name={m.displayName || ''} src={m.avatarUrl} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[14px] text-[var(--ink)] truncate">{m.displayName || 'Unnamed'}</div>
                    <div className="t-sm truncate">{m.email || ''}</div>
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--ink-2)]">
                    {m.staffRole === 'manager' ? 'Manager' : 'Front desk'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </OwnerSection>
        <div className="card p-4 t-sm text-[var(--muted)]">
          <Icon name="lock" size={14} className="inline mr-1" />
          You need the <span className="font-semibold">Manage venue staff</span> permission to add or remove team members.
        </div>
      </div>
    );
  }

  // ── Full management view ──
  return (
    <div className="space-y-4">
      {/* Current team */}
      <OwnerSection title="Team" icon="group" description={`${staff.length} member${staff.length === 1 ? '' : 's'} — managers have full venue access; front-desk see today's schedule and can check players in.`}>
        {loading ? (
          <div className="t-sm">Loading…</div>
        ) : error ? (
          <div className="t-sm text-[var(--coral)]">Couldn't load the team. <button type="button" className="underline font-bold" onClick={() => setRetryCtr((k) => k + 1)}>Retry</button></div>
        ) : staff.length === 0 ? (
          <div className="t-sm text-[var(--muted)]">No team members yet. Add your first one below.</div>
        ) : (
          <div className="space-y-1">
            {staff.map((m) => {
              const isRemoving = removing === m.id;
              return (
                <div key={m.id} className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl hover:bg-[var(--surface-2)] group">
                  <Avatar name={m.displayName || ''} src={m.avatarUrl} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[14px] text-[var(--ink)] truncate">{m.displayName || 'Unnamed'}</div>
                    <div className="t-sm truncate">{m.email || 'No email'}</div>
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--ink-2)] shrink-0">
                    {m.staffRole === 'manager' ? 'Manager' : 'Front desk'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(m.id)}
                    disabled={isRemoving}
                    aria-label={`Remove ${m.displayName || 'staff member'}`}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--coral)] hover:bg-[var(--coral-soft)] opacity-0 group-hover:opacity-100 transition disabled:opacity-50 shrink-0"
                  >
                    {isRemoving ? <span className="inline-flex animate-spin"><Icon name="spinner" size={14} /></span> : <Icon name="close" size={15} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {removeError && <div className="t-sm text-[var(--coral)] font-bold mt-2">{removeError}</div>}
      </OwnerSection>

      {/* Add a team member */}
      <OwnerSection title="Add a team member" icon="person_add" description="Search your staff accounts. Create them first in Owner → Staff if you haven't yet.">
        {/* Search field */}
        <div className="field p-0! mb-3">
          <label className="lbl">Find a person</label>
          <div className="relative">
            <input
              className="control"
              value={query}
              onChange={(e) => onSearch(e.target.value)}
              onFocus={onFocus}
              placeholder="Search your staff accounts…"
              autoComplete="off"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex animate-spin text-[var(--muted)]">
                <Icon name="spinner" size={15} />
              </span>
            )}
          </div>
        </div>

        {/* Search results */}
        {results.length > 0 && !selectedUser && (
          <div className="mb-3 rounded-xl border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] overflow-hidden">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setSelectedUser(p); setResults([]); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--surface-2)] text-left"
              >
                <Avatar name={p.displayName} src={p.avatarUrl} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[14px] text-[var(--ink)] truncate">{p.displayName}</div>
                  {p.skillLevelLabel && <div className="text-[11px] text-[var(--muted)]">{p.skillLevelLabel}</div>}
                </div>
                <Icon name="chevron" size={14} className="text-[var(--muted)]" />
              </button>
            ))}
          </div>
        )}

        {/* Selected user + role picker */}
        {selectedUser && (
          <div className="mb-3 rounded-xl border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] p-3.5">
            <div className="flex items-center gap-3 mb-3">
              <Avatar name={selectedUser.displayName} src={selectedUser.avatarUrl} size={32} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[14px] text-[var(--ink)]">{selectedUser.displayName}</div>
                {selectedUser.skillLevelLabel && <div className="text-[11px] text-[var(--muted)]">{selectedUser.skillLevelLabel}</div>}
              </div>
              <button
                type="button"
                onClick={() => { setSelectedUser(null); setAddStatus('idle'); setAddError(''); }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--coral)]"
                aria-label="Clear selection"
              >
                <Icon name="close" size={15} />
              </button>
            </div>
            <FormSelect
              label="Role"
              options={STAFF_ROLES}
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            />
            <button
              type="button"
              onClick={onAdd}
              disabled={addStatus === 'saving'}
              className="mt-3 w-full h-11 rounded-xl bg-[var(--primary)] text-white font-heading font-bold text-[14px] flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {addStatus === 'saving' ? (
                <><span className="inline-flex animate-spin"><Icon name="spinner" size={16} /></span> Adding…</>
              ) : (
                <><Icon name="person_add" size={16} /> Add to team</>
              )}
            </button>
            {addError && <div className="t-sm text-[var(--coral)] font-bold mt-2">{addError}</div>}
          </div>
        )}

        {/* Empty search state */}
        {!searching && results.length === 0 && !selectedUser && query.trim().length > 0 && (
          <div className="t-sm text-[var(--muted)] mb-3">No matching staff found. Create staff accounts in Owner → Staff first.</div>
        )}

        <div className="t-sm text-[var(--muted)]">
          <Icon name="info" size={13} className="inline mr-1" />
          The person you add will see this venue in their console with the role you pick below. You can remove them anytime.
        </div>
        <button
          type="button"
          onClick={() => onNavigate('owner-staff')}
          className="mt-3 t-sm font-semibold text-[var(--primary)] hover:underline"
        >
          No staff yet? Create one in Owner → Staff
        </button>
      </OwnerSection>
    </div>
  );
}
