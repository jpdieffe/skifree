export class Sound{
  constructor(){this.enabled=true;}
  async start(){try{this.context??=new AudioContext();await this.context.resume();}catch{/* Sound is optional when the browser blocks audio. */}}
  play(event){
    if(!this.enabled||!this.context||this.context.state!=='running')return;
    const audio=this.context,now=audio.currentTime;
    if(['blood','debris','crash','caught','blocked'].includes(event.type)){
      const duration=event.kind==='yeti'?.65:.2,buffer=audio.createBuffer(1,audio.sampleRate*duration,audio.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length)**2;
      const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=event.type==='blood'?700:1300;gain.gain.value=.14;source.connect(filter).connect(gain).connect(audio.destination);source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    }else if(['stretch','warning','win','jump'].includes(event.type)){
      const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type=event.type==='warning'?'sawtooth':'sine';const f=event.type==='stretch'?220:event.type==='jump'?500:event.type==='win'?660:110;
      oscillator.frequency.setValueAtTime(f,now);oscillator.frequency.exponentialRampToValueAtTime(f*(event.type==='stretch'?.4:1.8),now+.22);gain.gain.setValueAtTime(.055,now);gain.gain.exponentialRampToValueAtTime(.001,now+.3);oscillator.connect(gain).connect(audio.destination);oscillator.start();oscillator.stop(now+.32);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    }
  }
}
