import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from '../scripts/serve.mjs';
const server=createServer(4198),browser=await chromium.launch({channel:'chrome',headless:true});
await mkdir('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4198/?debug');await page.locator('#solo').click();await page.waitForFunction(()=>ski.state?.time>1);
 // Arrange a render inspection without letting the bosses eat the stationary skier.
 await page.evaluate(()=>{
  const w=ski.world;w.step=()=>{};w.phase='yeti';w.time=8;w.entities=[];w.events=[];w.players[0].x=0;w.players[0].y=1000;w.ball.x=100;w.ball.y=1070;
  for(let level=1;level<=5;level++)w.spawn('yeti',-310+(level-1)*180,950,{level});
 });
 await page.waitForTimeout(500);await page.screenshot({path:'test-results/yeti-lineup.png'});
 assert.equal(await page.evaluate(()=>ski.state.entities.filter(e=>e.kind==='yeti').length),5);
 assert.equal(await page.evaluate(()=>ski.view.art.tints.size),4,'each special variant has its own recolored original sprite');
 await page.setViewportSize({width:393,height:852});await page.locator('#menu-toggle').click();await page.locator('#touch').check();await page.locator('#menu-toggle').click();
 for(let level=1;level<=5;level++){
  await page.evaluate(level=>{const w=ski.world;w.entities=[];w.spawn('yeti',-70,990,{level});},level);await page.waitForTimeout(150);
  assert((await page.locator('#encounter').textContent()).includes(`LEVEL ${level}`));
  await page.screenshot({path:`test-results/yeti-phone-${level}.png`});
 }
 assert.deepEqual(errors,[]);console.log('PASS all five Yeti appearances, health labels, and phone rendering.');
}finally{await browser.close();server.close();}
