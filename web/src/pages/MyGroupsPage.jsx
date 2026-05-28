import { Link } from 'react-router-dom';
import { getGroups } from '../data/index.js';
import useAuth from '../stores/auth.js';

export default function MyGroupsPage() {
  const user = useAuth(s => s.user);
  const myGroups = getGroups().filter(g => g.memberIds?.includes(user?.id));

  if (!myGroups.length) return (
    <div>
      <h1 className="font-heading text-3xl font-extrabold text-on-surface">My Groups</h1>
      <div className="mt-16 flex flex-col items-center text-center">
        <div className="text-6xl">💬</div>
        <h2 className="mt-4 font-heading text-xl font-bold">No groups yet</h2>
        <p className="mt-2 text-base text-on-surface-variant">Join a group to connect with players!</p>
        <Link to="/community" className="mt-6 inline-flex h-14 items-center rounded-2xl bg-[#C1F100] px-8 text-base font-extrabold text-[#374D00] no-underline shadow-lg hover:scale-105 active:scale-95 transition-transform">Find Groups</Link>
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="font-heading text-3xl font-extrabold text-on-surface">My Groups</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {myGroups.map(g => (
          <Link key={g.id} to={`/community/${g.id}`} className="rounded-2xl bg-white p-5 shadow-lg no-underline hover:shadow-xl transition-shadow">
            <h3 className="font-heading text-base font-bold text-on-surface">{g.name}</h3>
            <p className="mt-1 line-clamp-2 text-base text-on-surface-variant">{g.description}</p>
            <p className="mt-2 text-base font-bold">{g.memberCount} members</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
