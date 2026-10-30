import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from '../scripts/serve.mjs';
const server=process.env.SKIFREE_URL?null:createServer(4198),base=process.env.SKIFREE_URL||'http://127.0.0.1:4198/',browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
await mkdir('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'?debug');await page.locator('#solo').click();await page.waitForFunction(()=>ski.state?.time>.5);
 await page.evaluate(()=>{
  ski.world.entities=[];ski.world.nextChunk=100000;
  window.samples=[];let skier=false;
  const art=ski.view.art,draw=art.draw,ctx=ski.view.ctx,drawImage=ctx.drawImage;
  art.draw=function(c,id,...args){skier=id>=1&&id<=3;try{return draw.call(this,c,id,...args);}finally{skier=false;}};
  ctx.drawImage=function(...args){if(skier&&samples.length<150){const m=this.getTransform(),p=ski.world.players[0];samples.push({x:m.e,y:m.f,z:ski.view.camera.z,time:ski.view.state.time,worldTime:ski.world.time,speed:Math.hypot(p.vx,p.vy)});}return drawImage.apply(this,args);};
 });
 await page.keyboard.down('KeyE');await page.waitForFunction(()=>samples.length>=150);await page.keyboard.up('KeyE');
 const samples=await page.evaluate(()=>samples),span=key=>Math.max(...samples.map(s=>s[key]))-Math.min(...samples.map(s=>s[key]));
 assert(span('x')<1e-6&&span('y')<1e-6,'actual skier sprite anchor must stay fixed while the ball swings');
 assert.equal(span('z'),0,'swinging must not change zoom');assert.equal(samples[0].z,1);
 assert(samples.every(s=>Math.abs(s.worldTime-s.time)<1e-6),'local rendering must use each physics update, not the network snapshots');
 const elapsed=samples.at(-1).time-samples[0].time;
 assert(new Set(samples.map(s=>s.time)).size>elapsed*45,'local motion updates faster than the 20 Hz network stream');
 await page.evaluate(()=>samples=[]);await page.keyboard.down('ArrowDown');await page.keyboard.down('KeyE');
 await page.waitForFunction(()=>samples.length>=150);await page.keyboard.up('ArrowDown');await page.keyboard.up('KeyE');
 const fast=await page.evaluate(()=>samples);
 assert(Math.max(...fast.map(s=>s.speed))>160,'exercise fast downhill motion with the ball swinging');
 assert(fast.every(s=>Math.abs(s.x-samples[0].x)<1e-6&&Math.abs(s.y-samples[0].y)<1e-6),'skier must remain stable at tuck speed');
 assert(fast.every(s=>s.z===1),'fast motion must not pulse the zoom');
 await page.screenshot({path:'test-results/solo-stable-desktop.png'});
 await page.evaluate(()=>{samples=[];const p=ski.world.players[0];ski.world.event('debris',p.x+40,p.y+40,{kind:'tree'});});
 await page.waitForFunction(()=>samples.length>=30);
 assert.equal(await page.evaluate(()=>ski.view.shake),0,'solo impacts must not shake the camera');
 for(const viewport of [{width:393,height:852},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(150);
  assert(await page.evaluate(()=>{const v=ski.view,p=v.state.players[0],b=v.state.ball,z=v.camera.z,w=v.canvas.clientWidth,h=v.canvas.clientHeight;return z<=1&&Math.abs(b.x-p.x)*z+b.r*z<w/2&&Math.abs(b.y-p.y)*z+b.r*z<h*.44;}),'the full swing remains visible after resizing');
 }
 await page.locator('#menu-toggle').click();await page.locator('#restart').click();await page.waitForFunction(()=>ski.state.run>1);
 assert(await page.evaluate(()=>ski.view.previous.run===ski.view.state.run),'restart must not interpolate from the old run');
 assert.deepEqual(errors,[]);
 console.log('PASS: fixed solo sprite anchor at normal and tuck speed, steady 1:1 desktop zoom, local physics-rate rendering, phone swing bounds and clean restart.');
}finally{await browser.close();server?.close();}
