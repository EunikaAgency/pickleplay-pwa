import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';
import { getVenues } from '../../shared/data/index.js';

export default function CreateGamePage() {
  const navigate = useNavigate();
  const venues = getVenues();
  const [form, setForm] = useState({
    title: '', venueId: '', eventType: 'Open Play', format: 'doubles',
    gameDate: '', startTime: '', endTime: '', skillMin: '2.5', skillMax: '4.0',
    playerLimit: '8', description: '', fee: '', beginnerFriendly: false,
  });

  const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const handleSubmit = e => { e.preventDefault(); navigate('/games'); };

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link to="/games" className="inline-flex items-center gap-1 text-base font-bold text-primary no-underline hover:underline">
        <Icon name="arrow_back" size={20} /> Back
      </Link>
      <h1 className="mt-4 font-heading text-3xl font-extrabold text-on-surface">Create a Game</h1>
      <p className="mt-1 text-on-surface-variant">Set up a game and invite players.</p>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Title</label>
          <input type="text" placeholder="Friday Night Dinks" value={form.title} onChange={e => handleChange('title', e.target.value)} required
            className="h-12 w-full rounded-xl border border-outline-variant bg-white px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Event Type</label>
            <select value={form.eventType} onChange={e => handleChange('eventType', e.target.value)}
              className="h-12 w-full rounded-xl border border-outline-variant bg-white px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10">
              {['Open Play','Clinic','Round Robin','Tournament'].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Format</label>
            <select value={form.format} onChange={e => handleChange('format', e.target.value)}
              className="h-12 w-full rounded-xl border border-outline-variant bg-white px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10">
              {['doubles','singles','open_play','mixed'].map(o => <option key={o}>{o.replace('_',' ')}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Venue</label>
          <select value={form.venueId} onChange={e => handleChange('venueId', e.target.value)} required
            className="h-12 w-full rounded-xl border border-outline-variant bg-white px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10">
            <option value="">Select a venue</option>
            {venues.map(v => <option key={v.id} value={v.id}>{v.name} — {v.city}</option>)}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Date</label>
            <input type="date" value={form.gameDate} onChange={e => handleChange('gameDate', e.target.value)} required
              className="h-12 w-full rounded-xl border border-outline-variant bg-white px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
          </div>
          <div>
            <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Start</label>
            <input type="time" value={form.startTime} onChange={e => handleChange('startTime', e.target.value)} required
              className="h-12 w-full rounded-xl border border-outline-variant bg-white px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
          </div>
          <div>
            <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">End</label>
            <input type="time" value={form.endTime} onChange={e => handleChange('endTime', e.target.value)} required
              className="h-12 w-full rounded-xl border border-outline-variant bg-white px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Min Skill</label>
            <input type="number" step="0.5" min="1" max="10" value={form.skillMin} onChange={e => handleChange('skillMin', e.target.value)}
              className="h-12 w-full rounded-xl border border-outline-variant bg-white px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
          </div>
          <div>
            <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Max Skill</label>
            <input type="number" step="0.5" min="1" max="10" value={form.skillMax} onChange={e => handleChange('skillMax', e.target.value)}
              className="h-12 w-full rounded-xl border border-outline-variant bg-white px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
          </div>
          <div>
            <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Max Players</label>
            <input type="number" min="2" max="64" value={form.playerLimit} onChange={e => handleChange('playerLimit', e.target.value)}
              className="h-12 w-full rounded-xl border border-outline-variant bg-white px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Description</label>
          <textarea rows={4} value={form.description} onChange={e => handleChange('description', e.target.value)}
            placeholder="What should players know about this game?"
            className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Fee ($)</label>
            <input type="number" min="0" step="1" placeholder="0 = free" value={form.fee} onChange={e => handleChange('fee', e.target.value)}
              className="h-12 w-full rounded-xl border border-outline-variant bg-white px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.beginnerFriendly} onChange={e => handleChange('beginnerFriendly', e.target.checked)}
                className="h-5 w-5 rounded accent-primary" />
              <span className="text-base font-bold text-on-surface">Beginner friendly</span>
            </label>
          </div>
        </div>

        <button type="submit" className="h-14 w-full rounded-2xl bg-[#C1F100] text-lg font-extrabold text-[#374D00] shadow-lg hover:scale-105 active:scale-95 transition-transform">
          Create Game
        </button>
      </form>
    </div>
  );
}
