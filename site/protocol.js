export const PROTOCOL='skifree-chain-v1',ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function parseCode(value){const code=String(value||'').trim().toUpperCase();return code.length===2&&[...code].every(c=>ALPHABET.includes(c))?code:null;}
export function newCode(){const a=new Uint8Array(2);crypto.getRandomValues(a);return [...a].map(v=>ALPHABET[v%ALPHABET.length]).join('');}
const finite=(n,limit=1e8)=>Number.isFinite(n)&&Math.abs(n)<=limit;
export function validInput(data){return data?.type==='input'&&Number.isSafeInteger(data.seq)&&data.seq>=0&&finite(data.x,1)&&finite(data.y,1)&&['brake','boost','jump'].every(k=>typeof data[k]==='boolean');}
export function validState(s){
  return s&&Number.isSafeInteger(s.run)&&Number.isSafeInteger(s.seed)&&finite(s.time)&&['skiing','yeti','won','lost','endless'].includes(s.phase)&&finite(s.distance)&&finite(s.score)&&finite(s.kills)&&finite(s.wrecks)&&finite(s.combo)&&finite(s.tension,1)&&finite(s.yetiKills)
    &&Array.isArray(s.players)&&s.players.length===2&&s.players.every(p=>p&&[p.x,p.y,p.vx,p.vy,p.jump,p.crash,p.angle].every(n=>finite(n)))
    &&Array.isArray(s.entities)&&s.entities.length<=400&&s.entities.every(e=>e&&Number.isSafeInteger(e.id)&&['tree','pine','rock','skier','boarder','dog','yeti','ramp'].includes(e.kind)&&[e.x,e.y,e.r,e.variant].every(n=>finite(n)))
    &&Array.isArray(s.events)&&s.events.length<=100&&s.events.every(e=>e&&Number.isSafeInteger(e.id)&&['blood','debris','jump','stretch','crash','warning','caught','win'].includes(e.type)&&[e.x,e.y,e.time].every(n=>finite(n)));
}
