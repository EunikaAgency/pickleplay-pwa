import { Link } from 'react-router-dom';

export default function MyEventsPage() {
  return (
    <div>
      <h1 className="font-heading text-3xl font-extrabold text-on-surface">My Events</h1>
      <p className="mt-1 text-on-surface-variant">Tournament + clinic registrations.</p>

      <div className="mt-12 flex flex-col items-center text-center">
        <div className="text-6xl">🎉</div>
        <h2 className="mt-4 font-heading text-xl font-bold">No events yet</h2>
        <p className="mt-2 max-w-md text-base text-on-surface-variant">
          The event-registration API isn't wired yet. Once it ships, your tournament + clinic signups will appear here.
        </p>
        <Link to="/tournaments" className="mt-6 inline-flex h-12 items-center rounded-full bg-[#C1F100] px-6 text-base font-extrabold text-[#374D00] no-underline shadow-md hover:scale-105 active:scale-95 transition-transform">
          Browse events
        </Link>
      </div>
    </div>
  );
}
