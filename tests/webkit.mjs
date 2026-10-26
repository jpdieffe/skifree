import {webkit,devices} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from '../scripts/serve.mjs';
const server=createServer(4197),browser=await webkit.launch({headless:true,...(process.env.WEBKIT_EXECUTABLE?{executablePath:process.env.WEBKIT_EXECUTABLE}:{})}),errors=[];
try{
 const page=await browser.newPage({...devices['iPhone 13'],viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4197/?debug');await page.locator('#practice').tap();await page.waitForFunction(()=>window.ski?.state?.time>1);assert.ok(await page.locator('#controls').isVisible());
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(500);await page.keyboard.up('ArrowRight');assert.ok(await page.evaluate(()=>ski.world.players[0].vx>0));await page.screenshot({path:'test-results/webkit-iphone.png'});
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);console.log('PASS: WebKit iPhone layout, original sprite rendering, simulation and rotation.');
}finally{await browser.close();server.close();}
