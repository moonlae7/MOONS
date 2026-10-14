'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, ArrowUp, Check, LoaderCircle, Mic, Square} from 'lucide-react';
import {LineLogo} from '@/components/Brand';
import {api, participantId, postJson, SPACE_ID} from '@/lib/client';
import type {Question} from '@/lib/thought';

type Sent = {id: string; text: string; input: 'text' | 'voice'; redacted: number};
const FREE: Question = {id: '', kind: '떠오른 생각', text: '질문 없이, 지금 머릿속에 있는 것 아무거나.'};
const MAX_SECONDS = 45; // about 300 Korean characters of speech
const MAX_CHARS = 300;

// The phone's own dictation (Siri on iPhone, Google on Android). Words appear in the box as they are spoken.
type Dictation = {lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; abort(): void;
  onresult: ((e: {results: ArrayLike<ArrayLike<{transcript: string}>>}) => void) | null; onerror: ((e: {error: string}) => void) | null; onend: (() => void) | null};
function dictationCtor(): (new () => Dictation) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {SpeechRecognition?: new () => Dictation; webkitSpeechRecognition?: new () => Dictation};
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

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
  const dictation = useRef<Dictation | null>(null), useServer = useRef(false);
  const card = cards[index];

  useEffect(() => { try { setNickname(localStorage.getItem('moons.nickname') ?? ''); } catch {} return () => { if (tick.current) clearInterval(tick.current); recorder.current?.stream.getTracks().forEach(t => t.stop()); dictation.current?.abort(); }; }, []);

  // Voice goes into the answer box first, so people can check and fix it before sending.
  async function transcribe(audio: Blob) {
    setError(''); setBusy('voice');
    try {
      const form = new FormData();
      form.append('participantId', participantId());
      form.append('audio', audio, audio.type.includes('mp4') ? 'voice.mp4' : audio.type.includes('ogg') ? 'voice.ogg' : 'voice.webm');
      const res = await api<{text: string}>('/api/transcribe', {method: 'POST', body: form});
      setText(prev => `${prev.trim() ? `${prev.trimEnd()} ` : ''}${res.text}`.slice(0, MAX_CHARS));
      setFromVoice(true);
      setTimeout(() => box.current?.focus(), 50);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
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

  function startTimer(stop: () => void) {
    setSeconds(0);
    const startedAt = Date.now();
    if (tick.current) clearInterval(tick.current);
    tick.current = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS) stop();
    }, 500);
  }

  function startDictation(Ctor: new () => Dictation) {
    const base = text.trim() ? `${text.trimEnd()} ` : '';
    let heard = '', failed = '';
    const rec = new Ctor();
    rec.lang = 'ko-KR'; rec.interimResults = true; rec.continuous = true;
    rec.onresult = e => {
      heard = Array.from(e.results, r => r[0].transcript.trim()).filter(Boolean).join(' ');
      setText(`${base}${heard}`.slice(0, MAX_CHARS));
    };
    rec.onerror = e => { failed = e.error; };
    rec.onend = () => {
      dictation.current = null;
      if (tick.current) clearInterval(tick.current);
      setRecording(false);
      if (heard.trim()) { setFromVoice(true); setTimeout(() => box.current?.focus(), 50); return; }
      if (failed === 'not-allowed') { setError('마이크 권한을 허용해 주세요. 주소창의 설정에서 마이크를 켤 수 있어요.'); return; }
      if (failed === 'service-not-allowed' || failed === 'network' || failed === 'language-not-supported') {
        useServer.current = true; // this phone cannot dictate here; record and transcribe on the server instead
        setError('이 휴대폰에서는 바로 받아쓰기가 안 돼요. "말로 답하기"를 한 번 더 누르면 녹음 방식으로 받아써요.');
        return;
      }
      setError('목소리를 듣지 못했어요. 마이크 가까이에서 다시 말해 주세요.');
    };
    dictation.current = rec;
    try { rec.start(); } catch { dictation.current = null; useServer.current = true; setError('받아쓰기를 시작하지 못했어요. 한 번 더 누르면 녹음 방식으로 받아써요.'); return; }
    setRecording(true);
    startTimer(() => rec.stop());
  }

  async function toggleRecord() {
    if (recording) {
      if (dictation.current) dictation.current.stop();
      else if (recorder.current?.state === 'recording') recorder.current.stop();
      return;
    }
    setError('');
    const Ctor = useServer.current ? null : dictationCtor();
    if (Ctor) { startDictation(Ctor); return; }
    const mime = pickMime();
    if (!navigator.mediaDevices?.getUserMedia || !mime) { setError('이 브라우저에서는 녹음을 쓸 수 없어요. 글로 적어주세요.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
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
      recorder.current = r; r.start(); setRecording(true);
      startTimer(() => { if (r.state === 'recording') r.stop(); });
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
            {recording ? <><Square size={16}/>{seconds}초 · 눌러서 끝내기</> : busy === 'voice' ? <><LoaderCircle size={17} className="spin"/>받아쓰는 중…</> : <><Mic size={17}/>말로 답하기</>}
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
