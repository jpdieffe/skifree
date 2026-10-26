import {World,STEP,clamp} from './physics.js';
import {Artwork,View} from './view.js';
import {Room} from './room.js';
import {parseCode} from './protocol.js';
import {Sound} from './sound.js';
const $=id=>document.getElementById(id),zero=()=>({x:0,y:0,brake:false,boost:false,jump:false}),sound=new Sound();
let art,view,world,room,mode='',remote=zero(),peerHidden=false,localHidden=document.hidden,connected=false,run=0,last=performance.now(),acc=0,networkTime=0,lastState,overlayAction=null;
const keys=new Set(),actions=new Set();let pad={x:0,y:0},padPointer=null;
const seed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
const settings=()=>({turn:$('turn').value.trim(),username:$('username').value,credential:$('credential').value,host:$('peer-host').value.trim(),path:$('peer-path').value.trim()||'/'});
const isHost=()=>mode==='host',paused=()=>mode==='host'&&(!connected||peerHidden||localHidden)||mode==='practice'&&localHidden;
function input(){return {x:clamp(pad.x+(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0),-1,1),y:pad.y,brake:actions.has('brake')||keys.has('ArrowUp')||keys.has('KeyW'),boost:actions.has('boost')||keys.has('ArrowDown')||keys.has('KeyS')||keys.has('ShiftLeft'),jump:actions.has('jump')||keys.has('Space')};}
function release(){keys.clear();actions.clear();pad={x:0,y:0};padPointer=null;$('stick').style.transform='';document.querySelectorAll('.actions button').forEach(b=>b.classList.remove('active'));room?.input(zero());}
function showOverlay(kicker,title,text,action,label){$('overlay').hidden=false;$('overlay-kicker').textContent=kicker;$('overlay-title').textContent=title;$('overlay-text').textContent=text;overlayAction=action;$('overlay-action').hidden=!action;$('overlay-action').textContent=label||'';$('continue').hidden=true;}
function startGame(next){mode=next;release();$('lobby').hidden=true;$('game').hidden=false;document.body.classList.add('playing');$('options').hidden=true;$('mode').textContent=next==='practice'?'BOT PARTNER':next==='host'?'RED SKIER':'BLUE SKIER';$('invite').hidden=next==='practice';$('restart').hidden=next==='guest';view=new View($('slope'),art,{player:next==='guest'?1:0,event:e=>sound.play(e)});view.blood=$('blood').checked;sound.start();last=performance.now();acc=0;lastState=null;}
function newRun(){if(mode==='guest')return;world=new World(seed(),++run);remote=zero();update(world.snapshot());}
function update(state){lastState=state;view?.set(state,mode!=='guest');$('distance').textContent=`${state.distance.toLocaleString()} m`;$('score').textContent=`${state.score.toLocaleString()} points · ${state.kills} hits`;$('tension').style.width=`${state.tension*100}%`;
 if(!connected&&mode!=='practice')return;
 if(state.paused){showOverlay('TAKE A BREATHER','Run paused','Keep both game tabs visible to keep skiing.');return;}
 if(state.phase==='won'||state.phase==='lost'){
  const finish=state.events.findLast(e=>e.type==='win'||e.type==='caught');if(finish&&state.time-finish.time<1.2){$('overlay').hidden=true;return;}
  const won=state.phase==='won';showOverlay(won?'CHAIN REACTION':'MOUNTAIN 1 / SKIERS 0',won?'You shredded the yeti!':'The yeti got you.',`${state.score.toLocaleString()} points · ${state.kills} chain hits · ${state.distance.toLocaleString()} m${mode==='guest'?' · Waiting for your host.':''}`,mode==='guest'?null:newRun,'Another run');$('continue').hidden=!won||mode==='guest';
 }else $('overlay').hidden=true;
}
async function connect(host,code){
 room?.close();connected=false;peerHidden=false;remote=zero();
 const current=room=new Room({
  status:text=>{$('notice').textContent=text;},
  connected:()=>{if(room!==current)return;connected=true;peerHidden=false;remote=zero();$('notice').textContent='Connected. Stay close. Swing wide.';room.send({type:'presence',hidden:document.hidden});if(host){if(!world)newRun();sendState();}else showOverlay('LINKED UP','Your skis are connected','Loading the mountain…');},
  input:value=>{remote=value;},
  state:state=>update(state),
  presence:hidden=>{peerHidden=hidden;remote=zero();if(host)sendState();},
  disconnected:()=>{connected=false;remote=zero();release();showOverlay('CONNECTION LOST',host?'Your friend disconnected':'Your host disconnected',host?'The run is paused. Your friend can rejoin with the same code.':'Ask your host to keep the room open, then rejoin.',host?copyInvite:()=>connect(false,code),host?'Copy invite':'Reconnect');},
  error:message=>{if(room!==current)return;$('lobby-status').textContent=message;if(mode)showOverlay('CONNECTION HELP','Could not connect',message,host?()=>connect(true):()=>connect(false,code),'Try again');},
  latency:ms=>{$('connection-status').textContent=`${ms} ms`;}
 },settings());
 showOverlay('LINK UP',host?'Opening your room…':'Connecting your skis…','Keep this tab open.');
 try{const result=await current.open(host,code);if(room!==current)return;$('room-code').textContent=result;if(host&&!connected)showOverlay('ROOM '+result,'Bring your partner',`Your two-character room is ${result}. Share the invitation; the run starts when your friend joins.`,copyInvite,'Copy invitation');}catch(e){if(room===current)showOverlay('CONNECTION HELP','Could not open the room',e.message,()=>connect(host,code),'Try again');}
}
function sendState(){if(!world)return;const state={...world.snapshot(),paused:paused()};update(state);if(room?.accepted)room.send({type:'state',state});}
async function copyInvite(){const url=new URL(location.href);url.search='';url.hash=`room=${room.code}`;try{await navigator.clipboard.writeText(url.href);$('notice').textContent='Invitation copied';$('overlay-text').textContent=`Invitation copied! Room ${room.code}. Keep this tab open.`;}catch{$('notice').textContent=url.href;$('overlay-text').textContent=url.href;}}
$('host').onclick=()=>{world=null;startGame('host');connect(true);};
$('practice').onclick=()=>{connected=true;startGame('practice');newRun();};
$('join-form').onsubmit=e=>{e.preventDefault();const code=parseCode($('code').value);if(!code){$('lobby-status').textContent='Use the two letters or numbers shown on your friend’s screen.';return;}world=null;startGame('guest');connect(false,code);};
$('overlay-action').onclick=()=>overlayAction?.();$('continue').onclick=()=>{world?.continue();sendState();};$('invite').onclick=copyInvite;
$('restart').onclick=()=>{$('options').hidden=true;newRun();};
$('leave').onclick=()=>{room?.close();room=null;world=null;mode='';connected=false;release();$('game').hidden=true;$('lobby').hidden=false;document.body.classList.remove('playing');$('lobby-status').textContent='The mountain is ready.';};
$('menu-toggle').onclick=()=>{$('options').hidden=!$('options').hidden;$('menu-toggle').setAttribute('aria-expanded',String(!$('options').hidden));release();};
$('blood').onchange=()=>{if(view)view.blood=$('blood').checked;};$('sound').onchange=()=>{sound.enabled=$('sound').checked;sound.start();};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else $('notice').textContent='Rotate your phone for a wider view.';}catch{$('notice').textContent='Rotate your phone for a wider view.';}};
$('touch').checked=matchMedia('(pointer:coarse)').matches;$('touch').onchange=()=>document.body.classList.toggle('touch',$('touch').checked);$('touch').onchange();
addEventListener('keydown',e=>{if(!mode||e.target instanceof HTMLInputElement)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft'].includes(e.code)){e.preventDefault();keys.add(e.code);}});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',release);
document.addEventListener('visibilitychange',()=>{localHidden=document.hidden;release();room?.send({type:'presence',hidden:localHidden});if(isHost())sendState();last=performance.now();acc=0;});
const movePad=e=>{const r=$('pad').getBoundingClientRect(),dx=clamp((e.clientX-r.left-r.width/2)/(r.width*.36),-1,1),dy=clamp((e.clientY-r.top-r.height/2)/(r.height*.36),-1,1);pad={x:Math.abs(dx)<.12?0:dx,y:Math.abs(dy)<.12?0:dy};$('stick').style.transform=`translate(${dx*35}px,${dy*35}px)`;};
$('pad').onpointerdown=e=>{if(padPointer!==null)return;e.preventDefault();padPointer=e.pointerId;$('pad').setPointerCapture(e.pointerId);movePad(e);sound.start();};$('pad').onpointermove=e=>{if(e.pointerId===padPointer)movePad(e);};
const endPad=e=>{if(e.pointerId!==padPointer)return;padPointer=null;pad={x:0,y:0};$('stick').style.transform='';};$('pad').onpointerup=endPad;$('pad').onpointercancel=endPad;$('pad').onlostpointercapture=endPad;
document.querySelectorAll('[data-action]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);actions.add(b.dataset.action);b.classList.add('active');sound.start();};const end=()=>{actions.delete(b.dataset.action);b.classList.remove('active');};b.onpointerup=end;b.onpointercancel=end;b.onlostpointercapture=end;});
const shared=parseCode(new URLSearchParams(location.hash.slice(1)).get('room'));if(shared)$('code').value=shared;
let preview,previewWorld;
function demo(){const w=new World(42);for(const p of w.players)p.y=450;w.generate();return w;}
function frame(now){const elapsed=Math.min(.1,(now-last)/1000);last=now;
 if(!mode&&preview){previewWorld.inputs[0]={...zero(),x:Math.sin(now/1500)*.65};previewWorld.bot();previewWorld.step(STEP);if(previewWorld.players[0].y>1100)previewWorld=demo();preview.set(previewWorld.snapshot(),true);preview.draw(now);}
 if(mode&&world){if(!paused()){acc+=elapsed;while(acc>=STEP){world.inputs[0]=input();if(mode==='practice')world.bot();else world.inputs[1]=remote;world.step(STEP);acc-=STEP;}}else acc=0;networkTime+=elapsed;if(networkTime>=.05){networkTime=0;sendState();}}
 else if(mode==='guest'){networkTime+=elapsed;if(networkTime>=1/30){networkTime=0;room?.input(input());}}
 if(mode)view?.draw(now);requestAnimationFrame(frame);
}
for(const id of ['host','join','practice'])$(id).disabled=true;
try{art=await new Artwork().load();previewWorld=demo();preview=new View($('preview'),art,{preview:true});$('lobby-status').textContent='No download. Two-character rooms. One shared disaster.';for(const id of ['host','join','practice'])$(id).disabled=false;requestAnimationFrame(frame);}catch(e){$('lobby-status').textContent=`Could not load the artwork. Reload to retry. ${e.message}`;}
if(new URLSearchParams(location.search).has('debug'))window.ski={get world(){return world;},get state(){return lastState;},get room(){return room;},get view(){return view;},input,paused};
