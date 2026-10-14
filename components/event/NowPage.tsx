'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, ArrowUp, Check, LoaderCircle, Mic, Square} from 'lucide-react';
import {LineLogo} from '@/components/Brand';
import {api, participantId, postJson, SPACE_ID} from '@/lib/client';
import {openMic, type Mic as LiveMic} from '@/lib/audio';
import type {Question} from '@/lib/thought';

type Sent = {id: string; text: string; input: 'text' | 'voice'; redacted: number};
const FREE: Question = {id: '', kind: '떠오른 생각', text: '질문 없이, 지금 머릿속에 있는 것 아무거나.'};
const MAX_SECONDS = 480; // about 3000 Korean characters of speech
const MAX_CHARS = 3000;

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
  const [level, setLevel] = useState(0);
  const [waiting, setWaiting] = useState(0);
  const mic = useRef<LiveMic | null>(null), tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve()), heard = useRef(0), failed = useRef('');
  const box = useRef<HTMLTextAreaElement | null>(null);
  const card = cards[index];

  useEffect(() => { try { setNickname(localStorage.getItem('moons.nickname') ?? ''); } catch {} return () => { if (tick.current) clearInterval(tick.current); mic.current?.stop(); }; }, []);

  // Live dictation: each phrase is sent the moment the speaker pauses, and its text is added to the answer box
  // in order while they keep talking. The box stays editable after, so people can fix it before sending.
  function phrase(audio: Blob) {
    setWaiting(n => n + 1);
    queue.current = queue.current.then(async () => {
      try {
        const form = new FormData();
        form.append('participantId', participantId());
        form.append('audio', audio, 'phrase.wav');
        const {text: said} = await api<{text: string}>('/api/transcribe', {method: 'POST', body: form});
        if (said) { heard.current++; setFromVoice(true); setText(prev => `${prev.trim() ? `${prev.trimEnd()} ` : ''}${said}`.slice(0, MAX_CHARS)); }
      } catch (e) {
        const message = (e as Error).message;
        if (!message.includes('알아듣지')) failed.current = message; // a phrase with no words is simply skipped
      } finally { setWaiting(n => n - 1); }
    });
  }

  async function finish() {
    if (tick.current) clearInterval(tick.current);
    mic.current?.stop(); mic.current = null;
    setRecording(false); setLevel(0); setBusy('voice');
    await queue.current;
    setBusy('');
    if (failed.current) setError(failed.current);
    else if (!heard.current) setError('목소리를 알아듣지 못했어요. 마이크 가까이에서 조금 더 크게 말해 주세요.');
    else setTimeout(() => box.current?.focus(), 50);
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
    if (recording) { void finish(); return; }
    setError(''); heard.current = 0; failed.current = '';
    try {
      mic.current = await openMic(phrase, setLevel);
    } catch (e) {
      setError((e as Error).message === 'UNSUPPORTED' ? '이 브라우저에서는 말로 답하기를 쓸 수 없어요. 글로 적어주세요.' : '마이크를 쓸 수 없어요. 브라우저 권한을 확인하거나 글로 적어주세요.');
      return;
    }
    setRecording(true); setSeconds(0);
    const startedAt = Date.now();
    tick.current = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS) void finish();
    }, 500);
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
        <textarea id="now-text" ref={box} value={text} onChange={e => setText(e.target.value)} maxLength={MAX_CHARS} rows={5}
          placeholder={recording ? '듣고 있어요. 말을 잠깐 멈출 때마다 여기에 글자가 채워져요.' : `말하거나 적어주세요. ${MAX_CHARS}자까지, 정리 안 해도 돼요.`}
          readOnly={recording || busy === 'voice'} disabled={busy === 'text'}/>
        {recording && <span className="now-live" role="status"><i className="now-level" style={{transform: `scaleX(${Math.max(0.04, level)})`}}/>{waiting ? '받아쓰는 중…' : '듣는 중'}</span>}
        <span className="now-count" aria-live="polite">{text.length} / {MAX_CHARS}</span>
        <div className="now-buttons">
          <button type="button" className={`now-mic ${recording ? 'on' : ''}`} onClick={toggleRecord} disabled={!!busy} aria-pressed={recording}>
            {recording ? <><Square size={16}/>{seconds}초 · 눌러서 끝내기</> : busy === 'voice' ? <><LoaderCircle size={17} className="spin"/>마무리하는 중…</> : <><Mic size={17}/>말로 답하기</>}
          </button>
          <button type="submit" className="now-send" disabled={!text.trim() || !!busy || recording} aria-label="스캔하기">{busy === 'text' ? <LoaderCircle size={20} className="spin"/> : <ArrowUp size={21}/>}</button>
        </div>
      </form>
      {fromVoice && text.trim() && !busy && !recording && <p className="ev-note" role="status">받아쓴 내용이 맞는지 확인해 주세요. 틀린 곳은 고친 뒤 보내면 돼요.</p>}
      {error && <p className="ev-error" role="alert">{error}</p>}

      <details className="now-name"><summary>이름 남기기 (선택)</summary>
        <label htmlFor="now-nick">큰 화면에는 보이지 않아요. 운영진만 봐요.</label>
        <input id="now-nick" value={nickname} onChange={e => setNickname(e.target.value)} maxLength={30} autoComplete="nickname"/>
      </details>
      <p className="now-fine"><Check size={13}/>로그인 없음 · 넣은 생각은 큰 화면에 공개돼요 · 키·비밀번호·연락처는 넣지 마세요 (보이면 자동으로 가려요)</p>
    </main>
  </div>;
}
