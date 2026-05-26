import { useState } from 'react';
import { Icon } from '../components/ui/Icon';

interface ClubDetailsScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
  onBack: () => void;
  clubId?: string;
}

type ClubTab = 'about' | 'members' | 'events' | 'chat';

const tabs: { id: ClubTab; label: string }[] = [
  { id: 'about', label: 'About' },
  { id: 'members', label: 'Members' },
  { id: 'events', label: 'Events' },
  { id: 'chat', label: 'Chat' },
];

const members = [
  { name: 'Mike R.', role: 'Admin', src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCLihjzyIyto-nfaYbB6LfyCCfi60IYWA12T0HeSYyhsi2Ng3e9s4N01dzYevyoSm08MTb60uLPaG5eIP1WLnVudq9kM9pl7JtcpAyTM7VvOcTQB8JDcdSU_1uVC_e0a9LkDlWGvEQ22aL8uBorsYEHaGQyBlrDNMG1eLsa1-7h8AN_A0LAqV1HTFkVM2vUyeaZukw_Bxx78xV7hYTpwQegZ0RSw2RMoWEfRjaqwq3pfMLvKWp5IkxE0CjK6sMNeC1wcB0efUNg' },
  { name: 'Sarah K.', role: 'Moderator', src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC11Czoun2_lIi5sXUquwWrSH9zQHexFqKo-X4CDjUV4W0TL7Ht5NjTuHGxtUiIqAsPIlsUb6NFVrceAQUSshEaH2IvKc_VsIiCR3LjB3A1DBte9odfpGMbbh_Uts7mH-Cxzz2Xzpqx3BxZ7-TABXizUiXu13rRrLReBp2MpFNulK6pmDY5PFVwtMF3Bi904yH8k5L1bA7mpL9m42zbY-I9vMb3NYQo2KN7JxG9_ja4VPZJ1D0cBRvZLqConIzBzpJMdRFigaCD' },
  { name: 'Alex T.', role: 'Member', src: null },
  { name: 'Jordan P.', role: 'Member', src: null },
  { name: 'Casey W.', role: 'Member', src: null },
];

const chatMessages = [
  { id: '1', sender: 'Mike R.', body: 'Who\'s in for Saturday morning?', time: '10:32 AM', isMe: false },
  { id: '2', sender: 'Sarah K.', body: 'I\'m there! Bringing a guest too.', time: '10:35 AM', isMe: false },
  { id: '3', sender: 'Me', body: 'Count me in! Can we do doubles?', time: '10:38 AM', isMe: true },
  { id: '4', sender: 'Mike R.', body: 'Absolutely. I\'ll set up the rotation.', time: '10:40 AM', isMe: false },
];

export function ClubDetailsScreen({ onBack }: ClubDetailsScreenProps) {
  const [activeTab, setActiveTab] = useState<ClubTab>('about');
  const [message, setMessage] = useState('');
  const cardShadow = { boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.1)' } as const;

  return (
    <div className="flex flex-1 flex-col overflow-hidden pb-24">
      <div className="scrollbar-none overflow-y-auto flex-1">
        {/* Club Header */}
        <div className="relative h-48 md:h-56">
          <img
            alt="Club cover"
            className="h-full w-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuD2EV0cyvMuMekUO2psqDEYAa9JTukNhSQhzsydF-lFuYEYIAcjvT5Khag839z2lIaH0OXPNIJdlBxOPcAKXNSGt2AZsYyFC3K-DDEgejV9HibLfSX8FVvmS83AgHtZnlLzveAQVxLZHesRPppGR7smLzogzDz0uOaz1Lspa4ND6jwuXKj1tH56uGQutiWcYOCxoDAhzJXMXu9kvSwfTw30UqVEG6vD70cktuEnRZ7FRpXCf17_iAz8Z9ni2NQt_mV7Y5XgF7nz"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-5">
            <h1 className="font-heading text-headline-lg-mobile md:text-headline-lg text-white">Neon Smashers</h1>
            <p className="text-white/80 text-body-md">128 members &middot; Competitive</p>
          </div>
        </div>

        <main className="mx-auto max-w-7xl px-5 pt-4 space-y-6">

          {/* Club Actions */}
          <div className="flex gap-3">
            <button className="flex-1 bg-secondary-container text-on-secondary-container h-12 rounded-full font-bold active:scale-95 transition-all">
              Joined
            </button>
            <button className="w-12 h-12 flex items-center justify-center rounded-full bg-surface-container-lowest text-primary active:scale-90 transition-all" style={cardShadow}>
              <Icon name="share" size={20} />
            </button>
            <button className="w-12 h-12 flex items-center justify-center rounded-full bg-surface-container-lowest text-primary active:scale-90 transition-all" style={cardShadow}>
              <Icon name="mail" size={20} />
            </button>
          </div>

          {/* Tab Bar */}
          <div className="flex rounded-full bg-surface-container-high p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-full py-2 text-center font-heading text-body-md font-bold transition-colors ${
                  activeTab === tab.id ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'about' && (
            <div className="space-y-4">
              <div className="bg-surface-container-lowest rounded-[16px] p-5 space-y-3" style={cardShadow}>
                <h3 className="font-heading text-headline-md">About</h3>
                <p className="text-body-md text-on-surface-variant leading-relaxed">
                  Welcome to Neon Smashers — Austin's most active pickleball community. We host weekly competitive and casual games across multiple courts in the downtown area. All skill levels welcome, from beginners to tournament players.
                </p>
              </div>
              <div className="bg-surface-container-lowest rounded-[16px] p-5 space-y-3" style={cardShadow}>
                <h3 className="font-heading text-headline-md">Rules</h3>
                <ul className="text-body-md text-on-surface-variant space-y-2">
                  <li className="flex items-start gap-2">
                    <Icon name="check_circle" size={18} filled className="text-secondary mt-0.5 shrink-0" />
                    Be respectful and supportive of all players
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon name="check_circle" size={18} filled className="text-secondary mt-0.5 shrink-0" />
                    RSVP at least 2 hours before events
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon name="check_circle" size={18} filled className="text-secondary mt-0.5 shrink-0" />
                    Bring water and wear court shoes
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.name} className="flex items-center gap-3 bg-surface-container-lowest rounded-[16px] p-4" style={cardShadow}>
                  {member.src ? (
                    <img alt={member.name} className="w-10 h-10 rounded-full object-cover" src={member.src} />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-label-sm">
                      {member.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-heading text-body-lg font-semibold">{member.name}</p>
                    <p className="text-label-sm text-on-surface-variant">{member.role}</p>
                  </div>
                  <Icon name="chevron_right" size={20} className="text-outline" />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'events' && (
            <div className="space-y-3">
              {[
                { title: 'Saturday Mix-In', date: 'Sat, Oct 14 • 9:00 AM', spots: '8/12' },
                { title: 'Weekly Doubles League', date: 'Tue, Oct 17 • 6:30 PM', spots: '14/16' },
                { title: 'Beginner Clinic', date: 'Sun, Oct 22 • 2:00 PM', spots: '4/8' },
              ].map((event) => (
                <div key={event.title} className="flex items-center justify-between bg-surface-container-lowest rounded-[16px] p-4 cursor-pointer active:scale-[0.98] transition-transform" style={cardShadow}>
                  <div>
                    <h3 className="font-heading text-body-lg font-semibold">{event.title}</h3>
                    <p className="text-body-md text-on-surface-variant">{event.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-label-sm font-bold text-secondary">{event.spots} spots</span>
                    <Icon name="chevron_right" size={20} className="text-outline" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="space-y-4">
              <div className="space-y-3">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-[16px] p-3 ${
                      msg.isMe
                        ? 'bg-primary-container text-on-primary-container rounded-br-[4px]'
                        : 'bg-surface-container-lowest text-on-surface rounded-bl-[4px]'
                    }`} style={!msg.isMe ? cardShadow : undefined}>
                      {!msg.isMe && <p className="text-label-sm font-bold text-primary mb-0.5">{msg.sender}</p>}
                      <p className="text-body-md">{msg.body}</p>
                      <p className="text-label-sm text-on-surface-variant text-right mt-1">{msg.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 h-12 px-4 bg-surface-container-lowest border border-outline-variant rounded-[16px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-body-md"
                  style={cardShadow}
                />
                <button className="w-12 h-12 bg-secondary-container text-on-secondary-container rounded-full flex items-center justify-center active:scale-90 transition-all">
                  <Icon name="send" size={20} />
                </button>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
