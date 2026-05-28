

export default function AboutPage() {
  return (
    <div>
      <section className="bg-gradient-to-r from-[#0040E0] to-[#2E5BFF] px-5 py-12">
        <div className="mx-auto flex max-w-6xl items-center gap-8">
          <div className="flex-1">
            <h1 className="font-heading text-4xl font-extrabold text-white">About pickleBaller</h1>
            <p className="mt-3 text-white/70 max-w-lg">We believe pickleball is more than a sport — it's a community. pickleBaller makes it dead simple to find courts, join games, and connect with players at your level.</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 py-12">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { n: '4,200+', l: 'Active players' },
            { n: '180+', l: 'Venues listed' },
            { n: '50+', l: 'Cities covered' },
          ].map(({ n, l }) => (
            <div key={l} className="rounded-2xl bg-primary-container p-8 text-center">
              <div className="font-heading text-headline-xl font-bold text-on-primary-container">{n}</div>
              <div className="mt-1 text-base text-on-primary-container">{l}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
        </div>

        <div className="mt-10 rounded-2xl bg-white p-8 shadow-lg">
          <h2 className="font-heading text-headline-lg font-bold">Get in touch</h2>
          <p className="mt-3 text-base text-on-surface-variant">Questions, feedback, or just want to say hi? Reach out at <a href="mailto:hello@pickleballer.eunika.xyz" className="font-semibold text-primary hover:underline">hello@pickleballer.eunika.xyz</a>.</p>
        </div>
      </div>
    </div>
  );
}
