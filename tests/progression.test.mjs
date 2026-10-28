import test from 'node:test';
import assert from 'node:assert/strict';
import {World,STEP} from '../site/physics.js';
import {SoloWorld,BALL_MAX_LENGTH} from '../site/solo-physics.js';
import {yetiProfile,moveYeti} from '../site/yetis.js';
import {slopeZoom} from '../site/view.js';
import {validState} from '../site/protocol.js';

test('hold Swing completes an orbit quickly and steering reverses it',()=>{
 const w=new SoloWorld(7);w.entities=[];w.nextChunk=100000;
 let angle=Math.atan2(w.ball.y-w.players[0].y,w.ball.x-w.players[0].x),total=0;
 for(let i=0;i<360;i++){
  w.inputs[0]={swing:true,x:0};w.step();const p=w.players[0],b=w.ball,a=Math.atan2(b.y-p.y,b.x-p.x);
  total+=Math.atan2(Math.sin(a-angle),Math.cos(a-angle));angle=a;
  assert(Math.hypot(b.x-p.x,b.y-p.y)<=BALL_MAX_LENGTH+.1);
 }
 assert(total>Math.PI*2,`one full orbit in six seconds, got ${total}`);
 w.inputs[0]={swing:true,x:-1};for(let i=0;i<100;i++)w.step();
 const p=w.players[0],b=w.ball;assert.equal(w.swingDirection,-1);
 assert((b.x-p.x)*(b.vy-p.vy)-(b.y-p.y)*(b.vx-p.vx)<0,'opposite steering reverses angular momentum');
});

test('camera leaves slope visible around the full swing on phones and desktops',()=>{
 for(const [w,h]of [[393,642],[844,341],[1280,808]])for(const [dx,dy]of [[172,0],[0,172],[122,122]]){
  const z=slopeZoom(w,h,dx,dy);assert(z<=1.25);assert(w/z>=480);assert(h/z>=380);
  assert((dx+100)*z<w);assert((dy+180)*z<h);
 }
});

test('solo and multiplayer keep running through every Yeti type and repeat at a higher level',()=>{
 for(const C of [World,SoloWorld]){
  const w=new C(12);w.entities=[];w.nextChunk=100000;w.distance=2000;w.players.forEach(p=>p.y=8000);
  for(let level=1;level<=11;level++){
   w.encounters();const e=w.entities.find(e=>e.alive&&e.kind==='yeti'),profile=yetiProfile(level);
   assert.equal(e.level,level);assert.equal(e.yetiType,['regular','cyborg','huge','super','tree'][(level-1)%5]);assert.equal(e.hp,profile.hp);
   if(C===World)assert(validState(w.snapshot()));
   const before=w.yetiKills,score=w.score;
   for(let hit=0;hit<profile.hp;hit++){
    w.time+=1;w.destroy(e,'ball');
    if(e.alive){assert.equal(w.yetiKills,before);assert.equal(w.score,score);const hp=e.hp;w.destroy(e,'chain');assert.equal(e.hp,hp,'sustained contact must not drain all HP in one frame');}
   }
   assert.equal(w.phase,'endless');assert.equal(w.yetiKills,before+1);assert(w.score>score);w.destroy(e,'ball');assert.equal(w.yetiKills,before+1);
   w.encounters();assert(!w.entities.some(e=>e.alive&&e.kind==='yeti'),'recovery distance before next boss');
   w.players.forEach(p=>p.y=w.nextYeti+1);
  }
 }
});

test('variants have distinct size, charge, weaving, and bounded tree planting',()=>{
 const w=new World(1);w.entities=[];w.players.forEach(p=>{p.x=0;p.y=400;});
 const regular=w.spawn('yeti',0,0,{level:1}),huge=w.spawn('yeti',0,0,{level:3});assert(huge.r>regular.r*1.7);
 const cyborg=w.spawn('yeti',0,0,{level:2});w.time=1;moveYeti(w,cyborg,STEP);w.time=3;moveYeti(w,cyborg,STEP);assert(cyborg.charging);assert(Math.hypot(cyborg.vx,cyborg.vy)>300);
 const superYeti=w.spawn('yeti',0,0,{level:4});moveYeti(w,superYeti,STEP);assert(Math.abs(superYeti.vx)>10);
 const tree=w.spawn('yeti',0,0,{level:5});for(let i=0;i<30;i++){w.time+=3;moveYeti(w,tree,STEP);}assert.equal(w.entities.filter(e=>e.grownBy===tree.id).length,12);
 regular.y=-5000;w.generate();assert(w.entities.includes(regular),'a living boss must not be discarded by scenery cleanup');
});

test('armored Yetis take separate real ball swings to defeat',()=>{
 const w=new SoloWorld(7);w.entities=[];w.nextChunk=100000;w.phase='yeti';
 const e=w.spawn('yeti',w.ball.x,w.ball.y+6,{level:2});w.step();assert.equal(e.hp,1);assert(e.alive);assert(w.events.some(e=>e.type==='armor'));
 w.time+=1;e.x=w.ball.x;e.y=w.ball.y+6;w.step();assert.equal(e.alive,false);assert.equal(w.phase,'endless');assert(w.events.some(e=>e.type==='blood'&&e.kind==='yeti'));
});

test('network Yeti state rejects invalid profiles and nonfinite encounter data',()=>{
 const w=new World(7);w.spawn('yeti',0,0,{level:5});const s=w.snapshot(),boss=s.entities.find(e=>e.kind==='yeti');assert(validState(s));
 for(const bad of [{level:0},{level:Infinity},{hp:9},{maxHp:0},{hitUntil:NaN}]){
  assert(!validState({...s,entities:s.entities.map(e=>e===boss?{...e,...bad}:e)}));
 }
 assert(!validState({...s,nextYetiDistance:Infinity}));
 assert(!validState({...s,events:[{id:1,type:'warning',x:0,y:0,time:0,level:NaN}]}));
});
