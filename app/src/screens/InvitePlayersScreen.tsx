import { useState } from 'react';
import { Icon } from '../components/ui/Icon';

interface InvitePlayersScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
  onBack: () => void;
  gameId?: string;
}

const suggestedPlayers = [
  { name: 'Sarah K.', skill: '3.0', src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC11Czoun2_lIi5sXUquwWrSH9zQHexFqKo-X4CDjUV4W0TL7Ht5NjTuHGxtUiIqAsPIlsUb6NFVrceAQUSshEaH2IvKc_VsIiCR3LjB3A1DBte9odfpGMbbh_Uts7mH-Cxzz2Xzpqx3BxZ7-TABXizUiXu13rRrLReBp2MpFNulK6pmDY5PFVwtMF3Bi904yH8k5L1bA7mpL9m42zbY-I9vMb3NYQo2KN7JxG9_ja4VPZJ1D0cBRvZLqConIzBzpJMdRFigaCD' },
  { name: 'Mike R.', skill: '4.5', src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCLihjzyIyto-nfaYbB6LfyCCfi60IYWA12T0HeSYyhsi2Ng3e9s4N01dzYevyoSm08MTb60uLPaG5eIP1WLnVudq9kM9pl7JtcpAyTM7VvOcTQB8JDcdSU_1uVC_e0a9LkDlWGvEQ22aL8uBorsYEHaGQyBlrDNMG1eLsa1-7h8AN_A0LAqV1HTFkVM2vUyeaZukw_Bxx78xV7hYTpwQegZ0RSw2RMoWEfRjaqwq3pfMLvKWp5IkxE0CjK6sMNeC1wcB0efUNg' },
  { name: 'Alex T.', skill: '2.5', src: null },
  { name: 'Jordan P.', skill: '4.0', src: null },
  { name: 'Casey W.', skill: '3.5', src: null },
];

export function InvitePlayersScreen({ onNavigate, onBack }: InvitePlayersScreenProps) {
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState(false);
  const [inviteLink] = useState('pickleplay.app/game/7xk9m2');
  const cardShadow = { boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.1)' } as const;
  const [showToast, setShowToast] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);

      setShowToast(true);

      setTimeout(() => {
        setShowToast(false);
      }, 2000);

    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleInvite = (name: string) => {
    setInvited((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const handleSend = () => {
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
        <div className="w-20 h-20 rounded-full bg-secondary-container flex items-center justify-center mb-6">
          <Icon name="send" size={40} className="text-on-secondary-container" />
        </div>
        <h2 className="font-heading text-headline-lg mb-2">Invites Sent!</h2>
        <p className="text-body-md text-on-surface-variant mb-2">{invited.size} player{invited.size !== 1 ? 's' : ''} invited</p>
        <p className="text-body-md text-on-surface-variant mb-8">They'll get a notification and can RSVP.</p>
        <button
          onClick={() => onNavigate('game-details', { id: 'new' })}
          className="w-full max-w-sm bg-secondary-container text-on-secondary-container h-12 rounded-full font-heading text-body-lg font-bold active:scale-95 transition-all"
          style={{ boxShadow: '0 8px 15px -3px rgba(0, 64, 224, 0.15)' }}
        >
          View Game
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex w-full min-w-0 flex-1 flex-col overflow-hidden">
        <div className="scrollbar-none overflow-y-auto flex-1">
          <main className="mx-auto max-w-xl px-5 pt-6 pb-28 space-y-6">

            <div>
              <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg">Invite Players</h1>
              <p className="text-body-md text-on-surface-variant mt-1">Saturday Morning Mix-In</p>
            </div>

            {/* Share Link */}
            <div className="bg-surface-container-lowest rounded-[12px] p-5 space-y-3" style={cardShadow}>
              <h3 className="font-heading text-headline-md">Share Link</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="flex-1 h-12 px-4 bg-surface-container border border-outline-variant rounded-[12px] text-body-md text-on-surface"
                />
                <button
                  onClick={handleCopyLink}
                  className="w-12 h-12 bg-primary text-on-primary rounded-full flex items-center justify-center active:scale-90 transition-all"
                >
                  <Icon name="content_copy" size={20} />
                </button>
              </div>
            </div>

            {/* Suggested Players */}
            <section className="space-y-3">
              <h3 className="font-heading text-headline-md">Suggested Players</h3>
              {suggestedPlayers.map((player) => (
                <div
                  key={player.name}
                  className="flex items-center gap-3 bg-surface-container-lowest rounded-[12px] p-4 cursor-pointer active:scale-[0.98] transition-transform"
                  style={cardShadow}
                  onClick={() => toggleInvite(player.name)}
                >
                  {player.src ? (
                    <img alt="" className="w-10 h-10 rounded-full object-cover" src={player.src} />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-label-sm">
                      {player.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-heading text-body-lg font-semibold">{player.name}</p>
                    <p className="text-label-sm text-on-surface-variant">{player.skill} skill</p>
                  </div>
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                    invited.has(player.name) ? 'bg-secondary-container text-on-secondary-container' : 'border-2 border-outline-variant'
                  }`}>
                    {invited.has(player.name) && <Icon name="check" size={16} weight={600} />}
                  </div>
                </div>
              ))}
            </section>

          </main>
        </div>

        {/* Fixed Bottom Bar */}
        <div className="fixed bottom-0 left-0 w-full bg-surface-container-lowest/80 backdrop-blur-md px-5 py-6 z-50 flex items-center gap-3 border-t border-surface-container-high" style={cardShadow}>
          <button onClick={onBack} className="flex-1 h-12 rounded-full bg-surface-container-high text-on-surface-variant font-bold active:scale-95 transition-all">
            Skip
          </button>
          <button
            onClick={handleSend}
            disabled={invited.size === 0}
            className="flex-1 h-12 rounded-full bg-secondary-container text-on-secondary-container font-bold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ boxShadow: '0 8px 15px -3px rgba(0, 64, 224, 0.15)' }}
          >
            Send {invited.size > 0 && `(${invited.size})`}
            <Icon name="send" size={18} />
          </button>
        </div>
      </div>


    {/* Toast */}
    {showToast && (
      <div className="fixed bottom-28 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-on-surface px-4 py-2 text-white shadow-lg animate-in fade-in zoom-in duration-200">
        Share link copied
      </div>
    )}

  </>
    
  );
}
