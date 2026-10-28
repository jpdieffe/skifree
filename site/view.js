import {chainPath,clamp,random} from './physics.js';
import {yetiProfile} from './yetis.js';
export function slopeZoom(w,h,dx,dy){return clamp(Math.min(1.25,w/480,h/380,(w-70)/(dx+100),(h-65)/(dy+180)),.35,1.25);}
export class Artwork{
  async load(){
    this.map=(await(await fetch('assets/sprites.json')).json()).sprites;
    this.images=await Promise.all(['original.png','partner.png'].map(async name=>{const im=new Image();im.src=`assets/${name}`;await im.decode();return im;}));return this;
  }
  draw(ctx,id,x,y,partner=false,scale=1,flip=false,tone=null){
    const r=this.map[id];if(!r)return;ctx.save();ctx.translate(Math.round(x),Math.round(y));if(flip)ctx.scale(-1,1);
    let image=this.images[partner?1:0],sx=r.x,sy=r.y;
    if(tone){
      this.tints??=new Map();const key=`${id}:${tone}`;
      if(!this.tints.has(key)){
        const canvas=document.createElement('canvas');canvas.width=r.w;canvas.height=r.h;const c=canvas.getContext('2d');c.drawImage(image,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
        const pixels=c.getImageData(0,0,r.w,r.h),rgb={cyborg:[130,167,185],huge:[195,215,245],super:[245,210,115],tree:[92,154,65]}[tone];
        if(rgb)for(let i=0;i<pixels.data.length;i+=4){const d=pixels.data;if(d[i+3]&&Math.min(d[i],d[i+1],d[i+2])>130){const light=Math.max(d[i],d[i+1],d[i+2])/255;for(let j=0;j<3;j++)d[i+j]=rgb[j]*light;}}
        c.putImageData(pixels,0,0);this.tints.set(key,canvas);
      }
      image=this.tints.get(key);sx=sy=0;
    }
    ctx.drawImage(image,sx,sy,r.w,r.h,-Math.round(r.w*scale/2),-Math.round((r.h-2)*scale),r.w*scale,r.h*scale);ctx.restore();
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
    const ball=s.mode==='solo'&&players.length===1&&s.ball?{...s.ball}:null,bodies=ball?[players[0],ball]:players;
    const [a,b]=bodies,dx=Math.abs(b.x-a.x),dy=Math.abs(b.y-a.y);
    const zoom=this.preview?1.6:slopeZoom(w,h,dx,dy),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
    if(!this.camera)this.camera={x:cx,y:cy,z:zoom};const k=.15;this.camera.x+=(cx-this.camera.x)*k;this.camera.y+=(cy-this.camera.y)*k;this.camera.z+=(zoom-this.camera.z)*.09;
    this.shake*=.88;const shakeX=Math.sin(now*.07)*this.shake,shakeY=Math.cos(now*.08)*this.shake*.6;
    const anchor=ball?.44:.39;c.save();c.translate(w/2+shakeX,h*anchor+shakeY);c.scale(this.camera.z,this.camera.z);c.translate(-this.camera.x,-this.camera.y);
    const worldLeft=this.camera.x-w/this.camera.z/2,worldRight=this.camera.x+w/this.camera.z/2,worldTop=this.camera.y-h*anchor/this.camera.z,worldBottom=this.camera.y+h*(1-anchor)/this.camera.z;
    // Small fixed snow marks preserve the clean original white slope.
    c.fillStyle='#dce7eb';for(let row=Math.floor(worldTop/100);row<worldBottom/100;row++){const rng=random(s.seed+row*103);for(let j=0;j<10;j++){const x=-1200+rng()*2400,y=row*100+rng()*100;if(x>worldLeft&&x<worldRight)c.fillRect(x,y,2,1);}}
    if(!this.preview){const marker=Math.floor(cy/2000)+1,y=marker*2000;c.strokeStyle='#d8e7ec';c.setLineDash([8,8]);c.beginPath();c.moveTo(-1100,y);c.lineTo(1100,y);c.stroke();c.setLineDash([]);c.font='bold 10px system-ui';c.fillStyle='#8ca9b8';c.textAlign='center';c.fillText(`${marker*500} m`,cx,y-8);}
    for(const p of players){if(!p.jump&&!p.crash&&p.vy>20)this.trails.push({x:p.x,y:p.y,angle:p.angle,time:s.time});}
    this.trails=this.trails.filter(t=>s.time-t.time<4).slice(-500);c.strokeStyle='#dce8ee';c.lineWidth=1;
    for(const t of this.trails){c.globalAlpha=clamp(1-(s.time-t.time)/4,0,1)*.6;for(const side of [-3,3]){c.beginPath();c.moveTo(t.x+side,t.y);c.lineTo(t.x+side-Math.sin(t.angle)*5,t.y-Math.cos(t.angle)*5);c.stroke();}}c.globalAlpha=1;
    for(const e of this.effects)if(['blood','debris'].includes(e.type))this.splatter(e,s.time-e.time);
    const objects=s.entities.filter(e=>e.x>worldLeft-80&&e.x<worldRight+80&&e.y>worldTop-80&&e.y<worldBottom+80).map(e=>({...e,object:true}));
    objects.push(...players.map(p=>({...p,object:false})));if(ball)objects.push({...ball,kind:'ball',object:true});objects.sort((a,b)=>a.y-b.y);
    this.chain(bodies,s.tension,s.time,!!ball);
    for(const o of objects){
      if(o.object){let id=o.variant,flip=false;
        if(o.kind==='ball'){this.ball(o);continue;}
        if(o.kind==='pole'){
          c.fillStyle='#8ba4af60';c.beginPath();c.ellipse(o.x+4,o.y-7,10,3,0,0,Math.PI*2);c.fill();
          c.fillStyle='#3e5662';c.fillRect(o.x-3,o.y-57,6,49);c.fillStyle='#c9d7df';c.fillRect(o.x-1,o.y-56,2,48);
          c.fillStyle='#ef6348';c.fillRect(o.x-4,o.y-57,8,5);c.fillRect(o.x-3,o.y-43,6,5);c.fillRect(o.x-3,o.y-29,6,5);
          c.fillStyle='#465e6a';c.fillRect(o.x-7,o.y-10,14,3);continue;
        }
        if(o.kind==='skier'){id=28+Math.floor(s.time*5+o.id)%2;flip=o.vx<0;}
        if(o.kind==='boarder'){id=37+Math.floor(s.time*6+o.id)%2;flip=o.vx<0;}
        if(o.kind==='dog'){id=33+Math.floor(s.time*7)%2;flip=o.vx<0;}
        if(o.kind==='yeti'){this.yeti(o,s.time);continue;}
        this.art.draw(c,id,o.x,o.y,false,1,flip);
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
    if(warning&&!this.preview){c.textAlign='center';c.fillStyle='#d53636';c.font=`900 ${Math.min(24,w/16)}px system-ui`;c.fillText(`LEVEL ${warning.level||1}: ${yetiProfile(warning.level).name.toUpperCase()}`,w/2,h*.2);c.fillStyle='#526b7c';c.font='12px system-ui';c.fillText(ball?'Hold SWING. Steer to change direction.':'Spread out. Put the chain in its path.',w/2,h*.2+21);}
  }
  yeti(o,time){
    const c=this.ctx,p=yetiProfile(o.level),id=70+Math.floor(time*9)%4,scale=p.scale,h=this.art.map[id].h*scale;
    c.save();
    if(p.type==='super'){c.fillStyle='#d63c42';c.beginPath();c.moveTo(o.x-8,o.y-h*.65);c.lineTo(o.x-32-Math.sin(time*9)*7,o.y-4);c.lineTo(o.x+12,o.y-13);c.closePath();c.fill();}
    if(p.type==='tree'){
      c.strokeStyle='#735033';c.lineWidth=6;c.beginPath();c.moveTo(o.x-15,o.y-25);c.lineTo(o.x-38,o.y-51);c.lineTo(o.x-35,o.y-65);c.moveTo(o.x+15,o.y-25);c.lineTo(o.x+38,o.y-51);c.lineTo(o.x+42,o.y-65);c.stroke();
      c.fillStyle='#387735';for(const side of[-1,1]){c.beginPath();c.moveTo(o.x+side*38,o.y-78);c.lineTo(o.x+side*38-16,o.y-51);c.lineTo(o.x+side*38+16,o.y-51);c.fill();}
    }
    if(o.hitUntil>time&&Math.floor(time*15)%2)c.globalAlpha=.55;
    this.art.draw(c,id,o.x,o.y,false,scale,false,p.type==='regular'?null:p.type);
    c.globalAlpha=1;
    if(p.type==='cyborg'){
      c.fillStyle='#3e5664';c.fillRect(o.x-14,o.y-h*.72,28,8);c.fillStyle=o.charging?'#ffed74':'#f04444';c.fillRect(o.x-11,o.y-h*.72+2,22,3);
      c.fillStyle='#8ba4b0';c.fillRect(o.x-14,o.y-18,10,12);c.fillRect(o.x+4,o.y-18,10,12);
    }
    c.font='bold 10px system-ui';c.textAlign='center';c.fillStyle='#344d5c';c.fillText(p.name,o.x,o.y-h-11);
    const bar=Math.max(38,scale*26);c.fillStyle='#dbe5e9';c.fillRect(o.x-bar/2,o.y-h-7,bar,4);c.fillStyle='#d74743';c.fillRect(o.x-bar/2,o.y-h-7,bar*(o.hp/o.maxHp),4);c.restore();
  }
  ball(ball){
    const c=this.ctx,r=ball.r,x=ball.x,y=ball.y-12;
    c.fillStyle='#60788835';c.beginPath();c.ellipse(x+5,y+r-1,r+4,8,0,0,Math.PI*2);c.fill();
    const metal=c.createRadialGradient(x-r*.38,y-r*.4,2,x,y,r);
    metal.addColorStop(0,'#f2f8fa');metal.addColorStop(.24,'#b4c7d0');metal.addColorStop(.57,'#738b99');metal.addColorStop(.85,'#344d5c');metal.addColorStop(1,'#172c38');
    c.fillStyle=metal;c.strokeStyle='#172e3c';c.lineWidth=2;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.stroke();
    c.save();c.translate(x,y);c.rotate(ball.roll*.5);c.strokeStyle='#233c4b90';c.lineWidth=2;c.beginPath();c.ellipse(0,0,r*.4,r-2,0,0,Math.PI*2);c.stroke();
    for(let i=0;i<4;i++){const a=i*Math.PI/2;c.fillStyle='#d4e1e5';c.fillRect(Math.cos(a)*r*.68-1,Math.sin(a)*r*.68-1,3,3);}c.restore();
    c.fillStyle='#ffffffaa';c.beginPath();c.ellipse(x-r*.34,y-r*.44,6,3,-.6,0,Math.PI*2);c.fill();
    c.strokeStyle='#203b49';c.lineWidth=3;c.beginPath();c.ellipse(x,y,5,3,0,0,Math.PI*2);c.stroke();
  }
  chain(players,tension,time,solo=false){
    const c=this.ctx,path=chainPath(...players);if(solo&&players[0].jump>0){const lift=Math.sin(clamp(players[0].jump/.9,0,1)*Math.PI)*28;path.unshift({x:players[0].x,y:players[0].y-12-lift});}c.lineJoin='round';c.lineCap='round';c.lineWidth=4;c.strokeStyle='#183e5350';c.beginPath();path.forEach((p,i)=>i?c.lineTo(p.x,p.y+2):c.moveTo(p.x,p.y+2));c.stroke();
    c.strokeStyle=tension>.7?'#dc493b':tension>.3?'#d48b21':'#607782';c.lineWidth=1.5;
    let carry=0;
    for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],length=Math.hypot(b.x-a.x,b.y-a.y),angle=Math.atan2(b.y-a.y,b.x-a.x);for(let d=carry;d<length;d+=6){const t=d/length;c.save();c.translate(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);c.rotate(angle);c.beginPath();c.ellipse(0,0,4,2,0,0,Math.PI*2);c.stroke();c.restore();}carry=(carry-length)%6;if(carry<0)carry+=6;}
    if(tension>.6){c.strokeStyle='#ffd361';c.lineWidth=.6;c.beginPath();path.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();}
  }
  splatter(e,age){
    if(age<0)return;const c=this.ctx,rng=random(e.seed||e.id),blood=e.type==='blood'&&this.blood;c.globalAlpha=clamp(1-(age-15)/10,0,1)*.8;
    for(let i=0;i<(e.kind==='yeti'?36:14);i++){const a=rng()*Math.PI*2,r=rng()*(e.kind==='yeti'?45:24),size=2+rng()*6;c.fillStyle=blood?(i%3?'#a01723':'#d02d37'):e.type==='blood'?'#82b8cb':['rock','pole'].includes(e.kind)?'#7c8790':'#387942';c.fillRect(Math.round(e.x+Math.cos(a)*r),Math.round(e.y+Math.sin(a)*r*.65),size,size*.5);}
    c.globalAlpha=1;
  }
  particles(e,age){
    const c=this.ctx;if(age<0||age>2.1)return;
    if(e.type==='blood'||e.type==='debris'){
      const rng=random(e.seed||e.id),blood=e.type==='blood'&&this.blood,count=e.kind==='yeti'?90:e.type==='blood'?48:24;
      for(let i=0;i<count;i++){
        const a=rng()*Math.PI*2,speed=35+rng()*(e.kind==='yeti'?155:110),life=.65+rng()*1.35,size=2+rng()*4;if(age>life)continue;
        const x=e.x+Math.cos(a)*speed*age,y=e.y+Math.sin(a)*speed*age-80*age+70*age*age;
        c.globalAlpha=clamp(1-age/life,0,1);c.fillStyle=blood?['#bd1028','#ed3046','#730a19','#ef7790','#e9e0d8'][i%5]:e.type==='blood'?['#62acc7','#d8e9f1','#3887a2'][i%3]:['rock','pole'].includes(e.kind)?['#707985','#a9b4bf'][i%2]:['#286b35','#50a236','#806344'][i%3];c.fillRect(Math.round(x),Math.round(y),size,size*(i%4===0?2:1));
      }c.globalAlpha=1;
      if(age<1){c.font='900 11px system-ui';c.textAlign='center';c.fillStyle=e.kind==='yeti'?'#bd1028':'#d84532';c.fillText(e.kind==='yeti'?'YETI +1000':e.combo>1?`×${e.combo} CHAIN COMBO`:e.type==='debris'?'+20':'+100',e.x,e.y-35-age*25);}
    }else if(e.type==='armor'&&age<.7){
      c.fillStyle='#d38123';c.font='bold 12px system-ui';c.textAlign='center';c.fillText(`${e.hp} HITS LEFT`,e.x,e.y-60-age*20);
    }else if(e.type==='blocked'&&age<.7){
      c.strokeStyle=e.kind==='pole'?'#e99c33':'#517b42';c.lineWidth=1.5;
      for(let i=0;i<8;i++){const a=i*Math.PI/4,r=5+age*25;c.beginPath();c.moveTo(e.x+Math.cos(a)*r,e.y-8+Math.sin(a)*r);c.lineTo(e.x+Math.cos(a)*(r+5),e.y-8+Math.sin(a)*(r+5));c.stroke();}
    }else if(e.type==='crash'&&age<.7){this.art.draw(c,12,e.x,e.y,false,1);}
  }
}
