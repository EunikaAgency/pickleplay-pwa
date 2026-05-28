import { Link } from 'react-router-dom';
import Icon from '../components/ui/Icon.jsx';
import { getVenues } from '../data/index.js';

export default function AdminVenuesPage() {
  const venues = getVenues();
  return (
    <div>
      <div className="flex items-center justify-between">
        <div><h1 className="font-heading text-headline-lg font-bold text-on-surface">Manage Venues</h1><p className="mt-1 text-body-md text-on-surface-variant">{venues.length} venues</p></div>
        <button className="inline-flex h-12 items-center rounded-full bg-secondary-container px-6 text-body-md font-bold text-on-secondary-container shadow-sm active:scale-95"><Icon name="add" size={20} /> Add Venue</button>
      </div>
      <div className="mt-6 rounded-[14px] bg-surface-container-lowest shadow-card overflow-hidden">
        <table className="w-full text-body-md">
          <thead className="border-b border-surface-variant text-left">
            <tr><th className="p-4 text-label-sm font-bold uppercase text-on-surface-variant">Venue</th><th className="p-4 text-label-sm font-bold uppercase text-on-surface-variant">City</th><th className="p-4 text-label-sm font-bold uppercase text-on-surface-variant">Courts</th><th className="p-4 text-label-sm font-bold uppercase text-on-surface-variant">Status</th><th className="p-4 text-label-sm font-bold uppercase text-on-surface-variant">Actions</th></tr>
          </thead>
          <tbody>
            {venues.map(v => (
              <tr key={v.id} className="border-b border-surface-variant last:border-0 hover:bg-surface-container-low">
                <td className="p-4 font-semibold text-on-surface">{v.name}</td>
                <td className="p-4 text-on-surface-variant">{v.city}</td>
                <td className="p-4">{v.courtCount}</td>
                <td className="p-4"><span className="rounded-full bg-secondary-fixed px-2.5 py-0.5 text-label-sm font-bold uppercase text-on-secondary-fixed">{v.status}</span></td>
                <td className="p-4"><button className="font-semibold text-primary hover:underline">Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
