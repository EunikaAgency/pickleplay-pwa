import { Link } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';
import { getGroups } from '../../shared/data/index.js';

export default function CommunityPage() {
  const groups = getGroups();

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-heading text-headline-xl font-bold text-on-surface">Community</h1>
          <p className="mt-2 text-body-lg text-on-surface-variant">{groups.length} groups — find your people.</p>
        </div>
        <Link to="/clubs/create" className="inline-flex h-12 items-center rounded-full bg-secondary-container px-6 text-body-md font-bold text-on-secondary-container no-underline shadow-sm active:scale-95">
          <Icon name="add" size={20} /> Create Group
        </Link>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <Link key={g.id} to={`/community/${g.id}`} className="rounded-[14px] bg-surface-container-lowest p-5 shadow-card no-underline hover:shadow-fab transition-shadow">
            <img src={g.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" loading="lazy" />
            <h3 className="mt-3 font-heading text-headline-md font-semibold text-on-surface">{g.name}</h3>
            <p className="mt-1 line-clamp-2 text-body-md text-on-surface-variant">{g.description}</p>
            <p className="mt-3 text-body-md text-on-surface-variant">{g.memberCount} members</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
