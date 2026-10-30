import test from 'node:test';
import assert from 'node:assert/strict';
import {WaveWorld,wavePlan} from '../site/waves.js';
import {validGunnerInput,validState} from '../site/protocol.js';

test('gunner messages bound aim and weapon requests without granting steering authority',()=>{
 const input={type:'gunner',seq:0,x:-550,y:400,fire:true,weapon:5};
 assert(validGunnerInput(input));
 for(const bad of [{x:NaN},{x:1201},{y:Infinity},{weapon:6},{weapon:.5},{fire:1},{seq:-1},{type:'input'}])assert(!validGunnerInput({...input,...bad}));
});
test('wave snapshots accept late-stage health, bullets, pickups and capture; reject malformed render data',()=>{
 const w=new WaveWorld(42);w.plan=wavePlan(301);w.spawnMonster();w.gunner.fire=true;w.step();
 const s=w.snapshot();assert(validState(s));
 for(const bad of [{players:[]},{weapon:6},{unlocked:[]},{plan:null},{projectiles:[{id:1,x:0,y:0,vx:0,vy:1,weapon:99}]},{pickups:[{id:1,x:0,y:0,time:0,slot:7}]},{aim:{x:NaN,y:0}},{events:[{id:1,type:'pickup',x:0,y:0,time:0,weapon:10}]}])assert(!validState({...s,...bad}));
 w.catchPlayer(w.players[0],w.entities.find(e=>e.kind==='yeti'));assert(validState(w.snapshot()));
});
test('phone ski pad vertical movement brakes and tucks in Onslaught',()=>{
 const slow=new WaveWorld(1),fast=new WaveWorld(1);
 for(const w of [slow,fast]){w.entities=[];w.generate=()=>{};w.spawnAt=1e9;}
 slow.inputs[0]={y:-1};fast.inputs[0]={y:1};
 for(let i=0;i<120;i++){slow.step();fast.step();}
 assert(fast.players[0].vy>slow.players[0].vy*4);
});
