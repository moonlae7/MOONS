'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, ArrowUp, Check, LoaderCircle, Mic, Square} from 'lucide-react';
import {LineLogo} from '@/components/Brand';
import {api, participantId, postJson, SPACE_ID} from '@/lib/client';
import {decodeTo16k, normalize, pieces, wav} from '@/lib/audio';
import type {Question} from '@/lib/thought';

type Sent = {id: string; text: string; input: 'text' | 'voice'; redacted: number};
const FREE: Question = {id: '', kind: '떠오른 생각', text: '질문 없이, 지금 머릿속에 있는 것 아무거나.'};
const MAX_SECONDS = 480; // about 3000 Korean characters of speech
const MAX_CHARS = 3000;

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) ?? '';
}

export default function NowPage({questions}: {questions: Question[]}) {
  // Icebreaking first: open on a random question so answers spread across planets. Free input is the last card.
  const router = useRouter();
  const cards = questions.length ? questions : [FREE];
  const single = cards.length === 1;
  const [index, setIndex] = useState(0);
  useEffect(() => { if (questions.length > 1) setIndex(Math.floor(Math.random() * questions.length)); }, [questions.length]);
  const [text, setText] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState<'' | 'text' | 'voice'>('');
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [fromVoice, setFromVoice] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null), chunks = useRef<Blob[]>([]), tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const box = useRef<HTMLTextAreaElement | null>(null);
  const [step, setStep] = useState('');
  const card = cards[index];

  useEffect(() => { try { setNickname(localStorage.getItem('moons.nickname') ?? ''); } catch {} return () => { if (tick.current) clearInterval(tick.current); recorder.current?.stream.getTracks().forEach(t => t.stop()); }; }, []);

  // Voice goes into the answer box first, so people can check and fix it before sending.
  // The recording is turned into clean, level 16kHz mono WAV and sent to OpenAI in 100-second pieces.
  async function transcribe(audio: Blob) {
    setError(''); setBusy('voice'); setStep('');
    try {
      let files: Blob[];
      try {
        const decoded = await decodeTo16k(await audio.arrayBuffer());
        const {samples, peak} = normalize(decoded.samples);
        if (peak < 0.002) throw new Error('quiet');
        files = pieces(samples, decoded.rate, 100).map(p => wav(p.samples, decoded.rate));
      } catch (e) {
        if ((e as Error).message === 'quiet') { setError('소리가 거의 들리지 않았어요. 마이크 가까이에서 다시 말해 주세요.'); return; }
        files = [audio]; // the browser could not decode its own recording: send it as recorded
      }
      const texts: string[] = [];
      for (let i = 0; i < files.length; i++) {
        if (files.length > 1) setStep(`${i + 1}/${files.length}`);
        const form = new FormData();
        form.append('participantId', participantId());
        const f = files[i];
        form.append('audio', f, f.type === 'audio/wav' ? `voice-${i}.wav` : f.type.includes('mp4') ? 'voice.mp4' : f.type.includes('ogg') ? 'voice.ogg' : 'voice.webm');
        const res = await api<{text: string}>('/api/transcribe', {method: 'POST', body: form}).catch(e => { if (files.length > 1 && (e as Error).message.includes('알아듣지')) return {text: ''}; throw e; });
        if (res.text) texts.push(res.text);
      }
      const heard = texts.join(' ').trim();
      if (!heard) { setError('목소리를 알아듣지 못했어요. 조금 더 크게, 천천히 말해 주세요.'); return; }
      setText(prev => `${prev.trim() ? `${prev.trimEnd()} ` : ''}${heard}`.slice(0, MAX_CHARS));
      setFromVoice(true);
      setTimeout(() => box.current?.focus(), 50);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); setStep(''); }
  }

  async function submit() {
    setError(''); setBusy('text');
    try { localStorage.setItem('moons.nickname', nickname); } catch {}
    try {
      const res = await api<Sent>(`/api/spaces/${SPACE_ID}/entries`, postJson({participantId: participantId(), nickname, questionId: card.id || null, text, input: fromVoice ? 'voice' : 'text'}));
      setText(''); setFromVoice(false);
      // Straight to the scan: the result page waits for the structure, then shows it.
      router.push(`/t/${res.id}?scan=1${res.redacted ? `&r=${res.redacted}` : ''}`);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  }

  async function toggleRecord() {
    if (recording) { if (recorder.current?.state === 'recording') recorder.current.stop(); return; }
    setError('');
    const mime = pickMime();
    if (!navigator.mediaDevices?.getUserMedia || !mime) { setError('이 브라우저에서는 녹음을 쓸 수 없어요. 글로 적어주세요.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1}});
      const r = new MediaRecorder(stream, {mimeType: mime});
      chunks.current = [];
      r.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (tick.current) clearInterval(tick.current);
        setRecording(false);
        const blob = new Blob(chunks.current, {type: mime.split(';')[0]});
        if (blob.size > 2000) transcribe(blob); else setError('너무 짧아요. 조금 더 길게 말해주세요.');
      };
      recorder.current = r; r.start(1000); setRecording(true); setSeconds(0);
      const startedAt = Date.now();
      tick.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedAt) / 1000);
        setSeconds(s);
        if (s >= MAX_SECONDS && r.state === 'recording') r.stop();
      }, 500);
    } catch { setError('마이크를 쓸 수 없어요. 브라우저 권한을 확인하거나 글로 적어주세요.'); }
  }

  return <div className="ev ev-now">
    <header className="now-top"><span className="ev-mark"><LineLogo/></span><Link href="/universe" className="ev-back right">우주 보기</Link></header>
    <main className="now-main">
      <h1>당신의 뇌를<br/>스캔해 드립니다</h1>
      <p className="now-sub">아래 질문에 말이나 글로 답해 주세요. MOONS가 당신이 이해한 모양 그대로 그려 드려요. 답은 큰 화면 우주에 별로도 떠요.</p>

      <section className="now-card" aria-live="polite">
        <div className="now-card-top"><span className="ev-eyebrow">{card.id ? card.kind : '자유'}{single ? '' : ` · ${index + 1} / ${cards.length}`}</span>
          {!single && <span className="now-nav">
            <button aria-label="이전 질문" onClick={() => setIndex((index - 1 + cards.length) % cards.length)}><ArrowLeft size={17}/></button>
            <button aria-label="다음 질문" onClick={() => setIndex((index + 1) % cards.length)}><ArrowRight size={17}/></button>
          </span>}
        </div>
        <p>{card.text}</p>
      </section>

      <form className="now-form" onSubmit={e => { e.preventDefault(); if (text.trim()) submit(); }}>
        <label htmlFor="now-text" className="sr-only">생각</label>
        <textarea id="now-text" ref={box} value={text} onChange={e => setText(e.target.value)} maxLength={MAX_CHARS} rows={5} placeholder={recording ? '듣고 있어요…' : `말하거나 적어주세요. ${MAX_CHARS}자까지, 정리 안 해도 돼요.`} disabled={recording || !!busy}/>
        <span className="now-count" aria-live="polite">{text.length} / {MAX_CHARS}</span>
        <div className="now-buttons">
          <button type="button" className={`now-mic ${recording ? 'on' : ''}`} onClick={toggleRecord} disabled={!!busy} aria-pressed={recording}>
            {recording ? <><Square size={16}/>{seconds}초 · 눌러서 끝내기</> : busy === 'voice' ? <><LoaderCircle size={17} className="spin"/>받아쓰는 중{step ? ` ${step}` : '…'}</> : <><Mic size={17}/>말로 답하기</>}
          </button>
          <button type="submit" className="now-send" disabled={!text.trim() || !!busy || recording} aria-label="스캔하기">{busy === 'text' ? <LoaderCircle size={20} className="spin"/> : <ArrowUp size={21}/>}</button>
        </div>
      </form>
      {fromVoice && text.trim() && !busy && <p className="ev-note" role="status">받아쓴 내용이 맞는지 확인해 주세요. 틀린 곳은 고친 뒤 보내면 돼요.</p>}
      {error && <p className="ev-error" role="alert">{error}</p>}

      <details className="now-name"><summary>이름 남기기 (선택)</summary>
        <label htmlFor="now-nick">큰 화면에는 보이지 않아요. 운영진만 봐요.</label>
        <input id="now-nick" value={nickname} onChange={e => setNickname(e.target.value)} maxLength={30} autoComplete="nickname"/>
      </details>
      <p className="now-fine"><Check size={13}/>로그인 없음 · 넣은 생각은 큰 화면에 공개돼요 · 키·비밀번호·연락처는 넣지 마세요 (보이면 자동으로 가려요)</p>
    </main>
  </div>;
}
