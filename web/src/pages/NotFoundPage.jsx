import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-5 text-center">
      <div className="text-7xl animate-float mt-4">🥒</div>
      <h1 className="mt-6 font-heading text-5xl font-extrabold text-on-surface">Oops!</h1>
      <p className="mt-3 text-lg text-on-surface-variant">This page is out of bounds. Let's get you back on the court.</p>
      <Link to="/" className="mt-8 inline-flex h-14 items-center rounded-full bg-[#C1F100] px-10 text-lg font-extrabold text-[#374D00] no-underline shadow-lg hover:scale-105 active:scale-95 transition-transform">
        Back to Home
      </Link>
    </div>
  );
}
