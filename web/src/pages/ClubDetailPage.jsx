import { useParams, Link } from 'react-router-dom';
import Icon from '../components/ui/Icon.jsx';
import { getClub, getUser } from '../data/index.js';

export default function ClubDetailPage() {
  const { slug } = useParams();
  const club = getClub(slug);
  if (!club) return <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 text-center"><div className="text-5xl">😕</div><h1 className="mt-4 font-heading text-3xl font-extrabold">Club not found</h1><Link to="/clubs" className="mt-4 font-bold text-primary no-underline hover:underline">Back to clubs</Link></div>;

  const creator = getUser(club.createdBy);
  const admins = club.admins.map(getUser).filter(Boolean);
  const members = club.memberIds.map(getUser).filter(Boolean);

  return (
    <div>
      <section className="bg-gradient-to-r from-[#2E5BFF] to-[#0040E0] px-5 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <Link to="/clubs" className="inline-flex items-center gap-1 text-base font-bold text-white/80 no-underline hover:text-white"><Icon name="arrow_back" size={20} /> Back</Link>
          <div className="mt-4 flex items-center gap-4">
            <img src={club.avatarUrl} alt="" className="h-20 w-20 rounded-2xl border-4 border-white/30 object-cover shadow-lg" />
            <div>
              <h1 className="font-heading text-3xl font-extrabold">{club.name}</h1>
              <p className="text-white/70">{club.memberCount} members · Created by {creator ? `${creator.firstName} ${creator.lastName}` : 'Unknown'}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">{club.tags.map(t => <span key={t} className="rounded-full bg-white/20 px-3 py-1 text-base font-extrabold uppercase">{t}</span>)}</div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-lg">
              <h2 className="font-heading text-xl font-bold">About</h2>
              <p className="mt-3 text-base leading-relaxed text-on-surface-variant">{club.description}</p>
            </div>
            {club.rules && (
              <div className="rounded-2xl bg-white p-6 shadow-lg">
                <h2 className="font-heading text-xl font-bold">Rules</h2>
                <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-on-surface-variant">{club.rules}</p>
              </div>
            )}
            {admins.length > 0 && (
              <div className="rounded-2xl bg-white p-6 shadow-lg">
                <h2 className="font-heading text-xl font-bold">Admins</h2>
                <div className="mt-4 flex flex-wrap gap-3">{admins.map(a => (
                  <div key={a.id} className="flex items-center gap-3 rounded-2xl border-2 border-surface-variant p-3">
                    <img src={a.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                    <div><p className="text-base font-bold">{a.firstName} {a.lastName}</p><p className="text-base text-on-surface-variant">{a.skillLabel}</p></div>
                  </div>
                ))}</div>
              </div>
            )}
            <div className="rounded-2xl bg-white p-6 shadow-lg">
              <h2 className="font-heading text-xl font-bold">Members ({members.length})</h2>
              <div className="mt-4 flex flex-wrap gap-2">{members.slice(0,12).map(m => (
                <img key={m.id} src={m.avatar} alt={m.firstName} title={`${m.firstName} ${m.lastName}`} className="h-10 w-10 rounded-full border-2 border-white object-cover shadow-sm" />
              ))}{members.length > 12 && <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-base font-extrabold">+{members.length-12}</div>}</div>
            </div>
          </div>
          <aside className="space-y-4">
            <div className="rounded-2xl bg-white p-6 shadow-lg text-center">
              <p className="text-lg font-extrabold">{club.memberCount} members</p>
              <p className="text-base text-on-surface-variant">Skill: {club.skillMin===club.skillMax?club.skillMin:`${club.skillMin}-${club.skillMax}`}</p>
              <button className="mt-4 h-14 w-full rounded-2xl bg-[#C1F100] text-base font-extrabold text-[#374D00] shadow-lg hover:scale-105 active:scale-95 transition-transform">Join Club 🤝</button>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-lg">
              <h3 className="font-heading text-base font-bold">Visibility</h3>
              <p className="mt-2 text-base">🔓 {club.visibility==='public'?'Anyone can join':'Invite only'}</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
