import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from '../scripts/serve.mjs';
await mkdir('test-results',{recursive:true});
const server=process.env.SKIFREE_URL?null:createServer(4195),base=process.env.SKIFREE_URL||'http://127.0.0.1:4195/',browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
try{
 const desktop=await browser.newPage({viewport:{width:1280,height:900}});desktop.on('pageerror',e=>errors.push(e.message));await desktop.goto(base+'?debug');await desktop.waitForFunction(()=>!document.getElementById('practice').disabled);await desktop.screenshot({path:'test-results/lobby-desktop.png',fullPage:true});
 for(const viewport of [{width:393,height:852},{width:844,height:390}]){
  const context=await browser.newContext({...devices['Pixel 7'],viewport,deviceScaleFactor:1});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'?debug');await page.locator(process.env.SKIFREE_SOLO?'#solo':'#practice').click();await page.waitForFunction(()=>window.ski?.state?.time>1);
  if(process.env.SKIFREE_SOLO){assert.equal(await page.evaluate(()=>ski.world.players.length),1);assert.ok(await page.evaluate(()=>ski.world.ball.r>=26));assert.equal(await page.evaluate(()=>!!ski.room),false);assert.equal(await page.locator('#invite').isVisible(),false);assert.equal(await page.locator('#overlay').isVisible(),false);}
  assert.ok(await page.locator('#controls').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const before=await page.evaluate(()=>ski.world.players[0].x),rect=await page.locator('#pad').boundingBox();const session=await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width-12,y:rect.y+rect.height/2,id:0}]});await page.waitForTimeout(900);assert.ok(await page.evaluate(()=>ski.input().x>.8));assert.ok(await page.evaluate(()=>ski.world.players[0].x)>before+15);
  const jump=await page.locator('[data-action="jump"]').boundingBox();await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width-12,y:rect.y+rect.height/2,id:0},{x:jump.x+jump.width/2,y:jump.y+jump.height/2,id:1}]});await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>ski.world.players[0].jump>0));
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await page.evaluate(()=>ski.input().x),0);assert.equal(await page.evaluate(()=>ski.input().jump),false);
  await page.screenshot({path:`test-results/${process.env.SKIFREE_SOLO?'solo':'phone'}-${viewport.width}.png`});if(process.env.SKIFREE_SOLO){const run=await page.evaluate(()=>ski.world.run);await page.locator('#menu-toggle').click();await page.locator('#restart').click();await page.waitForFunction(old=>ski.world.run>old,run);assert.equal(await page.evaluate(()=>ski.world.players.length),1);assert.ok(await page.evaluate(()=>ski.world.ball));
   await page.evaluate(()=>{const w=ski.world;w.entities=[];w.phase='yeti';w.spawn('yeti',w.ball.x,w.ball.y+6);});await page.waitForFunction(()=>ski.state.phase==='won');assert.ok(await page.evaluate(()=>ski.view.effects.some(e=>e.type==='blood'&&e.weapon==='ball')));await page.locator('#continue').click();await page.waitForFunction(()=>ski.state.phase==='endless');
   await page.locator('#menu-toggle').click();await page.locator('#leave').click();await page.locator('#practice').click();await page.waitForFunction(()=>ski.world.players.length===2&&ski.state.time>0);assert.equal(await page.evaluate(()=>!!ski.world.ball),false);
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: desktop lobby, portrait and landscape phone layout, real multi-touch steering + jump, input release, no JavaScript errors.');
}finally{await browser.close();server?.close();}
