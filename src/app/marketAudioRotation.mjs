const MARKET_AMBIENCE_FILES = Object.freeze([
  'soundreality-bell-fx-410608.mp3',
  'izafi-gong-sound-419930.mp3',
  'olenchic-psycho-1-155031.mp3',
  'alex_jauk-witch-laugh-256450.mp3',
]);

function fileNameFromSource(src) {
  const raw = String(src || '');
  const clean = raw.split('?')[0].split('#')[0];
  return clean.slice(clean.lastIndexOf('/') + 1);
}

function replaceFileName(src, nextFile) {
  const raw = String(src || '');
  const current = fileNameFromSource(raw);
  if (!current) return nextFile;
  return raw.slice(0, raw.lastIndexOf(current)) + nextFile + raw.slice(raw.lastIndexOf(current) + current.length);
}

function rotatedMarketSource(src, target = window) {
  const current = fileNameFromSource(src);
  if (!MARKET_AMBIENCE_FILES.includes(current)) return src;

  const last = target.__tlrLastMarketAmbienceFile || null;
  let next = current;
  if (next === last && MARKET_AMBIENCE_FILES.length > 1) {
    const choices = MARKET_AMBIENCE_FILES.filter(file => file !== last);
    next = choices[Math.floor(Math.random() * choices.length)] || next;
  }
  target.__tlrLastMarketAmbienceFile = next;
  return replaceFileName(src, next);
}

export function installMarketAudioRotation(target = window) {
  if (!target || target.__tlrMarketAudioRotationInstalled) return;
  const NativeAudio = target.Audio || globalThis.Audio;
  if (typeof NativeAudio !== 'function') return;
  target.__tlrMarketAudioRotationInstalled = true;

  function RotatingAudio(src) {
    return new NativeAudio(rotatedMarketSource(src, target));
  }

  RotatingAudio.prototype = NativeAudio.prototype;
  Object.setPrototypeOf?.(RotatingAudio, NativeAudio);
  target.Audio = RotatingAudio;
  target.__tlrMarketAmbienceFiles = MARKET_AMBIENCE_FILES.slice();
}
