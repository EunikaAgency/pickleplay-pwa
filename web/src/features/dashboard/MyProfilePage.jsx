import { useEffect, useState } from 'react';
import useAuth from '../auth/authStore.js';
import { apiGet, apiPatch } from '../../shared/api/client.js';
import Icon from '../../shared/components/Icon.jsx';

const SKILL_OPTIONS = [
  { value: '', label: 'Skill level…' },
  { value: '2.0', label: '2.0 — Beginner' },
  { value: '2.5', label: '2.5 — Beginner' },
  { value: '3.0', label: '3.0 — Intermediate' },
  { value: '3.5', label: '3.5 — Intermediate' },
  { value: '4.0', label: '4.0 — Advanced' },
  { value: '4.5', label: '4.5 — Advanced' },
  { value: '5.0', label: '5.0 — Pro' },
  { value: '5.5+', label: '5.5+ — Pro' },
];

export default function MyProfilePage() {
  const user = useAuth((s) => s.user);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [skillLevel, setSkillLevel] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  function applyUser(u) {
    setFirstName(u?.firstName || '');
    setLastName(u?.lastName || '');
    setDisplayName(u?.displayName || '');
    setBio(u?.bio || '');
    setPhone(u?.phone || '');
    setSkillLevel(u?.skillLevel != null ? String(u.skillLevel) : '');
  }

  // Load fresh from /api/v1/auth/me on mount (the cached user from login
  // could be stale if another tab made changes).
  useEffect(() => {
    let alive = true;
    apiGet('/api/v1/auth/me')
      .then((res) => { if (alive) { applyUser(res?.data); setError(null); } })
      .catch((e) => { if (alive) { setError(e); applyUser(useAuth.getState().user); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        displayName: displayName.trim() || `${firstName} ${lastName}`.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        bio: bio,
        phone: phone.trim(),
      };
      if (skillLevel) body.skillLevel = skillLevel;
      const res = await apiPatch('/api/v1/auth/me', body);
      applyUser(res?.data);
      // Also refresh the cached user in the store so Header / sidebar update.
      useAuth.getState().refreshMe();
      setSavedAt(Date.now());
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="rounded-2xl bg-gradient-to-r from-[#0040E0] to-[#2E5BFF] p-6 text-white">
        <div className="flex items-center gap-4">
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="size-20 rounded-2xl border-4 border-white/30 object-cover shadow-lg"
              onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <div className="flex size-20 items-center justify-center rounded-2xl border-4 border-white/30 bg-white/10 text-white shadow-lg">
              <Icon name="person" size={36} />
            </div>
          )}
          <div>
            <h1 className="font-heading text-3xl font-extrabold">
              {displayName || `${firstName} ${lastName}`.trim() || user?.email}
            </h1>
            <p className="text-white/70">
              {user?.role && user.role !== 'player' ? (
                <span className="mr-2 rounded-full bg-white/15 px-2 py-0.5 text-base font-bold uppercase tracking-wider">{user.role}</span>
              ) : null}
              {user?.email}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 rounded-2xl bg-white p-6 shadow-lg space-y-5">
        {loading && (
          <div className="text-on-surface-variant">Loading your profile…</div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="profile-firstName" className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">First Name</label>
            <input id="profile-firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={loading || saving}
              className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:opacity-60" />
          </div>
          <div>
            <label htmlFor="profile-lastName" className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Last Name</label>
            <input id="profile-lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={loading || saving}
              className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:opacity-60" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="profile-displayName" className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Display Name</label>
            <input id="profile-displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={loading || saving}
              placeholder="How others see you"
              className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:opacity-60" />
          </div>
          <div>
            <label htmlFor="profile-phone" className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Phone</label>
            <input id="profile-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading || saving}
              placeholder="+63 9xx xxx xxxx"
              className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:opacity-60" />
          </div>
        </div>

        <div>
          <label htmlFor="profile-skillLevel" className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Skill Level</label>
          <select id="profile-skillLevel" value={skillLevel} onChange={(e) => setSkillLevel(e.target.value)} disabled={loading || saving}
            className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:opacity-60">
            {SKILL_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
        </div>

        <div>
          <label htmlFor="profile-bio" className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Bio</label>
          <textarea id="profile-bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} disabled={loading || saving}
            placeholder="Tell players about yourself…"
            className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:opacity-60" />
        </div>

        {error && (
          <div role="alert" className="rounded-xl bg-error-container px-4 py-3 text-base font-semibold text-on-error-container">
            Could not save changes ({error.status || 'network error'}). Try again.
          </div>
        )}
        {savedAt && !error && (
          <div className="rounded-xl bg-secondary-container px-4 py-3 text-base font-semibold text-on-secondary-container">
            Saved! ✅
          </div>
        )}

        <button type="submit" disabled={loading || saving}
          className="h-12 rounded-2xl bg-[#C1F100] px-8 text-base font-extrabold text-[#374D00] shadow-md hover:scale-105 active:scale-95 transition-transform disabled:opacity-60 disabled:hover:scale-100">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
