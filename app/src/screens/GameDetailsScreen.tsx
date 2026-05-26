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
            </div>

            {/* Organizer Card */}
            <div className="flex items-center gap-4 bg-surface-container-lowest p-4 rounded-[16px]" style={cardShadow}>
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
          <section className="bg-surface-container-lowest rounded-[16px] overflow-hidden" style={cardShadow}>
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
          <section className="space-y-3 pb-8">
            <h3 className="font-heading text-headline-md text-on-surface">About this game</h3>
            <div className="text-body-lg text-on-surface-variant leading-relaxed">
              <p>Ready to shake off the week? Our Saturday Mix-In is all about high energy and meeting new playing partners! We've got 4 courts reserved for three hours of non-stop pickleball action.</p>
              <p className="mt-4">Whether you're just learning the dink or you're a seasoned pro, we rotate everyone every 15 minutes so you get to play with a variety of styles. Expect good music, plenty of water breaks, and a very supportive crew!</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-surface-container p-4 rounded-[16px] flex items-center gap-3">
                <Icon name="calendar_today" size={24} className="text-secondary" />
                <div>
                  <p className="font-bold text-label-sm text-on-surface-variant">Date</p>
                  <p className="text-body-md font-bold text-on-surface">Sat, Oct 14</p>
                </div>
              </div>
              <div className="bg-surface-container p-4 rounded-[16px] flex items-center gap-3">
                <Icon name="schedule" size={24} className="text-secondary" />
                <div>
                  <p className="font-bold text-label-sm text-on-surface-variant">Time</p>
                  <p className="text-body-md font-bold text-on-surface">9:00 - 12:00</p>
                </div>
              </div>
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
