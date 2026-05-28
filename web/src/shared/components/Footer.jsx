import { Link } from 'react-router-dom';

const FOOTER_LINKS = {
  Discover: [
    { to: '/venues', label: 'Find Venues' },
    { to: '/games', label: 'Find Games' },
    { to: '/clubs', label: 'Find Clubs' },
    { to: '/players', label: 'Player Directory' },
    { to: '/leagues', label: 'Leagues' },
    { to: '/tournaments', label: 'Tournaments' },
  ],
  Community: [
    { to: '/community', label: 'Groups' },
    { to: '/coaches', label: 'Coaches' },
    { to: '/learn', label: 'Learn' },
    { to: '/news', label: 'News' },
  ],
  Company: [
    { to: '/about', label: 'About' },
    { to: '/pricing', label: 'Pricing' },
    { to: '/roadmap', label: 'Roadmap' },
    { to: '/download', label: 'Download App' },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-surface-variant bg-surface-container-lowest">
      <div className="mx-auto max-w-7xl px-5 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="font-heading text-headline-md font-bold text-primary no-underline">
              pickleBaller
            </Link>
            <p className="mt-3 text-body-md text-on-surface-variant">
              Find Courts. Join Games.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="font-heading text-body-md font-semibold text-on-surface">{heading}</h4>
              <ul className="mt-3 space-y-2">
                {links.map(({ to, label }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      className="text-body-md text-on-surface-variant no-underline hover:text-primary"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-surface-variant pt-6 text-center text-label-sm uppercase tracking-wider text-on-surface-variant">
          &copy; {new Date().getFullYear()} pickleBaller. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
