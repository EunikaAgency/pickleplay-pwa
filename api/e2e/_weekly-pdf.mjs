import { chromium } from '@playwright/test';
const SRC='file:///var/public/pickleplay/docs/weekly-2026-07-16.html';
const OUT='/var/public/pickleplay/docs/PickleBallers_Weekly_Progress_Update_July_16_2026_Visual.pdf';
const b=await chromium.launch();
const p=await b.newPage();
await p.goto(SRC,{waitUntil:'networkidle'});
await p.evaluate(()=>document.fonts.ready);
await p.waitForTimeout(1500);
const head=`<div style="width:100%;font-family:'Nunito Sans',sans-serif;font-size:7pt;color:#6B8C2A;
  padding:0 16mm;text-align:right;letter-spacing:.06em;font-weight:700;">
  PICKLEBALLERS &nbsp;|&nbsp; WEEKLY PROGRESS UPDATE &nbsp;•&nbsp; 9–16 JULY 2026</div>`;
const foot=`<div style="width:100%;font-family:'Nunito Sans',sans-serif;font-size:7pt;color:#8A9A7A;
  padding:0 16mm;display:flex;justify-content:space-between;">
  <span>PickleBallers — Weekly Progress Update</span>
  <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
await p.pdf({path:OUT,format:'A4',printBackground:true,displayHeaderFooter:true,
  headerTemplate:head,footerTemplate:foot,
  margin:{top:'20mm',bottom:'18mm',left:'16mm',right:'16mm'}});
await b.close();
console.log('PDF →',OUT);
