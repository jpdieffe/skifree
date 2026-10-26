import test from 'node:test';
import assert from 'node:assert/strict';
import {World,STEP,REST_LENGTH,MAX_LENGTH,TREE_CUT_SPEED,spring,chainPath,sweptChainHit,chainImpactSpeed} from '../site/physics.js';
import {parseCode,validInput,validState} from '../site/protocol.js';
test('elastic chain preserves momentum and recoils toward the other skier',()=>{
 const a={x:-125,y:0,vx:0,vy:0},b={x:125,y:0,vx:0,vy:0};
 spring(a,b,STEP);assert.ok(a.vx>0&&b.vx<0);assert.equal(a.vx+b.vx,0);
 for(let i=0;i<40;i++){spring(a,b,STEP);a.x+=a.vx*STEP;b.x+=b.vx*STEP;}
 assert.ok(b.x-a.x<REST_LENGTH,'the spring rebounds past its rest length');
 const c={x:0,y:0,vx:0,vy:0},d={x:50,y:0,vx:0,vy:0};assert.equal(spring(c,d,STEP),0);assert.equal(c.vx,0);
});
test('chain sweep catches targets passed between frames',()=>{
 const old=chainPath({x:-80,y:0},{x:80,y:0}),now=chainPath({x:-80,y:100},{x:80,y:100});
 assert.ok(sweptChainHit({x:0,y:50,r:5,kind:'skier'},old,now));
 assert.equal(sweptChainHit({x:200,y:50,r:5,kind:'skier'},old,now),false);
});
test('chain destroys each character once, produces blood and shared scoring',()=>{
 const w=new World(123);w.entities=[];const victim=w.spawn('skier',0,-4,{vx:0,vy:0});w.step();
 assert.equal(victim.alive,false);assert.equal(w.kills,1);assert.equal(w.score,100);assert.equal(w.events.find(e=>e.type==='blood').kind,'skier');
 for(let i=0;i<10;i++)w.step();assert.equal(w.kills,1);assert.equal(w.score,100);
});
test('scenery shatters; the yeti explodes and ends the run',()=>{
 const w=new World(1);w.entities=[];w.spawn('rock',0,-4);w.step();assert.equal(w.wrecks,1);assert.ok(w.events.some(e=>e.type==='debris'));
 w.phase='yeti';w.spawn('yeti',0,w.players[0].y+6);w.step();assert.equal(w.yetiKills,1);assert.equal(w.phase,'won');assert.ok(w.events.some(e=>e.type==='blood'&&e.kind==='yeti'));assert.ok(w.events.some(e=>e.type==='win'));
 w.continue();assert.equal(w.phase,'endless');
});
test('the original 2000m milestone releases a pursuing yeti',()=>{
 const w=new World(1);for(const p of w.players)p.y=8000;w.step();assert.equal(w.phase,'yeti');const yeti=w.entities.find(e=>e.kind==='yeti');assert.ok(yeti);const before=yeti.y;w.step();assert.ok(yeti.y>before);
});
function obstacleRun(kind,speed){const w=new World(123);w.entities=[];w.nextChunk=100;for(const p of w.players){p.vy=speed;p.vx=0;}w.inputs=w.players.map(()=>({x:0,y:0,boost:speed>=TREE_CUT_SPEED,brake:speed<50,jump:false}));const e=w.spawn(kind,0,24);return {w,e};}
test('trees and large pines survive slow chain hits, but break above the speed threshold',()=>{
 for(const kind of ['tree','pine'])for(const speed of [28,118,185]){const {w,e}=obstacleRun(kind,speed);for(let i=0;i<150;i++)w.step();assert.equal(e.alive,speed<TREE_CUT_SPEED);assert.equal(w.wrecks,speed<TREE_CUT_SPEED?0:1);if(speed<TREE_CUT_SPEED){assert.ok(w.events.some(e=>e.type==='blocked'));assert.ok(Math.max(...w.players.map(p=>p.y))<40);}}
});
test('cutting speed measures the local chain swing, not stretching along its length',()=>{
 const before=chainPath({x:-68,y:0},{x:68,y:0}),sideways=chainPath({x:-70,y:0},{x:70,y:0}),fast=chainPath({x:-68,y:3},{x:68,y:3});assert.ok(chainImpactSpeed({x:0,y:20},before,sideways,STEP)<TREE_CUT_SPEED);assert.ok(chainImpactSpeed({x:0,y:20},before,fast,STEP)>TREE_CUT_SPEED);
});
test('metal poles stop both skiers at every speed, survive jumping, and never award points',()=>{
 for(const speed of [28,118,185,390]){const {w,e}=obstacleRun('pole',speed);for(const p of w.players)p.jump=.7;for(let i=0;i<180;i++)w.step();assert.ok(e.alive);assert.equal(w.score,0);assert.ok(Math.max(...w.players.map(p=>p.y))<35);assert.ok(w.events.some(e=>e.type==='blocked'&&e.kind==='pole'));w.destroy(e);assert.ok(e.alive);assert.equal(w.score,0);}
});
test('a skier also stops on a pole even if the chain misses it',()=>{
 const {w,e}=obstacleRun('pole',185);e.x=w.players[0].x;for(let i=0;i<120;i++)w.step();assert.ok(e.alive);assert.ok(w.players[0].y<e.y+8);assert.equal(w.wrecks,0);
});
test('a snag permits steering around a pole and resuming downhill',()=>{
 const {w,e}=obstacleRun('pole',185);for(let i=0;i<40;i++)w.step();w.inputs=w.players.map(()=>({x:1,y:0,boost:true,jump:false}));for(let i=0;i<300;i++)w.step();assert.ok(e.alive);assert.ok(Math.min(...w.players.map(p=>p.x))>e.x+10);assert.ok(Math.min(...w.players.map(p=>p.y))>e.y+60);
});
test('procedural slopes include metal poles accepted by the multiplayer protocol',()=>{const w=new World(1);assert.ok(w.entities.some(e=>e.kind==='pole'));assert.ok(validState(w.snapshot()));});
test('seeded simulation stays deterministic and bounded over a long run',()=>{
 const worlds=[new World(135),new World(135)];
 for(let i=0;i<18000;i++)for(const w of worlds){w.inputs[0]={x:Math.sin(i/41),y:Math.cos(i/91),boost:i%120<60,jump:i%150<3};w.bot();w.step();if(w.phase==='won')w.continue();if(w.phase==='lost'){w.phase='endless';w.entities=w.entities.filter(e=>e.kind!=='yeti');}
  const [a,b]=w.players;assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<=MAX_LENGTH+.001);assert.ok(Number.isFinite(a.x+a.y+b.x+b.y));if(i%120===0)assert.ok(validState(w.snapshot()));}
 assert.deepEqual(worlds[0].snapshot(),worlds[1].snapshot());
});
test('network protocol rejects malformed inputs and unbounded state',()=>{
 assert.equal(parseCode(' ab '),'AB');assert.equal(parseCode('A0'),null);assert.equal(parseCode('ABC'),null);
 const input={type:'input',seq:1,x:.5,y:-.2,brake:false,boost:true,jump:false};assert.ok(validInput(input));assert.equal(validInput({...input,x:Infinity}),false);assert.equal(validInput({...input,seq:-1}),false);
 const s=new World(1).snapshot();assert.ok(validState(s));assert.equal(validState({...s,entities:Array(401).fill(s.entities[0])}),false);assert.equal(validState({...s,players:[{x:NaN},{}]}),false);
});
