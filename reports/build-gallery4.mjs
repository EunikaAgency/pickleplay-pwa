import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const DIR = '/var/public/pickleplay/reports/2026-07-16-demo-shots';
const OUT = '/var/public/pickleplay/reports/2026-07-16-screenshot-gallery.html';

// act · title · what it's for · where to find it
const MAP = {
  'player-home.png': { act:'Player', title:'Player home',
    desc:"The player's landing screen: three main actions, a Friends rail, and a live badge on Social. This is where the meeting's “Open Play / Book a Court / Get a Coach” direction actually landed.",
    where:'Sign in as a player — you land here.' },
  'play-discover.png': { act:'Player', title:'Play Discover — ranked listing',
    desc:'The Open Play list, ordered by a relevance score (time 30% · distance 25% · skill 20% · spots 15% · friends 10%). Every card carries venue, skill, distance, price, host and spots, so a player can decide without opening it.',
    where:'Bottom bar → <strong>Play</strong>.' },
  'play-discover-sort.png': { act:'Player', title:'Sort menu',
    desc:"Five ways to reorder the same ranked feed, for when relevance isn't what the player wants. “Almost full” used to sort backwards — it now sorts by spots remaining.",
    where:'Play tab → tap <strong>Sort: Relevance</strong> (top right of the list).' },
  'play-discover-filter.png': { act:'Player', title:'Filter sheet',
    desc:'Narrows the same ranked feed. Live: date, skill, play type, distance, venue, cost, and Who can play (gender). Any active filter shows a badge, so the list is never silently empty. Court type and a price-range filter are still missing.',
    where:'Play tab → tap <strong>Filter</strong> (left, above the list).' },
  'find-coach.png': { act:'Player', title:'Find Coach directory',
    desc:"Every coach listed holds an active ₱499 subscription — that's the promise that each one is a real, paying professional, and it is the platform's only live revenue mechanism today.",
    where:'Home → <strong>Find Coach</strong> quick action.' },
  'coach-profile.png': { act:'Player', title:'Coach public profile',
    desc:'The redesigned Threads-style profile — specialty, hourly rate, verified check, and the entry point to book a session.',
    where:'Find Coach → tap a coach (e.g. Coach Mari).' },
  'book-coach-calendar.png': { act:'Player', title:'Book a session — calendar',
    desc:'The coach booking request: a real month-grid date picker, a start time, and a note on what to work on. Nothing is charged in-app — the player pays the coach once they accept. Whether the platform takes a commission is decision 3 (coach session payments).',
    where:'Coach profile → tap <strong>Book</strong>.' },
  'picklefeed.png': { act:'Player', title:'PickleFeed — global newsfeed',
    desc:'The Facebook-style feed from the task list: post, like, comment, repost, and share a game, open play or club as a tappable card. Authors can edit or delete their own posts.',
    where:'Bottom bar → <strong>Social</strong> → <strong>PickleFeed</strong> tab.' },
  'social-clubs.png': { act:'Player', title:'Social — Clubs',
    desc:'Clubs now sit inside Social rather than holding their own bottom-bar slot — the bar stays at five buttons.',
    where:'Social → <strong>Clubs</strong> tab.' },
  'social-friends.png': { act:'Player', title:'Social — Friends',
    desc:'Friends, pending requests and find-players, all inside Social. A waiting request shows as a live count on the Social tab instead of firing one notification that disappears.',
    where:'Social → <strong>Friends</strong> tab.' },
  'player-messages.png': { act:'Player', title:'Messages',
    desc:'Direct messages, venue conversations and booking threads split into tabs, each with its own unread counter.',
    where:'Home → chat icon (top right).' },

  'organizer-subscribe-999.png': { act:'Organizer', title:'Organizer subscription — ₱999 / 30 days',
    desc:'The licence to charge: only an active organizer subscriber can put a join fee on an Open Play — everyone else is fixed at ₱0. The organizer keeps 100% of the join fee; PickleBallers takes 7% on the court booking. Collecting that fee is still waiting on decision 1 (Open Play payment rules).',
    where:'Profile → the <strong>Organize</strong> / Become an organizer upsell.' },

  'coach-subscribe-499.png': { act:'Coach', title:'Become a coach — ₱499 / 30 days',
    desc:"The platform's live revenue model. Without an active subscription a coach is not listed in Find Coach and cannot take bookings. Price and duration are editable from admin settings with no app update.",
    where:'Home → <strong>Coach on PickleBallers</strong> card.' },

  'owner-home.png': { act:'Owner', title:'Owner home',
    desc:'The owner console landing — venues at a glance, bookings awaiting approval, and the shortcuts into daily operations.',
    where:'Sign in as an owner — you land here. (desktop console)' },
  'owner-manual-reservation.png': { act:'Owner', title:'Manual reservation',
    desc:"The answer to the meeting's biggest venue ask. Bookings that arrive by walk-in, phone, Messenger or Instagram are recorded here with customer, amount and payment method — they block the court and time on the calendar, and the server refuses a double-booking.",
    where:'Owner sidebar → <strong>Reservation</strong>.' },
  'owner-calendar.png': { act:'Owner', title:'Court calendar',
    desc:'One operational schedule per venue: app bookings, manually-entered reservations and maintenance blocks side by side, so a manual entry is identifiable and the grid cannot be double-booked.',
    where:'Owner sidebar → <strong>Calendar</strong>.' },
  'owner-pricing.png': { act:'Owner', title:'Pricing override',
    desc:'Variable, time-based pricing — paint peak, weekend, holiday and early-bird rates onto a weekly grid, plus maintenance blocks. These rules drive what a player is actually charged. Staff cannot reach this screen.',
    where:'Owner sidebar → <strong>Pricing</strong>.' },
  'owner-partners.png': { act:'Owner', title:'Partners — coach & organizer approvals',
    desc:'How a coach gets tagged to a venue: they apply, the owner approves or rejects, and approval grants a venue-scoped coach role. The screen also reports revenue attributed to partners.',
    where:'Owner sidebar → <strong>Partners</strong>.' },
  'owner-reports.png': { act:'Owner', title:'Reports',
    desc:'Owner-only financial and operational intelligence across all venues, with CSV and PDF export. A staff account navigating here is redirected away.',
    where:'Owner sidebar → <strong>Bookings / Reports</strong>.' },
  'owner-venues.png': { act:'Owner', title:'Venues',
    desc:'Every venue the owner runs, with “needs approval” badges. Staff inherit this whole list automatically — with no manual assignment — but the Delete option is hidden from them and blocked on the server.',
    where:'Owner sidebar → <strong>Venues</strong>.' },
  'owner-recurring-openplay.png': { act:'Owner', title:'Recurring Open Play — the series list',
    desc:'A recurring series is a template: pick the weekdays and how many weeks ahead, and the app generates one Open Play session per chosen day, automatically. This is no longer organizer-only — a venue owner (and their staff) can run a weekly session on their own courts. The live demo data already has one: “E2E Owner Weekly Open Play”, Tue + Thu, 6–8 PM, 16 spots, ₱300.',
    where:'Owner sidebar → <strong>Profile</strong> → the Recurring sessions / Open Play entry.' },
  'owner-recurring-new-series.png': { act:'Owner', title:'Recurring Open Play — new series form',
    desc:'The whole series in one form: title, venue, days of week, start/end time, capacity, price, weeks ahead, and level. “Create series” then generates every weekly session at once. Note the Price field — this is the one place in the app where an Open Play price can actually be set (the player-hosted path has no fee input at all). Nothing collects it yet.',
    where:'Recurring sessions → tap <strong>New series</strong> (the + button, top right).' },
  'owner-messages.png': { act:'Owner', title:'Shared venue inbox',
    desc:"Venue conversations carry the venue's name and photo instead of the owner's personal profile, and owner + staff share one inbox — so replies don't duplicate while the player's Seen status stays accurate.",
    where:'Owner sidebar → <strong>Messages</strong>.' },
};
const ORDER = Object.keys(MAP);
const files = existsSync(DIR) ? readdirSync(DIR).filter(f => f.endsWith('.png') && !f.startsWith('_')) : [];
files.sort((a,b)=>(ORDER.indexOf(a)+1||999)-(ORDER.indexOf(b)+1||999));
const shots = files.map(f => {
  const m = MAP[f] || { act:'Other', title:f.replace(/\.png$/,'').replace(/-/g,' '), desc:'', where:'' };
  return { ...m, src:`data:image/png;base64,${readFileSync(join(DIR,f)).toString('base64')}` };
});

const html = `<title>PickleBallers — Demo Screenshot Backup</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{--bg:#F5F7EF;--surface:#fff;--surface2:#EFF2E6;--stage:#E9EDDF;--ink:#161A10;--t2:#474D3B;--t3:#767C66;--bd:#E0E4D3;--accent:#3F6B1E;--lime:#B7E92F;--lime-ink:#3d5a06;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;--sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
@media (prefers-color-scheme:dark){:root{--bg:#0E1109;--surface:#161B0F;--surface2:#1D2314;--stage:#080A05;--ink:#ECEFE1;--t2:#B3BAA1;--t3:#828A6F;--bd:#2A3119;--accent:#9CCB5C;--lime-ink:#0E1109}}
:root[data-theme=light]{--bg:#F5F7EF;--surface:#fff;--surface2:#EFF2E6;--stage:#E9EDDF;--ink:#161A10;--t2:#474D3B;--t3:#767C66;--bd:#E0E4D3;--accent:#3F6B1E;--lime-ink:#3d5a06}
:root[data-theme=dark]{--bg:#0E1109;--surface:#161B0F;--surface2:#1D2314;--stage:#080A05;--ink:#ECEFE1;--t2:#B3BAA1;--t3:#828A6F;--bd:#2A3119;--accent:#9CCB5C;--lime-ink:#0E1109}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.5}
.wrap{max-width:1280px;margin:0 auto;padding:0 16px 64px}
header{padding:26px 0 14px;position:relative}
header::before{content:"";position:absolute;top:0;left:0;width:56px;height:4px;background:var(--lime);border-radius:0 0 3px 3px}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--t3)}
h1{margin:.35em 0 0;font-size:clamp(21px,3vw,28px);letter-spacing:-.02em}
.sub{color:var(--t2);margin-top:7px;font-size:14px;max-width:74ch}
.filters{display:flex;gap:7px;flex-wrap:wrap;margin:16px 0 12px}
.fbtn{font-family:var(--mono);font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;background:var(--surface);border:1px solid var(--bd);color:var(--t2);border-radius:999px;padding:6px 12px;cursor:pointer}
.fbtn[aria-pressed="true"]{background:var(--lime);border-color:var(--lime);color:var(--lime-ink)}
.fbtn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.stage{position:relative;background:var(--stage);border:1px solid var(--bd);border-radius:16px;display:flex;align-items:center;justify-content:center;padding:14px;min-height:54vh;overflow:hidden}
.stage.zoom{overflow:auto;justify-content:flex-start;align-items:flex-start}
.stage img{max-height:72vh;max-width:100%;width:auto;height:auto;display:block;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.22);background:#fff}
.stage.zoom img{max-height:none;max-width:none;border-radius:4px}
.nav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;background:var(--surface);border:1px solid var(--bd);color:var(--ink);font-size:19px;cursor:pointer;display:grid;place-items:center;box-shadow:0 3px 14px rgba(0,0,0,.18);z-index:2}
.nav:hover{background:var(--lime);border-color:var(--lime);color:var(--lime-ink)}
.nav:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.nav.prev{left:12px}.nav.next{right:12px}
.stage.zoom .nav{position:sticky;top:50%}
.cap{display:flex;align-items:center;gap:11px;margin:13px 2px 0;flex-wrap:wrap}
.chip{font-family:var(--mono);font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;background:var(--lime);color:var(--lime-ink);border-radius:6px;padding:3px 9px;flex:none}
.title{font-size:17px;font-weight:800;letter-spacing:-.015em;color:var(--ink);flex:1;min-width:200px}
.count{font-family:var(--mono);font-size:12.5px;color:var(--t3);font-variant-numeric:tabular-nums;flex:none}
.zbtn{font-family:var(--mono);font-size:11px;font-weight:700;background:var(--surface);border:1px solid var(--bd);color:var(--t2);border-radius:8px;padding:5px 10px;cursor:pointer;flex:none}
.zbtn[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}
:root[data-theme=dark] .zbtn[aria-pressed="true"]{color:#0E1109}
.info{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:11px}
.desc{margin:0;font-size:14px;line-height:1.6;color:var(--t2);background:var(--surface);border:1px solid var(--bd);border-radius:12px;padding:13px 15px}
.desc::before{content:"What it's for";display:block;font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--t3);margin-bottom:6px}
.where{margin:0;font-size:14px;line-height:1.6;color:var(--ink);background:var(--surface2);border:1px solid var(--bd);border-left:3px solid var(--accent);border-radius:12px;padding:13px 15px}
.where::before{content:"▸ Where to find it";display:block;font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin-bottom:6px}
.where code{font-family:var(--mono);font-size:12.5px;background:var(--bg);border:1px solid var(--bd);border-radius:5px;padding:1px 6px;color:var(--t2);white-space:nowrap}
.where strong{color:var(--ink);font-weight:750}
.thumbs{display:flex;gap:8px;overflow-x:auto;padding:14px 2px 6px;scrollbar-width:thin}
.thumb{flex:none;width:72px;height:72px;border-radius:9px;overflow:hidden;border:2px solid transparent;background:var(--surface);cursor:pointer;padding:0;display:grid;place-items:center}
.thumb img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.thumb[aria-current="true"]{border-color:var(--lime);box-shadow:0 0 0 2px var(--lime)}
.thumb:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.note{margin-top:20px;padding:13px 15px;border:1px dashed var(--bd);border-radius:12px;color:var(--t3);font-size:12.5px;line-height:1.55}
.note b{color:var(--t2);font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase}
.hint{margin-top:8px;font-family:var(--mono);font-size:11px;color:var(--t3)}
.toggle{position:fixed;top:12px;right:12px;background:var(--surface);border:1px solid var(--bd);color:var(--t2);border-radius:9px;padding:6px 10px;font-size:12px;font-family:var(--mono);cursor:pointer;z-index:5}
@media (max-width:820px){ .info{grid-template-columns:1fr} }
@media (max-width:640px){ .nav{width:38px;height:38px;font-size:16px} .stage{min-height:42vh} .stage img{max-height:58vh} }
</style>
<button class="toggle" onclick="var r=document.documentElement,c=r.getAttribute('data-theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');r.setAttribute('data-theme',c==='dark'?'light':'dark')">◐ theme</button>
<div class="wrap">
  <header>
    <div class="eyebrow">🥒 PickleBallers · Demo backup</div>
    <h1>Screenshot backup deck</h1>
    <p class="sub">Real captures from the live app on 16 Jul 2026, in demo order. Each screen says what it's for and exactly where to find it. Use ← → to move, click a thumbnail to jump, or hit <strong>Actual size</strong> to inspect detail.</p>
  </header>
  <div class="filters" id="filters"></div>
  <div class="stage" id="stage">
    <button class="nav prev" id="prev" aria-label="Previous screenshot">‹</button>
    <img id="main" alt="">
    <button class="nav next" id="next" aria-label="Next screenshot">›</button>
  </div>
  <div class="cap">
    <span class="chip" id="chip"></span>
    <span class="title" id="title"></span>
    <button class="zbtn" id="zoom" aria-pressed="false">⤢ Actual size</button>
    <span class="count" id="count"></span>
  </div>
  <div class="info">
    <p class="desc" id="desc"></p>
    <p class="where" id="where"></p>
  </div>
  <div class="thumbs" id="thumbs"></div>
  <div class="hint">← → arrows to navigate · Home/End to jump</div>
  <div class="note"><b>Not in this deck (preview limitation)</b> &nbsp;Two consoles can't be logged into on the live preview: the <em>Staff</em> console and the organizer <em>console</em> (recurring Open Play series). No demo account carries a staff or organizer role — staff accounts are created by an owner, and the seeded logins are player/owner only. Both are documented with real screenshots in the 8 Jul minutes (Staff = p14 &amp; p16; organizer series = p13). <b style="color:var(--accent)">Before the live demo, create one staff account (Owner console → Staff) to show Act 5.</b></div>
</div>
<script>
const SHOTS = ${JSON.stringify(shots)};
const ACTS = [...new Set(SHOTS.map(s=>s.act))];
let filter='All', view=SHOTS.slice(), i=0;
const $ = id => document.getElementById(id);
const main=$('main'), chip=$('chip'), title=$('title'), desc=$('desc'), where=$('where'), count=$('count'), thumbs=$('thumbs'), stage=$('stage');
function buildFilters(){
  const f=$('filters');
  ['All',...ACTS].forEach(a=>{
    const b=document.createElement('button');
    b.className='fbtn';
    b.textContent = a==='All' ? \`All (\${SHOTS.length})\` : \`\${a} (\${SHOTS.filter(s=>s.act===a).length})\`;
    b.setAttribute('aria-pressed', String(a===filter));
    b.onclick=()=>{ filter=a; view = a==='All'?SHOTS.slice():SHOTS.filter(s=>s.act===a); i=0;
      [...f.children].forEach(c=>c.setAttribute('aria-pressed','false')); b.setAttribute('aria-pressed','true');
      buildThumbs(); render(); };
    f.appendChild(b);
  });
}
function buildThumbs(){
  thumbs.innerHTML='';
  view.forEach((s,n)=>{
    const b=document.createElement('button');
    b.className='thumb'; b.title=s.title; b.setAttribute('aria-label',s.title);
    b.innerHTML=\`<img src="\${s.src}" alt="">\`;
    b.onclick=()=>{ i=n; render(); };
    thumbs.appendChild(b);
  });
}
function render(){
  const s=view[i]; if(!s) return;
  main.src=s.src; main.alt=s.title;
  chip.textContent=s.act; title.textContent=s.title;
  desc.innerHTML=s.desc || '—';
  where.innerHTML=s.where || '—';
  count.textContent=\`\${i+1} / \${view.length}\`;
  [...thumbs.children].forEach((t,n)=>t.setAttribute('aria-current', String(n===i)));
  const a=thumbs.children[i]; if(a) a.scrollIntoView({block:'nearest',inline:'nearest'});
  stage.scrollTop=0; stage.scrollLeft=0;
}
const go = d => { i=(i+d+view.length)%view.length; render(); };
$('prev').onclick=()=>go(-1); $('next').onclick=()=>go(1);
$('zoom').onclick=e=>{ const on=stage.classList.toggle('zoom'); e.currentTarget.setAttribute('aria-pressed',String(on)); };
addEventListener('keydown',e=>{
  if(e.key==='ArrowLeft')go(-1); else if(e.key==='ArrowRight')go(1);
  else if(e.key==='Home'){i=0;render();} else if(e.key==='End'){i=view.length-1;render();}
});
buildFilters(); buildThumbs(); render();
</script>`;
writeFileSync(OUT, html);
console.log(`Gallery: ${OUT}\n${shots.length} shots · all have title + desc + where: ${shots.every(s=>s.desc&&s.where)}`);
