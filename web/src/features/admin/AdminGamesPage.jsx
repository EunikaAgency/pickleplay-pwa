import { getGames } from '../../shared/data/index.js';

export default function AdminGamesPage() {
  const games = getGames();
  return (
    <div>
      <div className="flex items-center justify-between">
        <div><h1 className="font-heading text-headline-lg font-bold text-on-surface">Manage Games</h1><p className="mt-1 text-body-md text-on-surface-variant">{games.length} games</p></div>
      </div>
      <div className="mt-6 rounded-[14px] bg-surface-container-lowest shadow-card overflow-hidden">
        <table className="w-full text-body-md">
          <thead className="border-b border-surface-variant text-left">
            <tr><th className="p-4 text-label-sm font-bold uppercase text-on-surface-variant">Game</th><th className="p-4 text-label-sm font-bold uppercase text-on-surface-variant">Type</th><th className="p-4 text-label-sm font-bold uppercase text-on-surface-variant">Date</th><th className="p-4 text-label-sm font-bold uppercase text-on-surface-variant">Status</th><th className="p-4 text-label-sm font-bold uppercase text-on-surface-variant">Actions</th></tr>
          </thead>
          <tbody>
            {games.map(g => (
              <tr key={g.id} className="border-b border-surface-variant last:border-0 hover:bg-surface-container-low">
                <td className="p-4 font-semibold text-on-surface">{g.title}</td>
                <td className="p-4"><span className="rounded-full bg-secondary-fixed px-2.5 py-0.5 text-label-sm font-bold uppercase text-on-secondary-fixed">{g.eventType}</span></td>
                <td className="p-4 text-on-surface-variant">{new Date(g.gameDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                <td className="p-4"><span className={`rounded-full px-2.5 py-0.5 text-label-sm font-bold uppercase ${g.status === 'upcoming' ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-surface-container-high text-on-surface-variant'}`}>{g.status}</span></td>
                <td className="p-4"><button className="font-semibold text-primary hover:underline">Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
