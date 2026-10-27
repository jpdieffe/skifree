export const STEP=1/60,REST_LENGTH=138,MAX_LENGTH=310,FINISH_Y=8000;
// Normal skiing is 118; tucking reaches 185. A fast chain swing also counts.
export const TREE_CUT_SPEED=150;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function random(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function pointSegment(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,t=clamp(((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(px-ax-t*dx,py-ay-t*dy);}
export function chainPath(a,b){
  const distance=Math.hypot(b.x-a.x,b.y-a.y),sag=Math.max(0,REST_LENGTH-distance)*.2;
  return Array.from({length:13},(_,i)=>{const t=i/12;return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t-12+Math.sin(t*Math.PI)*sag};});
}
function inTriangle(p,a,b,c){const cross=(p,a,b)=>(p.x-b.x)*(a.y-b.y)-(a.x-b.x)*(p.y-b.y),d1=cross(p,a,b),d2=cross(p,b,c),d3=cross(p,c,a);return !(Math.min(d1,d2,d3)<0&&Math.max(d1,d2,d3)>0)&&Math.abs(cross(a,b,c))>.00001;}
export function sweptChainHit(entity,previous,current){
  const point={x:entity.x,y:entity.y-(entity.kind==='yeti'?18:8)},old={x:entity.px??entity.x,y:(entity.py??entity.y)-(entity.kind==='yeti'?18:8)},radius=entity.r+3;
  for(let i=1;i<current.length;i++){
    const a=previous[i-1],b=previous[i],c=current[i],d=current[i-1];
    for(const [u,v]of [[a,b],[b,c],[c,d],[d,a]])if(pointSegment(point.x,point.y,u.x,u.y,v.x,v.y)<=radius)return true;
    if(inTriangle(point,a,b,c)||inTriangle(point,a,c,d))return true;
    for(let step=0;step<=4;step++){const t=step/4,px=old.x+(point.x-old.x)*t,py=old.y+(point.y-old.y)*t;if(pointSegment(px,py,a.x+(d.x-a.x)*t,a.y+(d.y-a.y)*t,b.x+(c.x-b.x)*t,b.y+(c.y-b.y)*t)<=radius)return true;}
  }
  return false;
}
function nearestOnSegment(point,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1),x=a.x+dx*t,y=a.y+dy*t;return {x,y,t,d:Math.hypot(x-point.x,y-point.y)};}
export function chainImpactSpeed(e,before,after,dt){
  const point={x:e.x,y:e.y-8};let nearest=null;
  for(let i=1;i<after.length;i++){const hit=nearestOnSegment(point,after[i-1],after[i]);if(!nearest||hit.d<nearest.d)nearest={...hit,i};}
  const {i,t}=nearest,a=after[i-1],b=after[i],oldA=before[i-1],oldB=before[i],length=Math.hypot(b.x-a.x,b.y-a.y)||1;
  const vx=((a.x-oldA.x)*(1-t)+(b.x-oldB.x)*t)/dt,vy=((a.y-oldA.y)*(1-t)+(b.y-oldB.y)*t)/dt;
  return Math.abs(vx*-(b.y-a.y)/length+vy*(b.x-a.x)/length);
}
function obstacleContact(e,players){
  const point={x:e.x,y:e.y-8},path=chainPath(...players);let nearest=null;
  for(let i=1;i<path.length;i++){const hit=nearestOnSegment(point,path[i-1],path[i]);if(!nearest||hit.d<nearest.d)nearest={...hit,r:e.r+3};}
  if(e.kind==='pole')for(const p of players){const hit={x:p.x,y:p.y-12,d:Math.hypot(p.x-point.x,p.y-12-point.y),r:e.r+8};if(hit.d-hit.r<nearest.d-nearest.r)nearest=hit;}
  return {...nearest,nx:nearest.d>.00001?(nearest.x-point.x)/nearest.d:0,ny:nearest.d>.00001?(nearest.y-point.y)/nearest.d:-1};
}
function sweptObstacleHit(e,before,after){return sweptChainHit(e,chainPath(...before),chainPath(...after))||e.kind==='pole'&&after.some((p,i)=>pointSegment(e.x,e.y-8,before[i].x,before[i].y-12,p.x,p.y-12)<=e.r+8);}
export function spring(a,b,dt){
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<=REST_LENGTH)return 0;
  const nx=dx/d,ny=dy/d,radial=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
  const force=Math.max(0,(d-REST_LENGTH)*15+radial*2.4);
  a.vx+=nx*force*dt;a.vy+=ny*force*dt;b.vx-=nx*force*dt;b.vy-=ny*force*dt;
  return clamp((d-REST_LENGTH)/100,0,1);
}
const emptyInput=()=>({x:0,y:0,brake:false,boost:false,jump:false});
const player=(id,x)=>({id,x,y:0,vx:0,vy:95,angle:0,crash:0,jump:0,jumpCooldown:0,caught:false});

export class World{
  constructor(seed=1,run=1){
    this.seed=seed>>>0;this.run=run;this.time=0;this.players=[player(0,-68),player(1,68)];this.inputs=[emptyInput(),emptyInput()];
    this.entities=[];this.events=[];this.nextEntity=1;this.nextEvent=1;this.nextChunk=0;this.score=0;this.kills=0;this.wrecks=0;this.combo=0;this.lastKill=-10;this.distance=0;this.tension=0;this.phase='skiing';this.yetiKills=0;this.nextYeti=FINISH_Y+1100;this.snapArmed=true;
    this.spawn('skier',0,230,{vx:0,vy:12});this.generate();
  }
  spawn(kind,x,y,extra={}){
    const defaults={tree:{r:11,variant:49},pine:{r:15,variant:51},pole:{r:7,variant:64},rock:{r:9,variant:45},skier:{r:10,variant:28,vx:24,vy:38},boarder:{r:11,variant:37,vx:-24,vy:55},dog:{r:8,variant:33,vx:50,vy:0},yeti:{r:19,variant:68,vx:0,vy:0},ramp:{r:14,variant:48}};
    const e={id:this.nextEntity++,kind,x,y,px:x,py:y,alive:true,...defaults[kind],...extra};this.entities.push(e);return e;
  }
  event(type,x,y,extra={}){const e={id:this.nextEvent++,time:this.time,type,x,y,...extra};this.events.push(e);if(this.events.length>100)this.events.shift();return e;}
  generate(){
    const center=this.players.reduce((sum,p)=>sum+p.x,0)/this.players.length,ahead=Math.max(...this.players.map(p=>p.y))+820;
    while(this.nextChunk*320<ahead){
      const chunk=this.nextChunk++,rng=random(this.seed+chunk*7919),base=chunk*320;
      for(let i=0;i<10;i++){
        const x=clamp(center+(rng()-.5)*1050,-1100,1100),y=base+rng()*320;
        if(y<300)continue;
        const chance=rng(),kind=chance<.38?'tree':chance<.52?'pine':chance<.65?'rock':chance<.81?'skier':chance<.91?'boarder':chance<.96?'dog':'ramp';
        this.spawn(kind,x,y,{vx:kind==='skier'?(rng()-.5)*85:kind==='boarder'?(rng()-.5)*100:kind==='dog'?(rng()<.5?-55:55):0});
      }
      // A sparse, predictable course hazard; poles cannot be cut or jumped through.
      if(chunk>=2&&chunk%2===0)this.spawn('pole',clamp(center+(rng()-.5)*650,-1000,1000),base+160);
    }
    const behind=Math.min(...this.players.map(p=>p.y))-700;
    this.entities=this.entities.filter(e=>e.y>behind&&(e.alive||this.time-(e.deadAt||0)<3));
  }
  destroy(e,weapon='chain'){
    if(!e.alive||e.kind==='pole'&&!(this.ball&&weapon==='ball'))return;e.alive=false;e.deadAt=this.time;
    const bloody=['skier','boarder','dog','yeti'].includes(e.kind);this.combo=this.time-this.lastKill<1.7?Math.min(8,this.combo+1):1;this.lastKill=this.time;
    if(bloody)this.kills++;else this.wrecks++;
    this.score+=(e.kind==='yeti'?1000:bloody?100:20)*this.combo;
    this.event(bloody?'blood':'debris',e.x,e.y,{kind:e.kind,weapon,combo:this.combo,seed:(this.seed^e.id*12347)>>>0});
    if(e.kind==='yeti'){this.yetiKills++;if(this.phase==='yeti'){this.phase='won';this.event('win',e.x,e.y);}}
  }
  continue(){if(this.phase==='won'){this.phase='endless';this.nextYeti=Math.max(...this.players.map(p=>p.y))+850;}}
  stopAt(e,before){
    const proposed=this.players.map(p=>({...p})),initial=obstacleContact(e,before),final=obstacleContact(e,proposed);
    // Separating and sideways motion remain available so players can steer around a snag.
    if(initial.d<=initial.r+.1&&final.d>=initial.d-.00001){const separating=(final.x-initial.x)*initial.nx+(final.y-initial.y)*initial.ny;if(separating>=0&&initial.d>.001)return;}
    let lo=0,hi=1;const at=t=>before.map((p,i)=>({...p,x:p.x+(proposed[i].x-p.x)*t,y:p.y+(proposed[i].y-p.y)*t}));
    for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(sweptObstacleHit(e,before,at(mid)))hi=mid;else lo=mid;}
    const contact=at(lo),normal=obstacleContact(e,contact),continuing=this.time-(e.blockedAt??-10)<.25;e.blockedAt=this.time;
    for(let i=0;i<2;i++){const p=this.players[i],dx=proposed[i].x-contact[i].x,dy=proposed[i].y-contact[i].y,inward=Math.min(0,dx*normal.nx+dy*normal.ny);p.x=contact[i].x+dx-inward*normal.nx;p.y=contact[i].y+dy-inward*normal.ny;
      if(!continuing){p.vx=p.vy=0;p.crash=Math.max(p.crash,.65);}else{const speed=Math.min(0,p.vx*normal.nx+p.vy*normal.ny);p.vx-=speed*normal.nx;p.vy-=speed*normal.ny;}p.jump=0;
    }
    const corrected=obstacleContact(e,this.players),push=Math.max(0,corrected.r+.05-corrected.d);for(const p of this.players){p.x+=normal.nx*push;p.y+=normal.ny*push;}
    if(this.time-(e.lastBlockEvent??-10)>.8){e.lastBlockEvent=this.time;this.event('blocked',e.x,e.y,{kind:e.kind});}
  }
  bot(){
    const a=this.players[0],b=this.players[1],target=a.x+135+Math.sin(this.time*.7)*55;
    this.inputs[1]={x:clamp((target-b.x)/85,-1,1),y:clamp((a.y-b.y)/80,-1,1),boost:a.y-b.y>65,brake:b.y-a.y>80,jump:false};
  }
  step(dt=STEP){
    this.time+=dt;if(['won','lost'].includes(this.phase))return;
    const previousPlayers=this.players.map(p=>({...p})),before=chainPath(...this.players);
    for(let i=0;i<2;i++){
      const p=this.players[i],input=this.inputs[i]||emptyInput();
      p.crash=Math.max(0,p.crash-dt);p.jump=Math.max(0,p.jump-dt);p.jumpCooldown=Math.max(0,p.jumpCooldown-dt);
      if(input.jump&&!p.jumpCooldown&&!p.crash){p.jump=.72;p.jumpCooldown=1.4;this.event('jump',p.x,p.y,{player:i});}
      const target=input.brake||input.y<-.35?28:input.boost||input.y>.5?185:118;
      p.vx+=(clamp(input.x,-1,1)*200-p.vx*1.8)*dt;
      p.vy+=((p.crash?25:target)-p.vy)*1.3*dt;
      if(p.crash)p.vx*=Math.exp(-2*dt);
    }
    this.tension=spring(...this.players,dt);
    if(this.tension>.55&&this.snapArmed){this.event('stretch',(this.players[0].x+this.players[1].x)/2,(this.players[0].y+this.players[1].y)/2);this.snapArmed=false;}
    if(this.tension<.15)this.snapArmed=true;
    for(const p of this.players){p.vx=clamp(p.vx,-370,370);p.vy=clamp(p.vy,-280,390);p.x=clamp(p.x+p.vx*dt,-1050,1050);p.y+=p.vy*dt;p.angle=Math.atan2(p.vx,Math.max(25,p.vy));}
    const [a,b]=this.players,dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
    if(d>MAX_LENGTH){const excess=(d-MAX_LENGTH)/2;a.x+=dx/d*excess;a.y+=dy/d*excess;b.x-=dx/d*excess;b.y-=dy/d*excess;}
    // Resolve solid hazards before awarding any kills farther along the attempted sweep.
    const attempted=chainPath(a,b),points=[...before,...attempted,...previousPlayers,...this.players],bounds={left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};
    const obstacles=this.entities.filter(e=>e.alive&&['pole','tree','pine'].includes(e.kind)&&e.x>=bounds.left-e.r-8&&e.x<=bounds.right+e.r+8&&e.y-8>=bounds.top-e.r-8&&e.y-8<=bounds.bottom+e.r+8);
    const cuttable=new Set(obstacles.filter(e=>e.kind!=='pole'&&chainImpactSpeed(e,before,attempted,dt)>=TREE_CUT_SPEED).map(e=>e.id));
    for(let pass=0;pass<3;pass++)for(const e of obstacles){const path=chainPath(a,b);
      if(cuttable.has(e.id)&&chainImpactSpeed(e,before,path,dt)>=TREE_CUT_SPEED)continue;
      if(sweptObstacleHit(e,previousPlayers,this.players))this.stopAt(e,previousPlayers);
    }
    const current=chainPath(a,b);
    for(const e of this.entities){
      if(!e.alive)continue;e.px=e.x;e.py=e.y;
      if(e.kind==='yeti'){
        const target=this.players.reduce((best,p)=>Math.hypot(p.x-e.x,p.y-e.y)<Math.hypot(best.x-e.x,best.y-e.y)?p:best,a),tx=target.x-e.x,ty=target.y-e.y,len=Math.hypot(tx,ty)||1;
        e.vx=tx/len*218;e.vy=ty/len*218;
      }
      e.x+=(e.vx||0)*dt;e.y+=(e.vy||0)*dt;
      if(!['ramp','pole'].includes(e.kind)&&sweptChainHit(e,before,current)&&(!['tree','pine'].includes(e.kind)||cuttable.has(e.id)&&chainImpactSpeed(e,before,current,dt)>=TREE_CUT_SPEED)){this.destroy(e);continue;}
      if(e.kind==='pole')continue;
      for(const p of this.players){
        if(p.jump>.1||Math.hypot(p.x-e.x,p.y-e.y)>e.r+8)continue;
        if(e.kind==='ramp'){if(!p.jumpCooldown){p.jump=.9;p.jumpCooldown=1.3;this.event('jump',p.x,p.y,{player:p.id});}continue;}
        if(e.kind==='yeti'){p.caught=true;this.phase='lost';this.event('caught',p.x,p.y,{player:p.id});break;}
        if(p.crash<=0){p.crash=1.1;p.vy=-30;p.vx+=(p.x<e.x?-85:85);this.event('crash',p.x,p.y,{player:p.id});}
      }
    }
    this.distance=Math.max(this.distance,Math.floor(Math.min(a.y,b.y)*.25));
    if(this.distance>=2000&&this.phase==='skiing'){
      this.phase='yeti';this.spawn('yeti',(a.x+b.x)/2+125,Math.min(a.y,b.y)-240);this.event('warning',(a.x+b.x)/2,(a.y+b.y)/2);
    }
    if(this.phase==='endless'&&Math.min(a.y,b.y)>this.nextYeti){this.spawn('yeti',(a.x+b.x)/2-160,Math.min(a.y,b.y)-260);this.nextYeti+=1000;this.event('warning',a.x,a.y);}
    this.generate();
  }
  snapshot(){
    const round=v=>Math.round(v*10)/10;
    return {run:this.run,seed:this.seed,time:this.time,phase:this.phase,distance:this.distance,score:this.score,kills:this.kills,wrecks:this.wrecks,combo:this.time-this.lastKill<1.7?this.combo:0,tension:this.tension,yetiKills:this.yetiKills,
      players:this.players.map(p=>({...p,x:round(p.x),y:round(p.y),vx:round(p.vx),vy:round(p.vy)})),
      entities:this.entities.filter(e=>e.alive).map(({id,kind,x,y,vx,vy,variant,r})=>({id,kind,x:round(x),y:round(y),vx,vy,variant,r})),
      events:this.events.filter(e=>this.time-e.time<3)};
  }
}
