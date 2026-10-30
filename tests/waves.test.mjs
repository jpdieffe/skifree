import test from 'node:test';
import assert from 'node:assert/strict';
import {World,STEP} from '../site/physics.js';
import {SoloWorld} from '../site/solo-physics.js';
import {WaveWorld,WEAPONS,wavePlan,STAGES} from '../site/waves.js';
import {EATING_DURATION,eatingFrame} from '../site/yetis.js';
import {validState} from '../site/protocol.js';

const clean=()=>{const w=new WaveWorld(8);w.entities=[];w.nextChunk=100000;w.spawnAt=1e9;w.supplyAt=1e9;return w;};
test('capture is persistent, freezes the skier, and uses original eating frames',()=>{
 for(const C of [World,SoloWorld,WaveWorld]){
  const w=new C(7),p=w.players[0],e=w.spawn('yeti',p.x,p.y-25,{level:1});
  w.catchPlayer(p,e);const capture={...w.capture};w.catchPlayer(p,e);
  for(let i=0;i<300;i++)w.step();
  assert.equal(w.phase,'lost');assert.equal(p.vx,0);assert.equal(p.vy,0);assert.equal(p.jump,0);
  assert.deepEqual(w.snapshot().capture,capture);assert.equal(w.events.filter(e=>e.type==='caught').length,1);
  assert.equal(p.x,capture.x);assert.equal(p.y,capture.y);if(C===World)assert(validState(w.snapshot()));
 }
 assert.deepEqual([0,.31,.61,.91,1.21,1.51].map(eatingFrame),[76,77,78,79,80,81]);assert.equal(eatingFrame(EATING_DURATION),69);
 const s=new World(1).snapshot();assert(!validState({...s,phase:'lost',capture:{player:0,yeti:1,level:1,x:NaN,y:0,time:0}}));
});
test('skiing through a pickup equips it permanently; locked and invalid slots cannot be selected',()=>{
 const w=clean();w.select(5);assert.equal(w.weapon,0);w.select(NaN);assert.equal(w.weapon,0);
 w.pickups=[{id:1,x:0,y:1,slot:4,time:0}];w.step();assert(w.unlocked[4]);assert.equal(w.weapon,4);assert.equal(w.pickups.length,0);
 w.select(0);w.select(4);assert.equal(w.weapon,4);assert(w.events.some(e=>e.type==='pickup'));
});
test('all six weapons fire toward aim and defeat targets; holding fire respects cadence',()=>{
 for(let slot=0;slot<WEAPONS.length;slot++){
  const w=clean();w.unlocked.fill(true);w.weapon=slot;w.gunner={x:250,y:-18,fire:true};
  const e=w.spawn('yeti',180,0,{level:1,hp:1,maxHp:1});w.shoot();const count=w.projectiles.length;
  assert.equal(count,WEAPONS[slot].pellets);assert(w.projectiles.every(b=>b.vx>0));w.shoot();assert.equal(w.projectiles.length,count);
  for(let i=0;i<40;i++)w.bullets(STEP);assert(!e.alive,WEAPONS[slot].name+' must hit');
 }
});
test('sniper pierces a row, rockets damage a cluster, shotgun spreads, plasma only hits each target once',()=>{
 const sniper=clean();sniper.weapon=3;sniper.gunner={x:500,y:-18,fire:true};
 const row=[100,170,240].map(x=>sniper.spawn('yeti',x,0,{level:1}));sniper.shoot();for(let i=0;i<15;i++)sniper.bullets(STEP);assert(row.every(e=>!e.alive));
 const rocket=clean();rocket.weapon=4;rocket.gunner={x:180,y:-18,fire:true};
 const cluster=[0,45,-45].map(y=>rocket.spawn('yeti',180,y,{level:2}));rocket.shoot();for(let i=0;i<40;i++)rocket.bullets(STEP);assert(cluster.every(e=>!e.alive));assert(rocket.events.some(e=>e.type==='explosion'));
 const shotgun=clean();shotgun.weapon=2;shotgun.gunner={x:180,y:-18,fire:true};shotgun.shoot();assert(new Set(shotgun.projectiles.map(b=>b.vy)).size===7);
 const plasma=clean();plasma.weapon=5;plasma.gunner={x:180,y:-18,fire:true};const tank=plasma.spawn('yeti',60,0,{level:3,hp:30,maxHp:30});plasma.shoot();for(let i=0;i<20;i++)plasma.bullets(STEP);assert.equal(tank.hp,27);
});
test('monsters spawn in waves, the next wave waits for every survivor, and stages cycle harder',()=>{
 const w=clean();w.spawnAt=0;w.step();assert(w.entities.some(e=>e.kind==='yeti'));assert(w.remaining<w.plan.count);
 w.remaining=0;w.step();assert.equal(w.plan.number,1);
 w.entities.forEach(e=>e.alive=false);w.step();assert.equal(w.plan.number,2);assert(w.breatherUntil>w.time);
 assert.equal(wavePlan(4).stage,2);assert.equal(wavePlan(30).stage,10);assert.equal(STAGES.length,10);assert.equal(wavePlan(31).cycle,1);assert(wavePlan(31).count>wavePlan(1).count);
 for(let number=1;number<=300;number++)assert(wavePlan(number).count<=72);
});
test('physical monster contact captures the skier and jumping clears contact',()=>{
 const w=clean(),p=w.players[0];w.spawn('yeti',p.x,p.y,{level:1});w.step();assert.equal(w.phase,'lost');assert(w.capture);
 const jumping=clean();jumping.inputs[0]={jump:true};jumping.spawn('yeti',0,0,{level:1});jumping.step();assert.notEqual(jumping.phase,'lost');
});
test('crowded late-stage waves remain bounded and deterministic with automatic fire',()=>{
 const worlds=[new WaveWorld(42),new WaveWorld(42)];
 for(const w of worlds){w.plan=wavePlan(30);w.remaining=w.plan.count;w.spawnAt=0;w.unlocked.fill(true);w.weapon=5;}
 for(let frame=0;frame<3600;frame++)for(const w of worlds){
  const p=w.players[0];p.jump=.6; // Isolate simulation load from the terminal capture sequence.
  w.inputs[0]={x:Math.sin(frame/240),boost:true};
  const enemies=w.entities.filter(e=>e.alive&&e.kind==='yeti').sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
  const target=enemies[0];w.gunner={x:target?.x??p.x,y:target?target.y-target.centerY:p.y+300,fire:!!target};
  w.step();assert(enemies.length<=48);assert(w.projectiles.length<=160);assert(w.entities.length<160);assert(w.pickups.length<=8);assert(Number.isFinite(p.x+p.y));
 }
 assert(worlds[0].kills>10);assert.deepEqual(worlds[0].snapshot(),worlds[1].snapshot());
});
