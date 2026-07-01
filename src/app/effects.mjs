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

export function playSound(type,magnitude){
  const ctx=_ac();if(!ctx)return;
  if(ctx.state==='suspended')ctx.resume();
  try{
    if(type==='place'){
      const buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.07),ctx.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2.5);
      const src=ctx.createBufferSource();src.buffer=buf;
      const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=700;f.Q.value=0.7;
      const g=ctx.createGain();g.gain.setValueAtTime(0.22*_sfxVol,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+.07);
      src.connect(f);f.connect(g);g.connect(ctx.destination);src.start();src.onended=()=>{src.disconnect();f.disconnect();g.disconnect();};
    }else if(type==='meld'){
      const mag=Math.max(0,Math.min(1,magnitude||0));
      const rate=1+mag*.16;
      const fallbackSynth = () => {
        [[523,0],[659,.05],[784,.11]].forEach(([freq,t])=>{
          const o=ctx.createOscillator(),g=ctx.createGain();
          o.type='sine';o.frequency.value=freq*rate;
          const at=ctx.currentTime+t;
          g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime((0.55+mag*.25)*_sfxVol,at+.01);g.gain.exponentialRampToValueAtTime(0.001,at+.55);
          o.connect(g);g.connect(ctx.destination);o.start(at);o.stop(at+.6);o.onended=()=>{o.disconnect();g.disconnect();};
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
          src.connect(g); g.connect(ctx.destination);
          src.start();
          src.stop(ctx.currentTime + 4.01);
        } catch (e) {
          fallbackSynth();
        }
      }).catch(() => {
        fallbackSynth();
      });
    }else if(type==='relic'){
      [[880,0],[1318.5,.055]].forEach(([freq,t])=>{
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.type='sine';o.frequency.setValueAtTime(freq,ctx.currentTime+t);
        o.frequency.exponentialRampToValueAtTime(freq*1.5,ctx.currentTime+t+.16);
        const at=ctx.currentTime+t;
        g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(0.26*_sfxVol,at+.012);g.gain.exponentialRampToValueAtTime(0.001,at+.2);
        o.connect(g);g.connect(ctx.destination);o.start(at);o.stop(at+.22);o.onended=()=>{o.disconnect();g.disconnect();};
      });
    }else if(type==='purchase'){
      [[1600,0,.05],[2400,.045,.07]].forEach(([freq,t,dur])=>{
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.type='triangle';o.frequency.value=freq;
        const at=ctx.currentTime+t;
        g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(0.22*_sfxVol,at+.008);g.gain.exponentialRampToValueAtTime(0.001,at+dur);
        o.connect(g);g.connect(ctx.destination);o.start(at);o.stop(at+dur+.02);o.onended=()=>{o.disconnect();g.disconnect();};
      });
    }else if(type==='pass'){
      [[659,0],[880,.09],[1318.5,.18]].forEach(([freq,t])=>{
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.type='triangle';o.frequency.value=freq;
        const at=ctx.currentTime+t;
        g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(0.32*_sfxVol,at+.015);g.gain.exponentialRampToValueAtTime(0.001,at+.5);
        o.connect(g);g.connect(ctx.destination);o.start(at);o.stop(at+.55);o.onended=()=>{o.disconnect();g.disconnect();};
      });
    }else if(type==='fail'){
      [[311,0],[220,.12]].forEach(([freq,t])=>{
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.type='sine';o.frequency.value=freq;
        const at=ctx.currentTime+t;
        g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(0.24*_sfxVol,at+.02);g.gain.exponentialRampToValueAtTime(0.001,at+.42);
        o.connect(g);g.connect(ctx.destination);o.start(at);o.stop(at+.46);o.onended=()=>{o.disconnect();g.disconnect();};
      });
    }else if(type==='resonation'){
      [[220,0,.28],[440,.07,.2],[880,.14,.14],[330,.2,.1]].map(([f,t,v])=>[f,t,v*_sfxVol]).forEach(([freq,t,vol])=>{
        const o=ctx.createOscillator(),g=ctx.createGain();
        o.type='sine';o.frequency.value=freq;
        const at=ctx.currentTime+t;
        g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(vol,at+.04);g.gain.exponentialRampToValueAtTime(0.001,at+2.8);
        o.connect(g);g.connect(ctx.destination);o.start(at);o.stop(at+3);o.onended=()=>{o.disconnect();g.disconnect();};
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
      src.connect(f);f.connect(g);g.connect(ctx.destination);src.start();src.onended=()=>{src.disconnect();f.disconnect();g.disconnect();};
    }else if(type==='flip'){
      const dur=.045;
      const buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*dur),ctx.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3);
      const src=ctx.createBufferSource();src.buffer=buf;
      const f=ctx.createBiquadFilter();f.type='highpass';f.frequency.value=1800;
      const g=ctx.createGain();g.gain.setValueAtTime(0.16,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
      src.connect(f);f.connect(g);g.connect(ctx.destination);src.start();src.onended=()=>{src.disconnect();f.disconnect();g.disconnect();};
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
        src.connect(f);f.connect(g);g.connect(ctx.destination);src.start(at);src.stop(at+cd+.01);src.onended=()=>{src.disconnect();f.disconnect();g.disconnect();};
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
        src.connect(f);f.connect(g);g.connect(ctx.destination);
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
        src.connect(f);f.connect(g);g.connect(ctx.destination);
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
        src.connect(f);f.connect(g);g.connect(ctx.destination);src.start(ctx.currentTime+dt);src.stop(ctx.currentTime+dt+dur+.01);
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
