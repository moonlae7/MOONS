'use client';
// Browser-side audio prep shared by spoken answers and uploaded originals.
// Whatever the phone or file used (webm, mp4, m4a, mp3, wav), the speech model gets clean 16kHz mono WAV.

export const SPEECH_RATE = 16000;

// Decodes anything the browser can play and resamples it to 16kHz mono.
export async function decodeTo16k(data: ArrayBuffer) {
  const ctx = new OfflineAudioContext(1, SPEECH_RATE, SPEECH_RATE);
  const audio = await ctx.decodeAudioData(data);
  const mono = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const ch = audio.getChannelData(c);
    for (let i = 0; i < ch.length; i++) mono[i] += ch[i] / audio.numberOfChannels;
  }
  return {samples: mono, rate: audio.sampleRate, duration: audio.duration};
}

// Quiet recordings make speech models invent text. Bring the peak up to a normal level.
export function normalize(samples: Float32Array, target = 0.9, maxGain = 30) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) { const a = Math.abs(samples[i]); if (a > peak) peak = a; }
  if (peak > 0.0005 && peak < target) {
    const gain = Math.min(target / peak, maxGain);
    for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  }
  return {samples, peak};
}

export function wav(samples: Float32Array, rate: number) {
  const buf = new ArrayBuffer(44 + samples.length * 2), v = new DataView(buf);
  const tag = (at: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i)); };
  tag(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); tag(8, 'WAVE'); tag(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); tag(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) { const s = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Blob([buf], {type: 'audio/wav'});
}

// Live microphone for spoken answers. Samples come straight from the mic (no recorder file to decode),
// are brought down to 16kHz, and are cut into phrases at natural pauses, so each phrase can be
// transcribed while the person keeps talking. Stretches with no voice are never sent.
export type Mic = {stop: () => void};
const FRAME = 480;          // 30ms at 16kHz
const PAUSE_FRAMES = 23;    // about 0.7s of quiet ends a phrase
const MIN_FRAMES = 34;      // phrases shorter than about 1s wait for more
const MAX_FRAMES = 400;     // about 12s: cut at the quietest moment of the last 2s
const PREROLL_FRAMES = 12;  // keep about 0.35s before the first word
const VOICED_FRAMES = 6;    // about 0.2s of voice makes a phrase worth sending

export async function openMic(onPhrase: (audio: Blob) => void, onLevel: (level: number) => void): Promise<Mic> {
  const Ctx = window.AudioContext ?? (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
  if (!Ctx || !navigator.mediaDevices?.getUserMedia) throw new Error('UNSUPPORTED');
  const ctx = new Ctx(); // created inside the tap, so phones allow it to run
  const resumed = ctx.resume().catch(() => {});
  let stream: MediaStream;
  try { stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1}}); }
  catch (error) { void ctx.close(); throw error; }
  await resumed;
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const step = ctx.sampleRate / SPEECH_RATE;

  let acc = 0, accN = 0, next = step, at = 0;           // box-filter resampler state
  let frame = new Float32Array(FRAME), filled = 0;
  let frames: Float32Array[] = [], levels: number[] = [], voices: boolean[] = [], voiced = 0, quiet = 0;
  let floor = -1;

  const flush = (upTo = frames.length) => {
    const take = frames.slice(0, upTo), worth = voices.slice(0, upTo).filter(Boolean).length >= VOICED_FRAMES;
    frames = frames.slice(upTo); levels = levels.slice(upTo); voices = voices.slice(upTo);
    voiced = voices.filter(Boolean).length; quiet = voices.length - 1 - voices.lastIndexOf(true);
    if (!worth || !take.length) return;
    const out = new Float32Array(take.length * FRAME);
    take.forEach((f, i) => out.set(f, i * FRAME));
    onPhrase(wav(normalize(out, 0.9, 8).samples, SPEECH_RATE));
  };
  const push = (f: Float32Array) => {
    let sum = 0;
    for (let i = 0; i < f.length; i++) sum += f[i] * f[i];
    const rms = Math.sqrt(sum / f.length);
    floor = floor < 0 ? rms : rms < floor ? floor * 0.7 + rms * 0.3 : floor * 0.997 + rms * 0.003;
    const voice = rms > Math.max(0.006, floor * 2.2);
    frames.push(f); levels.push(rms); voices.push(voice);
    if (voice) { voiced++; quiet = 0; } else quiet++;
    if (!voiced && frames.length > PREROLL_FRAMES) { frames.shift(); levels.shift(); voices.shift(); return; }
    if (voiced >= VOICED_FRAMES && quiet >= PAUSE_FRAMES && frames.length >= MIN_FRAMES) return flush();
    if (frames.length >= MAX_FRAMES) {
      let cut = frames.length - 1;
      for (let i = frames.length - 66; i < frames.length; i++) if (levels[i] < levels[cut]) cut = i;
      flush(cut + 1);
    }
  };
  node.onaudioprocess = event => {
    const input = event.inputBuffer.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < input.length; i++) {
      const x = input[i]; acc += x; accN++; at++;
      if (Math.abs(x) > peak) peak = Math.abs(x);
      if (at >= next) {
        frame[filled++] = acc / accN; acc = 0; accN = 0; next += step;
        if (filled === FRAME) { push(frame); frame = new Float32Array(FRAME); filled = 0; }
      }
    }
    onLevel(Math.min(1, peak * 2.5));
  };
  source.connect(node); node.connect(ctx.destination); // the node writes silence, so nothing is heard

  return {stop() {
    node.onaudioprocess = null;
    try { source.disconnect(); node.disconnect(); } catch {}
    stream.getTracks().forEach(t => t.stop());
    void ctx.close();
    if (filled) { push(frame.slice(0, filled)); filled = 0; }
    flush();
  }};
}
