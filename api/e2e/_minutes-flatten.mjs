/** Flatten each figure (screenshot + SVG annotation overlay) into a single PNG,
 *  so the DOCX/Google Docs version keeps the annotations without needing HTML. */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const SRC='file:///var/public/pickleplay/docs/minutes-2026-07-08-visual.html';
const OUT='/var/public/pickleplay/docs/minutes-assets/flat';
mkdirSync(OUT,{recursive:true});
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1400,height:1000},deviceScaleFactor:2});
await p.goto(SRC,{waitUntil:'networkidle'});
await p.evaluate(()=>document.fonts.ready);
await p.waitForTimeout(1200);
const shots=await p.locator('.shot').all();
// Index-prefixed: the same screenshot can appear twice with DIFFERENT annotations
// (e.g. m02-discover in 3.4 and 4.4), so names must be unique per figure.
const names=await p.evaluate(()=>[...document.querySelectorAll('.shot')].map((el,i)=>{
  const img=el.querySelector('img');
  const base=img ? img.getAttribute('src').split('/').pop().replace('.png','') : 'diagram';
  return String(i).padStart(2,'0')+'-'+base;
}));
for(let i=0;i<shots.length;i++){
  await shots[i].screenshot({path:`${OUT}/${names[i]}.png`});
  console.log('flattened', names[i]);
}
await b.close();
