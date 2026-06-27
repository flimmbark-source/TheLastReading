// Background music and volume controls extracted from the legacy inline tail.

const TRACKS=[
  'assets/audio/boopul-misty-dawn-singing-bowls-amp-sitar-anxiety-relief-music-538675.mp3',
  'assets/audio/boopul-singing-bowls-amp-sitar-bhairav-raga-for-deep-sleep-538666.mp3',
  'assets/audio/boopul-sitar-amp-tanpura-meditation-yoga-flow-ahir-bhairav-raga-538665.mp3',
  'assets/audio/boopul-dreamy-sitar-amp-tanpura-late-night-calm-music-538721.mp3',
];
const FADE=6; // crossfade seconds

function inlineScriptStillContains(marker){
  return [...document.scripts].some(script=>script.textContent&&script.textContent.includes(marker));
}

export function installAudioControls(target = window){
  if(!target || target.__tlrAudioControlsInstalled)return;

  // The inline audio closure registers one-shot click/touch listeners. While it
  // remains in index.html, do not register a second music state machine.
  if(inlineScriptStillContains('const _music=(function()')){
    target.__tlrLegacyInlineAudioDetected=true;
    return;
  }

  target.__tlrAudioControlsInstalled=true;
  target._sfxVol=Number.isFinite(target._sfxVol)?target._sfxVol:1.0;

  let cur=null,nxt=null,lastIdx=-1,started=false,targetVol=0.3;
  let fading=false,fadeStart=0,fadeTick=null;

  function pickIdx(){let i;do{i=Math.floor(Math.random()*TRACKS.length);}while(TRACKS.length>1&&i===lastIdx);return i;}

  function beginFade(){
    if(fading)return;
    fading=true;
    fadeStart=performance.now();
    const fromVol=cur?cur.volume:targetVol;
    const idx=pickIdx();lastIdx=idx;
    nxt=document.createElement('audio');
    nxt.volume=0;
    nxt.preload='auto';
    nxt.src=TRACKS[idx];
    nxt.play().catch(()=>{});
    attachHandlers(nxt);
    function tick(){
      const p=Math.min(1,(performance.now()-fadeStart)/1000/FADE);
      if(cur)cur.volume=fromVol*(1-p);
      if(nxt)nxt.volume=targetVol*p;
      if(p<1){fadeTick=requestAnimationFrame(tick);}
      else{
        if(cur){cur.src='';cur=null;}
        cur=nxt;nxt=null;fading=false;fadeTick=null;
      }
    }
    fadeTick=requestAnimationFrame(tick);
  }

  function attachHandlers(el){
    function onTime(){
      if(!el.duration||el.duration-el.currentTime>FADE+0.5)return;
      el.removeEventListener('timeupdate',onTime);
      el.removeEventListener('ended',onEnd);
      if(cur===el)beginFade();
    }
    function onEnd(){
      el.removeEventListener('timeupdate',onTime);
      el.removeEventListener('ended',onEnd);
      if(cur===el)beginFade();
    }
    el.addEventListener('timeupdate',onTime);
    el.addEventListener('ended',onEnd);
  }

  function start(){
    if(started)return;
    started=true;
    cur=document.createElement('audio');
    cur.volume=targetVol;
    cur.preload='none';
    const idx=pickIdx();lastIdx=idx;
    cur.src=TRACKS[idx];
    attachHandlers(cur);
    cur.play().catch(()=>{started=false;cur=null;});
  }

  const music={setVol(v){targetVol=v;if(cur&&!fading)cur.volume=v;}};
  target.tlrMusic=music;
  target._music=music;
  target.setMusicVol=function(v){music.setVol(v);};
  target.setSfxVol=function(v){target._sfxVol=v;};

  document.addEventListener('touchstart',start,{capture:true,once:true});
  document.addEventListener('click',start,{capture:true,once:true});
}
