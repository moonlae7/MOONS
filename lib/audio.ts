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
export function normalize(samples: Float32Array, target = 0.9) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) { const a = Math.abs(samples[i]); if (a > peak) peak = a; }
  if (peak > 0.0005 && peak < target) {
    const gain = Math.min(target / peak, 30);
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

// Fixed-length pieces with their start and end times (seconds).
export function pieces(samples: Float32Array, rate: number, seconds: number) {
  const per = Math.floor(seconds * rate), out: {start: number; end: number; samples: Float32Array}[] = [];
  for (let at = 0; at < samples.length; at += per) {
    const part = samples.subarray(at, Math.min(samples.length, at + per));
    out.push({start: at / rate, end: (at + part.length) / rate, samples: part});
  }
  return out;
}
