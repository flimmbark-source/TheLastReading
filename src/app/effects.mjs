// Audio / haptic / ambient-breath effects (Step 3c, Phase 16.4).
// Moved verbatim from index.html. Owns the AudioContext singleton and the
// breath timer; reads _sfxVol from the shared global environment (let
// _sfxVol declared in the classic script is in the global declarative env).
/* global state, _sfxVol */

const _ac = () => {
  try { return window._tlrACtx || (window._tlrACtx = new (window.AudioContext || window.webkitAudioContext)()); }
  catch(e) { return null; }
};

document.addEventListener('pointerdown', () => {
  const _c = _ac(); if (_c && _c.state === 'suspended') _c.resume();
}, true);

const MELD_SOUND_FILE = new URL('./freesound_community-chinese-fanfare-107737.mp3', import.meta.url).href;
const _meldSoundBufferPromise = (async () => {
  try {
    const response = await fetch(MELD_SOUND_FILE, { cache: 'reload' });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const ctx = _ac();
    if (!ctx) return null;
    return await new Promise((resolve, reject) => ctx.decodeAudioData(arrayBuffer, resolve, reject));
  } catch (e) {
    return null;
  }
})();

// Normalizes a meld's chip/mult contribution to 0..1 so playback can scale
// with how big the meld actually is, rather than sounding identical for a
// minor pair and a huge pattern. Either dimension can carry a meld to "big".
export function meldMagnitude(chips,mult,additive){
  const multGain=additive?(mult||0):Math.max(0,(mult||1)-1);
  const chipsPart=Math.min(1,Math.max(0,chips||0)/40);
  const multPart=Math.min(1,multGain/3);
  return Math.max(chipsPart,multPart);
}

// ── Shared mix bus ──────────────────────────────────────────────────────
// Every synthesized voice below routes through one compressor (so several
// sounds firing at once glue together instead of fighting/clipping) and can
// optionally tap a procedurally-generated reverb send. The impulse response
// is noise shaped by an exponential decay envelope — a standard way to fake
// a room without shipping an audio file — so short tones read as struck
// objects in a space rather than a raw oscillator test tone.
let _bus=null;
function _impulse(ctx,duration=1.0,decay=2.8){
  const rate=ctx.sampleRate,len=Math.max(1,Math.floor(rate*duration));
  const buf=ctx.createBuffer(2,len,rate);
  for(let ch=0;ch<2;ch++){
    const d=buf.getChannelData(ch);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);
  }
  return buf;
}
function _masterBus(ctx){
  if(_bus&&_bus.ctx===ctx)return _bus;
  const dry=ctx.createGain();dry.gain.value=1;
  const comp=ctx.createDynamicsCompressor();
  comp.threshold.value=-20;comp.knee.value=22;comp.ratio.value=3.2;comp.attack.value=0.005;comp.release.value=0.18;
  dry.connect(comp);comp.connect(ctx.destination);
  const reverbIn=ctx.createGain();reverbIn.gain.value=1;
  try{
    const conv=ctx.createConvolver();conv.buffer=_impulse(ctx);
    const reverbOut=ctx.createGain();reverbOut.gain.value=0.55;
    reverbIn.connect(conv);conv.connect(reverbOut);reverbOut.connect(comp);
  }catch(e){reverbIn.connect(comp);}
  _bus={ctx,dry,reverbIn};
  return _bus;
}

// A struck/plucked tone: a small unison stack of detuned oscillators through
// a lowpass filter that opens bright on the attack and settles warm on the
// decay (how a mallet-struck bell or plucked string actually behaves),
// mixed to the dry bus plus an optional reverb send for space. Replaces
// single bare-oscillator "video game bleep" tones used elsewhere.
function _chime(ctx,bus,{freq,type='sine',start=0,attack=0.01,hold=0,decay=0.4,peak=0.25,detune=6,voices=3,filterHz=null,filterQ=0.75,pan=0,wet=0}){
  const at=ctx.currentTime+start;
  const end=at+attack+hold+decay;
  const g=ctx.createGain();
  g.gain.setValueAtTime(0,at);
  g.gain.linearRampToValueAtTime(peak,at+attack);
  if(hold>0)g.gain.setValueAtTime(peak,at+attack+hold);
  g.gain.exponentialRampToValueAtTime(0.0008,end);
  let out=g;
  if(filterHz){
    const f=ctx.createBiquadFilter();f.type='lowpass';f.Q.value=filterQ;
    f.frequency.setValueAtTime(filterHz*1.7,at);
    f.frequency.exponentialRampToValueAtTime(filterHz,end-decay*0.4);
    g.connect(f);out=f;
  }
  let tail=out;
  if(pan&&ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan));out.connect(p);tail=p;}
  tail.connect(bus.dry);
  if(wet>0){const send=ctx.createGain();send.gain.value=wet;tail.connect(send);send.connect(bus.reverbIn);}
  const n=Math.max(1,voices);
  for(let i=0;i<n;i++){
    const o=ctx.createOscillator();
    o.type=type;o.frequency.value=freq;
    o.detune.value=n===1?0:(i-(n-1)/2)*(detune*2/Math.max(1,n-1));
    o.connect(g);o.start(at);o.stop(end+0.05);
    o.onended=()=>{try{o.disconnect();}catch(e){}};
  }
  setTimeout(()=>{try{g.disconnect();if(out!==g)out.disconnect();if(tail!==out)tail.disconnect();}catch(e){}},Math.max(50,(end-ctx.currentTime+0.15)*1000));
}

export function playSound(type,magnitude){
  const ctx=_ac();if(!ctx)return;
  if(ctx.state==='suspended')ctx.resume();
  try{
    const bus=_masterBus(ctx);
    if(type==='place'){
      const buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.07),ctx.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2.5);
      const src=ctx.createBufferSource();src.buffer=buf;
      const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=700;f.Q.value=0.7;
      const g=ctx.createGain();g.gain.setValueAtTime(0.22*_sfxVol,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+.07);
      src.connect(f);f.connect(g);g.connect(bus.dry);src.start();src.onended=()=>{src.disconnect();f.disconnect();g.disconnect();};
    }else if(type==='meld'){
      const mag=Math.max(0,Math.min(1,magnitude||0));
      const rate=1+mag*.16;
      const fallbackSynth = () => {
        [[523.25,0],[659.25,.05],[784,.11]].forEach(([freq,t])=>{
          _chime(ctx,bus,{freq:freq*rate,type:'sine',start:t,attack:0.01,hold:0.04,decay:0.5,peak:(0.4+mag*.2)*_sfxVol,detune:6,voices:3,filterHz:3000,filterQ:0.7,wet:0.3});
        });
      };
      _meldSoundBufferPromise.then(buffer => {
        if (!buffer) {
          fallbackSynth();
          return;
        }
        try {
          const src = ctx.createBufferSource();
          src.buffer = buffer;
          src.playbackRate.value = rate;
          const g = ctx.createGain();
          g.gain.setValueAtTime((0.85+mag*.2)*_sfxVol, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 4);
          src.connect(g); g.connect(bus.dry);
          src.start();
          src.stop(ctx.currentTime + 4.01);
        } catch (e) {
          fallbackSynth();
        }
      }).catch(() => {
        fallbackSynth();
      });
    }else if(type==='relic'){
      // Small glass/bell chime — a struck object, not a power-up sweep.
      _chime(ctx,bus,{freq:880,type:'sine',start:0,attack:0.008,hold:0.02,decay:0.24,peak:0.24*_sfxVol,detune:6,voices:3,filterHz:2600,filterQ:0.9,pan:-0.12,wet:0.3});
      _chime(ctx,bus,{freq:1318.5,type:'triangle',start:0.055,attack:0.006,hold:0.02,decay:0.28,peak:0.2*_sfxVol,detune:5,voices:2,filterHz:3200,filterQ:0.8,pan:0.12,wet:0.32});
    }else if(type==='purchase'){
      // A coin/token set down (filtered noise tap) plus a warm confirm tone,
      // instead of an ascending arcade coin-pickup arpeggio.
      const dur=.05;
      const buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*dur),ctx.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++){const t=i/d.length;d[i]=(Math.random()*2-1)*Math.pow(1-t,2)*Math.min(1,t*12);}
      const src=ctx.createBufferSource();src.buffer=buf;
      const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=2200;f.Q.value=1.2;
      const g=ctx.createGain();g.gain.setValueAtTime(0.16*_sfxVol,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
      src.connect(f);f.connect(g);g.connect(bus.dry);src.start();src.onended=()=>{src.disconnect();f.disconnect();g.disconnect();};
      _chime(ctx,bus,{freq:1046.5,type:'triangle',start:0.03,attack:0.006,hold:0.03,decay:0.22,peak:0.2*_sfxVol,detune:5,voices:2,filterHz:2800,filterQ:0.7,wet:0.22});
    }else if(type==='pass'){
      [[659.25,0,0.28],[880,.09,0.24],[1318.5,.18,0.3]].forEach(([freq,start,peak])=>{
        _chime(ctx,bus,{freq,type:'triangle',start,attack:0.01,hold:0.05,decay:0.55,peak:peak*_sfxVol,detune:7,voices:3,filterHz:3400,filterQ:0.7,wet:0.34});
      });
    }else if(type==='fail'){
      [[311.1,0,0.26],[220,.12,0.22]].forEach(([freq,start,peak])=>{
        _chime(ctx,bus,{freq,type:'sine',start,attack:0.015,hold:0.03,decay:0.5,peak:peak*_sfxVol,detune:5,voices:2,filterHz:900,filterQ:0.6,wet:0.3});
      });
    }else if(type==='resonation'){
      [[220,0,.24,-.2],[440,.07,.18,-.05],[880,.14,.13,.1],[330,.2,.1,.22]].forEach(([freq,start,peak,pan])=>{
        _chime(ctx,bus,{freq,type:'sine',start,attack:0.02,hold:0.05,decay:0.9,peak:peak*_sfxVol,detune:6,voices:3,filterHz:2200,filterQ:0.6,pan,wet:0.4});
      });
    }else if(type==='draw'||type==='discard'){
      const dur=type==='draw'?.13:.16;
      const buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*dur),ctx.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++){const t=i/d.length;d[i]=(Math.random()*2-1)*Math.pow(1-t,1.6)*Math.min(1,t*7);}
      const src=ctx.createBufferSource();src.buffer=buf;
      const f=ctx.createBiquadFilter();f.type='bandpass';f.Q.value=0.6;
      const f0=type==='draw'?1100:1500,f1=type==='draw'?2700:520;
      f.frequency.setValueAtTime(f0,ctx.currentTime);f.frequency.exponentialRampToValueAtTime(f1,ctx.currentTime+dur);
      const g=ctx.createGain();g.gain.setValueAtTime(type==='draw'?.15:.12,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
      src.connect(f);f.connect(g);g.connect(bus.dry);src.start();src.onended=()=>{src.disconnect();f.disconnect();g.disconnect();};
    }else if(type==='flip'){
      const dur=.045;
      const buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*dur),ctx.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3);
      const src=ctx.createBufferSource();src.buffer=buf;
      const f=ctx.createBiquadFilter();f.type='highpass';f.frequency.value=1800;
      const g=ctx.createGain();g.gain.setValueAtTime(0.16,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
      src.connect(f);f.connect(g);g.connect(bus.dry);src.start();src.onended=()=>{src.disconnect();f.disconnect();g.disconnect();};
    }else if(type==='shuffle'){
      const n=11;
      for(let k=0;k<n;k++){
        const at=ctx.currentTime+k*0.033+Math.random()*0.012;
        const cd=.022;
        const buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*cd),ctx.sampleRate);
        const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2.2);
        const src=ctx.createBufferSource();src.buffer=buf;
        const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=1500+Math.random()*1300;f.Q.value=1.1;
        const g=ctx.createGain();g.gain.setValueAtTime(0.07,at);g.gain.exponentialRampToValueAtTime(0.001,at+cd);
        src.connect(f);f.connect(g);g.connect(bus.dry);src.start(at);src.stop(at+cd+.01);src.onended=()=>{src.disconnect();f.disconnect();g.disconnect();};
      }
    }else if(type==='breath'){
      const vol=0.055*_sfxVol;
      const inhaleLen=3.6,exhaleLen=2.2,gap=1.25;
      (()=>{
        const buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*inhaleLen),ctx.sampleRate);
        const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
        const src=ctx.createBufferSource();src.buffer=buf;
        const f=ctx.createBiquadFilter();f.type='bandpass';f.Q.value=1.4;
        f.frequency.setValueAtTime(180,ctx.currentTime);
        f.frequency.linearRampToValueAtTime(320,ctx.currentTime+inhaleLen);
        const g=ctx.createGain();
        g.gain.setValueAtTime(0,ctx.currentTime);
        g.gain.linearRampToValueAtTime(vol,ctx.currentTime+inhaleLen*0.45);
        g.gain.linearRampToValueAtTime(vol*0.6,ctx.currentTime+inhaleLen*0.8);
        g.gain.linearRampToValueAtTime(0.0001,ctx.currentTime+inhaleLen);
        src.connect(f);f.connect(g);g.connect(bus.dry);
        src.start(ctx.currentTime);src.stop(ctx.currentTime+inhaleLen+0.05);
        src.onended=()=>{src.disconnect();f.disconnect();g.disconnect();};
      })();
      (()=>{
        const at=ctx.currentTime+inhaleLen+gap;
        const buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*exhaleLen),ctx.sampleRate);
        const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
        const src=ctx.createBufferSource();src.buffer=buf;
        const f=ctx.createBiquadFilter();f.type='bandpass';f.Q.value=1.8;
        f.frequency.setValueAtTime(300,at);
        f.frequency.linearRampToValueAtTime(160,at+exhaleLen);
        const g=ctx.createGain();
        g.gain.setValueAtTime(0,at);
        g.gain.linearRampToValueAtTime(vol*0.75,at+exhaleLen*0.2);
        g.gain.linearRampToValueAtTime(vol*0.4,at+exhaleLen*0.65);
        g.gain.linearRampToValueAtTime(0.0001,at+exhaleLen);
        src.connect(f);f.connect(g);g.connect(bus.dry);
        src.start(at);src.stop(at+exhaleLen+0.05);
        src.onended=()=>{src.disconnect();f.disconnect();g.disconnect();};
      })();
    }else if(type==='scratch'){
      [0,.045,.09].forEach((dt,i)=>{
        const dur=.055+i*.015;
        const buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*dur),ctx.sampleRate);
        const d=buf.getChannelData(0);
        for(let j=0;j<d.length;j++){const t=j/d.length;d[j]=(Math.random()*2-1)*(Math.pow(1-t,1.2)*Math.min(1,t*9));}
        const src=ctx.createBufferSource();src.buffer=buf;
        const f=ctx.createBiquadFilter();f.type='bandpass';f.Q.value=1.4;
        f.frequency.setValueAtTime(1800+i*600,ctx.currentTime+dt);
        f.frequency.exponentialRampToValueAtTime(3200+i*400,ctx.currentTime+dt+dur);
        const g=ctx.createGain();g.gain.setValueAtTime(0.18*_sfxVol,ctx.currentTime+dt);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dt+dur);
        src.connect(f);f.connect(g);g.connect(bus.dry);src.start(ctx.currentTime+dt);src.stop(ctx.currentTime+dt+dur+.01);
        src.onended=()=>{src.disconnect();f.disconnect();g.disconnect();};
      });
    }
  }catch(e){}
}

let _breathTimer = null;

export function _scheduleBreath(){
  if(_breathTimer)clearTimeout(_breathTimer);
  const delay=35000+Math.random()*40000;
  _breathTimer=setTimeout(()=>{
    if(typeof state!=='undefined'&&!(window.tlrStore?.getState?.()?.run?.busy??state.busy)&&!(window.tlrStore?.getState?.()?.run?.ability?.targeting||state.abilitySelect)&&(window.tlrStore?.getState?.()?.run?.purge??state.purgeSelect)===null){
      playSound('breath');
      breathVisuals();
    }
    _scheduleBreath();
  },delay);
}

document.addEventListener('pointerdown', () => { if(!_breathTimer)_scheduleBreath(); }, {once:true});

export function breathVisuals(){
  const inhaleMs=3600,gapMs=1250,exhaleMs=2200;
  const totalMs=inhaleMs+gapMs+exhaleMs;

  const vig=document.getElementById('breathVignette');
  if(vig){
    vig.style.transition=`opacity ${inhaleMs}ms ease-in`;
    vig.style.opacity='1';
    setTimeout(()=>{vig.style.transition=`opacity ${exhaleMs}ms ease-out`;vig.style.opacity='0';},inhaleMs+gapMs);
  }

  const motes=[...document.querySelectorAll('#ambientFX .mote')];
  motes.forEach(m=>{
    m.getAnimations().forEach(a=>{try{a.updatePlaybackRate(.4);}catch(e){}});
    const leftPct=parseFloat(m.style.left)||50;
    const pushDir=(leftPct-50)/50;
    const pushAmt=pushDir*55;
    m.animate(
      [{marginLeft:'0px'},{marginLeft:`${pushAmt}px`,offset:inhaleMs/totalMs},{marginLeft:`${pushAmt*.25}px`,offset:(inhaleMs+gapMs+exhaleMs*.55)/totalMs},{marginLeft:'0px'}],
      {duration:totalMs,easing:'ease-in-out',fill:'none'}
    );
  });
  setTimeout(()=>{
    document.querySelectorAll('#ambientFX .mote').forEach(m=>{
      m.getAnimations().forEach(a=>{try{a.updatePlaybackRate(1.5);}catch(e){}});
    });
  },inhaleMs+gapMs);
  setTimeout(()=>{
    document.querySelectorAll('#ambientFX .mote').forEach(m=>{
      m.getAnimations().forEach(a=>{try{a.updatePlaybackRate(1.0);}catch(e){}});
    });
  },totalMs);

  window._breathActive=true;
  setTimeout(()=>{window._breathActive=false;},totalMs);
}

export function haptic(p){try{if(navigator.vibrate)navigator.vibrate(p)}catch(e){}}

export function fireRelicGhost(){
  const pill=document.querySelector('.score-stack .threshold-pill');
  if(!pill)return;
  const r=pill.getBoundingClientRect();
  const g=document.createElement('span');
  g.className='score-ghost mult';g.textContent='+Relic';
  g.style.left=(r.left+r.width/2)+'px';g.style.top=(r.top+r.height*0.25)+'px';
  document.body.appendChild(g);setTimeout(()=>g.remove(),950);
}
