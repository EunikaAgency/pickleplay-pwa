import { chromium } from '@playwright/test';
const APP='http://localhost:9000', API='http://localhost:9002';
const OUT='/var/public/pickleplay/docs/weekly-assets';
const tok=async(c)=>{const r=await fetch(`${API}/api/v1/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)});const j=await r.json();if(!j.data)throw new Error(JSON.stringify(j));return j.data.accessToken;};
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const p=await ctx.newPage();
const t=await tok({email:'84a3be4a.hernandez@example.com',password:'password123'});
await p.goto(APP);
await p.evaluate(k=>{localStorage.setItem('pb-access-token',k);localStorage.setItem('pb-refresh-token',k);sessionStorage.setItem('pb-splash-seen','1');},t);
await p.goto(`${APP}/messages`);
await p.reload();                       // let restore() pick the token up
await p.waitForTimeout(3800);
await p.addStyleTag({content:'.install-prompt,.pwa-toast{display:none!important}'});
await p.screenshot({path:`${OUT}/p12-messages.png`});
console.log((await p.locator('body').innerText()).replace(/\s+/g,' ').slice(0,220));
await b.close();
