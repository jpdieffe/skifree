import test from 'node:test';
import assert from 'node:assert/strict';
import {soloZoom,interpolateBody} from '../site/view.js';
import {BALL_MAX_LENGTH,BALL_RADIUS} from '../site/solo-physics.js';

test('solo uses original-size desktop sprites and fits the whole swing on phones',()=>{
 assert.equal(soloZoom(1280,808),1);
 const reach=BALL_MAX_LENGTH+BALL_RADIUS;
 for(const [w,h]of [[393,642],[844,341],[1280,808]]){
  const z=soloZoom(w,h);assert(z<=1);assert(w/z>=640);assert(h/z>=480);
  assert(w/2-reach*z>=24);assert(h*.44-reach*z>=24);
  assert(h*.44+reach*z<=h-24);
 }
});
test('skier, ball and moving obstacles share the same interpolation timeline',()=>{
 const old={x:10,y:20,angle:0,jump:.8,roll:1},next={x:14,y:28,angle:.4,jump:.6,roll:2};
 assert.deepEqual(interpolateBody(next,old,.25),{x:11,y:22,angle:.1,jump:.75,roll:1.25});
 assert.deepEqual(interpolateBody(next,undefined,.25),next);
 assert.deepEqual(interpolateBody({id:1,x:14,y:28},{id:1,x:10,y:20},.5),{id:1,x:12,y:24});
});
