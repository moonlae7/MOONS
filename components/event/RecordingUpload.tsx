'use client';
// Upload a recording (mp3, m4a, mp4, wav ...) as an original.
// The file itself is stored as uploaded; the browser also cuts a 16kHz mono copy into 2-minute WAV pieces
// that the server transcribes, so every transcribed sentence keeps its time in the recording.
import Link from 'next/link';
import {useEffect, useState} from 'react';
import {ArrowUpRight, Check, FileAudio, LoaderCircle, Upload} from 'lucide-react';
import {api, postJson} from '@/lib/client';
import {decodeTo16k, wav} from '@/lib/audio';
import {MATERIAL_CHUNK_SECONDS, MATERIAL_MAX_BYTES, MATERIAL_PART_BYTES} from '@/lib/thought';

const ACCEPT = 'audio/*,video/mp4,video/quicktime,.mp3,.m4a,.mp4,.wav,.aac,.ogg,.webm,.mov';
const MIME: Record<string, string> = {mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'video/mp4', wav: 'audio/wav', aac: 'audio/aac', ogg: 'audio/ogg', webm: 'audio/webm', mov: 'video/quicktime'};
type Stage = 'idle' | 'reading' | 'uploading' | 'transcribing' | 'finishing' | 'done';
const stageLabel: Record<Stage, string> = {idle: '', reading: '소리를 읽는 중', uploading: '원본 파일을 올리는 중', transcribing: '받아쓰는 중', finishing: '원본으로 잠그고 구조화를 맡기는 중', done: '원본 등록 완료'};

async function retry<T>(fn: () => Promise<T>, times = 2): Promise<T> {
  try { return await fn(); } catch (error) { if (times <= 0) throw error; await new Promise(r => setTimeout(r, 1500)); return retry(fn, times - 1); }
}

export default function RecordingUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [token, setToken] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [entryId, setEntryId] = useState('');
  useEffect(() => { try { setToken(localStorage.getItem('moons.adminToken') ?? ''); } catch {} }, []);
  const busy = stage !== 'idle' && stage !== 'done';

  function pick(f: File | null) {
    setError(''); setEntryId(''); setStage('idle');
    if (f && f.size > MATERIAL_MAX_BYTES) { setFile(null); setError('150MB 이하 파일만 올릴 수 있어요. 영상이면 소리만 따로 저장해서 올려 주세요.'); return; }
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  }

  async function start() {
    if (!file || !token.trim() || busy) return;
    setError(''); setProgress(0);
    try { localStorage.setItem('moons.adminToken', token.trim()); } catch {}
    const call = <T,>(url: string, init: RequestInit) => api<T>(url, {...init, headers: {...(init.headers as Record<string, string> ?? {}), 'x-admin-token': token.trim()}});
    try {
      setStage('reading');
      let audio: Awaited<ReturnType<typeof decodeTo16k>>;
      try { audio = await decodeTo16k(await file.arrayBuffer()); } catch { throw new Error('이 파일의 소리를 읽지 못했어요. mp3나 m4a로 바꿔서 올려 주세요.'); }
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const {id} = await call<{id: string}>('/api/materials', postJson({title: title.trim() || file.name, filename: file.name, mime: file.type || MIME[ext] || '', bytes: file.size, duration: audio.duration}));

      setStage('uploading');
      const parts = Math.ceil(file.size / MATERIAL_PART_BYTES);
      for (let i = 0; i < parts; i++) {
        const piece = file.slice(i * MATERIAL_PART_BYTES, (i + 1) * MATERIAL_PART_BYTES);
        await retry(() => call(`/api/materials/${id}/file/${i}`, {method: 'PUT', headers: {'Content-Type': 'application/octet-stream'}, body: piece}));
        setProgress((i + 1) / parts);
      }

      setStage('transcribing'); setProgress(0);
      const per = MATERIAL_CHUNK_SECONDS * audio.rate, total = Math.ceil(audio.samples.length / per);
      const queue = Array.from({length: total}, (_, k) => k);
      let done = 0;
      const worker = async () => {
        for (let k = queue.shift(); k !== undefined; k = queue.shift()) {
          const slice = audio.samples.subarray(k * per, Math.min(audio.samples.length, (k + 1) * per));
          const startSec = k * MATERIAL_CHUNK_SECONDS, endSec = startSec + slice.length / audio.rate;
          const body = wav(slice, audio.rate);
          await retry(() => call(`/api/materials/${id}/chunks/${k}?start=${startSec}&end=${endSec.toFixed(1)}`, {method: 'PUT', headers: {'Content-Type': 'audio/wav'}, body}));
          setProgress(++done / total);
        }
      };
      await Promise.all([worker(), worker(), worker()]);

      setStage('finishing');
      const res = await call<{entryId: string}>(`/api/materials/${id}/finish`, {method: 'POST'});
      setEntryId(res.entryId); setStage('done');
    } catch (e) { setError((e as Error).message); setStage('idle'); }
  }

  return <section className="rec-upload" aria-label="녹음 파일을 원본으로 올리기">
    <div className="rec-head"><FileAudio size={16}/><strong>녹음 파일을 원본으로</strong><span>mp3 · m4a · mp4 · wav, 150MB까지</span></div>
    <p className="rec-help">파일 자체가 원본으로 잠기고, 받아쓴 문장마다 녹음 시각이 붙어요. 참가자들의 답은 이 원본과 각각 비교돼요.</p>
    <label className="rec-file">
      <input type="file" accept={ACCEPT} disabled={busy} onChange={e => pick(e.target.files?.[0] ?? null)}/>
      <Upload size={15}/>{file ? `${file.name} · ${(file.size / 1048576).toFixed(1)}MB` : '파일 고르기'}
    </label>
    <div className="rec-fields">
      <label>제목<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="예: 오프닝 파이어사이드 챗" disabled={busy}/></label>
      <label>관리자 토큰<input type="password" value={token} onChange={e => setToken(e.target.value)} autoComplete="off" disabled={busy}/></label>
    </div>
    <button type="button" className="rec-go" onClick={start} disabled={!file || !token.trim() || busy}>
      {busy ? <><LoaderCircle size={15} className="spin"/>{stageLabel[stage]}{stage === 'uploading' || stage === 'transcribing' ? ` ${Math.round(progress * 100)}%` : ''}</> : <><Upload size={15}/>원본으로 올리기</>}
    </button>
    {busy && <div className="rec-bar" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{width: `${Math.round(progress * 100)}%`}}/></div>}
    {stage === 'done' && entryId && <p className="rec-done"><Check size={14}/>원본 등록 완료. 구조화와 답 비교는 잠시 뒤 끝나요.
      <Link href={`/t/${entryId}`}>원본 보기<ArrowUpRight size={13}/></Link><Link href="/universe">우주 보기<ArrowUpRight size={13}/></Link></p>}
    {error && <p className="rec-error" role="alert">{error}</p>}
  </section>;
}
