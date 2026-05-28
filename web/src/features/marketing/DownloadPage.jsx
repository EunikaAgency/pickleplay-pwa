
export default function DownloadPage() {
  return (
    <div>
      <section className="bg-gradient-to-r from-[#0040E0] to-[#2E5BFF] px-5 py-16 text-center">
        <div className="mx-auto max-w-lg">
          <h1 className="font-heading text-4xl font-extrabold text-white">Get the App</h1>
          <p className="mt-2 text-white/70">Take pickleBaller everywhere. Free on iOS and Android.</p>
          <div className="mt-6 flex justify-center gap-4">
            <a href="#" className="inline-flex h-14 items-center rounded-2xl bg-white px-8 text-base font-extrabold text-on-surface no-underline shadow-lg active:scale-95">App Store</a>
            <a href="#" className="inline-flex h-14 items-center rounded-2xl bg-[#C1F100] px-8 text-base font-extrabold text-[#374D00] no-underline shadow-lg active:scale-95">Google Play</a>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-5xl px-5">
        <h2 className="text-center font-heading text-3xl font-extrabold">Everything you need</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { e:'🗺️', t:'Find Courts', d:'Discover venues near you with real-time availability.' },
            { e:'🏓', t:'Join Games', d:'Open play, clinics, tournaments — all at your level.' },
            { e:'🤝', t:'Make Friends', d:'Join clubs, chat with players, build your crew.' },
            { e:'📊', t:'Track Progress', d:'Log matches, track streaks, connect your rating.' },
            { e:'🔔', t:'Stay Notified', d:'Alerts for games, invites, and community action.' },
            { e:'📅', t:'Book Courts', d:'Reserve, reschedule, or cancel right from your phone.' },
          ].map(({e,t,d}) => (
            <div key={t} className="rounded-2xl bg-white p-6 shadow-lg text-center hover:-translate-y-1 transition-transform">
              <div className="text-4xl">{e}</div>
              <h3 className="mt-3 font-heading text-lg font-bold">{t}</h3>
              <p className="mt-1 text-base text-on-surface-variant">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 mb-16 max-w-md px-5 text-center">
        <div className="rounded-3xl bg-white p-10 shadow-xl">
          <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-2xl bg-surface-container-high text-6xl">📷</div>
          <p className="mt-4 font-bold">Scan to download</p>
        </div>
      </section>
    </div>
  );
}
