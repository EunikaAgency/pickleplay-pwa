import { useState, type FormEvent } from 'react';
import { Icon } from '../components/ui/Icon';

interface CreateGameScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
  onBack: () => void;
}

export function CreateGameScreen({ onNavigate }: CreateGameScreenProps) {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [playerLimit, setPlayerLimit] = useState('8');
  const [skillMin, setSkillMin] = useState('2.0');
  const [skillMax, setSkillMax] = useState('4.5');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const cardShadow = { boxShadow: 'var(--shadow-card)' } as const;
  const inputClass = 'block h-12 w-full min-w-0 max-w-full rounded-[12px] border border-outline-variant bg-surface-container-lowest px-4 text-body-md transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';
  const selectClass = `${inputClass} appearance-none`;
  const fieldClass = 'min-w-0 space-y-1';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex w-full min-w-0 flex-1 flex-col items-center justify-center px-5 text-center">
        <div className="w-20 h-20 rounded-full bg-secondary-container flex items-center justify-center mb-6">
          <Icon name="check_circle" size={48} filled className="text-on-secondary-container" />
        </div>
        <h2 className="font-heading text-headline-lg mb-2">Game Created!</h2>
        <p className="text-body-md text-on-surface-variant mb-8 max-w-xs">Your game is live and ready for players to join.</p>
        <div className="flex w-full max-w-sm flex-col gap-3 sm:flex-row">
          <button
            onClick={() => onNavigate('game-details', { id: 'new' })}
            className="flex-1 bg-secondary-container text-on-secondary-container h-12 py-3 rounded-full font-bold active:scale-95 transition-all"
          >
            View Game
          </button>
          <button
            onClick={() => onNavigate('invite-players', { id: 'new' })}
            className="flex-1 bg-primary text-on-primary h-12 py-3 rounded-full font-bold active:scale-95 transition-all"
          >
            Invite Players
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="scrollbar-none w-full min-w-0 overflow-y-auto flex-1">
        <main className="mx-auto box-border w-full max-w-3xl min-w-0 px-5 pt-6 pb-10 md:px-6 lg:px-8">

          <h1 className="mb-6 font-heading text-headline-lg-mobile md:text-headline-lg">Create a Game</h1>

          <form onSubmit={handleSubmit} className="grid w-full min-w-0 grid-cols-1 gap-5 overflow-hidden md:grid-cols-2">
            {/* Game Name */}
            <div className={`${fieldClass} md:col-span-2`}>
              <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">GAME NAME</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Saturday Morning Mix-In"
                required
                className={inputClass}
                style={cardShadow}
              />
            </div>

            {/* Location */}
            <div className={`${fieldClass} md:col-span-2`}>
              <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">LOCATION</label>
              <div className="relative min-w-0">
                <Icon name="location_on" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Search courts..."
                  required
                  className={`${inputClass} pl-12`}
                  style={cardShadow}
                />
              </div>
            </div>

            {/* Date + Time Row */}
            <div className={fieldClass}>
              <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">DATE</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className={inputClass}
                style={cardShadow}
              />
            </div>
            <div className={fieldClass}>
              <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">TIME</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className={inputClass}
                style={cardShadow}
              />
            </div>

            {/* Player Limit + Skill Range */}
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 md:col-span-2">
              <div className={fieldClass}>
                <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">PLAYERS</label>
                <select
                  value={playerLimit}
                  onChange={(e) => setPlayerLimit(e.target.value)}
                  className={selectClass}
                  style={cardShadow}
                >
                  {['2','4','6','8','12','16','24','32'].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className={fieldClass}>
                <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">MIN SKILL</label>
                <select
                  value={skillMin}
                  onChange={(e) => setSkillMin(e.target.value)}
                  className={selectClass}
                  style={cardShadow}
                >
                  {['1.0','1.5','2.0','2.5','3.0','3.5','4.0','4.5','5.0'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className={fieldClass}>
                <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">MAX SKILL</label>
                <select
                  value={skillMax}
                  onChange={(e) => setSkillMax(e.target.value)}
                  className={selectClass}
                  style={cardShadow}
                >
                  {['2.0','2.5','3.0','3.5','4.0','4.5','5.0','5.5+'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Visibility Toggle */}
            <div className={`${fieldClass} md:col-span-2`}>
              <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">VISIBILITY</label>
              <div className="flex min-w-0 rounded-[12px] bg-surface-container-high p-1" style={cardShadow}>
                <button
                  type="button"
                  onClick={() => setVisibility('public')}
                  className={`flex-1 rounded-full py-2.5 text-center font-heading text-body-md font-bold transition-colors ${
                    visibility === 'public' ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'
                  }`}
                >
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility('private')}
                  className={`flex-1 rounded-full py-2.5 text-center font-heading text-body-md font-bold transition-colors ${
                    visibility === 'private' ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'
                  }`}
                >
                  Private
                </button>
              </div>
            </div>

            {/* Description */}
            <div className={`${fieldClass} md:col-span-2`}>
              <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">DESCRIPTION</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell players what to expect..."
                rows={3}
                className="block w-full min-w-0 max-w-full resize-none rounded-[12px] border border-outline-variant bg-surface-container-lowest p-4 text-body-md transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                style={cardShadow}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!title || !location || !date || !time}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-secondary-container font-heading text-body-lg font-bold text-on-secondary-container transition-all hover:brightness-105 active:scale-95 disabled:opacity-50 md:col-span-2 md:mx-auto md:max-w-sm"
              style={{ boxShadow: 'var(--shadow-button)' }}
            >
              Create Game
              <Icon name="bolt" size={20} />
            </button>
          </form>

        </main>
      </div>
    </div>
  );
}
