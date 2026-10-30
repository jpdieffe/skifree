import {World,STEP,clamp} from './physics.js';
import {SoloWorld} from './solo-physics.js';
import {Artwork,View} from './view.js';
import {Room} from './room.js';
import {parseCode} from './protocol.js';
import {Sound} from './sound.js';
import {yetiProfile,EATING_DURATION} from './yetis.js';
import {WaveWorld,WEAPONS} from './waves.js';
const $=id=>document.getElementById(id),zero=()=>({x:0,y:0,brake:false,boost:false,jump:false,swing:false}),sound=new Sound();
let art,view,world,room,mode='',remote=zero(),peerHidden=false,localHidden=document.hidden,connected=false,run=0,last=performance.now(),acc=0,networkTime=0,lastState,overlayAction=null;
const isWaves=()=>['waves','waves-host','waves-guest'].includes(mode),isGuest=()=>['guest','waves-guest'].includes(mode),onlineWaves=()=>['waves-host','waves-guest'].includes(mode);
const gunner={x:0,y:300,fire:false,weapon:-1};let aimPointer=null;
const desktop=()=>matchMedia('(any-pointer:fine)').matches;
const mouse={x:0,y:0,active:false,fire:false};
const keys=new Set(),actions=new Set();let pad={x:0,y:0},padPointer=null;
const seed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
const settings=()=>({turn:$('turn').value.trim(),username:$('username').value,credential:$('credential').value,host:$('peer-host').value.trim(),path:$('peer-path').value.trim()||'/'});
const isHost=()=>['host','waves-host'].includes(mode),presenceHidden=()=>localHidden||onlineWaves()&&!$('options').hidden,paused=()=>isHost()&&(!connected||peerHidden||presenceHidden())||['practice','solo','waves'].includes(mode)&&(localHidden||mode==='waves'&&!$('options').hidden);
function input(){return {x:clamp(pad.x+(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0),-1,1),y:pad.y,brake:actions.has('brake')||keys.has('ArrowUp')||keys.has('KeyW'),boost:actions.has('boost')||keys.has('ArrowDown')||keys.has('KeyS')||keys.has('ShiftLeft'),jump:actions.has('jump')||keys.has('Space'),swing:mode==='solo'&&(actions.has('swing')||keys.has('KeyE'))};}
function release(){mouse.fire=false;gunner.fire=false;gunner.weapon=-1;aimPointer=null;$('aim-stick').style.transform='';$('aim-pad').classList.remove('active');if(world?.gunner)world.gunner.fire=false;keys.clear();actions.clear();pad={x:0,y:0};padPointer=null;$('stick').style.transform='';document.querySelectorAll('.actions button').forEach(b=>b.classList.remove('active'));room?.input(mode==='waves-guest'?{...gunner,fire:false}:zero());}
function showOverlay(kicker,title,text,action,label){$('overlay').hidden=false;$('overlay-kicker').textContent=kicker;$('overlay-title').textContent=title;$('overlay-text').textContent=text;overlayAction=action;$('overlay-action').hidden=!action;$('overlay-action').textContent=label||'';$('continue').hidden=true;}
function startGame(next){mode=next;release();$('lobby').hidden=true;$('game').hidden=false;document.body.classList.add('playing');document.body.classList.toggle('solo',next==='solo');document.body.classList.toggle('waves',isWaves());document.body.classList.toggle('online-waves',onlineWaves());document.body.classList.toggle('gunner',next==='waves-guest');$('gunner-controls').hidden=next!=='waves-guest';$('arsenal').hidden=!isWaves();mouse.active=false;document.querySelector('[data-action="swing"]').hidden=next!=='solo';$('options').hidden=true;$('mode').textContent=next==='waves-host'?'ONLINE / SKIER':next==='waves-guest'?'ONLINE / GUNNER':next==='waves'?'YETI ONSLAUGHT / DESKTOP':next==='solo'?'SOLO WRECKING BALL':next==='practice'?'BOT PARTNER':next==='host'?'RED SKIER':'BLUE SKIER';$('invite').hidden=['practice','solo','waves'].includes(next);$('slope').setAttribute('aria-label',isWaves()?'Yeti Onslaught: skier and gunner':next==='solo'?'SkiFree solo skier and chained wrecking ball':'SkiFree multiplayer slope');$('notice').textContent=onlineWaves()?(next==='waves-host'?'You ski. Your partner shoots. Collect weapon crates.':'Drag the aim pad to aim + fire. Tap a weapon to equip it.'):next==='waves'?'P1: ski with keyboard. P2: aim + hold left click. 1-6 switch guns.':next==='solo'?'Hold SWING (E) to spin. Steer to reverse the swing.':'';$('restart').hidden=isGuest();view=new View($('slope'),art,{player:next==='guest'?1:0,event:e=>{sound.play(e);if(e.type==='pickup')$('notice').textContent=`${WEAPONS[e.weapon].name} equipped! `;if(e.type==='blocked')$('notice').textContent=mode==='solo'?'Chain snagged! Swing the ball into it, or steer around.':e.kind==='pole'?'Metal pole! Steer around it.':'Too slow! Tuck to cut trees, or steer around.';}});view.blood=$('blood').checked;sound.start();last=performance.now();acc=0;lastState=null;}
function newRun(){if(isGuest())return;release();if(mode==='waves')$('notice').textContent='P1: keyboard skis. P2: mouse aims + shoots. Collect crates; keys 1-6 switch guns.';world=isWaves()?new WaveWorld(seed(),++run):mode==='solo'?new SoloWorld(seed(),++run):new World(seed(),++run);remote=zero();update(world.snapshot());}
function update(state){if(isGuest()&&(lastState?.run!==state.run||state.paused&&!lastState?.paused))release();lastState=state;if(isGuest()||view?.run!==state.run)view?.set(state,!isGuest());$('distance').textContent=`${state.distance.toLocaleString()} m`;$('score').textContent=`${state.score.toLocaleString()} points · ${state.kills} hits`;$('tension').style.width=`${state.tension*100}%`;
 const boss=state.entities.find(e=>e.kind==='yeti');$('encounter').textContent=boss?`LEVEL ${boss.level} / ${yetiProfile(boss.level).name.toUpperCase()} / ${boss.hp} hits left`:`NEXT: ${yetiProfile(state.yetiKills+1).name.toUpperCase()} / ${state.nextYetiDistance?.toLocaleString()||'2,000'} m`;
 if(isWaves())updateArsenal(state);
 if(!connected&&!['practice','solo','waves'].includes(mode))return;
 if(state.paused){showOverlay('TAKE A BREATHER','Run paused',['solo','waves'].includes(mode)?'Return to the game to keep skiing.':'Keep both game tabs visible and close the options menus to keep skiing.');return;}
 if(state.phase==='won'||state.phase==='lost'){
  const finish=state.capture||state.events.findLast(e=>e.type==='win'||e.type==='caught');if(finish&&state.time-finish.time<(state.phase==='lost'?EATING_DURATION:1.2)){$('overlay').hidden=true;return;}
  const won=state.phase==='won';showOverlay(won?'CHAIN REACTION':'MOUNTAIN 1 / SKIERS 0',won?'You shredded the yeti!':'The yeti got you.',`${state.score.toLocaleString()} points · ${state.kills} hits · ${state.distance.toLocaleString()} m${isGuest()?' · Waiting for your host.':''}`,isGuest()?null:newRun,'Another run');$('continue').hidden=!won||isGuest();
 }else $('overlay').hidden=true;
}
async function connect(host,code){
 room?.close();connected=false;peerHidden=false;remote=zero();
 const current=room=new Room({
  status:text=>{$('notice').textContent=text;},
  connected:gameMode=>{if(room!==current)return;if(!host)startGame(gameMode==='waves'?'waves-guest':'guest');connected=true;peerHidden=false;remote=zero();$('notice').textContent=onlineWaves()?(host?'You ski. Your partner shoots. Collect weapon crates.':'Drag the aim pad to aim + fire. Tap a weapon to equip it.'):'Connected. Stay close. Swing wide.';room.send({type:'presence',hidden:presenceHidden()});if(host){if(!world)newRun();sendState();}else showOverlay('LINKED UP','Your skis are connected','Loading the mountain…');},
  input:value=>{remote=value;if(mode==='waves-host'&&value.weapon>=0&&!paused())world?.select(value.weapon);},
  state:state=>update(state),
  presence:hidden=>{peerHidden=hidden;remote=zero();if(world?.gunner)world.gunner.fire=false;if(host)sendState();},
  disconnected:()=>{connected=false;remote=zero();release();showOverlay('CONNECTION LOST',host?'Your friend disconnected':'Your host disconnected',host?'The run is paused. Your friend can rejoin with the same code.':'Ask your host to keep the room open, then rejoin.',host?copyInvite:()=>connect(false,code),host?'Copy invite':'Reconnect');},
  error:message=>{if(room!==current)return;$('lobby-status').textContent=message;if(mode)showOverlay('CONNECTION HELP','Could not connect',message,host?()=>connect(true):()=>connect(false,code),'Try again');},
  latency:ms=>{$('connection-status').textContent=`${ms} ms`;}
 },{...settings(),mode:mode==='waves-host'?'waves':'chain'});
 showOverlay('LINK UP',host?'Opening your room…':'Connecting your skis…','Keep this tab open.');
 try{const result=await current.open(host,code);if(room!==current)return;$('room-code').textContent=result;if(host&&!connected)showOverlay('ROOM '+result,'Bring your partner',`Your two-character room is ${result}. Share the invitation; the run starts when your friend joins.`,copyInvite,'Copy invitation');}catch(e){if(room===current)showOverlay('CONNECTION HELP','Could not open the room',e.message,()=>connect(host,code),'Try again');}
}
function sendState(){if(!world)return;const state={...world.snapshot(),paused:paused()};update(state);if(room?.accepted)room.send({type:'state',state});}
async function copyInvite(){const url=new URL(location.href);url.search='';url.hash=`room=${room.code}`;try{await navigator.clipboard.writeText(url.href);$('notice').textContent='Invitation copied';$('overlay-text').textContent=`Invitation copied! Room ${room.code}. Keep this tab open.`;}catch{$('notice').textContent=url.href;$('overlay-text').textContent=url.href;}}
$('host').onclick=()=>{world=null;startGame('host');connect(true);};
$('online-waves').onclick=()=>{world=null;startGame('waves-host');connect(true);};
$('waves').onclick=()=>{if(!desktop())return;connected=true;startGame('waves');newRun();};
$('solo').onclick=()=>{connected=true;startGame('solo');newRun();};
$('practice').onclick=()=>{connected=true;startGame('practice');newRun();};
$('join-form').onsubmit=e=>{e.preventDefault();const code=parseCode($('code').value);if(!code){$('lobby-status').textContent='Use the two letters or numbers shown on your friend’s screen.';return;}world=null;startGame('guest');connect(false,code);};
$('overlay-action').onclick=()=>overlayAction?.();$('continue').onclick=()=>{world?.continue();sendState();};$('invite').onclick=copyInvite;
$('restart').onclick=()=>{$('options').hidden=true;room?.send({type:'presence',hidden:presenceHidden()});newRun();};
$('leave').onclick=()=>{room?.close();room=null;world=null;mode='';connected=false;release();$('game').hidden=true;$('lobby').hidden=false;document.body.classList.remove('playing','waves','online-waves','gunner','solo');$('lobby-status').textContent='The mountain is ready.';};
$('menu-toggle').onclick=()=>{$('options').hidden=!$('options').hidden;$('menu-toggle').setAttribute('aria-expanded',String(!$('options').hidden));release();room?.send({type:'presence',hidden:presenceHidden()});if(isHost())sendState();};
$('blood').onchange=()=>{if(view)view.blood=$('blood').checked;};$('sound').onchange=()=>{sound.enabled=$('sound').checked;sound.start();};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else $('notice').textContent='Rotate your phone for a wider view.';}catch{$('notice').textContent='Rotate your phone for a wider view.';}};
$('touch').checked=matchMedia('(pointer:coarse)').matches;$('touch').onchange=()=>document.body.classList.toggle('touch',$('touch').checked);$('touch').onchange();
addEventListener('keydown',e=>{if(!mode||e.target instanceof HTMLInputElement)return;if(isWaves()&&/^Digit[1-6]$/.test(e.code)){e.preventDefault();selectWeapon(Number(e.code.slice(-1))-1);return;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','KeyE'].includes(e.code)){e.preventDefault();keys.add(e.code);}});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',release);
document.addEventListener('visibilitychange',()=>{localHidden=document.hidden;release();room?.send({type:'presence',hidden:presenceHidden()});if(isHost())sendState();last=performance.now();acc=0;});
const movePad=e=>{const r=$('pad').getBoundingClientRect(),dx=clamp((e.clientX-r.left-r.width/2)/(r.width*.36),-1,1),dy=clamp((e.clientY-r.top-r.height/2)/(r.height*.36),-1,1);pad={x:Math.abs(dx)<.12?0:dx,y:Math.abs(dy)<.12?0:dy};$('stick').style.transform=`translate(${dx*35}px,${dy*35}px)`;};
$('pad').onpointerdown=e=>{if(padPointer!==null)return;e.preventDefault();padPointer=e.pointerId;$('pad').setPointerCapture(e.pointerId);movePad(e);sound.start();};$('pad').onpointermove=e=>{if(e.pointerId===padPointer)movePad(e);};
const endPad=e=>{if(e.pointerId!==padPointer)return;padPointer=null;pad={x:0,y:0};$('stick').style.transform='';};$('pad').onpointerup=endPad;$('pad').onpointercancel=endPad;$('pad').onlostpointercapture=endPad;
document.querySelectorAll('[data-action]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);actions.add(b.dataset.action);b.classList.add('active');sound.start();};const end=()=>{actions.delete(b.dataset.action);b.classList.remove('active');};b.onpointerup=end;b.onpointercancel=end;b.onlostpointercapture=end;});
const weaponButtons=WEAPONS.map((gun,i)=>{
 const b=document.createElement('button');b.type='button';b.style.setProperty('--gun',gun.color);b.innerHTML=`<b>${i+1}</b><span>${gun.short}</span><small>LOCKED</small>`;b.onclick=()=>selectWeapon(i);$('arsenal').append(b);return b;
});
function updateArsenal(s){
 const alive=s.entities.filter(e=>e.kind==='yeti').length;
 $('encounter').textContent=`STAGE ${s.plan.stage} / ${s.plan.name.toUpperCase()} / WAVE ${s.plan.wave} OF 3 / ${s.remaining+alive} MONSTERS LEFT`;
 weaponButtons.forEach((b,i)=>{b.disabled=!s.unlocked[i]||mode==='waves-host';b.classList.toggle('selected',s.weapon===i);b.setAttribute('aria-pressed',String(s.weapon===i));b.querySelector('small').textContent=s.weapon===i?'EQUIPPED':s.unlocked[i]?'READY':'FIND PICKUP';});
}
function selectWeapon(slot){if(!(world?.unlocked||lastState?.unlocked)?.[slot]||mode==='waves-host')return;if(mode==='waves-guest')gunner.weapon=slot;else world?.select(slot);}
function updateGunner(){
 const r=$('slope').getBoundingClientRect(),v=view.camera,z=v?.z||1,p=world.players[0];
 view.pointer=mouse.active?{x:mouse.x,y:mouse.y}:null;
 world.viewport={halfWidth:r.width/(2*z),above:r.height*.44/z,below:r.height*.56/z};
 if(mode==='waves-host'){view.pointer=null;world.gunner={x:p.x+(remote.x||0),y:p.y-18+(remote.y||0),fire:!!remote.fire&&!paused()&&world.phase!=='lost'};return;}
 const aim=mouse.active?view.screenToWorld(mouse.x-r.left,mouse.y-r.top):{x:p.x,y:p.y+250};
 world.gunner={...aim,fire:mouse.fire&&!paused()&&world.phase!=='lost'};
}
const aimMouse=e=>{if(e.pointerType==='touch')return;mouse.x=e.clientX;mouse.y=e.clientY;mouse.active=true;};
$('slope').addEventListener('pointermove',aimMouse);
$('slope').addEventListener('pointerdown',e=>{if(mode!=='waves'||e.button!==0||e.pointerType==='touch')return;e.preventDefault();aimMouse(e);mouse.fire=true;$('slope').setPointerCapture(e.pointerId);sound.start();});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('slope').addEventListener(type,()=>{mouse.fire=false;});
// Relative aim stays attached to the skier while the host advances downhill.
function aimAt(e){
 const p=lastState?.players[0];if(!p||!view?.camera)return;
 const r=$('slope').getBoundingClientRect(),target=view.screenToWorld(e.clientX-r.left,e.clientY-r.top);
 gunner.x=clamp(target.x-p.x,-1200,1200);gunner.y=clamp(target.y-(p.y-18),-1200,1200);
}
const moveAim=e=>{
 const r=$('aim-pad').getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/(r.width*.36),y=(e.clientY-r.top-r.height/2)/(r.height*.36),length=Math.hypot(x,y),scale=Math.max(1,length);
 if(length>.12){gunner.x=x/scale*550;gunner.y=y/scale*550;}
 $('aim-stick').style.transform=`translate(${x/scale*35}px,${y/scale*35}px)`;
};
$('aim-pad').onpointerdown=e=>{if(aimPointer!==null||!connected||lastState?.paused)return;e.preventDefault();aimPointer=e.pointerId;$('aim-pad').setPointerCapture(e.pointerId);moveAim(e);gunner.fire=true;$('aim-pad').classList.add('active');sound.start();};
$('aim-pad').onpointermove=e=>{if(e.pointerId===aimPointer)moveAim(e);};
const endAim=e=>{if(e.pointerId!==aimPointer)return;aimPointer=null;gunner.fire=false;$('aim-stick').style.transform='';$('aim-pad').classList.remove('active');room?.input({...gunner,fire:false,weapon:-1});};
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('aim-pad').addEventListener(type,endAim);
$('slope').addEventListener('pointerdown',e=>{if(mode!=='waves-guest'||aimPointer!==null||!connected||lastState?.paused||e.button!==0)return;e.preventDefault();aimPointer=e.pointerId;aimAt(e);gunner.fire=true;$('slope').setPointerCapture(e.pointerId);sound.start();});
$('slope').addEventListener('pointermove',e=>{if(mode==='waves-guest'&&e.pointerId===aimPointer)aimAt(e);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('slope').addEventListener(type,endAim);
const shared=parseCode(new URLSearchParams(location.hash.slice(1)).get('room'));if(shared)$('code').value=shared;
let preview,previewWorld;
function demo(){const w=new World(42);for(const p of w.players)p.y=450;w.generate();return w;}
function frame(now){const elapsed=Math.min(.1,(now-last)/1000);last=now;
 if(!mode&&preview){previewWorld.inputs[0]={...zero(),x:Math.sin(now/1500)*.65};previewWorld.bot();previewWorld.step(STEP);if(previewWorld.players[0].y>1100)previewWorld=demo();preview.set(previewWorld.snapshot(),true);preview.draw(now);}
 if(mode&&world){if(!paused()){acc+=elapsed;while(acc>=STEP){world.inputs[0]=input();if(isWaves())updateGunner();if(mode==='practice')world.bot();else world.inputs[1]=remote;world.step(STEP);view.set(world.snapshot());acc-=STEP;}}else acc=0;networkTime+=elapsed;if(networkTime>=.05){networkTime=0;sendState();}}
 else if(isGuest()){networkTime+=elapsed;if(networkTime>=1/30){networkTime=0;if(mode==='waves-guest'){room?.input({...gunner,fire:gunner.fire&&!presenceHidden()&&!lastState?.paused});gunner.weapon=-1;}else room?.input(input());}}
 if(mode)view?.draw(now,world?(paused()?1:acc/STEP):undefined);requestAnimationFrame(frame);
}
for(const id of ['host','join','practice','solo','waves','online-waves'])$(id).disabled=true;
try{art=await new Artwork().load();previewWorld=demo();preview=new View($('preview'),art,{preview:true});$('lobby-status').textContent='No download. Two-character rooms. One shared disaster.';for(const id of ['host','join','practice','solo','waves','online-waves'])$(id).disabled=false;$('waves').disabled=!desktop();if(!desktop())$('waves-help').textContent='Desktop mode requires a keyboard and mouse.';requestAnimationFrame(frame);}catch(e){$('lobby-status').textContent=`Could not load the artwork. Reload to retry. ${e.message}`;}
if(new URLSearchParams(location.search).has('debug'))window.ski={get world(){return world;},get state(){return lastState;},get room(){return room;},get view(){return view;},input,paused};
