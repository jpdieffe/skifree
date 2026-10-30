export const PROTOCOL='skifree-coop-v4',ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function parseCode(value){const code=String(value||'').trim().toUpperCase();return code.length===2&&[...code].every(c=>ALPHABET.includes(c))?code:null;}
export function newCode(){const a=new Uint8Array(2);crypto.getRandomValues(a);return [...a].map(v=>ALPHABET[v%ALPHABET.length]).join('');}
const finite=(n,limit=1e8)=>Number.isFinite(n)&&Math.abs(n)<=limit;
export function validInput(data){return data?.type==='input'&&Number.isSafeInteger(data.seq)&&data.seq>=0&&finite(data.x,1)&&finite(data.y,1)&&['brake','boost','jump'].every(k=>typeof data[k]==='boolean');}
export function validGunnerInput(data){return data?.type==='gunner'&&Number.isSafeInteger(data.seq)&&data.seq>=0&&finite(data.x,1200)&&finite(data.y,1200)&&typeof data.fire==='boolean'&&Number.isInteger(data.weapon)&&data.weapon>=-1&&data.weapon<6;}
const slot=n=>Number.isInteger(n)&&n>=0&&n<6;
function validWaves(s){
  return s.plan&&Number.isSafeInteger(s.plan.number)&&s.plan.number>0&&Number.isSafeInteger(s.plan.stage)&&s.plan.stage>0&&[1,2,3].includes(s.plan.wave)&&typeof s.plan.name==='string'&&s.plan.name.length<=60
    &&Number.isInteger(s.remaining)&&s.remaining>=0&&s.remaining<=72&&finite(s.breather)&&slot(s.weapon)&&Array.isArray(s.unlocked)&&s.unlocked.length===6&&s.unlocked.every(v=>typeof v==='boolean')&&s.unlocked[s.weapon]
    &&s.aim&&finite(s.aim.x)&&finite(s.aim.y)
    &&Array.isArray(s.projectiles)&&s.projectiles.length<=160&&s.projectiles.every(b=>b&&Number.isSafeInteger(b.id)&&slot(b.weapon)&&[b.x,b.y,b.vx,b.vy].every(n=>finite(n)))
    &&Array.isArray(s.pickups)&&s.pickups.length<=8&&s.pickups.every(p=>p&&Number.isSafeInteger(p.id)&&slot(p.slot)&&[p.x,p.y,p.time].every(n=>finite(n)));
}
export function validState(s){
  const waves=s?.mode==='waves',hpLimit=waves?24:7;
  return s&&Number.isSafeInteger(s.run)&&Number.isSafeInteger(s.seed)&&finite(s.time)&&['skiing','yeti','won','lost','endless'].includes(s.phase)&&finite(s.distance)&&finite(s.score)&&finite(s.kills)&&finite(s.wrecks)&&finite(s.combo)&&finite(s.tension,1)&&finite(s.yetiKills)&&finite(s.nextYetiDistance)
    &&Array.isArray(s.players)&&s.players.length===(waves?1:2)&&s.players.every(p=>p&&[p.x,p.y,p.vx,p.vy,p.jump,p.crash,p.angle].every(n=>finite(n)))
    &&(s.capture==null||s.phase==='lost'&&(waves?s.capture.player===0:[0,1].includes(s.capture.player))&&Number.isSafeInteger(s.capture.yeti)&&Number.isSafeInteger(s.capture.level)&&s.capture.level>=1&&s.capture.level<=100000&&[s.capture.x,s.capture.y,s.capture.time].every(n=>finite(n)))
    &&Array.isArray(s.entities)&&s.entities.length<=400&&s.entities.every(e=>e&&Number.isSafeInteger(e.id)&&['tree','pine','pole','rock','skier','boarder','dog','yeti','ramp'].includes(e.kind)&&[e.x,e.y,e.r,e.variant].every(n=>finite(n))&&(e.kind!=='yeti'||Number.isSafeInteger(e.level)&&e.level>=1&&e.level<=100000&&finite(e.hp,hpLimit)&&e.hp>0&&Number.isInteger(e.maxHp)&&e.maxHp>=e.hp&&e.maxHp<=hpLimit&&typeof e.charging==='boolean'&&finite(e.hitUntil)))
    &&Array.isArray(s.events)&&s.events.length<=100&&s.events.every(e=>e&&Number.isSafeInteger(e.id)&&['blood','debris','jump','stretch','crash','warning','caught','win','blocked','armor',...(waves?['shot','explosion','pickup','wave']:[])].includes(e.type)&&[e.x,e.y,e.time].every(n=>finite(n))&&(e.level===undefined||Number.isSafeInteger(e.level)&&e.level>=1&&e.level<=100000)&&(!['shot','pickup'].includes(e.type)||slot(e.weapon))&&(e.type!=='shot'||finite(e.angle))&&(e.type!=='explosion'||finite(e.radius,200)))
    &&(!waves||validWaves(s));
}
