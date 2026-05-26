import { useState } from 'react';
import { Icon } from '../components/ui/Icon';

interface GamesScreenProps {
  onNavigate: (screen: string, params?: Record<string, string>) => void;
}

type GameTab = 'my-games' | 'upcoming' | 'completed';

const dateChips = [
  { label: 'Today', date: 'May 26' },
  { label: 'Tomorrow', date: 'May 27' },
  { label: 'Sat', date: 'May 30' },
  { label: 'Sun', date: 'May 31' },
  { label: 'Mon', date: 'Jun 1' },
  { label: 'Tue', date: 'Jun 2' },
  { label: 'Wed', date: 'Jun 3' },
];

const myGames = [
  {
    id: '1', title: 'Saturday Morning Mix-In', date: 'Sat, Oct 14 • 9:00 AM',
    location: 'Riverside Courts • 2.1 mi', players: '8/12', tag: 'Open Play',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCQeWJn-7Kk1HCR-1MhQ2a4JKM3hst4f2Go13gZorz6vGn8cKEUeXpeE3gDY6v6tBlYjWFTQLGTbHGRdv10L15u0FFVQC95N5dBLo0AcLAElZTzhP_oITmJh1BoD87sRmvOYdCL5Tl_YkEJwm8DgDULjJE3S0rp_uvrsn2lH7dTUfXyr1XiZAGc5jwCgKaiuxzTtkadzvjIwWFZNW0THmQVTRB1OtQV929zAPnNs-HFJuZKa_6n7mIrR33C5eCZFcXbW-BtyYd2',
  },
  {
    id: '2', title: 'Weekly Doubles League', date: 'Tue, Oct 17 • 6:30 PM',
    location: 'Central Hub • 0.8 mi', players: '14/16', tag: 'Competitive',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuByMwXrWnGLq1pjWr5EGIag1wSi3z-p4GQoRUYJv2WhqBU2vdxY0RD1VzOA5nJ4uLEuUPzDdOD-Tdkl_VBMRYPg1bGQ-buq9ulGnLkArv60HQOgh6IZmShrX6KsY_FSazVPyhayDM4qTTJ10rsLpGA2kpA3PUrVSW-xpILKCC--RXHWMf0z_iHdX2OilDEMAzH69rUL53KTk5lGpJUN_xzr_-cU0NIuVDBQRdURMjAjfcJUelBEO0EP7TvyKgouywscNgA72xI-',
  },
];

const upcomingGames = [
  {
    id: '3', title: 'Rookie Rally Round', date: 'Today, 5:30 PM',
    location: 'Central Hub • 1.2 mi', players: '4/8', tag: 'Beginner',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCQeWJn-7Kk1HCR-1MhQ2a4JKM3hst4f2Go13gZorz6vGn8cKEUeXpeE3gDY6v6tBlYjWFTQLGTbHGRdv10L15u0FFVQC95N5dBLo0AcLAElZTzhP_oITmJh1BoD87sRmvOYdCL5Tl_YkEJwm8DgDULjJE3S0rp_uvrsn2lH7dTUfXyr1XiZAGc5jwCgKaiuxzTtkadzvjIwWFZNW0THmQVTRB1OtQV929zAPnNs-HFJuZKa_6n7mIrR33C5eCZFcXbW-BtyYd2',
  },
  {
    id: '4', title: 'Competitive Singles', date: 'Sat, Oct 21 • 10:00 AM',
    location: 'The Kitchen • 3.5 mi', players: '2/4', tag: 'Advanced',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuByMwXrWnGLq1pjWr5EGIag1wSi3z-p4GQoRUYJv2WhqBU2vdxY0RD1VzOA5nJ4uLEuUPzDdOD-Tdkl_VBMRYPg1bGQ-buq9ulGnLkArv60HQOgh6IZmShrX6KsY_FSazVPyhayDM4qTTJ10rsLpGA2kpA3PUrVSW-xpILKCC--RXHWMf0z_iHdX2OilDEMAzH69rUL53KTk5lGpJUN_xzr_-cU0NIuVDBQRdURMjAjfcJUelBEO0EP7TvyKgouywscNgA72xI-',
  },
  {
    id: '5', title: 'Social Mixer & Drinks', date: 'Sun, Oct 22 • 4:00 PM',
    location: 'Sky Courts • 0.8 mi', players: '10/16', tag: 'Mixed Level',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDpfByT3q1YIF8lrRviwwRuL72MUO9nxSSrm_zzAA-UMCRtNWmMPJvsXtOm-gjNjoU9mULcsmHPtZJFw-bmPf4iT6HFrBvkN8jkcCapuLNdW-wyz2PUJ4c2K51n1bLqJcdgRc9R0c_gODV0tFxy-zXj0ondBthKQ6F42osmjp9z-atPbsTNGNniFjchTaJrVzK5ifLMQdJKlYD9B4QecTiuYPvCLgWiTPDwSI9RiW97N4sFK0l63Ojd3A6oCowgt_Ad7aWEJKsu',
  },
];

const completedGames = [
  {
    id: '6', title: 'Friday Night Lights', date: 'Fri, Oct 13 • 7:00 PM',
    location: 'Austin Smash Center • 0.8 mi', players: '12/12', tag: 'Intermediate',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBsL986uwrjRnAFPLVZTE71SgRlgtERnWB_O-_u-mg4qaddBohUzg2f9di6EjSOELb6gOdw5hpL_oiC_o8ZrPChGext6DF4-_g10CoLCaIMBtZ1oDYsDm-Q89VmI4GCI4qum9HaYOx0PQN98F1AJfvJh0jZUfJpE5qf_wdLWBpxpdg4Q0O9J_lQlCGuXKu6RCm-me0mSj6T7miyRvXid9yuUZHJgdgUeLXoT18Lf6wzh6Z3ZM0VQGmIKAHPEmkQ69DWo8kMreU1',
  },
];

const tabs: { id: GameTab; label: string }[] = [
  { id: 'my-games', label: 'My Games' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
];

const tagColors: Record<string, string> = {
  Beginner: 'bg-secondary-container text-on-secondary-container',
  Advanced: 'bg-tertiary-container text-on-tertiary-container',
  'Mixed Level': 'bg-primary-container text-on-primary-container',
  Competitive: 'bg-tertiary-container text-on-tertiary-container',
  'Open Play': 'bg-secondary-container text-on-secondary-container',
  Intermediate: 'bg-primary-container text-on-primary-container',
};

function GameCard({ game, onClick, cardShadow }: { game: typeof myGames[0]; onClick: () => void; cardShadow: React.CSSProperties }) {
  return (
    <div
      className="flex gap-4 bg-surface-container-lowest rounded-[12px] overflow-hidden group cursor-pointer active:scale-[0.98] transition-transform"
      style={cardShadow}
      onClick={onClick}
    >
      <div className="relative h-28 w-28 shrink-0 overflow-hidden">
        <img alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" src={game.img} />
        {/* Black overlay */}
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute bottom-2 left-2">
          <span className={`rounded-full px-2 py-0.5 text-label-sm font-bold uppercase tracking-wider ${tagColors[game.tag] || 'bg-surface-container text-on-surface-variant'}`}>
            {game.tag}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-center py-3 pr-4">
        <h3 className="font-heading text-body-lg font-semibold text-on-surface">{game.title}</h3>
        <div className="flex items-center text-label-sm text-on-surface-variant mt-1">
          <Icon name="schedule" size={14} className="mr-1" />
          {game.date}
        </div>
        <div className="flex items-center text-label-sm text-on-surface-variant mt-0.5">
          <Icon name="location_on" size={14} className="mr-1" />
          {game.location}
        </div>
        <div className="flex items-center text-label-sm text-on-surface-variant mt-0.5">
          <Icon name="group" size={14} className="mr-1" />
          {game.players} players
        </div>
      </div>
    </div>
  );
}

export function GamesScreen({ onNavigate }: GamesScreenProps) {
  const [activeTab, setActiveTab] = useState<GameTab>('my-games');
  const [selectedDate, setSelectedDate] = useState(0);
  const cardShadow = { boxShadow: '0 4px 20px -2px rgba(0, 64, 224, 0.1)' } as const;

  const currentGames = activeTab === 'my-games' ? myGames : activeTab === 'upcoming' ? upcomingGames : completedGames;

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="scrollbar-none overflow-y-auto flex-1">
        <main className="mx-auto max-w-7xl px-5 pt-6 pb-28 space-y-6">

          {/* Tab Switcher + Filter */}
          <div className="flex items-center gap-3">
            <div className="relative flex flex-1 rounded-full bg-surface-container-high p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 rounded-full py-2 text-center font-heading text-body-md font-bold transition-colors z-10 ${
                    activeTab === tab.id ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => onNavigate('game-filters')}
              className="flex items-center gap-1.5 rounded-full bg-surface-container-lowest px-4 py-2.5 text-label-sm font-bold text-on-surface-variant border border-outline-variant active:scale-95 transition-all"
              style={cardShadow}
            >
              <Icon name="tune" size={16} />
              {/* Filters */}
            </button>
          </div>

          {/* Date Chips */}
          {(activeTab === 'upcoming' || activeTab === 'my-games') && (
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              {dateChips.map((chip, i) => (
                <button
                  key={chip.date}
                  onClick={() => setSelectedDate(i)}
                  className={`flex flex-col items-center shrink-0 px-4 py-2 rounded-[12px] transition-all active:scale-95 ${
                    selectedDate === i
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant'
                  }`}
                  style={selectedDate === i ? cardShadow : undefined}
                >
                  <span className="font-heading text-body-md font-bold">{chip.label}</span>
                  <span className="text-label-sm opacity-70">{chip.date}</span>
                </button>
              ))}
            </div>
          )}

          {/* Games List */}
          <div className="space-y-3">
            {currentGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                cardShadow={cardShadow}
                onClick={() => onNavigate('game-details', { id: game.id })}
              />
            ))}
          </div>

          {/* Empty state for Completed */}
          {activeTab === 'completed' && completedGames.length === 0 && (
            <div className="py-12 text-center space-y-4">
              <Icon name="sports_tennis" size={48} className="mx-auto text-outline-variant" />
              <p className="font-heading text-headline-md text-on-surface-variant">No completed games yet</p>
              <p className="text-body-md text-on-surface-variant">Your finished games will show up here.</p>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
