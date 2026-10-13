'use client';
import Link from 'next/link';
import {useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, ArrowUp, Check, LoaderCircle, Mic, Square} from 'lucide-react';
import {LineLogo, MoonCharacter} from '@/components/Brand';
import {api, participantId, postJson, SPACE_ID} from '@/lib/client';
import type {Question} from '@/lib/thought';

type Sent = {id: string; text: string; input: 'text' | 'voice'; redacted: number};
const FREE: Question = {id: '', kind: '떠오른 생각', text: '질문 없이, 지금 머릿속에 있는 것 아무거나.'};
const MAX_SECONDS = 60;

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) ?? '';
}

export default function NowPage({questions}: {questions: Question[]}) {
  // Icebreaking first: open on a random question so answers spread across planets. Free input is the last card.
  const cards = [...questions, FREE];
  const [index, setIndex] = useState(0);
  useEffect(() => { if (questions.length > 1) setIndex(Math.floor(Math.random() * questions.length)); }, [questions.length]);
  const [text, setText] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState<'' | 'text' | 'voice'>('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState<Sent | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null), chunks = useRef<Blob[]>([]), tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const card = cards[index];

  useEffect(() => { try { setNickname(localStorage.getItem('moons.nickname') ?? ''); } catch {} return () => { if (tick.current) clearInterval(tick.current); recorder.current?.stream.getTracks().forEach(t => t.stop()); }; }, []);

  async function submit(audio?: Blob) {
    setError(''); setBusy(audio ? 'voice' : 'text');
    try { localStorage.setItem('moons.nickname', nickname); } catch {}
    try {
      let res: Sent;
      if (audio) {
        const form = new FormData();
        form.append('participantId', participantId()); form.append('nickname', nickname); form.append('questionId', card.id); form.append('text', '');
        form.append('audio', audio, audio.type.includes('mp4') ? 'voice.mp4' : audio.type.includes('ogg') ? 'voice.ogg' : 'voice.webm');
        res = await api<Sent>(`/api/spaces/${SPACE_ID}/entries`, {method: 'POST', body: form});
      } else {
        res = await api<Sent>(`/api/spaces/${SPACE_ID}/entries`, postJson({participantId: participantId(), nickname, questionId: card.id || null, text}));
      }
      setSent(res); setText('');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  }

  async function toggleRecord() {
    if (recording) { if (recorder.current?.state === 'recording') recorder.current.stop(); return; }
    setError('');
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
        if (blob.size > 2000) submit(blob); else setError('너무 짧아요. 조금 더 길게 말해주세요.');
      };
      recorder.current = r; r.start(); setRecording(true); setSeconds(0);
      const startedAt = Date.now();
      tick.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedAt) / 1000);
        setSeconds(s);
        if (s >= MAX_SECONDS && r.state === 'recording') r.stop();
      }, 500);
    } catch { setError('마이크를 쓸 수 없어요. 브라우저 권한을 확인하거나 글로 적어주세요.'); }
  }

  if (sent) return <div className="ev ev-now">
    <header className="now-top"><span className="ev-mark"><LineLogo/></span></header>
    <main className="now-done">
      <MoonCharacter large/>
      <h1>착지했어요</h1>
      <p>큰 화면을 보세요. 방금 넣은 답이 우주에 별로 떠올랐어요. 비슷한 생각을 한 사람과 곧 이어져요.</p>
      <blockquote>“{sent.text}”</blockquote>
      {sent.redacted > 0 && <p className="ev-note">키나 연락처로 보이는 {sent.redacted}곳은 가려서 저장했어요.</p>}
      <div className="now-actions">
        <Link className="ev-primary" href={`/t/${sent.id}`}>내 생각의 모양 보기<ArrowRight size={17}/></Link>
        <button className="ev-secondary" onClick={() => { setSent(null); setIndex((index + 1) % cards.length); }}>하나 더 넣기</button>
      </div>
    </main>
  </div>;

  return <div className="ev ev-now">
    <header className="now-top"><span className="ev-mark"><LineLogo/></span><Link href="/universe" className="ev-back right">우주 보기</Link></header>
    <main className="now-main">
      <h1>질문 하나에 답해주세요</h1>
      <p className="now-sub">보내는 순간 큰 화면 우주에 별 하나로 떠요. 넘기면서 마음에 드는 질문을 골라도 돼요.</p>

      <section className="now-card" aria-live="polite">
        <div className="now-card-top"><span className="ev-eyebrow">{card.id ? card.kind : '자유'} · {index + 1} / {cards.length}</span>
          <span className="now-nav">
            <button aria-label="이전 질문" onClick={() => setIndex((index - 1 + cards.length) % cards.length)}><ArrowLeft size={17}/></button>
            <button aria-label="다음 질문" onClick={() => setIndex((index + 1) % cards.length)}><ArrowRight size={17}/></button>
          </span>
        </div>
        <p>{card.text}</p>
      </section>

      <form className="now-form" onSubmit={e => { e.preventDefault(); if (text.trim()) submit(); }}>
        <label htmlFor="now-text" className="sr-only">생각</label>
        <textarea id="now-text" value={text} onChange={e => setText(e.target.value)} maxLength={1000} rows={5} placeholder={recording ? '듣고 있어요…' : '말하거나 적어주세요. 정리 안 해도 돼요.'} disabled={recording || !!busy}/>
        <div className="now-buttons">
          <button type="button" className={`now-mic ${recording ? 'on' : ''}`} onClick={toggleRecord} disabled={!!busy} aria-pressed={recording}>
            {recording ? <><Square size={16}/>{seconds}초 · 눌러서 끝내기</> : busy === 'voice' ? <><LoaderCircle size={17} className="spin"/>알아듣는 중…</> : <><Mic size={17}/>말로 넣기</>}
          </button>
          <button type="submit" className="now-send" disabled={!text.trim() || !!busy || recording} aria-label="넣기">{busy === 'text' ? <LoaderCircle size={20} className="spin"/> : <ArrowUp size={21}/>}</button>
        </div>
      </form>
      {error && <p className="ev-error" role="alert">{error}</p>}

      <details className="now-name"><summary>이름 남기기 (선택)</summary>
        <label htmlFor="now-nick">큰 화면에는 보이지 않아요. 운영진만 봐요.</label>
        <input id="now-nick" value={nickname} onChange={e => setNickname(e.target.value)} maxLength={30} autoComplete="nickname"/>
      </details>
      <p className="now-fine"><Check size={13}/>로그인 없음 · 넣은 생각은 큰 화면에 공개돼요 · 키·비밀번호·연락처는 넣지 마세요 (보이면 자동으로 가려요)</p>
    </main>
  </div>;
}
