import test from 'node:test';
import assert from 'node:assert/strict';
import {SoloWorld,BALL_MASS,BALL_MAX_LENGTH,ballTether,ballHit} from '../site/solo-physics.js';
import {STEP} from '../site/physics.js';
import {validState} from '../site/protocol.js';
const fixture=()=>{const w=new SoloWorld(123);w.entities=[];w.nextChunk=100000;return w;};
test('solo has one controlled skier and an independent heavy ball, without a network partner',()=>{
 const w=new SoloWorld(1);assert.equal(w.players.length,1);assert.ok(w.ball.r>=26);assert.equal(w.snapshot().mode,'solo');assert.equal(validState(w.snapshot()),false);
 const a={x:0,y:0,vx:0,vy:0},b={x:160,y:0,vx:0,vy:0};ballTether(a,b,STEP);assert.ok(a.vx>0&&b.vx<0);assert.ok(Math.abs(a.vx+b.vx*BALL_MASS)<1e-9);assert.ok(a.vx>Math.abs(b.vx));
});
test('ball sweep catches a moving target crossed between simulation frames',()=>{
 assert.ok(ballHit({kind:'skier',x:0,y:50,px:0,py:50,r:10},{x:-100,y:50},{x:100,y:50}));
 assert.equal(ballHit({kind:'tree',x:0,y:150,r:11},{x:-100,y:50},{x:100,y:50}),false);
});
test('the metal ball smashes trees, large pines, poles and rocks once, even at low speed',()=>{
 for(const kind of ['tree','pine','pole','rock']){
  const w=fixture(),e=w.spawn(kind,w.ball.x,w.ball.y,{vx:0,vy:0});w.ball.vy=5;w.step();assert.equal(e.alive,false,kind);assert.equal(w.wrecks,1);assert.ok(w.events.some(e=>e.type==='debris'&&e.weapon==='ball'));
  w.destroy(e,'ball');assert.equal(w.wrecks,1);
 }
});
test('solo chain never cuts trees or poles, including at tuck speed',()=>{
 for(const kind of ['tree','pine','pole'])for(const speed of [118,185,390]){
  const w=fixture(),p=w.players[0],b=w.ball;Object.assign(p,{x:-68,y:0,vx:0,vy:speed});Object.assign(b,{x:68,y:0,vx:0,vy:speed});w.inputs[0]={x:0,boost:true};const e=w.spawn(kind,0,24);
  for(let i=0;i<90;i++)w.step();assert.ok(e.alive,`${kind} at ${speed}`);assert.equal(w.wrecks,0);assert.ok(w.events.some(e=>e.type==='blocked'));assert.ok(p.y<45&&b.y<45);
  w.destroy(e,'chain');assert.ok(e.alive);
 }
});
test('chain snags permit steering free, and the ball can subsequently break the snag',()=>{
 const w=fixture(),p=w.players[0],b=w.ball;Object.assign(p,{x:-68,y:0});Object.assign(b,{x:68,y:0});const e=w.spawn('pole',0,24);
 for(let i=0;i<90;i++)w.step();const stopped=p.y;w.inputs[0]={x:1,boost:true};for(let i=0;i<300;i++)w.step();assert.ok(p.y>stopped+80);assert.ok(!e.alive||p.x>e.x+25);
});
test('solo chain hits rocks and characters, and either weapon can kill the yeti',()=>{
 for(const kind of ['rock','skier','boarder','dog','yeti']){
  const w=fixture(),p=w.players[0],b=w.ball;Object.assign(p,{x:-68,y:0});Object.assign(b,{x:68,y:0});if(kind==='yeti')w.phase='yeti';const e=w.spawn(kind,0,kind==='yeti'?6:-4,{vx:0,vy:0});w.step();assert.equal(e.alive,false,kind);assert.ok(w.events.some(e=>e.weapon==='chain'));if(kind==='yeti'){assert.equal(w.phase,'endless');w.continue();assert.equal(w.phase,'endless');}
 }
 const w=fixture();w.phase='yeti';w.spawn('yeti',w.ball.x,w.ball.y+6);w.step();assert.equal(w.phase,'endless');assert.ok(w.events.some(e=>e.type==='blood'&&e.weapon==='ball'));
});
test('solo distance and yeti trigger use the skier, not the ball',()=>{
 const w=fixture();w.players[0].y=8000;w.ball.y=7890;w.step();assert.equal(w.phase,'yeti');assert.ok(w.distance>=2000);assert.ok(w.entities.some(e=>e.kind==='yeti'));
});
test('solo stays deterministic and tethered through steering, braking, jumps and course edges',()=>{
 const worlds=[new SoloWorld(47),new SoloWorld(47)];
 for(let i=0;i<6000;i++)for(const w of worlds){w.inputs[0]={x:Math.sin(i/70),brake:i%300<80,boost:i%300>150,jump:i%100===0};w.step();if(w.phase==='won')w.continue();if(w.phase==='lost'){w.phase='endless';w.entities=w.entities.filter(e=>e.kind!=='yeti');}const p=w.players[0],b=w.ball;assert.ok(Number.isFinite(p.x+p.y+b.x+b.y));assert.ok(Math.hypot(p.x-b.x,p.y-b.y)<=BALL_MAX_LENGTH+.1);assert.ok(Math.abs(p.x)<=1051&&Math.abs(b.x)<=1051);}
 assert.deepEqual(worlds[0].snapshot(),worlds[1].snapshot());
});
