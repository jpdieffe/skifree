// Original Yeti animation, with distinct silhouettes, movement and durability.
export const YETIS=[
 {type:'regular',name:'Yeti',scale:1.25,hp:1,speed:218},
 {type:'cyborg',name:'Cyborg Yeti',scale:1.35,hp:2,speed:210},
 {type:'huge',name:'Huge Yeti',scale:2.3,hp:3,speed:185},
 {type:'super',name:'Super Yeti',scale:1.5,hp:3,speed:245},
 {type:'tree',name:'Tree Yeti',scale:1.8,hp:4,speed:200},
];
export function yetiProfile(level=1){
 const index=Math.max(0,Math.floor(level)-1),round=Math.floor(index/YETIS.length),base=YETIS[index%YETIS.length];
 return {...base,level:index+1,hp:Math.min(7,base.hp+round),speed:base.speed+Math.min(35,round*8)};
}
export function moveYeti(world,e,dt){
 if(world.time<(e.stunnedUntil||0)){e.vx=e.vy=0;return;}
 const target=world.players.reduce((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)<Math.hypot(b.x-e.x,b.y-e.y)?a:b);
 const profile=yetiProfile(e.level),dx=target.x-e.x,dy=target.y-e.y,d=Math.hypot(dx,dy)||1;
 let speed=profile.speed,nx=dx/d,ny=dy/d;
 // Cyborgs lock their aim, flash their visor, then charge that line.
 if(profile.type==='cyborg'){
  const cycle=(world.time-(e.spawnedAt||0))%3.5;
  if(cycle<2.3){e.aimX=nx;e.aimY=ny;e.charging=false;}
  else {nx=e.aimX??nx;ny=e.aimY??ny;speed=cycle<2.7?60:340;e.charging=true;}
 }
 // Super Yetis weave across the skier's path rather than following a straight line.
 if(profile.type==='super'){const side=Math.sin(world.time*4+e.id)*.55,angle=Math.atan2(ny,nx)+side;nx=Math.cos(angle);ny=Math.sin(angle);}
 e.vx=nx*speed;e.vy=ny*speed;
 // Tree Yetis plant breakable saplings behind them. Cap their count per encounter.
 if(profile.type==='tree'&&world.time>(e.nextPlant||0)&&(e.planted||0)<12){
  e.nextPlant=world.time+2.5;e.planted=(e.planted||0)+1;
  world.spawn('tree',Math.max(-1050,Math.min(1050,e.x-nx*55)),e.y-ny*55,{grownBy:e.id});
 }
}
