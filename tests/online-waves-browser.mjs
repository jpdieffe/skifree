import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from '../scripts/serve.mjs';
const server=process.env.SKIFREE_URL?null:createServer(4201),base=process.env.SKIFREE_URL||'http://127.0.0.1:4201/';
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
await mkdir('test-results',{recursive:true});
try{
 const pages=await Promise.all([1,2].map(async()=>{const c=await browser.newContext({...devices['Pixel 7'],viewport:{width:393,height:852},deviceScaleFactor:1});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return p;}));
 const [host,guest]=pages;
 const touch=async(page,selector,dx,dy)=>{
  const cdp=await page.context().newCDPSession(page),b=await page.locator(selector).boundingBox();
  const x=b.x+b.width/2+dx,y=b.y+b.height/2+dy;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  return async()=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();};
 };
 await host.goto(base+'?debug');await host.locator('#online-waves').click();
 await host.waitForFunction(()=>ski.room?.peer?.open,null,{timeout:35000});const code=await host.evaluate(()=>ski.room.code);
 await guest.goto(base+'?debug#room='+code);await guest.locator('#join').click();
 await guest.waitForFunction(()=>ski.state?.mode==='waves'&&ski.state.time>0,null,{timeout:40000});
 await host.evaluate(()=>{const w=ski.world;w.entities=[];w.generate=()=>{};w.spawnAt=1e9;w.supplyAt=1e9;});
 assert.match(await host.locator('#mode').textContent(),/SKIER/);assert.match(await guest.locator('#mode').textContent(),/GUNNER/);
 assert(await host.locator('#controls').isVisible());assert(!await guest.locator('#controls').isVisible());assert(await guest.locator('#gunner-controls').isVisible());
 assert.equal(await guest.evaluate(()=>ski.world),null);assert.equal(await guest.evaluate(()=>ski.state.players.length),1);
 console.log('PASS: public room negotiation assigns phone skier and phone gunner.');
 const endSki=await touch(host,'#pad',40,0),endFire=await touch(guest,'#aim-pad',32,-25);
 await host.waitForFunction(()=>ski.world.players[0].x>15&&ski.world.projectiles.length>0);
 assert(await host.evaluate(()=>ski.world.projectiles.every(b=>b.vx>0&&b.vy<0)));
 await guest.waitForFunction(()=>ski.state.projectiles.length>0);
 await endSki();await endFire();await host.waitForFunction(()=>!ski.world.gunner.fire);
 const shots=await host.evaluate(()=>ski.world.nextProjectile);await host.waitForTimeout(400);assert.equal(await host.evaluate(()=>ski.world.nextProjectile),shots);
 // Malformed or wrong-role input must not control the skier or crash the renderer.
 await guest.evaluate(()=>ski.room.send({type:'input',seq:999999,x:1,y:0,brake:false,boost:false,jump:false}));
 await host.evaluate(()=>{const w=ski.world,p=w.players[0];w.pickups.push({id:200,slot:5,x:p.x,y:p.y+1,time:w.time});});
 await guest.waitForFunction(()=>ski.state.unlocked[5]&&ski.state.weapon===5);
 await guest.locator('#arsenal button').nth(0).tap();await host.waitForFunction(()=>ski.world.weapon===0);
 await guest.locator('#arsenal button').nth(5).tap();await host.waitForFunction(()=>ski.world.weapon===5);
 const stop=await touch(guest,'#aim-pad',35,0);await host.waitForFunction(()=>ski.world.gunner.fire);
 await guest.locator('#menu-toggle').tap();await host.waitForFunction(()=>ski.paused());
 const t=await host.evaluate(()=>ski.world.time);await host.waitForTimeout(250);assert.equal(await host.evaluate(()=>ski.world.time),t);
 await stop();await guest.locator('#menu-toggle').tap();await host.waitForFunction(()=>!ski.paused()&&ski.world.time>0);
 assert(!await host.evaluate(()=>ski.world.gunner.fire));
 await host.locator('#menu-toggle').tap();await guest.waitForFunction(()=>ski.state.paused);
 await host.locator('#menu-toggle').tap();await guest.waitForFunction(()=>!ski.state.paused);
 const stopStale=await touch(guest,'#aim-pad',35,0);await host.waitForFunction(()=>ski.world.gunner.fire);
 await guest.evaluate(()=>{window.savedInput=ski.room.input;ski.room.input=()=>{};});
 await host.waitForFunction(()=>!ski.world.gunner.fire);await stopStale();
 await guest.evaluate(()=>{ski.room.input=savedInput;Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 await host.waitForFunction(()=>ski.paused());
 await guest.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
 await host.waitForFunction(()=>!ski.paused());
 console.log('PASS: simultaneous touch steering/firing, synchronized weapons, release and either-phone pause.');
 await host.evaluate(()=>{const w=ski.world,p=w.players[0];w.breatherUntil=0;w.spawn('yeti',p.x-110,p.y-70,{level:2,hp:4,maxHp:4});w.spawn('yeti',p.x+120,p.y+130,{level:5,hp:8,maxHp:8});w.step=()=>{};});
 await guest.waitForFunction(()=>ski.state.entities.some(e=>e.kind==='yeti'));
 for(const p of pages){
  await p.screenshot({path:`test-results/online-${p===host?'skier':'gunner'}-portrait.png`});
  await p.setViewportSize({width:852,height:393});await p.waitForTimeout(100);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const box=await p.locator('#arsenal').boundingBox();assert(box.x>=0&&box.x+box.width<=852);
  if(p===guest){const aim=await p.locator('#aim-pad').boundingBox();assert(box.x+box.width<aim.x,'landscape weapons remain clear of the aim pad');}
  await p.screenshot({path:`test-results/online-${p===host?'skier':'gunner'}-landscape.png`});
 }
 const third=await browser.newPage();await third.goto(base+'?debug#room='+code);await third.locator('#join').click();await third.waitForFunction(()=>document.querySelector('#overlay-text').textContent.includes('already has two'),null,{timeout:40000});await third.close();
 const run=await host.evaluate(()=>ski.world.run);await guest.evaluate(()=>ski.room.close());await host.waitForFunction(()=>ski.paused());
 await guest.reload();await guest.locator('#join').click();await guest.waitForFunction(run=>ski.state?.run===run&&ski.state.mode==='waves'&&!ski.state.paused,run,{timeout:40000});
 assert.equal(await host.evaluate(()=>ski.world.run),run);
 await host.locator('#menu-toggle').tap();await host.locator('#restart').tap();await guest.waitForFunction(run=>ski.state.run===run+1,run);
 assert.deepEqual(await guest.evaluate(()=>ski.state.unlocked),[true,false,false,false,false,false]);
 await host.evaluate(()=>{const w=ski.world,p=w.players[0],e=w.spawn('yeti',p.x,p.y,{level:1});w.catchPlayer(p,e);});
 await guest.waitForFunction(()=>ski.state.capture?.player===0);assert(!await guest.locator('#overlay').isVisible());
 await guest.waitForFunction(()=>!document.querySelector('#overlay').hidden);assert.match(await guest.locator('#overlay-title').textContent(),/yeti got you/i);
 assert.deepEqual(errors,[]);console.log('PASS: portrait/landscape, third-player rejection, reconnect preserves run, host restart, shared capture, no browser errors.');
}finally{await browser.close();server?.close();}
