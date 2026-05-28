import { Link } from 'react-router-dom';

const GUIDES = [
  { title: 'Pickleball Rules 101', desc: 'Scoring, serving, kitchen rules — everything a beginner needs to know.', tag: 'Beginner' },
  { title: 'Your First Game', desc: 'What to bring, what to wear, and what to expect at your first open play.', tag: 'Beginner' },
  { title: 'Dinking Masterclass', desc: 'Master the soft game. Techniques for better control at the net.', tag: 'Intermediate' },
  { title: 'Serving with Spin', desc: 'Add topspin and slice to your serve for an aggressive start.', tag: 'Advanced' },
  { title: 'Doubles Strategy', desc: 'Positioning, stacking, and communication with your partner.', tag: 'Intermediate' },
  { title: 'Drills for Consistency', desc: 'Solo and partner drills to build reliable shots under pressure.', tag: 'All Levels' },
];

export default function LearnPage() {
  return (
    <div>
      <section className="bg-gradient-to-r from-[#0040E0] to-[#2E5BFF] px-5 py-12">
        <div className="mx-auto flex max-w-6xl items-center gap-8">
          <div className="flex-1">
            <p className="text-label-sm font-bold uppercase tracking-wider text-[#C1F100]">Level up</p>
            <h1 className="mt-1 font-heading text-4xl font-extrabold text-white">Learn</h1>
            <p className="mt-2 text-white/70 max-w-md">Guides, drills, and tips to level up your pickleball game.</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDES.map(g => (
            <div key={g.title} className="rounded-2xl bg-white shadow-lg p-5">
                <span className="rounded-full bg-primary-fixed px-2.5 py-0.5 text-label-sm font-bold uppercase text-on-primary-fixed">{g.tag}</span>
                <h3 className="mt-3 font-heading text-headline-md font-semibold">{g.title}</h3>
                <p className="mt-2 text-on-surface-variant">{g.desc}</p>
                <Link to="/learn" className="mt-4 inline-block font-semibold text-primary no-underline hover:underline">Read more</Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
