import { Link } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';
import { coaches } from '../../shared/data/index.js';

export default function CoachesPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <div>
        <h1 className="font-heading text-headline-xl font-bold text-on-surface">Coaches</h1>
        <p className="mt-2 text-body-lg text-on-surface-variant">{coaches.length} coaches ready to level up your game.</p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {coaches.map((c) => (
          <div key={c.id} className="rounded-[14px] bg-surface-container-lowest p-5 shadow-card">
            <div className="flex items-center gap-4">
              <img src={c.avatar} alt={c.name} className="h-14 w-14 rounded-full object-cover" loading="lazy" />
              <div>
                <h3 className="font-heading text-headline-md font-semibold text-on-surface">{c.name}</h3>
                <p className="text-body-md text-on-surface-variant">{c.specialty}</p>
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-body-md text-on-surface-variant">{c.bio}</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="rounded-full bg-primary-fixed px-2.5 py-0.5 text-label-sm font-bold uppercase text-on-primary-fixed">{c.rate}</span>
              {c.tags?.slice(0, 2).map(t => (
                <span key={t} className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-label-sm font-bold uppercase text-on-surface-variant">{t}</span>
              ))}
            </div>
            <button className="mt-4 h-11 w-full rounded-full bg-secondary-container text-body-md font-bold text-on-secondary-container shadow-sm active:scale-95">Book Session</button>
          </div>
        ))}
      </div>
    </div>
  );
}
