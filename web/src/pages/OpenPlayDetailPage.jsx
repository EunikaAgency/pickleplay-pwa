import { useParams, Link } from 'react-router-dom';
import Icon from '../components/ui/Icon.jsx';
import { getGame, getUser, getVenue } from '../data/index.js';

export default function OpenPlayDetailPage() {
  const { id } = useParams();
  const session = getGame(id);
  if (!session || session.format !== 'open_play') return <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 text-center"><div className="text-5xl">😕</div><h1 className="mt-4 font-heading text-3xl font-extrabold">Session not found</h1><Link to="/open-play" className="mt-4 font-bold text-primary no-underline hover:underline">Back</Link></div>;

  const venue = getVenue(session.venueId);
  const organizer = getUser(session.organizerId);
  const participants = session.participantIds.map(getUser).filter(Boolean);
  const spotsLeft = session.playerLimit - session.participantCount;

  return (
    <div>
      <section className="bg-gradient-to-br from-[#0040E0] to-[#2E5BFF] px-5 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <Link to="/open-play" className="inline-flex items-center gap-1 text-base font-bold text-white/80 no-underline hover:text-white"><Icon name="arrow_back" size={20} /> Back</Link>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-[#C1F100] px-2.5 py-0.5 text-base font-extrabold uppercase text-[#374D00]">Open Play</span>
            {session.beginnerFriendly && <span className="rounded-full bg-[#C1F100]/30 px-2.5 py-0.5 text-base font-extrabold uppercase">Beginners!</span>}
            {!session.fee && <span className="rounded-full bg-[#C1F100]/30 px-2.5 py-0.5 text-base font-extrabold uppercase">Free!</span>}
          </div>
          <h1 className="mt-3 font-heading text-3xl font-extrabold">{session.title}</h1>
          {organizer && <div className="mt-3 flex items-center gap-3"><img src={organizer.avatar} alt="" className="h-10 w-10 rounded-full border-2 border-white object-cover" /><span className="text-base font-bold">Hosted by {organizer.firstName} {organizer.lastName}</span></div>}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-lg">
              <h2 className="font-heading text-xl font-bold">About this session</h2>
              <p className="mt-3 text-base leading-relaxed text-on-surface-variant">{session.description}</p>
              <div className="mt-4"><div className="flex items-center justify-between text-base"><span>Players</span><span className="font-extrabold">{session.participantCount}/{session.playerLimit}</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-container-low"><div className="h-full rounded-full bg-[#C1F100]" style={{width:`${(session.participantCount/session.playerLimit)*100}%`}} /></div>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-lg">
              <h2 className="font-heading text-xl font-bold">Who's playing ({participants.length})</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {participants.map(p => (
                  <div key={p.id} className="flex items-center gap-2 rounded-full border-2 border-surface-variant px-3 py-1.5">
                    <img src={p.avatar} alt="" className="h-8 w-8 rounded-full object-cover" /><span className="text-base font-bold">{p.firstName}</span><span className="text-base text-on-surface-variant">{p.skillLabel}</span>
                  </div>
                ))}
                {spotsLeft > 0 && Array.from({length: Math.min(spotsLeft, 3)}).map((_, i) => (
                  <div key={`open-${i}`} className="flex items-center gap-2 rounded-full border-2 border-dashed border-surface-variant px-3 py-1.5"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high">🏓</div><span className="text-base text-on-surface-variant">Open spot</span></div>
                ))}
              </div>
            </div>
          </div>
          <aside className="space-y-4">
            <div className="rounded-2xl bg-white p-6 shadow-lg text-center">
              <p className="text-lg font-extrabold">{spotsLeft>0?`${spotsLeft} spot${spotsLeft!==1?'s':''} left`:'Full!'}</p>
              <button disabled={spotsLeft===0} className="mt-4 h-14 w-full rounded-2xl bg-[#C1F100] text-base font-extrabold text-[#374D00] shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-50">
                {spotsLeft>0?'Join Session 🎉':'Join Waitlist'}
              </button>
              {!session.fee ? <p className="mt-3 text-base">Free to join!</p> : <p className="mt-3 font-extrabold text-primary">${session.fee}</p>}
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-lg">
              <h3 className="font-heading text-base font-bold">Date & Time</h3>
              <p className="mt-2 text-base">{new Date(session.gameDate).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</p>
              <p className="text-base font-bold">{session.startTime} - {session.endTime}</p>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-lg">
              <h3 className="font-heading text-base font-bold">Skill Level</h3>
              <p className="mt-2 font-extrabold">{session.skillMin===session.skillMax?`${session.skillMin} (${session.skillMin>=4?'Advanced':session.skillMin>=2.5?'Intermediate':'Beginner'})`:`${session.skillMin}-${session.skillMax}`}</p>
            </div>
            {venue && (
              <Link to={`/venues/${venue.slug}`} className="block rounded-2xl bg-white p-6 shadow-lg no-underline hover:shadow-xl transition-shadow">
                <div className="h-24 overflow-hidden rounded-xl"><img src={venue.heroImage} alt="" className="h-full w-full object-cover" /></div>
                <p className="mt-2 font-bold text-on-surface">{venue.name}</p><p className="text-base text-on-surface-variant">{venue.city}</p>
              </Link>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
