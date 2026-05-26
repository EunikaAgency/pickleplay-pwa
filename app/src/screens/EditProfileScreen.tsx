import { useState, type FormEvent } from 'react';
import { Icon } from '../components/ui/Icon';

interface EditProfileScreenProps {
  onBack: () => void;
}

export function EditProfileScreen({ onBack }: EditProfileScreenProps) {
  const [firstName, setFirstName] = useState('Riley');
  const [lastName, setLastName] = useState('Pickler');
  const [bio, setBio] = useState('The dink master.');
  const [location, setLocation] = useState('Austin, TX');
  const [skillLevel, setSkillLevel] = useState('3.5');
  const [saved, setSaved] = useState(false);
  const cardShadow = { boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.1)' } as const;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden pb-24">
      <div className="scrollbar-none overflow-y-auto flex-1">
        <main className="mx-auto max-w-xl px-5 pt-6 space-y-8">

          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-surface-container-lowest" style={cardShadow}>
                <img
                  alt="Profile"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuC11Czoun2_lIi5sXUquwWrSH9zQHexFqKo-X4CDjUV4W0TL7Ht5NjTuHGxtUiIqAsPIlsUb6NFVrceAQUSshEaH2IvKc_VsIiCR3LjB3A1DBte9odfpGMbbh_Uts7mH-Cxzz2Xzpqx3BxZ7-TABXizUiXu13rRrLReBp2MpFNulK6pmDY5PFVwtMF3Bi904yH8k5L1bA7mpL9m42zbY-I9vMb3NYQo2KN7JxG9_ja4VPZJ1D0cBRvZLqConIzBzpJMdRFigaCD"
                />
              </div>
              <button className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shadow-md active:scale-90 transition-all">
                <Icon name="edit" size={18} />
              </button>
            </div>
            <span className="text-label-sm text-primary font-bold">Change Photo</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">FIRST NAME</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="w-full h-12 px-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md" style={cardShadow} />
              </div>
              <div className="space-y-1">
                <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">LAST NAME</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="w-full h-12 px-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md" style={cardShadow} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">BIO</label>
              <input type="text" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A short tagline..." className="w-full h-12 px-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md italic" style={cardShadow} />
            </div>

            <div className="space-y-1">
              <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">LOCATION</label>
              <div className="relative">
                <Icon name="location_on" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full h-12 pl-12 pr-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md" style={cardShadow} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-label-sm text-on-surface-variant ml-1 font-bold">SKILL LEVEL</label>
              <select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value)} className="w-full h-12 px-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md appearance-none" style={cardShadow}>
                {['1.0','1.5','2.0','2.5','3.0','3.5','4.0','4.5','5.0','5.5+'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <button
              type="submit"
              className={`w-full h-12 rounded-full font-heading text-body-lg font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                saved ? 'bg-secondary text-white' : 'bg-secondary-container text-on-secondary-container hover:brightness-105'
              }`}
              style={{ boxShadow: '0 8px 15px -3px rgba(0, 64, 224, 0.15)' }}
            >
              {saved ? (
                <>
                  <Icon name="check_circle" size={20} filled />
                  Saved!
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </form>

        </main>
      </div>
    </div>
  );
}
