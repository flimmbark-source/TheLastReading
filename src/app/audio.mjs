// Background music and volume controls extracted from the legacy inline tail.

const DEFAULT_TRACKS = [
  'assets/audio/boopul-misty-dawn-singing-bowls-amp-sitar-anxiety-relief-music-538675.mp3',
  'assets/audio/boopul-singing-bowls-amp-sitar-bhairav-raga-for-deep-sleep-538666.mp3',
  'assets/audio/boopul-sitar-amp-tanpura-meditation-yoga-flow-ahir-bhairav-raga-538665.mp3',
  'assets/audio/boopul-dreamy-sitar-amp-tanpura-late-night-calm-music-538721.mp3',
];

const MUSIC_CONTEXTS = {
  default: { tracks: DEFAULT_TRACKS, loopSingle: false, volumeScale: 1 },
  mainMenu: {
    tracks: ['assets/audio/execore-gradient-148888.mp3'],
    loopSingle: true,
    volumeScale: 0.5,
  },
  premiumStore: {
    tracks: ['assets/audio/lofium-lofi-song-backyard-by-lofium-242713.mp3'],
    loopSingle: true,
    volumeScale: 0.5,
  },
};

const FADE = 6; // crossfade seconds

function inlineScriptStillContains(marker) {
  return [...document.scripts].some(script => script.textContent && script.textContent.includes(marker));
}

export function installAudioControls(target = window) {
  if (!target || target.__tlrAudioControlsInstalled) return;

  // The inline audio closure registers one-shot click/touch listeners. While it
  // remains in index.html, do not register a second music state machine.
  if (inlineScriptStillContains('const _music=(function()')) {
    target.__tlrLegacyInlineAudioDetected = true;
    return;
  }

  target.__tlrAudioControlsInstalled = true;
  target._sfxVol = Number.isFinite(target._sfxVol) ? target._sfxVol : 1.0;

  let cur = null;
  let nxt = null;
  let lastIdx = -1;
  let started = false;
  let targetVol = 0.3;
  let activeContext = 'mainMenu';
  let currentTrack = null;
  let fading = false;
  let fadeStart = 0;
  let fadeTick = null;

  function contextConfig(name = activeContext) {
    return MUSIC_CONTEXTS[name] || MUSIC_CONTEXTS.default;
  }

  function contextVolume(name = activeContext) {
    return targetVol * (contextConfig(name).volumeScale ?? 1);
  }

  function pickTrack(name = activeContext) {
    const tracks = contextConfig(name).tracks;
    if (tracks.length === 1) {
      lastIdx = 0;
      return tracks[0];
    }
    let i;
    do { i = Math.floor(Math.random() * tracks.length); } while (tracks.length > 1 && i === lastIdx);
    lastIdx = i;
    return tracks[i];
  }

  // Crossfade step interval. Media-element volume writes dirty style, so a
  // rAF-driven fade forced a style recalc on every frame for the fade's whole
  // 6s run (measured ~60 recalcs/s after every track change). A 100ms volume
  // staircase is inaudible on a multi-second music fade and costs 1/10th of it.
  const FADE_TICK_MS = 100;

  function stopFadeTick() {
    if (fadeTick != null) target.clearTimeout(fadeTick);
    fadeTick = null;
    fading = false;
  }

  function buildAudio(src, contextName) {
    const el = document.createElement('audio');
    el.volume = 0;
    el.preload = 'auto';
    el.loop = !!contextConfig(contextName).loopSingle;
    el.src = src;
    attachHandlers(el, contextName);
    return el;
  }

  function beginFadeTo(src, contextName = activeContext, fadeSeconds = FADE) {
    if (!started) return;
    if (currentTrack === src && cur && !nxt) {
      cur.loop = !!contextConfig(contextName).loopSingle;
      return;
    }

    stopFadeTick();
    if (nxt) {
      nxt.pause();
      nxt.src = '';
      nxt = null;
    }

    fading = true;
    fadeStart = performance.now();
    const outgoing = cur;
    const fromVol = outgoing ? outgoing.volume : 0;
    nxt = buildAudio(src, contextName);
    nxt.play().catch(() => {});

    function tick() {
      const p = Math.min(1, (performance.now() - fadeStart) / 1000 / fadeSeconds);
      if (outgoing) outgoing.volume = fromVol * (1 - p);
      if (nxt) nxt.volume = contextVolume(contextName) * p;
      if (p < 1) {
        fadeTick = target.setTimeout(tick, FADE_TICK_MS);
      } else {
        if (outgoing) {
          outgoing.pause();
          outgoing.src = '';
        }
        cur = nxt;
        nxt = null;
        currentTrack = src;
        fading = false;
        fadeTick = null;
      }
    }
    fadeTick = target.setTimeout(tick, FADE_TICK_MS);
  }

  function beginFade() {
    beginFadeTo(pickTrack(activeContext), activeContext);
  }

  function attachHandlers(el, contextName) {
    function onTime() {
      const config = contextConfig(contextName);
      if (config.loopSingle) return;
      if (!el.duration || el.duration - el.currentTime > FADE + 0.5) return;
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
      if (cur === el) beginFade();
    }
    function onEnd() {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
      if (cur === el) beginFade();
    }
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
  }

  function start() {
    if (started) return;
    started = true;
    currentTrack = pickTrack(activeContext);
    cur = buildAudio(currentTrack, activeContext);
    cur.volume = contextVolume(activeContext);
    cur.preload = 'none';
    let playResult;
    try { playResult = cur.play(); } catch { playResult = null; }
    Promise.resolve(playResult).then(() => {
      // Autoplay (on load) or the gesture succeeded -- the fallback is done.
      disarmGestureStart();
    }).catch(() => {
      // The browser blocked autoplay before any user gesture. Reset and leave
      // the touch/click fallback armed so the first interaction starts it.
      started = false;
      if (cur) { try { cur.pause(); } catch {} cur.src = ''; cur = null; }
      currentTrack = null;
    });
  }

  function armGestureStart() {
    document.addEventListener('touchstart', start, { capture: true });
    document.addEventListener('click', start, { capture: true });
  }
  function disarmGestureStart() {
    document.removeEventListener('touchstart', start, { capture: true });
    document.removeEventListener('click', start, { capture: true });
  }

  const music = {
    setVol(v) { targetVol = v; if (cur && !fading) cur.volume = contextVolume(activeContext); },
    setContext(name = 'default', options = {}) {
      const nextContext = MUSIC_CONTEXTS[name] ? name : 'default';
      if (nextContext === activeContext) return;
      activeContext = nextContext;
      lastIdx = -1;
      if (started) beginFadeTo(pickTrack(activeContext), activeContext, options.fadeSeconds ?? FADE);
    },
  };
  target.tlrMusic = music;
  target._music = music;
  target.setMusicVol = function (v) { music.setVol(v); };
  target.tlrSetMusicContext = function (name, options) { music.setContext(name, options); };
  target.setSfxVol = function (v) { target._sfxVol = v; };

  // Try to start the (main-menu) music as soon as the game loads. Browsers that
  // permit autoplay begin immediately; those that block it before a user gesture
  // fall through to the armed touch/click fallback (the historical behaviour).
  armGestureStart();
  start();
}
