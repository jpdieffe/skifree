import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from '../scripts/serve.mjs';
const server=process.env.SKIFREE_URL?null:createServer(4199),base=process.env.SKIFREE_URL||'http://127.0.0.1:4199/',browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
await mkdir('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'?debug');await page.locator('#waves').click();await page.waitForFunction(()=>ski.state?.mode==='waves');
 assert.equal(await page.locator('#arsenal button').count(),6);assert(!await page.locator('#controls').isVisible());
 await page.waitForFunction(()=>ski.state.unlocked[1]);assert.equal(await page.evaluate(()=>ski.world.weapon),1);
 await page.keyboard.press('Digit6');assert.equal(await page.evaluate(()=>ski.world.weapon),1,'locked weapons stay locked');
 await page.evaluate(()=>{ski.world.entities=[];ski.world.generate=()=>{};ski.world.spawnAt=1e9;ski.world.supplyAt=1e9;});
 const box=await page.locator('#slope').boundingBox(),target={x:box.x+box.width/2+200,y:box.y+box.height*.44-100};
 await page.mouse.move(target.x,target.y);
 await page.evaluate(({x,y})=>{const v=ski.view,r=v.canvas.getBoundingClientRect(),aim=v.screenToWorld(x-r.left,y-r.top);ski.world.spawn('yeti',aim.x,aim.y+18,{level:1});},target);
 await page.mouse.down();await page.waitForFunction(()=>ski.world.kills>0);await page.keyboard.down('ArrowRight');
 await page.waitForFunction(()=>ski.world.events.filter(e=>e.type==='shot').length>=5&&ski.world.players[0].x>10);await page.keyboard.up('ArrowRight');await page.mouse.up();
 const firing=await page.evaluate(()=>({x:ski.world.players[0].x,shots:ski.world.events.filter(e=>e.type==='shot').length,bullets:ski.world.projectiles.map(b=>({vx:b.vx,vy:b.vy})),aim:ski.world.gunner,v:ski.view.screenToWorld(840,ski.view.canvas.clientHeight*.44-100)}));
 assert(firing.x>5,'keyboard skier moves while mouse gunner fires');assert(firing.bullets.every(b=>b.vx>0&&b.vy<0),'aim up/right produces up/right shots');
 await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>ski.world.events.filter(e=>e.type==='shot').length),firing.shots,'mouse up stops fire');
 assert(Math.abs(firing.aim.x-firing.v.x)<5&&Math.abs(firing.aim.y-firing.v.y)<5,'aim uses current camera coordinates');
 await page.evaluate(()=>{window.reticles=[];const ctx=ski.view.ctx,arc=ctx.arc;ctx.arc=function(x,y,r,...args){if(r===9&&reticles.length<45){const m=this.getTransform();reticles.push({x:m.a*x+m.e,y:m.d*y+m.f});}return arc.call(this,x,y,r,...args);};});
 await page.keyboard.down('ArrowDown');await page.waitForFunction(()=>reticles.length===45);await page.keyboard.up('ArrowDown');
 const reticles=await page.evaluate(()=>reticles);assert(reticles.every(p=>Math.abs(p.x-reticles[0].x)<.001&&Math.abs(p.y-reticles[0].y)<.001),'mouse reticle stays steady to within .001 pixels during downhill movement');
 for(let slot=2;slot<6;slot++){
  await page.evaluate(slot=>{const w=ski.world,p=w.players[0];w.pickups.push({id:100+slot,slot,x:p.x,y:p.y+1,time:w.time});},slot);
  await page.waitForFunction(slot=>ski.world.unlocked[slot],slot);
  await page.keyboard.press('Digit1');await page.keyboard.press('Digit'+(slot+1));assert.equal(await page.evaluate(()=>ski.world.weapon),slot);
  await page.mouse.down();await page.waitForFunction(slot=>ski.world.events.some(e=>e.type==='shot'&&e.weapon===slot),slot);await page.mouse.up();
 }
 await page.locator('#menu-toggle').click();const t=await page.evaluate(()=>ski.world.time);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>ski.world.time),t,'options pause the wave mode');
 await page.locator('#menu-toggle').click();await page.waitForFunction(t=>ski.world.time>t,t);
 await page.setViewportSize({width:1000,height:760});await page.waitForTimeout(100);
 assert(await page.evaluate(()=>document.querySelector('#arsenal').getBoundingClientRect().right<innerWidth));
 await page.evaluate(()=>{
  const w=ski.world,p=w.players[0];w.plan={...w.plan,name:'Monster Mountain',stage:9,wave:3};w.breatherUntil=0;
  for(let i=0;i<15;i++)w.spawn('yeti',p.x-350+(i%5)*150,p.y-200+Math.floor(i/5)*220,{level:i%5+1});
  w.step=()=>{};
 });
 await page.waitForTimeout(120);await page.screenshot({path:'test-results/yeti-onslaught-desktop.png'});
 await page.locator('#menu-toggle').click();await page.locator('#restart').click();await page.waitForFunction(()=>ski.world.run===2);
 assert.deepEqual(await page.evaluate(()=>ski.world.unlocked),[true,false,false,false,false,false]);
 await page.evaluate(()=>{
  const w=ski.world,p=w.players[0],e=w.spawn('yeti',p.x,p.y-10,{level:1});
  window.eatingFrames=[];const draw=ski.view.art.draw;ski.view.art.draw=function(c,id,...args){if(id>=76&&id<=81)eatingFrames.push(id);return draw.call(this,c,id,...args);};w.catchPlayer(p,e);
 });
 await page.waitForTimeout(1100);assert(!await page.locator('#overlay').isVisible(),'retry must not cover eating animation');await page.screenshot({path:'test-results/yeti-eating.png'});
 await page.waitForFunction(()=>new Set(eatingFrames).size===6);assert(!await page.locator('#overlay').isVisible());
 await page.waitForFunction(()=>!document.querySelector('#overlay').hidden);assert.match(await page.locator('#overlay-title').textContent(),/yeti got you/i);
 await page.locator('#overlay-action').click();await page.waitForFunction(()=>ski.world.run===3);assert(!await page.locator('#overlay').isVisible());
 await page.locator('#menu-toggle').click();await page.locator('#leave').click();await page.locator('#solo').click();await page.waitForFunction(()=>ski.state.mode==='solo');
 await page.evaluate(()=>{const w=ski.world,p=w.players[0],e=w.spawn('yeti',p.x,p.y-10,{level:1});eatingFrames.length=0;w.catchPlayer(p,e);});
 await page.waitForFunction(()=>new Set(eatingFrames).size===6);assert(!await page.locator('#overlay').isVisible(),'solo also shows the full original sequence');
 const phone=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});phone.on('pageerror',e=>errors.push(e.message));await phone.goto(base);await phone.waitForFunction(()=>!document.querySelector('#solo').disabled);
 assert(await phone.locator('#waves').isDisabled());assert.match(await phone.locator('#waves-help').textContent(),/keyboard and mouse/);
 assert.deepEqual(errors,[]);console.log('PASS: desktop co-op controls, six weapons, pickups, pause, resize, restart, original eating frames, solo capture and phone gating.');
}finally{await browser.close();server?.close();}
