import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../shared/components/ui/Icon';
import { AdminScreen, type LoadState } from './AdminScaffold';
import { listAdminRoles, listPermissionCatalogue, listVenues, updateAdminRole, type AdminRole, type PermissionDef } from '../../shared/lib/api';
import type { Navigate } from '../../shared/lib/navigation';

interface Props {
  onNavigate: Navigate;
  onBack: () => void;
}

/**
 * Admin console: Roles & permissions editor. Pick a role from the dropdown,
 * toggle its permissions, and save. Coaches also get a linked-venue picker.
 * Gated by `admin.settings.manage`.
 */
export function AdminRolesScreen({ onNavigate }: Props) {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [catalogue, setCatalogue] = useState<PermissionDef[]>([]);
  const [venues, setVenues] = useState<{ id: string; name: string; city: string }[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ key: string; label: string; description: string; permissions: string[]; venues: string[]; userCount: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [venueSearch, setVenueSearch] = useState('');
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setState('loading');
    try {
      const [rolesData, catData] = await Promise.all([listAdminRoles(), listPermissionCatalogue()]);
      if (id !== reqId.current) return;
      setRoles(rolesData);
      setCatalogue(catData);
      setState('idle');
      // Default to admin role
      const adminRole = rolesData.find((r) => r.key === 'admin') || rolesData[0];
      if (adminRole && !selectedKey) selectRole(adminRole);
    } catch {
      if (id === reqId.current) setState('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Non-critical: venues for coach-role association picker.
  useEffect(() => {
    listVenues({ pageSize: 100 }).then((page) => {
      setVenues(page.items.map((v) => ({ id: v.id, name: v.displayName, city: v.city || v.area || v.region || '' }))
        .sort((a, b) => a.name.localeCompare(b.name)));
    }).catch(() => {});
  }, []);

  const groups = useMemo(() => {
    const order: string[] = [];
    const byGroup: Record<string, PermissionDef[]> = {};
    for (const p of catalogue) {
      const g = p.group || 'Other';
      if (!byGroup[g]) { byGroup[g] = []; order.push(g); }
      byGroup[g].push(p);
    }
    return order.map((name) => ({ name, items: byGroup[name] }));
  }, [catalogue]);

  const isAdmin = draft?.key === 'admin';
  const showVenues = draft?.key === 'coach';

  function selectRole(r: AdminRole) {
    setSelectedKey(r.key);
    setDraft({ key: r.key, label: r.label || '', description: r.description || '', permissions: [...(r.permissions || [])], venues: (r.venues || []).map(String), userCount: r.userCount || 0 });
    setVenueSearch('');
    setFormError(null);
  }

  function clearSelection() {
    setSelectedKey(null);
    setDraft(null);
    setFormError(null);
  }

  function togglePerm(permKey: string) {
    if (isAdmin && permKey === 'admin.access') return;
    setDraft((d) => d ? { ...d, permissions: d.permissions.includes(permKey) ? d.permissions.filter((p) => p !== permKey) : [...d.permissions, permKey] } : null);
  }

  function toggleVenue(venueId: string) {
    setDraft((d) => d ? { ...d, venues: d.venues.includes(venueId) ? d.venues.filter((v) => v !== venueId) : [...d.venues, venueId] } : null);
  }

  const filteredVenues = useMemo(() => {
    const q = venueSearch.trim().toLowerCase();
    if (!q) return venues;
    return venues.filter((v) => v.name.toLowerCase().includes(q) || v.city.toLowerCase().includes(q));
  }, [venues, venueSearch]);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload: { permissions: string[]; venues?: string[] } = { permissions: draft.permissions };
      if (showVenues) payload.venues = draft.venues;
      await updateAdminRole(draft.key, payload);
      await load();
    } catch (e) {
      setFormError((e as Error).message || 'Could not save the role.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminScreen onBack={() => onNavigate('admin-hub')} title="Roles & permissions" subtitle={`${roles.length} roles`} onRefresh={() => void load()}>
      <div className="space-y-4 pt-4 pb-8">
        {/* Role picker */}
        <div className="flex flex-wrap items-end gap-4 card p-4">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1">
            <span className="lbl">Select a role</span>
            <select value={selectedKey ?? ''} onChange={(e) => { const r = roles.find((x) => x.key === e.target.value); r ? selectRole(r) : clearSelection(); }}
              disabled={state === 'loading'} className="control">
              <option value="">Select a role to edit…</option>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>{r.label || r.key} — {r.permissions?.length || 0} perms, {r.userCount || 0} users</option>
              ))}
            </select>
          </label>
        </div>

        {draft ? (
          <section className="card p-4">
            <h2 className="hd-2 flex items-center gap-2">
              <Icon name="shield_person" size={18} /> {draft.label}
              {draft.description && <span className="t-sm font-normal">{draft.description}</span>}
            </h2>

            {/* Permission groups */}
            <div className="mt-4 space-y-4">
              {groups.map((group) => (
                <div key={group.name}>
                  <div className="lbl mb-2">{group.name}</div>
                  <div className="space-y-2">
                    {group.items.map((p) => {
                      const locked = isAdmin && p.key === 'admin.access';
                      const checked = draft.permissions.includes(p.key);
                      return (
                        <label key={p.key} className={`flex items-start gap-3 rounded-xl border-[1.5px] border-[var(--hairline)] p-3 ${locked ? 'opacity-60' : 'cursor-pointer'}`}>
                          <input type="checkbox" checked={checked} disabled={locked} onChange={() => togglePerm(p.key)} className="mt-0.5 size-5 shrink-0 accent-[var(--blue)]" />
                          <div className="min-w-0">
                            <p className="font-bold">{p.label || p.key}{locked && <Icon name="lock" size={13} className="inline ml-1 text-[var(--muted)]" />}</p>
                            <p className="t-sm">{p.description}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Venue association (coach only) */}
            {showVenues && (
              <div className="mt-6 border-t-[0.5px] border-[var(--hairline)] pt-4">
                <h3 className="hd-3 flex items-center gap-2"><Icon name="stadium" size={16} /> Linked venues ({draft.venues.length})</h3>
                {venues.length === 0 ? (
                  <p className="t-sm mt-2">No venues available to link.</p>
                ) : (
                  <>
                    <input type="text" value={venueSearch} onChange={(e) => setVenueSearch(e.target.value)} placeholder="Search venues…" className="control mt-2 mb-2" />
                    <div className="max-h-60 overflow-y-auto space-y-1.5">
                      {filteredVenues.map((v) => (
                        <label key={v.id} className="flex items-center gap-3 cursor-pointer py-1.5">
                          <input type="checkbox" checked={draft.venues.includes(v.id)} onChange={() => toggleVenue(v.id)} className="size-5 shrink-0 accent-[var(--blue)]" />
                          <span className="t-sm">{v.name}{v.city ? ` · ${v.city}` : ''}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {formError && <p className="mt-4 text-[13px] font-bold text-[var(--coral)]">{formError}</p>}

            <div className="flex gap-3 mt-5">
              <button type="button" onClick={save} disabled={saving}
                className="chip font-bold disabled:opacity-40">{saving ? 'Saving…' : 'Save changes'}</button>
              <button type="button" onClick={clearSelection} disabled={saving}
                className="chip font-bold text-[var(--muted)]">Cancel</button>
            </div>
          </section>
        ) : (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-[var(--muted)]">
            <Icon name="shield_person" size={32} />
            <p className="font-semibold">Choose a role from the dropdown to edit its permissions.</p>
          </div>
        )}
      </div>
    </AdminScreen>
  );
}
