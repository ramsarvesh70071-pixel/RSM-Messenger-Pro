// Tiny WebAudio ringtone/ringback so calls are audible without shipping audio files.
let ctx: AudioContext | null = null;
let timer: any = null;
let activeKind: 'incoming' | 'outgoing' | null = null;

const getCtx = (): AudioContext | null => {
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx || ctx.state === 'closed') ctx = new Ctor();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

const beep = (freqs: number[], durationMs: number, volume: number) => {
  const c = getCtx();
  if (!c) return;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, c.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + durationMs / 1000);
  gain.connect(c.destination);
  freqs.forEach((f) => {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    osc.connect(gain);
    osc.start();
    osc.stop(c.currentTime + durationMs / 1000 + 0.05);
  });
};

export const startRingtone = (kind: 'incoming' | 'outgoing') => {
  stopRingtone();
  activeKind = kind;
  const play = () => {
    if (kind === 'incoming') {
      beep([440, 480], 900, 0.18);
      try {
        navigator.vibrate?.([400, 200, 400]);
      } catch {}
    } else {
      beep([425], 1000, 0.1); // classic ringback tone
    }
  };
  play();
  timer = setInterval(play, kind === 'incoming' ? 2200 : 3000);
};

export const stopRingtone = () => {
  if (timer) clearInterval(timer);
  timer = null;
  activeKind = null;
  try {
    navigator.vibrate?.(0);
  } catch {}
};

export const isRinging = () => activeKind !== null;
