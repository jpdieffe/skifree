import {chainPath,clamp,random} from './physics.js';
export class Artwork{
  async load(){
    this.map=(await(await fetch('assets/sprites.json')).json()).sprites;
    this.images=await Promise.all(['original.png','partner.png'].map(async name=>{const im=new Image();im.src=`assets/${name}`;await im.decode();return im;}));return this;
  }
  draw(ctx,id,x,y,partner=false,scale=1,flip=false){
    const r=this.map[id];if(!r)return;ctx.save();ctx.translate(Math.round(x),Math.round(y));if(flip)ctx.scale(-1,1);
    ctx.drawImage(this.images[partner?1:0],r.x,r.y,r.w,r.h,-Math.round(r.w*scale/2),-Math.round((r.h-2)*scale),r.w*scale,r.h*scale);ctx.restore();
  }
}
export class View{
  constructor(canvas,artwork,{player=0,preview=false,event=()=>{}}={}){
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.art=artwork;this.player=player;this.preview=preview;this.onEvent=event;this.blood=true;this.state=null;this.previous=null;this.lastEvent=0;this.effects=[];this.trails=[];this.camera=null;this.ghosts=[];this.run=null;this.shake=0;
  }
  set(state,immediate=false){
    if(state.run!==this.run){this.effects=[];this.trails=[];this.lastEvent=0;this.previous=null;this.camera=null;this.run=state.run;}
    this.previous=immediate?state:this.state;this.state=state;this.received=performance.now();
    for(const e of state.events)if(e.id>this.lastEvent){this.lastEvent=e.id;this.effects.push(e);if(e.type==='blood'||e.type==='debris')this.shake=e.kind==='yeti'?7:2;if(!this.preview)this.onEvent(e);}
    this.effects=this.effects.filter(e=>state.time-e.time<25).slice(-180);
  }
  draw(now=performance.now()){
    const s=this.state;if(!s)return;
    const c=this.ctx,w=this.canvas.clientWidth,h=this.canvas.clientHeight,dpr=Math.min(2,devicePixelRatio||1);
    if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);}
    c.setTransform(dpr,0,0,dpr,0,0);c.imageSmoothingEnabled=false;c.fillStyle='#fff';c.fillRect(0,0,w,h);
    const alpha=clamp((now-this.received)/50,0,1),players=s.players.map((p,i)=>{const old=this.previous?.players[i]||p;return {...p,x:old.x+(p.x-old.x)*alpha,y:old.y+(p.y-old.y)*alpha};});
    const [a,b]=players,dx=Math.abs(b.x-a.x),dy=Math.abs(b.y-a.y),preferred=this.preview?1.6:Math.min(2.35,w/210,h/210);
    const zoom=clamp(Math.min(preferred,(w-70)/(dx+80),(h-60)/(dy+140)),.6,2.5),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
    if(!this.camera)this.camera={x:cx,y:cy,z:zoom};const k=.15;this.camera.x+=(cx-this.camera.x)*k;this.camera.y+=(cy-this.camera.y)*k;this.camera.z+=(zoom-this.camera.z)*.09;
    this.shake*=.88;const shakeX=Math.sin(now*.07)*this.shake,shakeY=Math.cos(now*.08)*this.shake*.6;
    c.save();c.translate(w/2+shakeX,h*.39+shakeY);c.scale(this.camera.z,this.camera.z);c.translate(-this.camera.x,-this.camera.y);
    const worldLeft=this.camera.x-w/this.camera.z/2-50,worldRight=this.camera.x+w/this.camera.z/2+50,worldTop=this.camera.y-h/this.camera.z,worldBottom=this.camera.y+h/this.camera.z;
    // Small fixed snow marks preserve the clean original white slope.
    c.fillStyle='#dce7eb';for(let row=Math.floor(worldTop/100);row<worldBottom/100;row++){const rng=random(s.seed+row*103);for(let j=0;j<10;j++){const x=-1200+rng()*2400,y=row*100+rng()*100;if(x>worldLeft&&x<worldRight)c.fillRect(x,y,2,1);}}
    if(!this.preview){const marker=Math.floor(cy/2000)+1,y=marker*2000;c.strokeStyle='#d8e7ec';c.setLineDash([8,8]);c.beginPath();c.moveTo(-1100,y);c.lineTo(1100,y);c.stroke();c.setLineDash([]);c.font='bold 10px system-ui';c.fillStyle='#8ca9b8';c.textAlign='center';c.fillText(`${marker*500} m`,cx,y-8);}
    for(const p of players){if(!p.jump&&!p.crash&&p.vy>20)this.trails.push({x:p.x,y:p.y,angle:p.angle,time:s.time});}
    this.trails=this.trails.filter(t=>s.time-t.time<4).slice(-500);c.strokeStyle='#dce8ee';c.lineWidth=1;
    for(const t of this.trails){c.globalAlpha=clamp(1-(s.time-t.time)/4,0,1)*.6;for(const side of [-3,3]){c.beginPath();c.moveTo(t.x+side,t.y);c.lineTo(t.x+side-Math.sin(t.angle)*5,t.y-Math.cos(t.angle)*5);c.stroke();}}c.globalAlpha=1;
    for(const e of this.effects)if(['blood','debris'].includes(e.type))this.splatter(e,s.time-e.time);
    const objects=s.entities.filter(e=>e.x>worldLeft-80&&e.x<worldRight+80&&e.y>worldTop-80&&e.y<worldBottom+80).map(e=>({...e,object:true}));
    objects.push(...players.map(p=>({...p,object:false})));objects.sort((a,b)=>a.y-b.y);
    this.chain(players,s.tension,s.time);
    for(const o of objects){
      if(o.object){let id=o.variant,flip=false;
        if(o.kind==='skier'){id=28+Math.floor(s.time*5+o.id)%2;flip=o.vx<0;}
        if(o.kind==='boarder'){id=37+Math.floor(s.time*6+o.id)%2;flip=o.vx<0;}
        if(o.kind==='dog'){id=33+Math.floor(s.time*7)%2;flip=o.vx<0;}
        if(o.kind==='yeti')id=70+Math.floor(s.time*9)%4;
        this.art.draw(c,id,o.x,o.y,false,o.kind==='yeti'?1.25:1,flip);
      }else{
        let id=o.crash?12:o.caught?13:o.jump>0?14:Math.abs(o.angle)<.15?1:Math.abs(o.angle)<.5?2:3;
        const lift=o.jump>0?Math.sin(clamp(o.jump/.9,0,1)*Math.PI)*28:0;
        c.fillStyle='#b6c7cf60';c.beginPath();c.ellipse(o.x,o.y+1,8,3,0,0,Math.PI*2);c.fill();this.art.draw(c,id,o.x,o.y-lift,o.id===1,1,o.angle<0);
        if(!this.preview){c.font='bold 8px system-ui';c.textAlign='center';const label=o.id===this.player?'YOU':o.id===0?'RED':'BLUE';c.fillStyle=o.id===0?'#b9433a':'#007b9d';c.fillText(label,o.x,o.y-38-lift);}
      }
    }
    for(const e of this.effects)this.particles(e,s.time-e.time);
    if(s.phase==='yeti'||s.phase==='endless')for(const e of s.entities.filter(e=>e.kind==='yeti')){if(e.y<worldTop+80){c.fillStyle='#e14d3d';c.font='bold 12px system-ui';c.textAlign='center';c.fillText('▲ YETI',clamp(e.x,worldLeft+55,worldRight-55),worldTop+85);}}
    c.restore();
    const warning=this.effects.findLast(e=>e.type==='warning'&&s.time-e.time<3);
    if(warning&&!this.preview){c.textAlign='center';c.fillStyle='#d53636';c.font=`900 ${Math.min(24,w/16)}px system-ui`;c.fillText('YETI TERRITORY',w/2,h*.13);c.fillStyle='#526b7c';c.font='12px system-ui';c.fillText('Spread out. Put the chain in its path.',w/2,h*.13+21);}
  }
  chain(players,tension,time){
    const c=this.ctx,path=chainPath(...players);c.lineJoin='round';c.lineCap='round';c.lineWidth=4;c.strokeStyle='#183e5350';c.beginPath();path.forEach((p,i)=>i?c.lineTo(p.x,p.y+2):c.moveTo(p.x,p.y+2));c.stroke();
    c.strokeStyle=tension>.7?'#dc493b':tension>.3?'#d48b21':'#607782';c.lineWidth=1.5;
    let carry=0;
    for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],length=Math.hypot(b.x-a.x,b.y-a.y),angle=Math.atan2(b.y-a.y,b.x-a.x);for(let d=carry;d<length;d+=6){const t=d/length;c.save();c.translate(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);c.rotate(angle);c.beginPath();c.ellipse(0,0,4,2,0,0,Math.PI*2);c.stroke();c.restore();}carry=(carry-length)%6;if(carry<0)carry+=6;}
    if(tension>.6){c.strokeStyle='#ffd361';c.lineWidth=.6;c.beginPath();path.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();}
  }
  splatter(e,age){
    if(age<0)return;const c=this.ctx,rng=random(e.seed||e.id),blood=e.type==='blood'&&this.blood;c.globalAlpha=clamp(1-(age-15)/10,0,1)*.8;
    for(let i=0;i<(e.kind==='yeti'?36:14);i++){const a=rng()*Math.PI*2,r=rng()*(e.kind==='yeti'?45:24),size=2+rng()*6;c.fillStyle=blood?(i%3?'#a01723':'#d02d37'):e.type==='blood'?'#82b8cb':e.kind==='rock'?'#7c8790':'#387942';c.fillRect(Math.round(e.x+Math.cos(a)*r),Math.round(e.y+Math.sin(a)*r*.65),size,size*.5);}
    c.globalAlpha=1;
  }
  particles(e,age){
    const c=this.ctx;if(age<0||age>2.1)return;
    if(e.type==='blood'||e.type==='debris'){
      const rng=random(e.seed||e.id),blood=e.type==='blood'&&this.blood,count=e.kind==='yeti'?90:e.type==='blood'?48:24;
      for(let i=0;i<count;i++){
        const a=rng()*Math.PI*2,speed=35+rng()*(e.kind==='yeti'?155:110),life=.65+rng()*1.35,size=2+rng()*4;if(age>life)continue;
        const x=e.x+Math.cos(a)*speed*age,y=e.y+Math.sin(a)*speed*age-80*age+70*age*age;
        c.globalAlpha=clamp(1-age/life,0,1);c.fillStyle=blood?['#bd1028','#ed3046','#730a19','#ef7790','#e9e0d8'][i%5]:e.type==='blood'?['#62acc7','#d8e9f1','#3887a2'][i%3]:e.kind==='rock'?['#707985','#a9b4bf'][i%2]:['#286b35','#50a236','#806344'][i%3];c.fillRect(Math.round(x),Math.round(y),size,size*(i%4===0?2:1));
      }c.globalAlpha=1;
      if(age<1){c.font='900 11px system-ui';c.textAlign='center';c.fillStyle=e.kind==='yeti'?'#bd1028':'#d84532';c.fillText(e.kind==='yeti'?'YETI +1000':e.combo>1?`×${e.combo} CHAIN COMBO`:e.type==='debris'?'+20':'+100',e.x,e.y-35-age*25);}
    }else if(e.type==='crash'&&age<.7){this.art.draw(c,12,e.x,e.y,false,1);}
  }
}
