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

  const cardShadow = { boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.1)' } as const;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
        <div className="w-20 h-20 rounded-full bg-secondary-container flex items-center justify-center mb-6">
          <Icon name="check_circle" size={48} filled className="text-on-secondary-container" />
        </div>
        <h2 className="font-heading text-headline-lg mb-2">Game Created!</h2>
        <p className="text-body-md text-on-surface-variant mb-8 max-w-xs">Your game is live and ready for players to join.</p>
        <div className="flex gap-3 w-full max-w-sm">
          <button
            onClick={() => onNavigate('game-details', { id: 'new' })}
            className="flex-1 bg-secondary-container text-on-secondary-container h-12 rounded-full font-bold active:scale-95 transition-all"
          >
            View Game
          </button>
          <button
            onClick={() => onNavigate('invite-players', { id: 'new' })}
            className="flex-1 bg-primary text-on-primary h-12 rounded-full font-bold active:scale-95 transition-all"
          >
            Invite Players
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden pb-24">
      <div className="scrollbar-none overflow-y-auto flex-1">
        <main className="mx-auto max-w-xl px-5 pt-6 space-y-6">

          <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg">Create a Game</h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Game Name */}
            <div className="space-y-1">
              <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">GAME NAME</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Saturday Morning Mix-In"
                required
                className="w-full h-12 px-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md"
                style={cardShadow}
              />
            </div>

            {/* Location */}
            <div className="space-y-1">
              <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">LOCATION</label>
              <div className="relative">
                <Icon name="location_on" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Search courts..."
                  required
                  className="w-full h-12 pl-12 pr-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md"
                  style={cardShadow}
                />
              </div>
            </div>

            {/* Date + Time Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">DATE</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full h-12 px-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md"
                  style={cardShadow}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">TIME</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="w-full h-12 px-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md"
                  style={cardShadow}
                />
              </div>
            </div>

            {/* Player Limit + Skill Range */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">PLAYERS</label>
                <select
                  value={playerLimit}
                  onChange={(e) => setPlayerLimit(e.target.value)}
                  className="w-full h-12 px-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md appearance-none"
                  style={cardShadow}
                >
                  {['2','4','6','8','12','16','24','32'].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">MIN SKILL</label>
                <select
                  value={skillMin}
                  onChange={(e) => setSkillMin(e.target.value)}
                  className="w-full h-12 px-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md appearance-none"
                  style={cardShadow}
                >
                  {['1.0','1.5','2.0','2.5','3.0','3.5','4.0','4.5','5.0'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">MAX SKILL</label>
                <select
                  value={skillMax}
                  onChange={(e) => setSkillMax(e.target.value)}
                  className="w-full h-12 px-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md appearance-none"
                  style={cardShadow}
                >
                  {['2.0','2.5','3.0','3.5','4.0','4.5','5.0','5.5+'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Visibility Toggle */}
            <div className="space-y-1">
              <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">VISIBILITY</label>
              <div className="flex rounded-[12px] bg-surface-container-high p-1" style={cardShadow}>
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
            <div className="space-y-1">
              <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">DESCRIPTION</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell players what to expect..."
                rows={3}
                className="w-full p-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md resize-none"
                style={cardShadow}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!title || !location || !date || !time}
              className="w-full h-12 bg-secondary-container text-on-secondary-container font-heading text-body-lg font-bold rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 hover:brightness-105 disabled:opacity-50"
              style={{ boxShadow: '0 8px 15px -3px rgba(0, 64, 224, 0.15)' }}
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
