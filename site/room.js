import {PROTOCOL,newCode,parseCode,validInput,validState} from './protocol.js';
const PREFIX='skifree-chain-v2-';
const advice=()=>/Android/i.test(navigator.userAgent)?'Allow Nearby devices / Local network for your browser in Android Settings, then retry.':'Allow local-network access if asked. Check Wi-Fi isolation or use the TURN option in Connection help.';
const messageFor=e=>({'peer-unavailable':'That room is not hosted. Check the code and ask your friend to keep the game open.','network':'The room service is unreachable. Check your connection and retry.','server-error':'The room service is unavailable. Try again shortly.','browser-incompatible':'This browser does not support WebRTC. Use current Chrome or Safari.','webrtc':`The direct connection failed. ${advice()}`})[e?.type]||e?.message||String(e);

export class Room{
  constructor(events={},settings={}){this.events=events;this.settings=settings;this.closed=false;this.accepted=false;this.seq=0;this.lastSeq=-1;this.latency=0;}
  emit(name,...args){this.events[name]?.(...args);}
  async open(host,code){
    this.isHost=host;this.code=host?newCode():parseCode(code);if(!this.code)throw new Error('Enter a two-character room code.');
    const iceServers=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:global.stun.twilio.com:3478'}];
    if(this.settings.turn)iceServers.push({urls:this.settings.turn,username:this.settings.username,credential:this.settings.credential});
    const options={debug:0,config:{iceServers}};if(this.settings.host)Object.assign(options,{host:this.settings.host,port:443,path:this.settings.path||'/',secure:true});
    for(let n=0;;n++){
      try{await this.reserve(host?PREFIX+this.code:undefined,options);break;}
      catch(error){this.peer?.destroy();if(this.closed||!host||error.type!=='unavailable-id'||n>=19)throw new Error(messageFor(error));this.code=newCode();}
    }
    if(this.closed)return;
    this.peer.on('error',error=>this.fail(messageFor(error)));
    this.peer.on('disconnected',()=>{if(!this.closed&&!this.peer.destroyed)this.peer.reconnect();});
    this.peer.on('connection',connection=>{
      if(!this.isHost||this.connection){connection.on('open',()=>{connection.send({type:'busy'});setTimeout(()=>connection.close(),150);});return;}
      this.attach(connection);
    });
    if(!host)this.attach(this.peer.connect(PREFIX+this.code,{reliable:true,serialization:'json',metadata:{protocol:PROTOCOL}}));
    this.timer=setInterval(()=>{
      if(this.accepted&&this.lastHeard&&performance.now()-this.lastHeard>14000)this.connection?.close();
      if(this.isHost&&this.lastInput&&performance.now()-this.lastInput>450){this.lastInput=0;this.emit('input',{x:0,y:0,brake:false,boost:false,jump:false});}
    },100);
    this.heartbeat=setInterval(()=>{if(this.accepted)this.send({type:'ping',at:Date.now()});},2000);
    return this.code;
  }
  reserve(id,options){
    const peer=this.peer=new Peer(id,options);
    return new Promise((resolve,reject)=>{
      const finish=error=>{clearTimeout(timer);peer.off('open',onOpen);peer.off('error',onError);this.cancelOpen=null;error?reject(error):resolve();};
      const onOpen=()=>finish(),onError=error=>finish(error),timer=setTimeout(()=>finish(new Error('The room service did not respond. Try again.')),20000);
      this.cancelOpen=()=>finish(new Error('Room closed.'));peer.on('open',onOpen);peer.on('error',onError);
    });
  }
  attach(connection){
    this.connection=connection;this.lastHeard=performance.now();this.lastSeq=-1;
    const timeout=()=>this.fail(`Room found, but the devices could not connect. ${advice()}`);
    this.connectTimer=setTimeout(timeout,30000);
    connection.peerConnection?.addEventListener('iceconnectionstatechange',()=>{if(this.connection!==connection)return;const state=connection.peerConnection.iceConnectionState;if(state==='checking')this.emit('status','Room found. Connecting your skis...');if(state==='failed')timeout();});
    connection.on('open',()=>{if(this.closed){connection.close();return;}if(!this.isHost)this.send({type:'hello',protocol:PROTOCOL});});
    connection.on('data',data=>{
      if(this.connection!==connection||!data||typeof data!=='object')return;this.lastHeard=performance.now();
      if(data.type==='busy'){this.fail('This room already has two skiers.');return;}
      if(data.type==='hello'&&this.isHost&&!this.accepted){if(data.protocol!==PROTOCOL){this.fail('Game versions differ. Both players should reload.');return;}this.accepted=true;clearTimeout(this.connectTimer);this.send({type:'welcome',protocol:PROTOCOL});this.emit('connected');return;}
      if(data.type==='welcome'&&!this.isHost&&!this.accepted&&data.protocol===PROTOCOL){this.accepted=true;clearTimeout(this.connectTimer);this.emit('connected');return;}
      if(!this.accepted)return;
      if(this.isHost&&validInput(data)&&data.seq>this.lastSeq){this.lastSeq=data.seq;this.lastInput=performance.now();this.emit('input',data);}
      else if(!this.isHost&&data.type==='state'&&validState(data.state))this.emit('state',data.state);
      else if(data.type==='presence'&&typeof data.hidden==='boolean')this.emit('presence',data.hidden);
      else if(data.type==='ping'&&Number.isFinite(data.at))this.send({type:'pong',at:data.at});
      else if(data.type==='pong'&&Number.isFinite(data.at)){this.latency=Math.max(0,Date.now()-data.at);this.emit('latency',this.latency);}
    });
    connection.on('close',()=>{if(this.connection!==connection)return;const accepted=this.accepted;this.accepted=false;this.connection=null;clearTimeout(this.connectTimer);this.emit('input',{x:0,y:0,brake:false,boost:false,jump:false});if(!this.closed&&accepted)this.emit('disconnected');});
    connection.on('error',e=>{if(this.connection===connection)this.fail(messageFor(e));});
  }
  input(input){if(this.accepted&&!this.isHost)this.send({type:'input',seq:this.seq++,...input});}
  send(data){if(!this.connection?.open)return false;try{if(this.connection.dataChannel?.bufferedAmount>256000&&data.type==='state')return false;this.connection.send(data);return true;}catch{return false;}}
  fail(message){clearTimeout(this.connectTimer);if(!this.accepted){const c=this.connection;this.connection=null;c?.close();}this.emit('error',message);}
  close(){this.closed=true;this.cancelOpen?.();clearInterval(this.timer);clearInterval(this.heartbeat);clearTimeout(this.connectTimer);this.connection?.close();this.peer?.destroy();this.accepted=false;}
}
