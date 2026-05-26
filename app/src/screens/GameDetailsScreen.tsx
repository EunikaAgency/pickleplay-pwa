import { useState } from 'react';
import { Icon } from '../components/ui/Icon';

interface GameDetailsScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
  onBack: () => void;
  gameId?: string;
}

export function GameDetailsScreen({ onNavigate, onBack }: GameDetailsScreenProps) {
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const cardShadow = { boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.1)' } as const;

  const handleJoin = () => {
    setJoining(true);
    setTimeout(() => {
      setJoining(false);
      setJoined(true);
    }, 1500);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden pb-32">
      <div className="scrollbar-none overflow-y-auto flex-1">
        <main className="max-w-xl mx-auto px-5 pt-6 space-y-6">

          {/* Hero Section */}
          <section className="space-y-4">
            <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg text-on-surface">Saturday Morning Mix-In</h1>
            <div className="flex flex-wrap gap-2">
              <span className="bg-primary/10 text-primary px-4 py-1.5 rounded-full font-bold text-label-sm">Beginners Welcome</span>
              <span className="bg-secondary-container text-on-secondary-container px-4 py-1.5 rounded-full font-bold text-label-sm">Open Play</span>
              <span className="bg-surface-container-high text-on-surface-variant px-4 py-1.5 rounded-full font-bold text-label-sm">Skill: 2.5–3.5</span>
            </div>

            {/* Format & Details Row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface-container-lowest rounded-[12px] p-3 text-center" style={cardShadow}>
                <p className="font-bold text-label-sm text-on-surface-variant">Format</p>
                <p className="font-heading text-body-lg font-semibold text-on-surface">Doubles</p>
              </div>
              <div className="bg-surface-container-lowest rounded-[12px] p-3 text-center" style={cardShadow}>
                <p className="font-bold text-label-sm text-on-surface-variant">Skill</p>
                <p className="font-heading text-body-lg font-semibold text-on-surface">2.5–3.5</p>
              </div>
              <div className="bg-surface-container-lowest rounded-[12px] p-3 text-center" style={cardShadow}>
                <p className="font-bold text-label-sm text-on-surface-variant">Spots</p>
                <p className="font-heading text-body-lg font-semibold text-secondary">8/12</p>
              </div>
            </div>

            {/* Organizer Card */}
            <div className="flex items-center gap-4 bg-surface-container-lowest p-4 rounded-[12px]" style={cardShadow}>
              <div className="relative">
                <img
                  alt="Organizer"
                  className="w-14 h-14 rounded-full object-cover border-2 border-secondary-container"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCLihjzyIyto-nfaYbB6LfyCCfi60IYWA12T0HeSYyhsi2Ng3e9s4N01dzYevyoSm08MTb60uLPaG5eIP1WLnVudq9kM9pl7JtcpAyTM7VvOcTQB8JDcdSU_1uVC_e0a9LkDlWGvEQ22aL8uBorsYEHaGQyBlrDNMG1eLsa1-7h8AN_A0LAqV1HTFkVM2vUyeaZukw_Bxx78xV7hYTpwQegZ0RSw2RMoWEfRjaqwq3pfMLvKWp5IkxE0CjK6sMNeC1wcB0efUNg"
                />
                <div className="absolute -bottom-1 -right-1 bg-primary text-white p-0.5 rounded-full border-2 border-white">
                  <Icon name="verified" size={14} filled />
                </div>
              </div>
              <div>
                <p className="font-bold text-label-sm text-on-surface-variant uppercase tracking-wider">Organizer</p>
                <p className="font-heading text-headline-md text-on-surface">Coach Mike</p>
              </div>
              <button className="ml-auto w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-high text-primary active:scale-90 transition-all">
                <Icon name="mail" size={20} />
              </button>
            </div>
          </section>

          {/* Location Card */}
          <section className="bg-surface-container-lowest rounded-[12px] overflow-hidden" style={cardShadow}>
            <div className="h-48 w-full relative">
              <img
                className="w-full h-full object-cover"
                alt="Map location"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCChxs_Ha_J-LXMi4XCQ_MOHPsTAP5ZjyQxCUKRzWuKcG2mkY_6TfaKUIUQgIa1dkqtSmhqJxDL9wzo3Lu2-01dUQUs-qOlNKQMKROuzPb-CEBnX1Jlr7B-F1HoSkvLpgNQumifF8tgOgC09jBT9MZ7DdYnOk9uKosrqKILjo7IqZZwl1UCbMJe5hYWd7rvb6ovMrYTRut0xbPwkuGRt5TcVdrZsyirbLQUpL1TX5wKLy4kH6aaV4Wj9TTLhYeMTCWUkKqNeK5z"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            </div>
            <div className="p-5 flex justify-between items-center">
              <div>
                <h3 className="font-heading text-headline-md text-on-surface">Riverside Courts</h3>
                <p className="text-body-md text-on-surface-variant">1200 Willow St, Austin, TX</p>
              </div>
              <a className="flex flex-col items-center gap-1 text-primary group active:scale-95 transition-transform cursor-pointer">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Icon name="directions" size={24} />
                </div>
                <span className="font-bold text-label-sm">Get Directions</span>
              </a>
            </div>
          </section>

          {/* About Section */}
          <section className="space-y-3">
            <h3 className="font-heading text-headline-md text-on-surface">About this game</h3>
            <div className="text-body-lg text-on-surface-variant leading-relaxed">
              <p>Ready to shake off the week? Our Saturday Mix-In is all about high energy and meeting new playing partners! We've got 4 courts reserved for three hours of non-stop pickleball action.</p>
              <p className="mt-4">Whether you're just learning the dink or you're a seasoned pro, we rotate everyone every 15 minutes so you get to play with a variety of styles. Expect good music, plenty of water breaks, and a very supportive crew!</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-surface-container p-4 rounded-[12px] flex items-center gap-3">
                <Icon name="calendar_today" size={24} className="text-secondary" />
                <div>
                  <p className="font-bold text-label-sm text-on-surface-variant">Date</p>
                  <p className="text-body-md font-bold text-on-surface">Sat, Oct 14</p>
                </div>
              </div>
              <div className="bg-surface-container p-4 rounded-[12px] flex items-center gap-3">
                <Icon name="schedule" size={24} className="text-secondary" />
                <div>
                  <p className="font-bold text-label-sm text-on-surface-variant">Time</p>
                  <p className="text-body-md font-bold text-on-surface">9:00 - 12:00</p>
                </div>
              </div>
            </div>
          </section>

          {/* Players */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-headline-md text-on-surface">Players (8/12)</h3>
              <button className="text-primary font-bold text-label-sm hover:underline" onClick={() => onNavigate('invite-players', { id: '1' })}>Invite</button>
            </div>
            <div className="space-y-2">
              {[
                { name: 'Coach Mike', role: 'Organizer', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCLihjzyIyto-nfaYbB6LfyCCfi60IYWA12T0HeSYyhsi2Ng3e9s4N01dzYevyoSm08MTb60uLPaG5eIP1WLnVudq9kM9pl7JtcpAyTM7VvOcTQB8JDcdSU_1uVC_e0a9LkDlWGvEQ22aL8uBorsYEHaGQyBlrDNMG1eLsa1-7h8AN_A0LAqV1HTFkVM2vUyeaZukw_Bxx78xV7hYTpwQegZ0RSw2RMoWEfRjaqwq3pfMLvKWp5IkxE0CjK6sMNeC1wcB0efUNg', verified: true },
                { name: 'Sarah K.', role: 'Player', avatar: '', initial: 'S' },
                { name: 'Alex T.', role: 'Player', avatar: '', initial: 'A' },
                { name: 'Jordan M.', role: 'Player', avatar: '', initial: 'J' },
                { name: 'Taylor R.', role: 'Player', avatar: '', initial: 'T' },
                { name: 'Casey L.', role: 'Player', avatar: '', initial: 'C' },
                { name: 'Morgan P.', role: 'Player', avatar: '', initial: 'M' },
                { name: 'Riley W.', role: 'Player', avatar: '', initial: 'R' },
              ].map((player) => (
                <div key={player.name} className="flex items-center gap-3 bg-surface-container-lowest rounded-[12px] p-3" style={cardShadow}>
                  {player.avatar ? (
                    <img alt={player.name} className="w-10 h-10 rounded-full object-cover" src={player.avatar} />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-body-md">
                      {player.initial}
                    </div>
                  )}
                  <div>
                    <p className="font-heading text-body-lg font-semibold text-on-surface">{player.name}</p>
                    <p className="text-label-sm text-on-surface-variant">{player.role}</p>
                  </div>
                  {player.verified && (
                    <Icon name="verified" size={18} filled className="text-primary ml-auto" />
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Chat */}
          <section className="space-y-3 pb-8">
            <h3 className="font-heading text-headline-md text-on-surface">Game Chat</h3>
            <div className="space-y-3">
              {[
                { from: 'Coach Mike', msg: "Hey everyone! Excited for Saturday. Bring water — it's gonna be hot out there.", time: '10:32 AM', isOrganizer: true },
                { from: 'Sarah K.', msg: 'Will do! Are we still rotating every 15 minutes?', time: '10:45 AM', isOrganizer: false },
                { from: 'Coach Mike', msg: 'Yep! Standard round robin format. Everyone plays with everyone.', time: '10:50 AM', isOrganizer: true },
              ].map((msg, i) => (
                <div key={i} className="flex gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-label-sm font-bold ${msg.isOrganizer ? 'bg-secondary-container text-on-secondary-container' : 'bg-primary/10 text-primary'}`}>
                    {msg.from.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-body-md font-semibold text-on-surface">{msg.from}</span>
                      <span className="text-label-sm text-outline">{msg.time}</span>
                    </div>
                    <p className="text-body-md text-on-surface-variant">{msg.msg}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <input
                type="text"
                placeholder="Type a message..."
                className="flex-1 h-12 px-4 bg-surface-container-lowest border border-outline-variant rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 text-body-md"
              />
              <button className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center active:scale-90 transition-all">
                <Icon name="send" size={20} />
              </button>
            </div>
          </section>

        </main>
      </div>

      {/* Fixed Action Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-surface-container-lowest/80 backdrop-blur-md px-5 py-6 z-50 flex items-center justify-between border-t border-surface-container-high" style={cardShadow}>
        <div className="flex flex-col">
          <span className="font-bold text-label-sm text-on-surface-variant">Price per person</span>
          <span className="font-heading text-headline-md text-on-surface">$12.00</span>
        </div>
        <button
          onClick={handleJoin}
          disabled={joining || joined}
          className={`px-10 h-12 rounded-full font-heading text-headline-md active:scale-95 transition-all flex items-center justify-center gap-2 ${
            joined
              ? 'bg-secondary text-white'
              : joining
                ? 'bg-primary text-white'
                : 'bg-secondary-container text-on-secondary-container hover:brightness-105'
          }`}
          style={{ boxShadow: '0 8px 15px -3px rgba(0, 64, 224, 0.15)' }}
        >
          {joining ? (
            <>
              <Icon name="sync" size={20} className="animate-spin" />
              Joining...
            </>
          ) : joined ? (
            <>
              <Icon name="check_circle" size={20} filled />
              You're in!
            </>
          ) : (
            <>
              Join Game
              <Icon name="bolt" size={20} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
