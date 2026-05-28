import { useState } from 'react';
import useAuth from '../stores/auth.js';

export default function MyProfilePage() {
  const user = useAuth(s => s.user);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <div className="rounded-2xl bg-gradient-to-r from-[#0040E0] to-[#2E5BFF] p-6 text-white">
        <div className="flex items-center gap-4">
          <img src={user?.avatar} alt="" className="h-20 w-20 rounded-2xl border-4 border-white/30 object-cover shadow-lg" />
          <div><h1 className="font-heading text-3xl font-extrabold">{user?.firstName} {user?.lastName}</h1><p className="text-white/70">{user?.skillLabel} · {user?.email}</p></div>
        </div>
      </div>

      <form onSubmit={e => { e.preventDefault(); setSaved(true); setTimeout(()=>setSaved(false),2000); }}
        className="mt-6 rounded-2xl bg-white p-6 shadow-lg space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">First Name</label>
            <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" /></div>
          <div><label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Last Name</label>
            <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" /></div>
        </div>
        <div><label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Bio</label>
          <textarea rows={4} value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell players about yourself..." className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" /></div>
        <button type="submit" className={`h-12 rounded-2xl px-8 text-base font-extrabold shadow-md hover:scale-105 active:scale-95 transition-transform ${saved ? 'bg-[#C1F100] text-[#374D00]' : 'bg-[#C1F100] text-[#374D00]'}`}>
          {saved ? 'Saved! ✅' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
