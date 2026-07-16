import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const DIR = '/var/public/pickleplay/reports/2026-07-16-demo-shots';
const OUT = '/var/public/pickleplay/reports/2026-07-16-screenshot-gallery.html';

const MAP = {
  'player-home.png':             { act:'Player', cap:'Player home — Play / Book Court / Find Coach, Friends rail, Social badge' },
  'play-discover.png':           { act:'Player', cap:'Play Discover — ranked cards: venue, skill, distance, price, host, spots' },
  'play-discover-sort.png':      { act:'Player', cap:'Sort — Relevance / Start time / Distance / Spots left / Recently added' },
  'play-discover-filter.png':    { act:'Player', cap:'Filter — skill, Who can play (gender), venue, date, distance, type, cost' },
  'find-coach.png':              { act:'Player', cap:'Find Coach — only active-subscription coaches (verified)' },
  'coach-profile.png':           { act:'Player', cap:'Coach public profile — Coach Mari' },
  'book-coach-calendar.png':     { act:'Player', cap:'Book a session — real calendar date picker' },
  'picklefeed.png':              { act:'Player', cap:'PickleFeed — post, like, comment, repost, share' },
  'social-clubs.png':            { act:'Player', cap:'Social — Clubs sub-tab' },
  'social-friends.png':          { act:'Player', cap:'Social — Friends (add / requests / find)' },
  'player-messages.png':         { act:'Player', cap:'Messages — Direct / Venues / Bookings tabs' },
  'organizer-subscribe-999.png': { act:'Organizer', cap:'Organizer subscription — ₱999 / 30 days (the licence to charge)' },
  'coach-subscribe-499.png':     { act:'Coach', cap:'Become a coach — ₱499 / 30 days subscription' },
  'owner-home.png':              { act:'Owner', cap:'Owner home — venues overview & approvals' },
  'owner-manual-reservation.png':{ act:'Owner', cap:'Manual reservation — walk-in / phone / Messenger, blocks the slot' },
  'owner-calendar.png':          { act:'Owner', cap:'Court calendar — manual & blocked slots held' },
  'owner-pricing.png':           { act:'Owner', cap:'Pricing override — variable time-based pricing grid' },
  'owner-partners.png':          { act:'Owner', cap:'Partners — approve / reject coaches & organizers' },
  'owner-reports.png':           { act:'Owner', cap:'Reports — owner-only financial dashboard' },
  'owner-venues.png':            { act:'Owner', cap:'Venues — all owned venues' },
  'owner-messages.png':          { act:'Owner', cap:'Shared venue inbox — venue name & photo' },
};
const ORDER = Object.keys(MAP);
const files = existsSync(DIR) ? readdirSync(DIR).filter(f => f.endsWith('.png') && !f.startsWith('_')) : [];
files.sort((a,b)=>(ORDER.indexOf(a)+1||999)-(ORDER.indexOf(b)+1||999));
const shots = files.map(f => {
  const m = MAP[f] || { act:'Other', cap:f.replace(/\.png$/,'').replace(/-/g,' ') };
  return { act:m.act, cap:m.cap, src:`data:image/png;base64,${readFileSync(join(DIR,f)).toString('base64')}` };
});

const html = `<title>PickleBallers — Demo Screenshot Backup</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{--bg:#F5F7EF;--surface:#fff;--stage:#E9EDDF;--ink:#161A10;--t2:#474D3B;--t3:#767C66;--bd:#E0E4D3;--accent:#3F6B1E;--lime:#B7E92F;--lime-ink:#3d5a06;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;--sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
@media (prefers-color-scheme:dark){:root{--bg:#0E1109;--surface:#161B0F;--stage:#080A05;--ink:#ECEFE1;--t2:#B3BAA1;--t3:#828A6F;--bd:#2A3119;--accent:#9CCB5C;--lime-ink:#0E1109}}
:root[data-theme=light]{--bg:#F5F7EF;--surface:#fff;--stage:#E9EDDF;--ink:#161A10;--t2:#474D3B;--t3:#767C66;--bd:#E0E4D3;--accent:#3F6B1E;--lime-ink:#3d5a06}
:root[data-theme=dark]{--bg:#0E1109;--surface:#161B0F;--stage:#080A05;--ink:#ECEFE1;--t2:#B3BAA1;--t3:#828A6F;--bd:#2A3119;--accent:#9CCB5C;--lime-ink:#0E1109}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.5}
.wrap{max-width:1280px;margin:0 auto;padding:0 16px 64px}
header{padding:26px 0 14px;position:relative}
header::before{content:"";position:absolute;top:0;left:0;width:56px;height:4px;background:var(--lime);border-radius:0 0 3px 3px}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--t3)}
h1{margin:.35em 0 0;font-size:clamp(21px,3vw,28px);letter-spacing:-.02em}
.sub{color:var(--t2);margin-top:7px;font-size:14px;max-width:72ch}

/* filters */
.filters{display:flex;gap:7px;flex-wrap:wrap;margin:16px 0 12px}
.fbtn{font-family:var(--mono);font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
  background:var(--surface);border:1px solid var(--bd);color:var(--t2);border-radius:999px;padding:6px 12px;cursor:pointer}
.fbtn[aria-pressed="true"]{background:var(--lime);border-color:var(--lime);color:var(--lime-ink)}
.fbtn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* stage */
.stage{position:relative;background:var(--stage);border:1px solid var(--bd);border-radius:16px;
  display:flex;align-items:center;justify-content:center;padding:14px;min-height:56vh;overflow:hidden}
.stage.zoom{overflow:auto;justify-content:flex-start;align-items:flex-start}
.stage img{max-height:76vh;max-width:100%;width:auto;height:auto;display:block;border-radius:8px;
  box-shadow:0 8px 30px rgba(0,0,0,.22);background:#fff}
.stage.zoom img{max-height:none;max-width:none;border-radius:4px}
.nav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;
  background:var(--surface);border:1px solid var(--bd);color:var(--ink);font-size:19px;cursor:pointer;
  display:grid;place-items:center;box-shadow:0 3px 14px rgba(0,0,0,.18);z-index:2}
.nav:hover{background:var(--lime);border-color:var(--lime);color:var(--lime-ink)}
.nav:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.nav.prev{left:12px}.nav.next{right:12px}
.stage.zoom .nav{position:sticky;top:50%}

/* caption bar */
.cap{display:flex;align-items:center;gap:12px;margin:12px 2px 0;flex-wrap:wrap}
.chip{font-family:var(--mono);font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
  background:var(--lime);color:var(--lime-ink);border-radius:6px;padding:3px 9px;flex:none}
.captext{font-size:14.5px;font-weight:600;color:var(--ink);flex:1;min-width:200px}
.count{font-family:var(--mono);font-size:12.5px;color:var(--t3);font-variant-numeric:tabular-nums;flex:none}
.zbtn{font-family:var(--mono);font-size:11px;font-weight:700;background:var(--surface);border:1px solid var(--bd);
  color:var(--t2);border-radius:8px;padding:5px 10px;cursor:pointer;flex:none}
.zbtn[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}
:root[data-theme=dark] .zbtn[aria-pressed="true"]{color:#0E1109}
.zbtn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* thumbs */
.thumbs{display:flex;gap:8px;overflow-x:auto;padding:14px 2px 6px;scrollbar-width:thin}
.thumb{flex:none;width:74px;height:74px;border-radius:9px;overflow:hidden;border:2px solid transparent;
  background:var(--surface);cursor:pointer;padding:0;display:grid;place-items:center}
.thumb img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.thumb[aria-current="true"]{border-color:var(--lime);box-shadow:0 0 0 2px var(--lime)}
.thumb:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

.note{margin-top:22px;padding:13px 15px;border:1px dashed var(--bd);border-radius:12px;color:var(--t3);font-size:12.5px;line-height:1.55}
.note b{color:var(--t2);font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase}
.hint{margin-top:8px;font-family:var(--mono);font-size:11px;color:var(--t3)}
.toggle{position:fixed;top:12px;right:12px;background:var(--surface);border:1px solid var(--bd);color:var(--t2);
  border-radius:9px;padding:6px 10px;font-size:12px;font-family:var(--mono);cursor:pointer;z-index:5}
@media (max-width:640px){ .nav{width:38px;height:38px;font-size:16px} .stage{min-height:44vh} .stage img{max-height:62vh} }
</style>
<button class="toggle" onclick="var r=document.documentElement,c=r.getAttribute('data-theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');r.setAttribute('data-theme',c==='dark'?'light':'dark')">◐ theme</button>
<div class="wrap">
  <header>
    <div class="eyebrow">🥒 PickleBallers · Demo backup</div>
    <h1>Screenshot backup deck</h1>
    <p class="sub">Real captures from the live app on 16 Jul 2026, in demo order. Use ← → to move, click a thumbnail to jump, or hit <strong>Actual size</strong> to inspect detail.</p>
  </header>

  <div class="filters" id="filters"></div>

  <div class="stage" id="stage">
    <button class="nav prev" id="prev" aria-label="Previous screenshot">‹</button>
    <img id="main" alt="">
    <button class="nav next" id="next" aria-label="Next screenshot">›</button>
  </div>

  <div class="cap">
    <span class="chip" id="chip"></span>
    <span class="captext" id="captext"></span>
    <button class="zbtn" id="zoom" aria-pressed="false">⤢ Actual size</button>
    <span class="count" id="count"></span>
  </div>

  <div class="thumbs" id="thumbs"></div>
  <div class="hint">← → arrows to navigate · Home/End to jump</div>

  <div class="note"><b>Not in this deck (preview limitation)</b> &nbsp;Two consoles can't be logged into on the live preview: the <em>Staff</em> console and the organizer <em>console</em> (recurring Open Play series). No demo account carries a staff or organizer role — staff accounts are created by an owner, and the seeded logins are player/owner only. Both are documented with real screenshots in the 8 Jul minutes (Staff = p14 &amp; p16; organizer series = p13). <b style="color:var(--accent)">Before the live demo, create one staff account (Owner console → Staff) to show Act 5.</b></div>
</div>
<script>
const SHOTS = ${JSON.stringify(shots)};
const ACTS = [...new Set(SHOTS.map(s=>s.act))];
let filter = 'All', view = SHOTS.slice(), i = 0;

const $ = id => document.getElementById(id);
const main=$('main'), chip=$('chip'), captext=$('captext'), count=$('count'), thumbs=$('thumbs'), stage=$('stage');

function buildFilters(){
  const f=$('filters');
  ['All',...ACTS].forEach(a=>{
    const b=document.createElement('button');
    b.className='fbtn'; b.textContent = a==='All' ? \`All (\${SHOTS.length})\` : \`\${a} (\${SHOTS.filter(s=>s.act===a).length})\`;
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
    b.className='thumb'; b.title=s.cap; b.setAttribute('aria-label',s.cap);
    b.innerHTML=\`<img src="\${s.src}" alt="">\`;
    b.onclick=()=>{ i=n; render(); };
    thumbs.appendChild(b);
  });
}
function render(){
  const s=view[i]; if(!s) return;
  main.src=s.src; main.alt=s.cap;
  chip.textContent=s.act; captext.textContent=s.cap;
  count.textContent=\`\${i+1} / \${view.length}\`;
  [...thumbs.children].forEach((t,n)=>t.setAttribute('aria-current', String(n===i)));
  const active=thumbs.children[i]; if(active) active.scrollIntoView({block:'nearest',inline:'nearest'});
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
console.log(`Carousel gallery: ${OUT}\n${shots.length} shots · acts: ${[...new Set(shots.map(s=>s.act))].join(', ')}`);
