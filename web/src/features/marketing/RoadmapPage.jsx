

const BADGE = {
  mvp: 'bg-secondary-container text-on-secondary-container',
  phase2: 'bg-primary-container text-on-primary-container',
  phase3: 'bg-tertiary-container text-on-tertiary-container',
  future: 'bg-surface-container-high text-on-surface-variant',
  rejected: 'bg-error-container text-on-error-container',
  open: 'bg-tertiary-fixed text-on-tertiary-fixed',
};

function Badge({ label, tone = 'future' }) {
  return (
    <span className={`inline-block rounded-full px-3 py-0.5 text-label-sm font-bold uppercase tracking-wider ${BADGE[tone] || BADGE.future}`}>
      {label}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <section className="py-8">
      <h2 className="font-heading text-headline-lg font-bold text-on-surface">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`rounded-[14px] bg-surface-container-lowest p-6 shadow-card ${className}`}>
      {children}
    </div>
  );
}

function TimelineItem({ phase, title, status, children }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`mt-1 h-3 w-3 rounded-full ${status === 'done' ? 'bg-primary' : status === 'active' ? 'bg-secondary-container ring-4 ring-secondary-container/30' : 'bg-surface-variant'}`} />
        <div className="w-0.5 flex-1 bg-surface-variant" />
      </div>
      <div className="flex-1 pb-6">
        <div className="flex items-center gap-2">
          <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">{phase}</span>
          <Badge label={status === 'done' ? 'Done' : status === 'active' ? 'In Progress' : 'Planned'} tone={status === 'done' ? 'mvp' : status === 'active' ? 'phase2' : 'future'} />
        </div>
        <h3 className="mt-1 font-heading text-headline-md font-semibold text-on-surface">{title}</h3>
        <div className="mt-2 text-body-md text-on-surface-variant">{children}</div>
      </div>
    </div>
  );
}

function CrossroadCard({ question, context, options }) {
  return (
    <Card className="border-l-4 border-tertiary-container">
      <h3 className="font-heading text-headline-md font-semibold text-on-surface">{question}</h3>
      <p className="mt-2 text-body-md text-on-surface-variant">{context}</p>
      <ul className="mt-3 space-y-1.5">
        {options.map((o, i) => (
          <li key={i} className="flex items-start gap-2 text-body-md text-on-surface-variant">
            <span className="mt-1.5 block h-1.5 w-1.5 rounded-full bg-tertiary-container shrink-0" />
            <span><strong className="text-on-surface">{o.label}:</strong> {o.desc}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function RoadmapPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-r from-[#0040E0] to-[#2E5BFF] px-5 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-2">
            <Badge label="Living Document" tone="mvp" />
            <span className="text-sm text-white/60">Last updated: May 28, 2026</span>
          </div>
          <h1 className="mt-3 font-heading text-4xl font-extrabold text-white">Project Roadmap</h1>
          <p className="mt-3 max-w-2xl text-lg text-white/70">
            The complete product direction for PicklePlay — where we came from, where we are, and where we are heading. This document evolves with the project.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 py-10 space-y-2">

        {/* ---- PROJECT OVERVIEW ---- */}
        <Section title="Project Overview">
          <Card>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">Product</span>
                <p className="mt-1 text-body-md text-on-surface font-semibold">PicklePlay PWA</p>
                <p className="text-body-md text-on-surface-variant">Mobile-first pickleball discovery and social play platform</p>
              </div>
              <div>
                <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">Brand Website</span>
                <p className="mt-1 text-body-md text-on-surface font-semibold">pickleBaller</p>
                <p className="text-body-md text-on-surface-variant">Public-facing responsive website at pickleballer.eunika.xyz</p>
              </div>
              <div>
                <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">Tagline</span>
                <p className="mt-1 text-body-md text-on-surface font-semibold">Enter the Kitchen.</p>
                <p className="text-body-md text-on-surface-variant">Find Courts. Join Games.</p>
              </div>
              <div>
                <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">Tech Stack</span>
                <p className="mt-1 text-body-md text-on-surface-variant">React 19 + TypeScript + Vite + Tailwind CSS v4 + Zustand + Leaflet + PWA</p>
              </div>
            </div>
          </Card>
        </Section>

        {/* ---- PRODUCT ORIGIN ---- */}
        <Section title="Product Origin">
          <Card>
            <h3 className="font-heading text-headline-md font-semibold text-on-surface">Why This MVP Exists</h3>
            <p className="mt-2 text-body-md text-on-surface-variant">
              The pickleball app landscape is fragmented. Some apps focus on facility booking, others on tournament organization, and others on social communities — but none combine <strong>simple game discovery</strong> with <strong>lightweight community features</strong> in a mobile-first, approachable package. This MVP aims to fill that gap: an app that helps a regular person answer "Where do I go, who do I play with, and how do I join?" in under 3 minutes.
            </p>
          </Card>

          <Card>
            <h3 className="font-heading text-headline-md font-semibold text-on-surface">Apps Compared</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-body-md">
                <thead>
                  <tr className="border-b border-surface-variant">
                    <th className="pb-2 pr-4 font-semibold text-on-surface">App</th>
                    <th className="pb-2 pr-4 font-semibold text-on-surface">Category</th>
                    <th className="pb-2 pr-4 font-semibold text-on-surface">Primary Focus</th>
                    <th className="pb-2 font-semibold text-on-surface">Screenshots Reviewed</th>
                  </tr>
                </thead>
                <tbody className="text-on-surface-variant">
                  <tr className="border-b border-surface-variant/50">
                    <td className="py-2 pr-4 font-semibold text-on-surface">Pickleheads</td>
                    <td className="py-2 pr-4">Social + Organizer</td>
                    <td className="py-2 pr-4">Session organization, round robins, player communities</td>
                    <td className="py-2">~60</td>
                  </tr>
                  <tr className="border-b border-surface-variant/50">
                    <td className="py-2 pr-4 font-semibold text-on-surface">ReClub</td>
                    <td className="py-2 pr-4">Community-native</td>
                    <td className="py-2 pr-4">Clubs, meets, social identity, reputation system</td>
                    <td className="py-2">~70</td>
                  </tr>
                  <tr className="border-b border-surface-variant/50">
                    <td className="py-2 pr-4 font-semibold text-on-surface">Playtomic</td>
                    <td className="py-2 pr-4">Consumer Marketplace</td>
                    <td className="py-2 pr-4">Court booking, match-finding wizard, premium upsell</td>
                    <td className="py-2">~35</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-semibold text-on-surface">PlayByPoint</td>
                    <td className="py-2 pr-4">Facility/Utility</td>
                    <td className="py-2 pr-4">Court booking, membership management, waivers, billing</td>
                    <td className="py-2">~55</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h3 className="font-heading text-headline-md font-semibold text-on-surface">Positioning Map</h3>
            <pre className="mt-3 overflow-x-auto whitespace-pre rounded-[12px] bg-surface-container-low p-4 text-label-sm text-on-surface-variant leading-relaxed">
{`                        Commerce/Utility
                             |
                    PlayByPoint
                             |
                    Playtomic
                             |
        Social -------------+-------------- Organizer
                             |
              ReClub         |
                             |    Pickleheads
                             |
                        Community`}
            </pre>
            <p className="mt-3 text-body-md text-on-surface-variant">
              <strong>Pickleheads</strong> sits closest to our target — organizer-heavy pickleball with deep session creation tools. <strong>ReClub</strong> has the best community structure. <strong>Playtomic</strong> has the best polish. <strong>PlayByPoint</strong> has the deepest facility tooling, but its complexity is the anti-pattern we want to avoid.
            </p>
          </Card>

          <Card>
            <h3 className="font-heading text-headline-md font-semibold text-on-surface">Why Pickleheads Became the Primary Reference</h3>
            <ul className="mt-2 space-y-1.5 text-body-md text-on-surface-variant">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 block h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong className="text-on-surface">Best organizer tooling</strong> — 11 round-robin formats, reusable player lists, multi-channel invites. The most fully-realized session creation UX of any pickleball app.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 block h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong className="text-on-surface">Proven IA</strong> — 5-tab navigation (Home, Nearby, Games, Groups, Stats) is the clearest information architecture for pickleball discovery.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 block h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong className="text-on-surface">Card-based mobile UX</strong> — clean, scannable, mobile-optimized layouts that translate directly to our design goals.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 block h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong className="text-on-surface">Pickleball-only focus</strong> — like ReClub, it is pickleball-specialized, giving it deeper domain-specific features than multi-sport platforms.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 block h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong className="text-on-surface">Visible monetization path</strong> — tiered subscription model (Plus/Pro/Ultra) provides a clear reference for future monetization without blocking MVP.</span>
              </li>
            </ul>
          </Card>
        </Section>

        {/* ---- MVP PHILOSOPHY ---- */}
        <Section title="MVP Philosophy">
          <Card>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[12px] bg-primary-fixed p-4">
                <h4 className="font-heading text-body-lg font-semibold text-on-primary-fixed">What We Build</h4>
                <ul className="mt-2 space-y-1 text-body-md text-on-primary-fixed-variant">
                  <li>Simple, useful, easy to navigate</li>
                  <li>Mobile-first PWA (no app store required)</li>
                  <li>Game discovery + quick creation</li>
                  <li>Basic clubs for community hubs</li>
                  <li>Court map/list browse</li>
                  <li>Clean empty states with clear CTAs</li>
                  <li>Friendly, approachable copy and design</li>
                </ul>
              </div>
              <div className="rounded-[12px] bg-error-container/20 p-4">
                <h4 className="font-heading text-body-lg font-semibold text-on-surface">What We Avoid</h4>
                <ul className="mt-2 space-y-1 text-body-md text-on-surface-variant">
                  <li>Feature bloat from competitor apps</li>
                  <li>Court booking / payment processing (legal complexity)</li>
                  <li>Membership management / waivers (legal liability)</li>
                  <li>Coach directories (requires ecosystem)</li>
                  <li>17-section settings menus (anti-pattern)</li>
                  <li>Family profiles (niche)</li>
                  <li>DUPR integration (requires partnership)</li>
                  <li>Full social network feeds (keep it lightweight)</li>
                </ul>
              </div>
            </div>
          </Card>
        </Section>

        {/* ---- CURRENT STATUS ---- */}
        <Section title="Current Status">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">PWA Prototype</span>
              <div className="mt-2 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-secondary-container" />
                <span className="font-heading text-headline-md font-semibold text-on-surface">Demo Complete</span>
              </div>
              <p className="mt-2 text-body-md text-on-surface-variant">
                Mobile redesigned prototype with 17 routed screens, 2 bottom-sheet filters, custom app navigation, PWA install/update support, offline banner, and demo loading/error/empty states. Next work is backend integration and persistence.
              </p>
              <p className="mt-1 text-body-md text-on-surface-variant">
                Runs at <code className="rounded bg-surface-container px-1 text-sm">pickleballer-pwa.eunika.xyz</code>
              </p>
            </Card>
            <Card>
              <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">Mockups</span>
              <div className="mt-2 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                <span className="font-heading text-headline-md font-semibold text-on-surface">Reference Complete</span>
              </div>
              <p className="mt-2 text-body-md text-on-surface-variant">
                Static Redesign reference preserved with tab screens, detail screens, iOS frame, tuneable styling panel, and image assets. "Playful Modernism" design language has been carried into the React app.
              </p>
            </Card>
            <Card>
              <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">Responsive Website</span>
              <div className="mt-2 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                <span className="font-heading text-headline-md font-semibold text-on-surface">Scaffolded</span>
              </div>
              <p className="mt-2 text-body-md text-on-surface-variant">
                40+ page stubs, react-router v7, shadcn/ui, full design system documented. This roadmap now tracks the newer PWA implementation state from /app.
              </p>
              <p className="mt-1 text-body-md text-on-surface-variant">
                Runs at <code className="rounded bg-surface-container px-1 text-sm">pickleballer.eunika.xyz</code>
              </p>
            </Card>
          </div>

          <Card className="mt-4">
            <h3 className="font-heading text-headline-md font-semibold text-on-surface">Existing Screens (PWA)</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { name: 'Login', tone: 'mvp' },
                { name: 'Onboarding', tone: 'mvp' },
                { name: 'Home', tone: 'mvp' },
                { name: 'Nearby', tone: 'mvp' },
                { name: 'Games', tone: 'mvp' },
                { name: 'Clubs', tone: 'mvp' },
                { name: 'Profile', tone: 'mvp' },
                { name: 'Game Details', tone: 'mvp' },
                { name: 'Court Details', tone: 'mvp' },
                { name: 'Club Details', tone: 'mvp' },
                { name: 'Create Game', tone: 'mvp' },
                { name: 'Create Club', tone: 'mvp' },
                { name: 'Edit Profile', tone: 'mvp' },
                { name: 'Settings', tone: 'mvp' },
                { name: 'Search', tone: 'mvp' },
                { name: 'Invite Players', tone: 'mvp' },
                { name: 'Notifications', tone: 'mvp' },
                { name: 'Nearby Filter Sheet', tone: 'mvp' },
                { name: 'Game Filter Sheet', tone: 'mvp' },
              ].map((s) => (
                <span key={s.name} className={`rounded-full px-3 py-1 text-label-sm font-bold uppercase tracking-wider ${BADGE[s.tone]}`}>
                  {s.name}
                </span>
              ))}
            </div>
          </Card>

          <Card className="mt-4">
            <h3 className="font-heading text-headline-md font-semibold text-on-surface">Documentation Available</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 text-body-md">
              {[
                { file: 'app/docs/pickleplay-app-documentation.xlsx', desc: 'Excel workbook covering app overview, screens, features, flows, shared components, data model, and integration gaps' },
                { file: 'app/docs/pickleplay-screens-pages.csv', desc: 'Screen-by-screen implementation notes, actions, state, and data dependencies' },
                { file: 'app/docs/pickleplay-features.csv', desc: 'Feature-area inventory with user value, implementation details, and current demo/API status' },
                { file: 'app/docs/pickleplay-navigation-flows.csv', desc: 'Current app navigation paths and handoffs between routed screens' },
                { file: 'app/docs/pickleplay-shared-components.csv', desc: 'Reusable UI primitives and app-level components now present in /app' },
                { file: 'app/docs/pickleplay-integration-gaps.csv', desc: 'Backend, persistence, routing, and state gaps to resolve before production launch' },
                { file: 'app/docs/pickleplay-data-model.csv', desc: 'Suggested entity model for users, courts, games, clubs, messages, and notifications' },
                { file: 'app/Redesign/', desc: 'Preserved visual reference implementation and assets used for the latest mobile redesign' },
                { file: 'app/src/lib/demoState.tsx', desc: 'Demo state provider powering normal, empty, loading, error, and offline review modes' },
                { file: 'app/src/pwaUpdate.ts', desc: 'Service-worker update registration and refresh handling for installed PWA builds' },
                { file: 'app/vite.config.ts', desc: 'PWA manifest, OpenStreetMap tile caching, local dev port 9000, and API proxy configuration' },
                { file: 'web/src/pages/RoadmapPage.jsx', desc: 'Public roadmap page source' },
              ].map((d) => (
                <div key={d.file} className="flex items-start gap-2 rounded-[10px] bg-surface-container-low p-3">
                  <span className="mt-0.5 shrink-0 rounded bg-primary-fixed px-1.5 py-0.5 text-label-sm font-semibold text-on-primary-fixed">doc</span>
                  <div>
                    <span className="font-semibold text-on-surface">{d.file}</span>
                    <p className="text-on-surface-variant">{d.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        {/* ---- RECENT APP REDESIGN (BEFORE / AFTER) ---- */}
        <Section title="Recent App Redesign — May 27, 2026">
          <Card>
            <p className="text-body-md text-on-surface-variant">
              The PWA prototype went through a three-commit redesign on May 26–27, 2026 (commits <code className="rounded bg-surface-container-low px-1.5 py-0.5 text-sm">16acf6c</code> → <code className="rounded bg-surface-container-low px-1.5 py-0.5 text-sm">0e32861</code> → <code className="rounded bg-surface-container-low px-1.5 py-0.5 text-sm">c4ceec6</code>). The screen count stayed similar (~19), but the chrome, layout, and primitives were largely rebuilt to match a new visual reference under <code className="rounded bg-surface-container-low px-1.5 py-0.5 text-sm">app/Redesign/</code>. The previous state is preserved below so reviewers can see what changed.
            </p>
          </Card>

          {/* Entry screen change */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-l-4 border-surface-variant">
              <Badge label="Before" tone="future" />
              <h3 className="mt-2 font-heading text-headline-md font-semibold text-on-surface">Entry: Login screen first</h3>
              <p className="mt-2 text-body-md text-on-surface-variant">
                Cold-launching the app dropped users straight onto <strong>LoginScreen</strong>. There was no marketing/welcome surface before authentication. Logout returned the user back to Login.
              </p>
            </Card>
            <Card className="border-l-4 border-secondary-container">
              <Badge label="After" tone="mvp" />
              <h3 className="mt-2 font-heading text-headline-md font-semibold text-on-surface">Entry: Landing screen first</h3>
              <p className="mt-2 text-body-md text-on-surface-variant">
                Cold-launching now shows <strong>LandingScreen</strong> — a welcome/marketing surface with "Get Started" and "Sign In" CTAs. LoginScreen is reached by tapping either CTA. Logout returns to Landing, not Login.
              </p>
            </Card>
          </div>

          {/* Layout chrome change */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-l-4 border-surface-variant">
              <Badge label="Before" tone="future" />
              <h3 className="mt-2 font-heading text-headline-md font-semibold text-on-surface">Chrome: Top bar + tab bar + FAB + sidebar</h3>
              <p className="mt-2 text-body-md text-on-surface-variant">
                The app shell had four chrome elements: a persistent <strong>TopBar</strong> (logo, search, bell), a <strong>TabBar</strong> with 5 tabs, a separate <strong>FAB</strong> for creating games, and a <strong>Sidebar</strong> drawer for settings/profile shortcuts.
              </p>
            </Card>
            <Card className="border-l-4 border-secondary-container">
              <Badge label="After" tone="mvp" />
              <h3 className="mt-2 font-heading text-headline-md font-semibold text-on-surface">Chrome: Tab bar only</h3>
              <p className="mt-2 text-body-md text-on-surface-variant">
                TopBar, FAB, and Sidebar were all removed. The redesigned <strong>TabBar</strong> absorbs the create action (it now receives an <code className="rounded bg-surface-container px-1 text-sm">onCreate</code> handler), so there is no separate floating button. Screen headers are now owned by each screen rather than a global top bar.
              </p>
            </Card>
          </div>

          {/* Filters change */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-l-4 border-surface-variant">
              <Badge label="Before" tone="future" />
              <h3 className="mt-2 font-heading text-headline-md font-semibold text-on-surface">Filters: Full screens</h3>
              <p className="mt-2 text-body-md text-on-surface-variant">
                Filters lived in their own routed screens — <strong>NearbyFiltersScreen</strong> and <strong>GameFiltersScreen</strong> — that pushed onto the navigation stack and required a full back navigation to return.
              </p>
            </Card>
            <Card className="border-l-4 border-secondary-container">
              <Badge label="After" tone="mvp" />
              <h3 className="mt-2 font-heading text-headline-md font-semibold text-on-surface">Filters: Bottom sheets</h3>
              <p className="mt-2 text-body-md text-on-surface-variant">
                Filters are now reusable bottom sheets — <strong>NearbyFilterSheet</strong> and <strong>GameFilterSheet</strong> — that open over the current screen via the shared <strong>BottomSheet</strong> primitive. Faster to open, faster to dismiss, no nav-stack pollution.
              </p>
            </Card>
          </div>

          {/* Loading state change */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-l-4 border-surface-variant">
              <Badge label="Before" tone="future" />
              <h3 className="mt-2 font-heading text-headline-md font-semibold text-on-surface">Loading: Spinner</h3>
              <p className="mt-2 text-body-md text-on-surface-variant">
                Lists and detail views showed a centered <strong>LoadingSpinner</strong> while fetching. Pages flashed empty before content arrived.
              </p>
            </Card>
            <Card className="border-l-4 border-secondary-container">
              <Badge label="After" tone="mvp" />
              <h3 className="mt-2 font-heading text-headline-md font-semibold text-on-surface">Loading: Skeletons</h3>
              <p className="mt-2 text-body-md text-on-surface-variant">
                Lists and detail views now use <strong>LoadingSkeleton</strong> placeholders matching the eventual content layout. Less perceived latency, more polished feel.
              </p>
            </Card>
          </div>

          {/* Demo state + offline */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-l-4 border-surface-variant">
              <Badge label="Before" tone="future" />
              <h3 className="mt-2 font-heading text-headline-md font-semibold text-on-surface">Review modes: Manual</h3>
              <p className="mt-2 text-body-md text-on-surface-variant">
                To review empty/error/offline states, you had to edit code or mock network failures by hand. No way to demo failure surfaces to stakeholders.
              </p>
            </Card>
            <Card className="border-l-4 border-secondary-container">
              <Badge label="After" tone="mvp" />
              <h3 className="mt-2 font-heading text-headline-md font-semibold text-on-surface">Review modes: Demo state switcher</h3>
              <p className="mt-2 text-body-md text-on-surface-variant">
                A global <strong>DemoStateProvider</strong> + <strong>DemoStateControl</strong> widget lets anyone toggle between <em>normal / empty / loading / error / offline</em> modes at runtime. The <strong>OfflineBanner</strong> appears at the top when offline is selected (or when the browser is genuinely offline).
              </p>
            </Card>
          </div>

          {/* New primitives summary */}
          <Card>
            <h3 className="font-heading text-headline-md font-semibold text-on-surface">New UI primitives & helpers added in the redesign</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                'BottomSheet', 'CourtIllustration', 'DemoStateControl', 'DuprExplainerSheet',
                'GameRow', 'LoadingSkeleton', 'OfflineBanner', 'Segmented', 'Toast',
                'GameFilterSheet', 'NearbyFilterSheet',
                'FormField', 'FormSelect', 'FormTierPicker',
                'useForm', 'usePrefersReducedMotion', 'useTheme',
                'demoState (provider)', 'skillTiers',
              ].map((name) => (
                <span key={name} className="rounded-full bg-secondary-container px-3 py-1 text-label-sm font-bold uppercase tracking-wider text-on-secondary-container">
                  {name}
                </span>
              ))}
            </div>
            <h3 className="mt-6 font-heading text-headline-md font-semibold text-on-surface">Removed in the redesign</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                'TopBar (layout)', 'FAB (layout)', 'Sidebar (layout)',
                'LoadingSpinner (replaced by LoadingSkeleton)',
                'NearbyFiltersScreen (replaced by NearbyFilterSheet)',
                'GameFiltersScreen (replaced by GameFilterSheet)',
              ].map((name) => (
                <span key={name} className="rounded-full bg-error-container px-3 py-1 text-label-sm font-bold uppercase tracking-wider text-on-error-container line-through">
                  {name}
                </span>
              ))}
            </div>
          </Card>

          {/* Screen list diff */}
          <Card>
            <h3 className="font-heading text-headline-md font-semibold text-on-surface">Screen list — before vs after</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">Before (19 routed screens)</span>
                <ol className="mt-2 list-decimal pl-5 space-y-0.5 text-body-md text-on-surface-variant">
                  <li>login</li>
                  <li>onboarding</li>
                  <li>home</li>
                  <li>nearby</li>
                  <li>games</li>
                  <li>clubs</li>
                  <li>profile</li>
                  <li>game-details</li>
                  <li>court-details</li>
                  <li>club-details</li>
                  <li>create-game</li>
                  <li>create-club</li>
                  <li>edit-profile</li>
                  <li>settings</li>
                  <li>search</li>
                  <li>invite-players</li>
                  <li>notifications</li>
                  <li className="line-through text-error">nearby-filters</li>
                  <li className="line-through text-error">game-filters</li>
                </ol>
              </div>
              <div>
                <span className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">After (18 routed screens + 2 sheets)</span>
                <ol className="mt-2 list-decimal pl-5 space-y-0.5 text-body-md text-on-surface-variant">
                  <li className="font-semibold text-on-surface">landing <span className="text-secondary">(new)</span></li>
                  <li>login</li>
                  <li>onboarding</li>
                  <li>home</li>
                  <li>nearby</li>
                  <li>games</li>
                  <li>clubs</li>
                  <li>profile</li>
                  <li>game-details</li>
                  <li>court-details</li>
                  <li>club-details</li>
                  <li>create-game</li>
                  <li>create-club</li>
                  <li>edit-profile</li>
                  <li>settings</li>
                  <li>search</li>
                  <li>invite-players</li>
                  <li>notifications</li>
                </ol>
                <p className="mt-2 text-body-md text-on-surface-variant"><em>Plus 2 bottom sheets: NearbyFilterSheet, GameFilterSheet.</em></p>
              </div>
            </div>
          </Card>

          {/* Reference assets */}
          <Card>
            <h3 className="font-heading text-headline-md font-semibold text-on-surface">Redesign reference assets</h3>
            <p className="mt-2 text-body-md text-on-surface-variant">
              The redesign was driven by a static JSX prototype now preserved under <code className="rounded bg-surface-container-low px-1.5 py-0.5 text-sm">app/Redesign/</code>. It contains an <strong>iOS frame</strong> wrapper, separate <strong>tab</strong> and <strong>detail</strong> screen prototypes, a live <strong>tweaks panel</strong>, shared <strong>components</strong>, an <strong>icons</strong> set, a self-contained <strong>PickleBallers.html</strong> showcase, and the source PNG illustrations. This folder is the visual source of truth for matching the prototype during integration work.
            </p>
          </Card>
        </Section>

        {/* ---- CORE FEATURES (TIER 1 MVP) ---- */}
        <Section title="Core Features — Tier 1 MVP">
          <Card>
            <p className="mb-4 text-body-md text-on-surface-variant">
              These features are now represented in the redesigned PWA prototype. Most are still demo/local-state implementations, but the user flows, screens, and failure-state surfaces are in place.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-md">
                <thead>
                  <tr className="border-b border-surface-variant">
                    <th className="pb-2 pr-4 font-semibold text-on-surface">Feature</th>
                    <th className="pb-2 pr-4 font-semibold text-on-surface">Source</th>
                    <th className="pb-2 font-semibold text-on-surface">Status</th>
                  </tr>
                </thead>
                <tbody className="text-on-surface-variant">
                  {[
                    ['User registration + login', 'Pickleheads', 'Demo UI wired locally'],
                    ['Onboarding for location and skill setup', 'Pickleheads + Playtomic', 'Demo UI wired locally'],
                    ['Player profile (name, photo, skill, location)', 'Pickleheads', 'Demo UI wired locally'],
                    ['Home screen with game feed + quick actions', 'Pickleheads', 'Redesigned'],
                    ['Nearby courts with stylized map + optional Leaflet map', 'Pickleheads', 'Redesigned'],
                    ['Nearby game discovery with chips and filters', 'Pickleheads', 'Redesigned'],
                    ['Create game form + post-create actions', 'Pickleheads', 'Demo UI wired locally'],
                    ['Join/leave game toggle', 'Pickleheads', 'Local state only'],
                    ['Public/private game toggle', 'Pickleheads', 'Demo UI wired locally'],
                    ['Game details (info, players, chat)', 'Pickleheads', 'Redesigned'],
                    ['Basic clubs (create, join, member list)', 'Pickleheads + ReClub', 'Demo UI wired locally'],
                    ['Club tabs for about, events, members, chat', 'ReClub', 'Redesigned'],
                    ['Game and club chat placeholders', 'Pickleheads + ReClub', 'Demo/local only'],
                    ['Cross-entity search (courts, games, players, clubs)', 'ReClub', 'Demo UI wired locally'],
                    ['Notifications inbox + mark-all-read', 'Pickleheads', 'Local state only'],
                    ['5-tab navigation with floating create action', 'Pickleheads', 'Redesigned'],
                    ['Settings shell + logout path', 'Pickleheads', 'Demo UI wired locally'],
                    ['PWA install prompt + service worker auto-update', '—', 'Wired globally'],
                    ['Offline/loading/error/empty review states', '—', 'Wired via demo mode'],
                  ].map(([feature, source, status]) => (
                    <tr key={feature} className="border-b border-surface-variant/50">
                      <td className="py-2 pr-4 font-medium text-on-surface">{feature}</td>
                      <td className="py-2 pr-4">{source}</td>
                      <td className="py-2"><Badge label={status} tone={status.includes('Wired') || status.includes('Redesigned') ? 'mvp' : 'phase2'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Section>

        {/* ---- EXCLUDED / DEFERRED ---- */}
        <Section title="Excluded & Deferred Features">
          <Card>
            <p className="mb-4 text-body-md text-on-surface-variant">
              These features exist in competitor apps but were intentionally excluded. Each has a specific reason — not just "we will add it later."
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-md">
                <thead>
                  <tr className="border-b border-surface-variant">
                    <th className="pb-2 pr-4 font-semibold text-on-surface">Feature</th>
                    <th className="pb-2 pr-4 font-semibold text-on-surface">Source</th>
                    <th className="pb-2 font-semibold text-on-surface">Reason Excluded</th>
                  </tr>
                </thead>
                <tbody className="text-on-surface-variant">
                  {[
                    ['Full court booking checkout', 'PlayByPoint', 'Too facility-heavy; different product category'],
                    ['Membership management', 'PlayByPoint', 'Legal complexity; requires admin tools'],
                    ['Waivers / proof of residency', 'PlayByPoint', 'Legal liability; document storage overhead'],
                    ['Club credits / billing passes', 'PlayByPoint', 'Payment complexity; Phase 6 at earliest'],
                    ['Family profiles', 'PlayByPoint', 'Niche feature; adds navigation depth'],
                    ['17-section settings menu', 'PlayByPoint', 'Anti-pattern; keep settings minimal'],
                    ['Full booking marketplace', 'Playtomic', 'Different product direction'],
                    ['Coaches directory', 'ReClub', 'Requires coach verification ecosystem'],
                    ['Full social network feed', 'ReClub', 'Keep community lightweight'],
                    ['11 round robin formats', 'Pickleheads', 'Start with 4; add based on usage data'],
                    ['DUPR integration', 'Pickleheads', 'Requires business partnership'],
                    ['Stripe payment processing', 'Pickleheads', 'Legal/compliance overhead'],
                    ['Learning/classes marketplace', 'Playtomic', 'Requires instructor ecosystem'],
                  ].map(([feature, source, reason]) => (
                    <tr key={feature} className="border-b border-surface-variant/50">
                      <td className="py-2 pr-4 font-medium text-on-surface">{feature}</td>
                      <td className="py-2 pr-4">{source}</td>
                      <td className="py-2">{reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Section>

        {/* ---- BORROWED FEATURES SUMMARY ---- */}
        <Section title="Reference Apps & Learnings">
          <Card>
            <h3 className="font-heading text-headline-md font-semibold text-on-surface">What We Borrowed From Each App</h3>
          </Card>

          <Card>
            <h4 className="font-heading text-body-lg font-semibold text-on-surface">From Pickleheads (Primary Reference)</h4>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 text-body-md">
              {[
                ['5-tab navigation', 'Proven IA for pickleball discovery apps'],
                ['Card-based UI', 'Clean, scannable, mobile-optimized'],
                ['Game creation flow', 'Best-in-class organizer UX'],
                ['Court map/list toggle', 'Essential discovery pattern'],
                ['Home with quick actions + game feed', 'Single dashboard for player and organizer'],
                ['Onboarding checklist', 'Gentle new-user activation, all steps skippable'],
                ['Round robin formats', 'Start with 4 of 11 formats'],
                ['Reusable player lists', 'Reduces repeat organizer work'],
                ['Multi-channel invites', 'Link + player search; QR in Phase 2'],
                ['Subscription tiers', 'Monetization reference for Phase 6'],
              ].map(([feature, note]) => (
                <div key={feature} className="flex items-start gap-2 rounded-[10px] bg-surface-container-low p-3">
                  <span className="mt-0.5 shrink-0 rounded-full bg-primary w-1.5 h-1.5 mt-1.5" />
                  <div>
                    <span className="font-semibold text-on-surface">{feature}</span>
                    <p className="text-on-surface-variant">{note}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h4 className="font-heading text-body-lg font-semibold text-on-surface">From ReClub (Community Structure)</h4>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 text-body-md">
              {[
                ['Clubs as durable hubs', 'Sub-tabs: activities, discussion, members, library, chat'],
                ['Club announcements', 'Pinned posts from club admins'],
                ['Club library', 'Links + files for organized clubs'],
                ['Meet vs Game vs Competition', 'Different creation forms, different badges'],
                ['Global search overlay', 'Unified discovery across 5 entity types'],
                ['Activity feed', 'Social proof and engagement; fan-out on write'],
              ].map(([feature, note]) => (
                <div key={feature} className="flex items-start gap-2 rounded-[10px] bg-surface-container-low p-3">
                  <span className="mt-0.5 shrink-0 rounded-full bg-tertiary-container w-1.5 h-1.5 mt-1.5" />
                  <div>
                    <span className="font-semibold text-on-surface">{feature}</span>
                    <p className="text-on-surface-variant">{note}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h4 className="font-heading text-body-lg font-semibold text-on-surface">From Playtomic (Consumer Polish)</h4>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 text-body-md">
              {[
                ['"I want to play" guided flow', 'Step-by-step: sport → skill → location → results'],
                ['Skill-based game suggestions', 'Simple heuristic, no ML needed'],
                ['Clean empty states', 'Illustration + friendly text + one clear CTA'],
                ['Visual discovery feed', 'Larger images, clearer CTAs, more whitespace'],
              ].map(([feature, note]) => (
                <div key={feature} className="flex items-start gap-2 rounded-[10px] bg-surface-container-low p-3">
                  <span className="mt-0.5 shrink-0 rounded-full bg-primary-container w-1.5 h-1.5 mt-1.5" />
                  <div>
                    <span className="font-semibold text-on-surface">{feature}</span>
                    <p className="text-on-surface-variant">{note}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h4 className="font-heading text-body-lg font-semibold text-on-surface">From PlayByPoint (Data Model Only)</h4>
            <p className="mt-2 text-body-md text-on-surface-variant">
              We borrow PlayByPoint's court data model fields (availability, price, booking link, partner facility tag, contact details) as nullable columns — but none of the booking/payment/membership UI. This keeps our court profiles complete without turning into a facility management platform.
            </p>
          </Card>
        </Section>

        {/* ---- IMPLEMENTATION PHASES ---- */}
        <Section title="Implementation Phases">
          <TimelineItem phase="Phase 1" title="MVP Core Prototype" status="done">
            <p>All Tier 1 user flows are represented in the mobile PWA prototype: landing, login, onboarding, home, nearby, games, clubs, profile, details, creation flows, search, invites, notifications, install prompt, and demo-state review modes.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge label="19 Feature Surfaces" tone="mvp" />
              <Badge label="17 Routed Screens" tone="mvp" />
              <Badge label="2 Filter Sheets" tone="mvp" />
              <Badge label="Demo Complete" tone="mvp" />
            </div>
          </TimelineItem>

          <TimelineItem phase="Phase 2" title="Backend Integration & Persistence" status="active">
            <p>Replace static demo arrays and local-only state with real auth, persisted onboarding/profile data, game list/detail APIs, create-game mutation, join/leave endpoint, court search by location, durable notifications, and profile editing.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge label="High Priority" tone="phase2" />
              <Badge label="Integration Gaps Documented" tone="future" />
            </div>
          </TimelineItem>

          <TimelineItem phase="Phase 3" title="Organizer Tools" status="future">
            <p>Reusable player lists, invite links, recurring weekly games, attendance tracking, join request approve/decline, waitlists, 4 round robin formats, mini tournament setup, payment note field, co-host assignment.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge label="10 Features" tone="phase2" />
              <Badge label="Pickleheads-derived" tone="future" />
            </div>
          </TimelineItem>

          <TimelineItem phase="Phase 4" title="Community Layer" status="future">
            <p>Club sub-sections beyond the current tabs, club announcements, club events, club rules/about, club library, favorite players/clubs/courts, public activity feed, Meet/Game/Competition categorization.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge label="8 Features" tone="phase3" />
              <Badge label="ReClub-derived" tone="future" />
            </div>
          </TimelineItem>

          <TimelineItem phase="Phase 5" title="Polish & Guidance" status="future">
            <p>"I want to play" guided discovery flow, skill-based game suggestions, singles/doubles/open play selector, beginner-friendly game tags, improved empty states, improved onboarding.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge label="6 Features" tone="phase3" />
              <Badge label="Playtomic-derived" tone="future" />
            </div>
          </TimelineItem>

          <TimelineItem phase="Phase 6" title="Facility Readiness" status="future">
            <p>Court availability fields, court price field, external booking link, partner facility tag, facility contact details. Data model only — no booking UI.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge label="5 Features" tone="future" />
              <Badge label="PlayByPoint data model" tone="future" />
            </div>
          </TimelineItem>

          <TimelineItem phase="Phase 7" title="Monetization" status="future">
            <p>Premium organizer tools, facility partnerships, court booking integrations, tournament fees, subscription plans.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge label="5 Features" tone="future" />
              <Badge label="Future" tone="future" />
            </div>
          </TimelineItem>
        </Section>

        {/* ---- ROADMAP TIMELINE ---- */}
        <Section title="Roadmap Timeline">
          <Card>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="shrink-0 rounded-full bg-secondary-container px-4 py-2 text-center">
                  <span className="block text-label-sm font-bold uppercase text-on-secondary-container">Now</span>
                  <span className="block font-heading text-headline-md font-bold text-on-secondary-container">Q2 2026</span>
                </div>
                <div className="text-body-md text-on-surface-variant">
                  <strong className="text-on-surface">Phase 1 — MVP Core Prototype.</strong> Mobile app flows are redesigned and wired with local/demo state. Keep using the prototype for review while integration work begins.
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="shrink-0 rounded-full bg-primary-container px-4 py-2 text-center">
                  <span className="block text-label-sm font-bold uppercase text-on-primary-container">Next</span>
                  <span className="block font-heading text-headline-md font-bold text-on-primary-container">Q3 2026</span>
                </div>
                <div className="text-body-md text-on-surface-variant">
                  <strong className="text-on-surface">Phase 2 — Backend Integration.</strong> Real auth, persisted onboarding/profile data, game/court/club APIs, search, filters, join/leave, create flows, and durable notifications.
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="shrink-0 rounded-full bg-surface-container-high px-4 py-2 text-center">
                  <span className="block text-label-sm font-bold uppercase text-on-surface-variant">Later</span>
                  <span className="block font-heading text-headline-md font-bold text-on-surface-variant">Q4 2026+</span>
                </div>
                <div className="text-body-md text-on-surface-variant">
                  <strong className="text-on-surface">Phase 3+ — Organizer Tools, Community, Polish, Monetization.</strong> Progressive rollout based on usage data and user feedback. Phases may be reordered based on what users actually need.
                </div>
              </div>
            </div>
          </Card>
        </Section>

        {/* ---- CROSSROADS AND OPEN DECISIONS ---- */}
        <Section title="Crossroads & Open Decisions">
          <p className="text-body-md text-on-surface-variant">
            These are decisions we know we will face. Each has a default lean but should be revisited when the time comes.
          </p>

          <CrossroadCard
            question="PWA First vs Native Mobile App"
            context="The MVP is a PWA to avoid app store friction and enable rapid iteration. But native apps offer better OS integration (notifications, contacts, calendar) and are expected by users accustomed to the App Store / Play Store."
            options={[
              { label: 'PWA-first (current lean)', desc: 'Ship fast, iterate, prove value. Add native apps only when PWA limitations block growth or user expectations demand it.' },
              { label: 'PWA + wrappers', desc: 'Use Capacitor or similar to wrap the PWA in a native shell for app store distribution without maintaining separate codebases.' },
              { label: 'Full native', desc: 'Build dedicated iOS and Android apps. Higher cost, higher quality, harder to iterate. Only justified at scale.' },
            ]}
          />

          <CrossroadCard
            question="Simple Booking vs Advanced League/Community Features"
            context="Pickleheads invested heavily in organizer tools (round robins, player lists, subscriptions). ReClub invested in community depth (clubs, reputation, library). Which direction do we prioritize after MVP?"
            options={[
              { label: 'Organizer-first (current lean)', desc: 'Follow Pickleheads. Prioritize session creation, round robins, invites, attendance. Organizers drive network effects.' },
              { label: 'Community-first', desc: 'Follow ReClub. Prioritize clubs, reputation, activity feeds. Community depth drives retention.' },
              { label: 'Balanced', desc: 'Light organizer tools + light community. Risk: neither deep enough to win either segment.' },
            ]}
          />

          <CrossroadCard
            question="User Profiles Now vs Later"
            context="Detailed player profiles (stats, history, ratings, DUPR) add social depth but increase complexity and require more backend. Simple profiles (name, photo, skill) are enough for MVP game discovery."
            options={[
              { label: 'Simple profiles for MVP (current lean)', desc: 'Name, photo, self-rated skill, home location. Add stats, history, and reputation in Phase 3.' },
              { label: 'Medium profiles at launch', desc: 'Add game history and basic stats in Phase 1. More engaging but delays other features.' },
              { label: 'DUPR integration early', desc: 'Requires partnership. High value for competitive players but limits initial audience.' },
            ]}
          />

          <CrossroadCard
            question="Court Discovery Only vs Social/Community Layer"
            context="The simplest useful app is a court finder with game listings. Adding clubs, chat, and social features makes the app stickier but riskier to build. Where is the line for MVP?"
            options={[
              { label: 'Court discovery + games (current lean)', desc: 'MVP includes games and basic clubs. The social layer is thin but present — enough to prove demand without overbuilding.' },
              { label: 'Court discovery only', desc: 'Ship as a pure utility app first. Add social later. Faster to launch, less sticky.' },
              { label: 'Full social from day one', desc: 'Clubs, chat, activity feed, profiles all in MVP. Risky: more to build, more to go wrong.' },
            ]}
          />

          <CrossroadCard
            question="Minimal MVP Release vs Adding Borrowed Features Before Launch"
            context="The more complete the app, the better the first impression. But every feature added before launch delays learning from real users."
            options={[
              { label: 'Ship minimal, iterate fast (current lean)', desc: '17 MVP features, no Phase 2 features. Get it in front of users and let data drive what to build next.' },
              { label: 'Ship with Phase 2 features', desc: 'Include round robins and waitlists at launch. More compelling for organizers but delays launch by weeks/months.' },
              { label: 'Ship with community features', desc: 'Include clubs, activity feed, favorite system. More complete social experience but significantly delays launch.' },
            ]}
          />

          <CrossroadCard
            question="Public-Facing Documentation vs Internal-Only"
            context="This roadmap page is currently public. That creates transparency and can attract contributors, but it also exposes product strategy to competitors."
            options={[
              { label: 'Keep public (current lean)', desc: 'Transparency builds trust. The pickleball app space is not zero-sum — a rising tide lifts all boats. Competitors already have their own apps.' },
              { label: 'Make internal-only later', desc: 'If competitive pressure increases or the roadmap reveals too much, restrict access. Easy to change — just remove the route.' },
            ]}
          />
        </Section>

        {/* ---- WHAT MAKES THIS APP DIFFERENT ---- */}
        <Section title="What Makes PicklePlay Different">
          <Card>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: 'Mobile-First PWA',
                  desc: 'No app store required. Install from the browser. Works offline. Updates instantly. Lower barrier to try than any native pickleball app.',
                },
                {
                  title: 'Simple, Not Simplistic',
                  desc: 'Every feature earns its place. We borrow the best ideas from 4 apps but reject anything that adds complexity without clear user value.',
                },
                {
                  title: 'Playful Design Language',
                  desc: 'Electric Blue, Neon Lime, and rounded everything. The UI feels energetic and approachable — not corporate, not gamified, not sterile.',
                },
                {
                  title: 'Organizer-Friendly from Day One',
                  desc: 'Quick game creation, invite tools, and basic clubs are in MVP. We do not make organizers wait for Phase 3 to be useful.',
                },
                {
                  title: 'Empty States That Welcome',
                  desc: 'Every empty list has an illustration, friendly text, and one clear CTA. First-time users feel guided, not lost.',
                },
                {
                  title: 'Competitive Without Bloat',
                  desc: 'We track what competitors build but do not match them feature-for-feature. If a feature does not serve our user promise, we skip it.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-[12px] bg-surface-container-low p-4">
                  <h4 className="font-heading text-body-lg font-semibold text-on-surface">{item.title}</h4>
                  <p className="mt-1 text-body-md text-on-surface-variant">{item.desc}</p>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        {/* ---- SUCCESS METRICS ---- */}
        <Section title="Success Metrics">
          <Card>
            <div className="grid gap-4 sm:grid-cols-3 text-center">
              {[
                { metric: '3 min', desc: 'New user finds and joins a game after signup' },
                { metric: '2 min', desc: 'Organizer creates a game and invites players' },
                { metric: '60%', desc: 'New users return within 7 days' },
              ].map(({ metric, desc }) => (
                <div key={metric} className="rounded-[12px] bg-primary-fixed p-4">
                  <span className="font-heading text-headline-xl font-bold text-on-primary-fixed">{metric}</span>
                  <p className="mt-1 text-body-md text-on-primary-fixed-variant">{desc}</p>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        {/* ---- NEXT ACTIONS ---- */}
        <Section title="Next Actions">
          <Card>
            <ol className="space-y-3 text-body-md text-on-surface">
              {[
                'Add real authentication with persisted session bootstrap, token refresh, and visible auth errors',
                'Persist onboarding, profile, and settings data through shared user state',
                'Connect game list/detail screens to API data with loading, empty, and error handling',
                'Submit Create Game to the backend and route to the returned game ID',
                'Add join/leave game and join/leave club mutations with refreshed counts/status',
                'Connect court discovery to geospatial search using location, radius, and filter parameters',
                'Replace static search results with debounced cross-entity search',
                'Make notifications server-backed, then add optional Web Push delivery',
                'Introduce URL/deep-link routing so refreshes and external links can target screens/entities',
                'Run a full mobile visual pass against the Redesign reference and the demo state switcher',
                'Draft privacy policy and terms of service',
                'Plan closed alpha with 10-20 local pickleball players for real feedback',
              ].map((action, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary-container text-label-sm font-bold text-on-secondary-container">{i + 1}</span>
                  {action}
                </li>
              ))}
            </ol>
          </Card>
        </Section>

        {/* ---- CHANGE LOG ---- */}
        <Section title="Change Log">
          <Card>
            <div className="space-y-4 text-body-md">
              {[
                { date: '2026-05-28', change: 'Web cleanup + non-phased polish: lint 37 → 0 errors, main bundle 1.2 MB → 317 KB via React.lazy() route splitting. Strict admin/player separation — admins no longer see /dashboard/* (hard redirect) and the public header user link routes them straight to /admin. Wired remaining player dashboard tabs: MyBookings, MyPayments, MyFavorites now read live from the API with loading/error/empty states; MyGames / MyEvents / MyMembership / MyWaitlists / MyGroups got honest coming-soon screens explaining their data models aren\\u2019t on the API yet. HomePage now shows real venues + live open-play sessions + real coaches instead of dummies. SearchPage wired to /api/v1/search with a debounced query and Venues / Coaches tabs.' },
                { date: '2026-05-28', change: 'Phase 4.1 (admin foundation, mapped to public-roadmap Phase 5) shipped. /admin/* now requires admin role via RequireRole, opens to AdminOverviewPage with 4 stat cards + 4 mini-charts (Recharts), and Quick links + DB collections table. Directory: Users, Venues, Coaches, Bookings — all searchable + filterable list pages reading live API endpoints. Moderation: queue overview + four queue pages (Reviews, Review reports, Venue claims, Suggested edits) each with PATCH approve/reject. Sidebar grouped into Overview / Directory / Moderation / Reports / System; disabled sections show "soon" chips. Login does role-aware post-auth redirect (admin → /admin). Shared dashboard kit (StatCard, MiniChart, DataTable) and RequireRole guard added to features/auth + shared/components/dashboard for reuse by future Owner + Coach surfaces.' },
                { date: '2026-05-28', change: 'Role-based dashboard spec landed at /var/public/pickleplay/DASHBOARD_INSTRUCTION_AND_PLAN.md and aligned to this roadmap\\u2019s phases. Existing /dashboard/* stays as the player surface; three new role surfaces specified: /coach/*, /owner/*, /admin/*. Sub-phases map onto roadmap phases (Admin → Phase 5 Polish; Owner → Phase 6 Facility Readiness; Coach → Phase 3 Organizer Tools; Reports → Phase 5 + Phase 7). web/PLAN.md also refreshed to reflect current shipped state and the role-based dashboard model.' },
                { date: '2026-05-28', change: 'Renamed user dashboard route prefix /my → /dashboard and the owning feature folder features/my → features/dashboard. Legacy /my/* URLs forward to /dashboard/* so existing bookmarks keep working. Lays the foundation for role-aware dashboard variants (player / coach / venue owner) sharing a single /dashboard root.' },
                { date: '2026-05-28', change: 'AuthGuard hardened and the user dashboard is now a real surface. /dashboard/* redirects unauthenticated visitors to /login with a `from` state that returns them after sign-in. UserLayout re-validates the session (calls /api/v1/auth/me) on every entry; invalid/expired tokens silently log the user out. MyProfilePage loads fresh from GET /api/v1/auth/me on mount and saves via PATCH — verified the round-trip persists bio + names + skill across reload.' },
                { date: '2026-05-28', change: 'Web sign-in and sign-up are live against the API. Real authStore (tokens persisted in localStorage, normalised user view-model, async login/register/logout/refreshMe). LoginPage gets show/hide password toggle, inline error surface (invalid creds, rate-limited, etc.), and respects redirect-after-login. RegisterPage maps full-name → displayName + firstName/lastName, handles 409 duplicate email cleanly. Verified end-to-end with the seeded admin (info@eunika.agency) and a freshly registered test user.' },
                { date: '2026-05-28', change: 'Rebuilt /lists in the API to be accurate and grouped by feature (Root, Auth, Discovery, Venues, Coaches, Content, Bookings & Payments, Interactions, Media, Subscriptions, Venue management, Admin). Previously listed bare /coach-reviews, /media, /subscriptions, /admin all 404\\u2019d on click because none of those mounts has a root handler. Clickable links now only render for public GET endpoints that actually exist; /search gets a sample ?q= so it returns 200 on click. Each row shows an `auth` / `admin` lock chip when JWT is required.' },
                { date: '2026-05-28', change: 'Venue photos live. New `npm run db:download-images` script fetches the Google Drive image URLs from venues.csv (238/244 = 97.5% success) into real-data/handoff/images/, which the importer then mirrors to api/uploads/. The API serves them at /images/venues/<slug>/<file>.jpg via Hono serveStatic, and the wired Venues + Coaches pages on the web now render real photos.' },
                { date: '2026-05-28', change: 'First live-API surfaces on the web. VenuesPage, VenueDetailPage, and CoachesPage now read from pickleballer-api.eunika.xyz (179 real venues, 32 coaches). Added shared/api/client.js + per-feature api.js modules with normalised view-models, plus graceful fallback when image payloads are missing.' },
                { date: '2026-05-28', change: 'CORS allowlist fixed (was treating the comma-separated env var as a single literal — silently broken). API now reflects each whitelisted origin and rejects others. Loosened Cross-Origin-Resource-Policy to "cross-origin" so browser fetches from sibling subdomains succeed.' },
                { date: '2026-05-28', change: 'Seeded admin account (Eunika Agency, info@eunika.agency) directly into MongoDB with bcrypt-hashed password and roleDefault: "admin". Login returns a JWT with role=admin.' },
                { date: '2026-05-28', change: 'Image-serving pipeline wired in API. Importer mirrors real-data/handoff/images/** → uploads/images/** (no-op if payload missing); /images/* mounted via serveStatic.' },
                { date: '2026-05-28', change: 'Seeded 69 dummy user accounts from randomuser.me across all roles — 32 coach users (each claims one of the imported coach profiles bidirectionally via User.coachId ↔ Coach.userId, claimStatus → "claimed"), 12 venue owner users (assigned to venues via Venue.ownerUserId), and 25 player users with random skill levels. New idempotent script: `npm run db:seed:users`. Seeded accounts use @example.com emails and password "password123"; re-runs cleanly unlink and replace prior dummies without touching the admin account.' },
                { date: '2026-05-28', change: 'app/ PWA restructured to feature-based vertical slices: src/features/{auth,home,games,venues,clubs,profile,search}/ + src/shared/{components,hooks,lib,styles}/. 18 screens moved into feature folders; filter sheets co-located with their owning feature; src/screens/, src/components/, src/hooks/, src/lib/ removed.' },
                { date: '2026-05-28', change: 'Roadmap update process formalized — added a "Keeping the public roadmap current" rule to api/, app/, and web/ CLAUDE.md. Every meaningful task must now append a Change Log entry here and bump the Last Updated date.' },
                { date: '2026-05-28', change: 'API /lists, /, and /health endpoints converted to HTML pages with dark theme, clickable nav links, and color-coded method badges. Dropped /sitemap.xml entirely (premature SEO, wrong default host).' },
                { date: '2026-05-28', change: 'web/ frontend restructured to feature-based vertical slices: src/features/{admin,auth,clubs,coaches,games,marketing,my,venues}/ + src/shared/{components,layouts,data}/. 41 pages moved; src/pages/, src/components/, src/layouts/, src/stores/ removed.' },
                { date: '2026-05-28', change: 'API restructured to vertical slices: src/features/<f>/{controller,routes,model}.ts + src/shared/{db,lib,middleware}/. CoachReviews folded into coaches/, VenueManagement into venues/. Added api/CLAUDE.md with the structural rules.' },
                { date: '2026-05-28', change: 'Pickleballers API stood up on port 9002 (pickleballer-api.eunika.xyz) via PM2 with autostart. Real handoff data imported into local MongoDB: 179 venues, 70 cities, 815 venue hours, 185 pricing blocks, 32 coaches.' },
                { date: '2026-05-27', change: 'Added "Recent App Redesign" section with side-by-side before/after for entry screen, chrome (TopBar/FAB/Sidebar removed), filters (screens → bottom sheets), loading (spinner → skeleton), and demo/offline review modes. Previous state preserved for reference.' },
                { date: '2026-05-27', change: 'Roadmap updated against latest /app git history: mobile redesign, bottom-sheet filters, install/update lifecycle, offline banner, demo states, and integration-gap documentation' },
                { date: '2026-05-27', change: 'Commit c4ceec6 — refined mobile redesign across App.tsx, TabBar, filter sheets, UI primitives, and all major screen files. New LandingScreen became the entry point; TopBar/FAB/Sidebar removed' },
                { date: '2026-05-27', change: 'Commit 0e32861 — added Landing/Sidebar/BottomSheet/filter/form components, replaced spinner with LoadingSkeleton, introduced DemoStateProvider + theme/form/skill-tier helpers, included Redesign reference assets under app/Redesign/' },
                { date: '2026-05-26', change: 'PWA gained service-worker update handling, install prompt, OpenStreetMap tile caching, PWA assets, and demo-state coverage for loading/error/empty/offline review' },
                { date: '2026-05-26', change: 'Created live project roadmap page at /roadmap' },
                { date: '2026-05-25', change: 'Structured app documentation generated in app/docs as CSV files and an Excel workbook' },
                { date: '2026-05-25', change: 'Web project scaffolded with 40+ page stubs, design system documented in web/DESIGN.md' },
                { date: '2026-05-24', change: 'PWA prototype reached 19 screens with complete Tailwind v4 theme' },
                { date: '2026-05-23', change: 'Competitive analysis completed — 220+ screenshots reviewed across 4 apps' },
                { date: '2026-05-22', change: '6 static mockups completed: Login, Home, Nearby, Clubs, Profile, Game Details' },
                { date: '2026-05-21', change: 'FEATURE-MATRIX.md published — 6 tiers, 58 features, 13 exclusions' },
                { date: '2026-05-20', change: 'Design tokens extracted from mockup to PWA codebase. "Playful Modernism" theme established with Electric Blue, Neon Lime, Coral palette' },
                { date: '2026-05-19', change: 'Product spec, sitemap, navigation map, UX patterns, and component inventory documented' },
                { date: '2026-05-18', change: 'Comparative analysis of Pickleheads, ReClub, Playtomic, PlayByPoint initiated. Pickleheads selected as primary reference' },
              ].map(({ date, change }) => (
                <div key={date + change} className="flex gap-3">
                  <span className="shrink-0 text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">{date}</span>
                  <span className="text-on-surface">{change}</span>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        {/* ---- HOW TO UPDATE ---- */}
        <Section title="How to Update This Document">
          <Card>
            <p className="text-body-md text-on-surface-variant">
              This roadmap is a living document. To update it:
            </p>
            <ol className="mt-3 space-y-2 text-body-md text-on-surface">
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary">1.</span>
                Edit <code className="rounded bg-surface-container-low px-1.5 py-0.5 text-sm">/var/public/pickleplay/web/src/features/marketing/RoadmapPage.jsx</code>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary">2.</span>
                Update the relevant section — add features, change status badges, append to the change log
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary">3.</span>
                Rebuild and redeploy: <code className="rounded bg-surface-container-low px-1.5 py-0.5 text-sm">npm run build && pm2 reload pickleballer-web</code>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary">4.</span>
                The page is live at{' '}
                <a href="https://pickleballer.eunika.xyz/roadmap" className="text-primary hover:underline font-semibold">
                  pickleballer.eunika.xyz/roadmap
                </a>
              </li>
            </ol>
            <p className="mt-4 text-body-md text-on-surface-variant">
              For deeper documentation on current PWA behavior, see the CSV files and workbook in{' '}
              <code className="rounded bg-surface-container-low px-1.5 py-0.5 text-sm">app/docs/</code>. For the static visual reference, see{' '}
              <code className="rounded bg-surface-container-low px-1.5 py-0.5 text-sm">app/Redesign/</code>.
            </p>
          </Card>
        </Section>

      </div>
    </div>
  );
}
