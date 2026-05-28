import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../shared/components/Icon.jsx';

const TAG_OPTIONS = ['Family','Senior','Competitive','Casual','Doubles','Singles','Mixed','Social','Youth','Beginner'];

export default function CreateClubPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', description: '', visibility: 'public',
    skillMin: '2.0', skillMax: '5.0', rules: '', tags: [],
  });

  const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const toggleTag = tag => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }));
  };
  const handleSubmit = e => { e.preventDefault(); navigate('/clubs'); };

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link to="/clubs" className="inline-flex items-center gap-1 text-base font-bold text-primary no-underline hover:underline">
        <Icon name="arrow_back" size={20} /> Back
      </Link>
      <h1 className="mt-4 font-heading text-3xl font-extrabold text-on-surface">Create a Club</h1>
      <p className="mt-1 text-on-surface-variant">Build your pickleball community.</p>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Club Name</label>
          <input type="text" placeholder="Sunset Picklers" value={form.name} onChange={e => handleChange('name', e.target.value)} required
            className="h-12 w-full rounded-xl border border-outline-variant bg-white px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
        </div>

        <div>
          <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Description</label>
          <textarea rows={4} value={form.description} onChange={e => handleChange('description', e.target.value)} required
            placeholder="Tell players what your club is about..."
            className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Visibility</label>
            <select value={form.visibility} onChange={e => handleChange('visibility', e.target.value)}
              className="h-12 w-full rounded-xl border border-outline-variant bg-white px-4 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10">
              <option value="public">Public - anyone can join</option>
              <option value="private">Private - invite only</option>
            </select>
          </div>
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
        </div>

        <div>
          <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Tags</label>
          <div className="flex flex-wrap gap-2">
            {TAG_OPTIONS.map(tag => (
              <button key={tag} type="button" onClick={() => toggleTag(tag)}
                className={`rounded-full px-4 py-2 text-base font-bold transition-colors ${
                  form.tags.includes(tag)
                    ? 'bg-primary text-white shadow-md'
                    : 'border-2 border-surface-variant text-on-surface-variant hover:bg-surface-container-high'
                }`}>{tag}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-base font-extrabold uppercase tracking-wider text-on-surface-variant">Club Rules</label>
          <textarea rows={4} value={form.rules} onChange={e => handleChange('rules', e.target.value)}
            placeholder="Any rules members should know? (optional)"
            className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10" />
        </div>

        <button type="submit" className="h-14 w-full rounded-2xl bg-[#C1F100] text-lg font-extrabold text-[#374D00] shadow-lg hover:scale-105 active:scale-95 transition-transform">
          Create Club
        </button>
      </form>
    </div>
  );
}
