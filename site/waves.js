import {World,STEP,clamp,random,pointSegment} from './physics.js';
import {yetiProfile} from './yetis.js';

export const WEAPONS=[
 {name:'Pistol',short:'PISTOL',color:'#b06c28',interval:.28,speed:980,damage:2,pellets:1,spread:0,pierce:1,r:2},
 {name:'Machine gun',short:'MACHINE GUN',color:'#33775b',interval:.085,speed:1100,damage:1,pellets:1,spread:.045,pierce:1,r:2},
 {name:'Shotgun',short:'SHOTGUN',color:'#cc7036',interval:.65,speed:900,damage:2,pellets:7,spread:.33,pierce:1,r:3,life:.48},
 {name:'Sniper rifle',short:'SNIPER',color:'#3d7fbc',interval:.8,speed:2400,damage:9,pellets:1,spread:0,pierce:5,r:2},
 {name:'Rocket launcher',short:'ROCKETS',color:'#bd4854',interval:.95,speed:580,damage:9,pellets:1,spread:0,pierce:1,r:5,blast:115},
 {name:'Plasma rifle',short:'PLASMA',color:'#8b42c3',interval:.14,speed:820,damage:3,pellets:1,spread:.025,pierce:2,r:6},
];
export const STAGES=[
 {name:'Pine Pass',types:[1],color:'#3f7966'},
 {name:'Chrome Canyon',types:[1,2],color:'#527c93'},
 {name:'Giant Glacier',types:[1,3],color:'#608bcc'},
 {name:'Super Slalom',types:[1,2,4],color:'#b58c25'},
 {name:'Howling Grove',types:[1,3,5],color:'#55833c'},
 {name:'Steel Avalanche',types:[2,2,3,4],color:'#6a7897'},
 {name:'Golden Gauntlet',types:[1,4,4,5],color:'#b48b32'},
 {name:'Ancient Ice',types:[3,3,5,2],color:'#578c97'},
 {name:'Monster Mountain',types:[1,2,3,4,5],color:'#89619f'},
 {name:'Last Lift',types:[2,3,4,5,5],color:'#b95760'},
];
export function wavePlan(number){
 const stageIndex=Math.floor((number-1)/3),stage=STAGES[stageIndex%STAGES.length];
 return {...stage,number,stage:stageIndex+1,wave:(number-1)%3+1,cycle:Math.floor(stageIndex/STAGES.length),count:Math.min(72,12+stageIndex*4+((number-1)%3)*5)};
}

// Shared simulation for desktop co-op and online skier/gunner rooms.
export class WaveWorld extends World{
 constructor(seed=1,run=1){
  super(seed,run);this.players=[{...this.players[0],x:0}];this.entities=[];
  this.rng=random(seed);this.projectiles=[];this.pickups=[];this.nextProjectile=1;this.nextPickup=1;
  this.unlocked=[true,false,false,false,false,false];this.weapon=0;this.nextShot=0;
  this.gunner={x:0,y:300,fire:false};this.viewport={halfWidth:640,above:350,below:450};
  this.plan=wavePlan(1);this.remaining=this.plan.count;this.spawnAt=6;this.breatherUntil=6;this.supplyAt=16;
  this.supply(1);this.generate();
 }
 generate(){
  // World calls this before the wave-specific fields exist.
  if(!this.plan)return;
  const p=this.players[0];
  while(this.nextChunk*320<p.y+900){
   const chunk=this.nextChunk++,rng=random(this.seed+chunk*7919);
   for(let i=0;i<4;i++){
    const x=clamp(p.x+(rng()-.5)*1500,-1080,1080),y=chunk*320+rng()*320;
    if(y>300&&Math.abs(x-p.x)>75)this.spawn(rng()>.3?'pine':'rock',x,y);
   }
  }
  this.entities=this.entities.filter(e=>e.alive&&(e.kind==='yeti'||e.y>p.y-700));
  this.pickups=this.pickups.filter(e=>e.y>p.y-300&&this.time-e.time<40);
 }
 select(slot){if(Number.isInteger(slot)&&this.unlocked[slot])this.weapon=slot;}
 supply(slot=this.unlocked.findIndex((yes,i)=>i>0&&!yes)){
  if(slot<0)slot=1+Math.floor(this.rng()*5);
  const p=this.players[0];this.pickups.push({id:this.nextPickup++,x:p.x,y:p.y+170,slot,time:this.time});
  if(this.pickups.length>8)this.pickups.shift();
 }
 damage(e,amount){
  if(!e.alive)return;e.hp-=amount;e.hitUntil=this.time+.12;
  if(e.hp>0)return;
  e.alive=false;this.kills++;this.yetiKills++;this.score+=1000;
  this.event('blood',e.x,e.y,{kind:'yeti',seed:(this.seed^e.id*12347)>>>0,combo:1});
 }
 explode(b){
  const gun=WEAPONS[b.weapon];this.event('explosion',b.x,b.y,{radius:gun.blast});
  for(const e of this.entities)if(e.alive&&e.kind==='yeti'&&Math.hypot(e.x-b.x,e.y-e.centerY-b.y)<gun.blast+e.r)this.damage(e,gun.damage);
 }
 shoot(){
  if(this.time<this.nextShot||!this.gunner.fire)return;
  const gun=WEAPONS[this.weapon],p=this.players[0],angle=Math.atan2(this.gunner.y-(p.y-18),this.gunner.x-p.x);
  this.nextShot=this.time+gun.interval;
  this.event('shot',p.x,p.y-18,{weapon:this.weapon,angle});
  for(let i=0;i<gun.pellets;i++){
   const a=angle+(gun.pellets>1?(i/(gun.pellets-1)-.5)*gun.spread*2:(this.rng()-.5)*gun.spread*2);
   const reach=Math.hypot(this.gunner.x-p.x,this.gunner.y-(p.y-18));
   this.projectiles.push({id:this.nextProjectile++,x:p.x,y:p.y-18,vx:Math.cos(a)*gun.speed,vy:Math.sin(a)*gun.speed,weapon:this.weapon,life:gun.blast?clamp(reach/gun.speed,.08,2):gun.life||1.5,pierce:gun.pierce,hit:new Set()});
  }
  if(this.projectiles.length>160)this.projectiles.splice(0,this.projectiles.length-160);
 }
 bullets(dt){
  for(const b of this.projectiles){
   const gun=WEAPONS[b.weapon],x=b.x,y=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
   // Sweep relative motion, including fast sniper shots and moving monsters.
   const hits=this.entities.filter(e=>e.alive&&e.kind==='yeti'&&!b.hit.has(e.id)&&pointSegment(0,0,x-e.px,y-(e.py-e.centerY),b.x-e.x,b.y-(e.y-e.centerY))<e.r+gun.r);
   hits.sort((a,b)=>Math.hypot(a.x-x,a.y-a.centerY-y)-Math.hypot(b.x-x,b.y-b.centerY-y));
   for(const e of hits){
    b.hit.add(e.id);
    if(gun.blast){b.x=e.x;b.y=e.y-e.centerY;this.explode(b);b.life=-1;break;}
    this.damage(e,gun.damage);if(--b.pierce<=0){b.life=-1;break;}
   }
   if(gun.blast&&b.life<=0&&b.life!==-1)this.explode(b);
  }
  this.projectiles=this.projectiles.filter(b=>b.life>0);
 }
 spawnMonster(){
  const p=this.players[0],v=this.viewport,rng=this.rng,side=Math.floor(rng()*4);
  let x=p.x+(rng()-.5)*Math.min(v.halfWidth*1.7,1000),y=p.y;
  if(side<2){x=p.x+(side?-1:1)*Math.min(v.halfWidth+65,760);y+=(rng()-.5)*600;}
  else y+=side===2?-Math.min(v.above+80,650):Math.min(v.below+80,700);
  const level=this.plan.types[Math.floor(rng()*this.plan.types.length)],profile=yetiProfile(level),hp=profile.hp*2+Math.min(10,this.plan.cycle*2+Math.floor((this.plan.stage-1)/5));
  this.spawn('yeti',x,y,{level,hp,maxHp:hp});
 }
 moveMonster(e,p,dt){
  const profile=yetiProfile(e.level),dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;
  let a=Math.atan2(dy,dx),speed=profile.speed*.85+Math.min(28,this.plan.stage*2);
  if(profile.type==='cyborg'){
   const cycle=(this.time-e.spawnedAt)%3.8;
   if(cycle<2.7){e.aim=a;e.charging=false;}
   else {a=e.aim??a;e.charging=true;speed=cycle<3.1?35:300;}
  }
  if(profile.type==='super')a+=Math.sin(this.time*4+e.id)*.5;
  if(profile.type==='tree'&&this.time>e.nextPlant){
   e.nextPlant=this.time+5;
   if(this.entities.filter(t=>t.kind==='tree').length<20)this.spawn('tree',e.x,e.y+45);
  }
  // Small separation keeps crowds readable while allowing large waves.
  let sx=0,sy=0;
  for(const other of this.entities)if(other!==e&&other.alive&&other.kind==='yeti'){
   const ox=e.x-other.x,oy=e.y-other.y,od=Math.hypot(ox,oy),gap=(e.r+other.r)*.8;
   if(od>0&&od<gap){sx+=ox/od*(gap-od)*3;sy+=oy/od*(gap-od)*3;}
  }
  e.vx=Math.cos(a)*speed+clamp(sx,-90,90);e.vy=Math.sin(a)*speed+clamp(sy,-90,90);
  e.x+=e.vx*dt;e.y+=e.vy*dt;
 }
 step(dt=STEP){
  this.time+=dt;if(this.phase==='lost')return;
  const p=this.players[0],input=this.inputs[0]||{},old={x:p.x,y:p.y};
  p.crash=Math.max(0,p.crash-dt);p.jump=Math.max(0,p.jump-dt);p.jumpCooldown=Math.max(0,p.jumpCooldown-dt);
  if(input.jump&&!p.jumpCooldown&&!p.crash){p.jump=.72;p.jumpCooldown=1.4;this.event('jump',p.x,p.y,{player:0});}
  const target=input.brake||input.y<-.3?30:input.boost||input.y>.3?210:145;
  p.vx+=(clamp(input.x||0,-1,1)*370-p.vx*2.2)*dt;p.vy+=((p.crash?35:target)-p.vy)*2*dt;
  p.x=clamp(p.x+p.vx*dt,-1050,1050);p.y+=p.vy*dt;p.angle=Math.atan2(p.vx,Math.max(25,p.vy));
  for(const e of this.entities){e.px=e.x;e.py=e.y;if(e.alive&&e.kind==='yeti')this.moveMonster(e,p,dt);}
  this.shoot();this.bullets(dt);
  for(const e of this.entities){
   if(!e.alive||p.jump>.1||pointSegment(0,0,old.x-e.px,old.y-e.py,p.x-e.x,p.y-e.y)>e.r+8)continue;
   if(e.kind==='yeti'){this.catchPlayer(p,e);return;}
   if(!p.crash){p.crash=.7;p.vy=20;this.event('crash',p.x,p.y,{player:0});}
  }
  this.pickups=this.pickups.filter(e=>{
   if(pointSegment(e.x,e.y,old.x,old.y,p.x,p.y)>30)return true;
   this.unlocked[e.slot]=true;this.weapon=e.slot;this.event('pickup',e.x,e.y,{weapon:e.slot});return false;
  });
  const alive=this.entities.filter(e=>e.alive&&e.kind==='yeti').length;
  if(this.remaining>0&&this.time>=this.spawnAt&&alive<48){
   const batch=Math.min(this.remaining,48-alive,2+Math.floor(this.plan.stage/3));
   for(let i=0;i<batch;i++)this.spawnMonster();this.remaining-=batch;this.spawnAt=this.time+.9;
  }
  if(!this.remaining&&!alive){
   this.plan=wavePlan(this.plan.number+1);this.remaining=this.plan.count;
   this.spawnAt=this.breatherUntil=this.time+5;this.supply();
   this.event('wave',p.x,p.y,{number:this.plan.number});
  }
  if(this.time>=this.supplyAt){this.supplyAt=this.time+16;this.supply();}
  this.distance=Math.max(this.distance,Math.floor(p.y*.25));this.generate();
 }
 snapshot(){
  return {...super.snapshot(),mode:'waves',plan:{...this.plan},remaining:this.remaining,breather:Math.max(0,this.breatherUntil-this.time),weapon:this.weapon,unlocked:[...this.unlocked],
   projectiles:this.projectiles.map(({id,x,y,vx,vy,weapon})=>({id,x,y,vx,vy,weapon})),pickups:this.pickups.map(p=>({...p})),aim:{x:this.gunner.x,y:this.gunner.y}};
 }
}
