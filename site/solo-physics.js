import {World,STEP,clamp,chainPath,sweptChainHit,pointSegment} from './physics.js';

export const BALL_RADIUS=26,BALL_MASS=2.6,BALL_CHAIN_LENGTH=138,BALL_MAX_LENGTH=172;
const solid=e=>['tree','pine','pole'].includes(e.kind);
const center=e=>({x:e.x,y:e.y-(e.kind==='yeti'?18:8)});

// Relative motion sweeps catch moving targets as well as fast ball swings.
export function ballHit(e,before,after){
 const p=center(e),old={x:e.px??e.x,y:(e.py??e.y)-(e.kind==='yeti'?18:8)};
 return pointSegment(0,0,before.x-old.x,before.y-12-old.y,after.x-p.x,after.y-12-p.y)<=BALL_RADIUS+e.r;
}
export function ballTether(a,b,dt){
 const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
 if(d<=BALL_CHAIN_LENGTH)return 0;
 const nx=dx/d,ny=dy/d,radial=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
 const force=Math.max(0,(d-BALL_CHAIN_LENGTH)*24+radial*4);
 a.vx+=nx*force*dt;a.vy+=ny*force*dt;b.vx-=nx*force*dt/BALL_MASS;b.vy-=ny*force*dt/BALL_MASS;
 return clamp((d-BALL_CHAIN_LENGTH)/(BALL_MAX_LENGTH-BALL_CHAIN_LENGTH),0,1);
}
function limitChain(a,b){
 const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<=BALL_MAX_LENGTH)return;
 const nx=dx/d,ny=dy/d,share=BALL_MASS/(1+BALL_MASS),excess=d-BALL_MAX_LENGTH;
 a.x+=nx*excess*share;a.y+=ny*excess*share;b.x-=nx*excess*(1-share);b.y-=ny*excess*(1-share);
 const outward=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
 if(outward>0){a.vx+=nx*outward*share;a.vy+=ny*outward*share;b.vx-=nx*outward*(1-share);b.vy-=ny*outward*(1-share);}
}
function contact(e,bodies){
 const p=center(e),path=chainPath(...bodies);let closest={d:Infinity};
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1),x=a.x+dx*t,y=a.y+dy*t,d=Math.hypot(x-p.x,y-p.y);
  if(d<closest.d)closest={x,y,d,r:e.r+3};
 }
 // The skier still collides with poles even while jumping.
 const a=bodies[0],d=Math.hypot(a.x-p.x,a.y-12-p.y);
 if(e.kind==='pole'&&d-(e.r+8)<closest.d-closest.r)closest={x:a.x,y:a.y-12,d,r:e.r+8};
 return {...closest,nx:closest.d>.00001?(closest.x-p.x)/closest.d:0,ny:closest.d>.00001?(closest.y-p.y)/closest.d:-1};
}
function snagged(e,before,after){
 const p=center(e);return sweptChainHit(e,chainPath(...before),chainPath(...after))||e.kind==='pole'&&pointSegment(p.x,p.y,before[0].x,before[0].y-12,after[0].x,after[0].y-12)<=e.r+8;
}
function stopChain(world,e,before){
 const bodies=[world.players[0],world.ball],proposed=bodies.map(p=>({...p})),initial=contact(e,before),final=contact(e,proposed);
 if(initial.d<=initial.r+.1&&final.d>=initial.d-.00001&&initial.d>.001){
  if((final.x-initial.x)*initial.nx+(final.y-initial.y)*initial.ny>=0)return;
 }
 const at=t=>before.map((p,i)=>({...p,x:p.x+(proposed[i].x-p.x)*t,y:p.y+(proposed[i].y-p.y)*t}));
 let lo=0,hi=1;for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(snagged(e,before,at(mid)))hi=mid;else lo=mid;}
 const stopped=at(lo),normal=contact(e,stopped);
 for(let i=0;i<2;i++){
  const p=bodies[i],dx=proposed[i].x-stopped[i].x,dy=proposed[i].y-stopped[i].y,inward=Math.min(0,dx*normal.nx+dy*normal.ny);
  p.x=stopped[i].x+dx-inward*normal.nx;p.y=stopped[i].y+dy-inward*normal.ny;
  const speed=Math.min(0,p.vx*normal.nx+p.vy*normal.ny);p.vx-=speed*normal.nx;p.vy-=speed*normal.ny;
 }
 const push=Math.max(0,normal.r+.05-contact(e,bodies).d);
 for(const p of bodies){p.x+=normal.nx*push;p.y+=normal.ny*push;}
 if(world.time-(e.blockedAt??-10)>.8){e.blockedAt=world.time;world.event('blocked',e.x,e.y,{kind:e.kind});}
}

export class SoloWorld extends World{
 constructor(seed=1,run=1){
  super(seed,run);this.players=[{...this.players[0],x:0}];
  this.ball={x:92,y:76,vx:0,vy:115,r:BALL_RADIUS,roll:0};
 }
 destroy(e,weapon='chain'){if(solid(e)&&weapon!=='ball')return;super.destroy(e,weapon);}
 step(dt=STEP){
  this.time+=dt;if(['won','lost'].includes(this.phase))return;
  const p=this.players[0],b=this.ball,input=this.inputs[0]||{},before=[{...p},{...b}];
  p.crash=Math.max(0,p.crash-dt);p.jump=Math.max(0,p.jump-dt);p.jumpCooldown=Math.max(0,p.jumpCooldown-dt);
  if(input.jump&&!p.jumpCooldown&&!p.crash){p.jump=.72;p.jumpCooldown=1.4;this.event('jump',p.x,p.y,{player:0});}
  const target=input.brake||input.y<-.35?28:input.boost||input.y>.5?185:118;
  p.vx+=(clamp(input.x||0,-1,1)*220-p.vx*1.8)*dt;p.vy+=((p.crash?25:target)-p.vy)*1.3*dt;
  if(p.crash)p.vx*=Math.exp(-2*dt);
  // Downhill gravity and low rolling friction let the weight overtake the skier
  // when braking, and retain sideways momentum when the skier changes direction.
  b.vx*=Math.exp(-.22*dt);b.vy+=(80-b.vy*.55)*dt;
  this.tension=ballTether(p,b,dt);
  if(this.tension>.55&&this.snapArmed){this.event('stretch',(p.x+b.x)/2,(p.y+b.y)/2);this.snapArmed=false;}
  if(this.tension<.15)this.snapArmed=true;
  for(const body of[p,b]){body.vx=clamp(body.vx,-420,420);body.vy=clamp(body.vy,-280,420);body.x+=body.vx*dt;body.y+=body.vy*dt;}
  limitChain(p,b);
  // Keep the pair inside the course without stretching their chain at the edge.
  const shift=Math.max(0,-1050-Math.min(p.x,b.x))-Math.max(0,Math.max(p.x,b.x)-1050);p.x+=shift;b.x+=shift;
  p.angle=Math.atan2(p.vx,Math.max(25,p.vy));
  for(const e of this.entities){
   if(!e.alive)continue;e.px=e.x;e.py=e.y;
   if(e.kind==='yeti'){const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;e.vx=dx/d*218;e.vy=dy/d*218;}
   e.x+=(e.vx||0)*dt;e.y+=(e.vy||0)*dt;
  }
  // The ball can break a solid hazard, but the chain alone can never cut it.
  // Resolve snags before scoring, so a stopped swing cannot kill beyond the snag.
  for(let pass=0;pass<3;pass++)for(const e of this.entities){
   if(e.alive&&solid(e)&&!ballHit(e,before[1],b)&&snagged(e,before,[p,b]))stopChain(this,e,before);
  }
  const oldChain=chainPath(...before),current=chainPath(p,b);
  for(const e of this.entities){
   if(!e.alive)continue;
   if(e.kind!=='ramp'&&ballHit(e,before[1],b)){this.destroy(e,'ball');continue;}
   if(!solid(e)&&e.kind!=='ramp'&&sweptChainHit(e,oldChain,current)){this.destroy(e);continue;}
   if(p.jump>.1||Math.hypot(p.x-e.x,p.y-e.y)>e.r+8)continue;
   if(e.kind==='ramp'){if(!p.jumpCooldown){p.jump=.9;p.jumpCooldown=1.3;this.event('jump',p.x,p.y,{player:0});}continue;}
   if(e.kind==='yeti'){p.caught=true;this.phase='lost';this.event('caught',p.x,p.y,{player:0});break;}
   if(p.crash<=0){p.crash=1.1;p.vy=-30;p.vx+=(p.x<e.x?-85:85);this.event('crash',p.x,p.y,{player:0});}
  }
  b.roll+=Math.hypot(b.x-before[1].x,b.y-before[1].y)/BALL_RADIUS;
  this.distance=Math.max(this.distance,Math.floor(p.y*.25));
  if(this.distance>=2000&&this.phase==='skiing'){this.phase='yeti';this.spawn('yeti',p.x+125,p.y-240);this.event('warning',p.x,p.y);}
  if(this.phase==='endless'&&p.y>this.nextYeti){this.spawn('yeti',p.x-160,p.y-260);this.nextYeti+=1000;this.event('warning',p.x,p.y);}
  this.generate();
 }
 snapshot(){return {...super.snapshot(),mode:'solo',ball:{...this.ball}};}
}
