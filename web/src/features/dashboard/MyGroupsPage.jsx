import { Link } from 'react-router-dom';

export default function MyGroupsPage() {
  return (
    <div>
      <h1 className="font-heading text-3xl font-extrabold text-on-surface">My Groups</h1>
      <p className="mt-1 text-on-surface-variant">Communities you're a member of.</p>

      <div className="mt-12 flex flex-col items-center text-center">
        <div className="text-6xl">💬</div>
        <h2 className="mt-4 font-heading text-xl font-bold">No groups yet</h2>
        <p className="mt-2 max-w-md text-base text-on-surface-variant">
          The Club / Group model doesn't exist on the API yet — once it ships, the clubs you join will list here with quick chat access.
        </p>
        <Link to="/clubs" className="mt-6 inline-flex h-12 items-center rounded-full bg-[#C1F100] px-6 text-base font-extrabold text-[#374D00] no-underline shadow-md hover:scale-105 active:scale-95 transition-transform">
          Browse clubs
        </Link>
      </div>
    </div>
  );
}
