// Builds a self-contained screenshot backup gallery from the captured PNGs.
// Re-run any time to pick up newly captured shots. Output: screenshot-gallery.html
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = '/var/public/pickleplay/reports/2026-07-16-demo-shots';
const OUT = '/var/public/pickleplay/reports/2026-07-16-screenshot-gallery.html';

// filename -> {act, caption}. Order within an act follows this map.
const MAP = {
  'player-home.png':              { act:'Act 1 · Player', cap:'Player home — Play / Book Court / Find Coach, Friends rail, Social badge' },
  'play-discover.png':            { act:'Act 1 · Player', cap:'Play Discover — ranked cards: venue, skill, distance, price, host, spots' },
  'play-discover-sort.png':       { act:'Act 1 · Player', cap:'Sort menu — Relevance / Start time / Distance / Spots left / Recently added' },
  'play-discover-filter.png':     { act:'Act 1 · Player', cap:'Filter sheet — skill, Who can play, venue, date, distance, type, cost' },
  'play-discover-gender-cards.png':{ act:'Act 1 · Player', cap:'Men / Women-only game cards (Who Can Play restriction)' },
  'picklefeed.png':               { act:'Act 1 · Player', cap:'PickleFeed — post, like, comment, repost, share' },
  'social-clubs.png':             { act:'Act 1 · Player', cap:'Social — Clubs sub-tab' },
  'social-friends.png':           { act:'Act 1 · Player', cap:'Social — Friends (add / requests / find)' },
  'find-coach.png':               { act:'Act 1 · Player', cap:'Find Coach — only active-subscription coaches shown' },
  'book-coach-calendar.png':      { act:'Act 1 · Player', cap:'Book a session — real calendar date picker' },
  'organizer-subscribe-999.png':  { act:'Act 2 · Organizer', cap:'Organizer subscription — ₱999 / 30 days (the licence to charge)' },
  'organizer-hub.png':            { act:'Act 2 · Organizer', cap:'Organizer hub — create Open Play / recurring series' },
  'coach-subscribe-499.png':      { act:'Act 3 · Coach', cap:'Become a coach — ₱499 / 30 days subscription' },
  // owner / staff (added as captured)
  'owner-manual-reservation.png': { act:'Act 4 · Owner', cap:'Manual reservation — walk-in / phone / Messenger, blocks the slot' },
  'owner-calendar.png':           { act:'Act 4 · Owner', cap:'Court calendar — manual & blocked slots held' },
  'owner-pricing.png':            { act:'Act 4 · Owner', cap:'Pricing override — variable time-based pricing grid' },
  'owner-partners.png':           { act:'Act 4 · Owner', cap:'Partners — approve / reject coaches & organizers' },
  'owner-reports.png':            { act:'Act 4 · Owner', cap:'Reports — owner-only financial dashboard' },
  'owner-messages.png':           { act:'Act 4 · Owner', cap:'Shared venue inbox — venue name & photo' },
  'staff-venues.png':             { act:'Act 5 · Staff', cap:'Staff venues — inherits owner venues, no Delete' },
  'staff-home.png':               { act:'Act 5 · Staff', cap:'Staff home — scoped nav, revenue tile hidden' },
};
const ACTS = ['Act 1 · Player','Act 2 · Organizer','Act 3 · Coach','Act 4 · Owner','Act 5 · Staff','Other'];

const files = existsSync(DIR) ? readdirSync(DIR).filter(f => f.endsWith('.png') && !f.startsWith('_')) : [];
const byAct = Object.fromEntries(ACTS.map(a => [a, []]));
for (const f of files) {
  const meta = MAP[f] || { act:'Other', cap:f.replace(/\.png$/,'').replace(/-/g,' ') };
  const b64 = readFileSync(join(DIR, f)).toString('base64');
  byAct[meta.act].push({ f, cap: meta.cap, src:`data:image/png;base64,${b64}` });
}
// keep MAP order within each act
for (const a of ACTS) {
  const order = Object.keys(MAP);
  byAct[a].sort((x,y)=> (order.indexOf(x.f)+1||999) - (order.indexOf(y.f)+1||999));
}
const pending = Object.keys(MAP).filter(f => !files.includes(f));

const card = s => `<figure class="shot"><div class="fr"><img loading="lazy" alt="${s.cap.replace(/"/g,'&quot;')}" src="${s.src}"></div><figcaption>${s.cap}</figcaption></figure>`;
const section = a => byAct[a].length ? `<section><h2>${a} <span class="c">${byAct[a].length}</span></h2><div class="grid">${byAct[a].map(card).join('')}</div></section>` : '';

const html = `<title>PickleBallers — Demo Screenshot Backup</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{--bg:#F5F7EF;--surface:#fff;--ink:#161A10;--t2:#474D3B;--t3:#767C66;--bd:#E0E4D3;--accent:#3F6B1E;--lime:#B7E92F;--lime-ink:#3d5a06;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;--sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
@media (prefers-color-scheme:dark){:root{--bg:#0E1109;--surface:#161B0F;--ink:#ECEFE1;--t2:#B3BAA1;--t3:#828A6F;--bd:#2A3119;--accent:#9CCB5C;--lime:#B7E92F;--lime-ink:#0E1109}}
:root[data-theme=light]{--bg:#F5F7EF;--surface:#fff;--ink:#161A10;--t2:#474D3B;--t3:#767C66;--bd:#E0E4D3;--accent:#3F6B1E;--lime-ink:#3d5a06}
:root[data-theme=dark]{--bg:#0E1109;--surface:#161B0F;--ink:#ECEFE1;--t2:#B3BAA1;--t3:#828A6F;--bd:#2A3119;--accent:#9CCB5C;--lime-ink:#0E1109}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.5}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px 80px}
header{padding:36px 0 18px;border-bottom:1px solid var(--bd);margin-bottom:24px;position:relative}
header::before{content:"";position:absolute;top:0;left:0;width:60px;height:5px;background:var(--lime);border-radius:0 0 3px 3px}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--t3)}
h1{margin:.4em 0 0;font-size:clamp(24px,4vw,34px);letter-spacing:-.02em}
.sub{color:var(--t2);margin-top:10px;max-width:70ch}
.meta{margin-top:12px;font-family:var(--mono);font-size:12px;color:var(--t3)}
section{margin-top:36px}
h2{font-size:16px;letter-spacing:-.01em;display:flex;align-items:center;gap:9px;margin:0 0 14px}
h2 .c{font-family:var(--mono);font-size:11px;font-weight:700;color:var(--lime-ink);background:var(--lime);border-radius:6px;padding:1px 7px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
.shot{margin:0;background:var(--surface);border:1px solid var(--bd);border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(20,26,10,.05)}
.fr{background:var(--bg);display:flex;justify-content:center;max-height:460px;overflow:hidden}
.fr img{width:100%;height:auto;display:block;object-fit:contain}
figcaption{padding:10px 12px;font-size:12.5px;color:var(--t2);line-height:1.4;border-top:1px solid var(--bd)}
.pending{margin-top:32px;padding:14px 16px;border:1px dashed var(--bd);border-radius:12px;color:var(--t3);font-size:13px}
.pending b{color:var(--t2);font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase}
.toggle{position:fixed;top:14px;right:14px;background:var(--surface);border:1px solid var(--bd);color:var(--t2);border-radius:9px;padding:7px 11px;font-size:12px;font-family:var(--mono);cursor:pointer}
footer{margin-top:44px;padding-top:18px;border-top:1px solid var(--bd);color:var(--t3);font-size:12px}
</style>
<button class="toggle" onclick="var r=document.documentElement,c=r.getAttribute('data-theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');r.setAttribute('data-theme',c==='dark'?'light':'dark')">◐ theme</button>
<div class="wrap">
<header>
<div class="eyebrow">🥒 PickleBallers · Demo backup</div>
<h1>Screenshot backup deck</h1>
<p class="sub">Real captures from the live app, grouped by demo act — the fallback if a screen won't load during the walkthrough. Mirrors the run-sheet order.</p>
<div class="meta">Captured 16 Jul 2026 · live preview · ${files.length} screenshots</div>
</header>
${ACTS.map(section).join('')}
${pending.length ? `<div class="pending"><b>Still capturing</b> &nbsp;${pending.length} owner/staff desktop shots being added: ${pending.map(f=>f.replace(/\.png$/,'')).join(' · ')}</div>` : ''}
<footer>Backup only — the live demo runs against the preview. If a step fails, show that step's shot here.</footer>
</div>`;

writeFileSync(OUT, html);
console.log(`Gallery built: ${OUT}\nEmbedded ${files.length} shots. Pending: ${pending.length ? pending.join(', ') : 'none'}`);
