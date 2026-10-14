'use client';
import Link from 'next/link';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ArrowLeft, ArrowUpRight, AudioLines, Check, GitFork, LoaderCircle, LockKeyhole, Mic, Orbit, Play} from 'lucide-react';
import {LineLogo, MoonCharacter} from '@/components/Brand';
import ShapeView, {roleName} from './ShapeView';
import {api, participantId, postJson, timeLabel, ApiError} from '@/lib/client';
import {linkLabels, shapeLabels, signalLabels, verdictLabels, type Crossroad, type ThoughtDTO} from '@/lib/thought';

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export default function ThoughtPage({id}: {id: string}) {
  const [t, setT] = useState<ThoughtDTO | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [crossBusy, setCrossBusy] = useState(false);
  const [crossError, setCrossError] = useState('');
  const [pick, setPick] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [choosing, setChoosing] = useState(false);
  const [scan, setScan] = useState<{on: boolean; redacted: number}>({on: false, redacted: 0});
  const player = useRef<HTMLAudioElement | null>(null), comparing = useRef(false), seekedAt = useRef(false);
  useEffect(() => { const p = new URLSearchParams(window.location.search); setScan({on: p.get('scan') === '1', redacted: Number(p.get('r')) || 0}); }, []);

  const load = useCallback(async () => {
    try { setT(await api<ThoughtDTO>(`/api/entries/${id}`)); setError(''); }
    catch (e) { setError(e instanceof ApiError && e.status === 404 ? '이 생각을 찾을 수 없어요.' : (e as Error).message); }
  }, [id]);

  // Poll while the structure is being drawn, then a little longer for links that land afterwards.
  const status = useRef<string>('saved');
  useEffect(() => { status.current = t?.status ?? 'saved'; }, [t]);
  useEffect(() => {
    load();
    let doneAt = 0;
    const timer = setInterval(() => {
      if (status.current !== 'saved' && status.current !== 'analyzing') {
        doneAt ||= Date.now();
        if (Date.now() - doneAt > 40000) { clearInterval(timer); return; }
      }
      load();
    }, 2000);
    return () => clearInterval(timer);
  }, [load]);

  const related = useMemo(() => {
    const map: Record<string, number> = {};
    t?.related.forEach(r => { map[r.selfNode] = (map[r.selfNode] ?? 0) + 1; });
    return map;
  }, [t]);

  // An answer sent before the original was uploaded gets read against it the first time it is opened.
  useEffect(() => {
    if (!t || comparing.current || t.comparison || !t.originalAvailable || t.status !== 'done' || t.kind === 'decision' || t.kind === 'media') return;
    comparing.current = true;
    api(`/api/entries/${id}/compare`, {method: 'POST'}).then(load).catch(() => {});
  }, [t, id, load]);
  // /t/:id?at=123 opens the original at that moment of the recording.
  useEffect(() => {
    if (!t?.material || seekedAt.current || !player.current) return;
    const at = Number(new URLSearchParams(window.location.search).get('at'));
    seekedAt.current = true;
    if (Number.isFinite(at) && at > 0) player.current.currentTime = at;
  }, [t]);
  function seek(sec: number | undefined, play = true) {
    if (!player.current || sec === undefined) return;
    player.current.currentTime = sec;
    if (play) player.current.play().catch(() => {});
  }
  useEffect(() => {
    const n = t?.analysis?.nodes.find(x => x.id === selected);
    if (t?.material && n?.source.length) seek(t.material.sentenceTimes[n.source[0]], false);
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const node = t?.analysis?.nodes.find(n => n.id === selected) ?? null;
  const highlight = new Set(node?.source ?? []);
  const question = t?.space.questions.find(q => q.id === t.questionId);
  const counts = {
    misunderstanding: t?.analysis?.signals.filter(s => s.kind === 'misunderstanding' && s.state === 'open').length ?? 0,
    study: t?.analysis?.signals.filter(s => s.kind === 'study' && s.state === 'open').length ?? 0,
  };

  async function openCrossroad() {
    setCrossBusy(true); setCrossError('');
    try { const c = await api<Crossroad>(`/api/entries/${id}/crossroads`, {method: 'POST'}); setT(prev => prev ? {...prev, crossroad: c} : prev); }
    catch (e) { setCrossError((e as Error).message); }
    finally { setCrossBusy(false); }
  }
  async function choose() {
    if (!t?.crossroad || !pick) return;
    setChoosing(true); setCrossError('');
    try { await api(`/api/crossroads/${t.crossroad.id}/choose`, postJson({pathId: pick, reason, participantId: participantId()})); await load(); }
    catch (e) { setCrossError((e as Error).message); }
    finally { setChoosing(false); }
  }
  async function dismiss(signalId: string) {
    try { await api(`/api/entries/${id}/signals/${signalId}`, {method: 'PATCH'}); await load(); } catch (e) { setError((e as Error).message); }
  }

  return <div className="ev ev-thought">
    <header className="ev-bar">
      <Link href="/universe" className="ev-back"><ArrowLeft size={16}/>우주 보기</Link>
      <span className="ev-mark"><LineLogo/></span>
      <Link href="/now" className="ev-back right">다른 질문으로 스캔<ArrowUpRight size={15}/></Link>
    </header>
    {!t ? <div className="ev-center">{error ? <p className="ev-error">{error}</p> : <LoaderCircle className="spin"/>}</div> : <main className="th-main">
      <section className="th-head">
        <span className="ev-eyebrow">{t.kind === 'decision' ? '결정' : t.kind === 'media' ? '원본 · 녹음' : t.status === 'done' ? '뇌 스캔 완료' : t.kind === 'quiz' ? '개발 퀴즈 답' : '생각'} · {timeLabel(t.createdAt)}{t.input === 'voice' && t.kind !== 'media' && <> · <Mic size={12}/> 말로 넣음</>}</span>
        {question && <p className="th-question">Q. {question.text}</p>}
        {t.material && <p className="th-question">{t.material.title} · {clock(t.material.duration)}</p>}
        {t.status === 'done' && t.analysis ? <>
          <h1>{t.kind === 'media' ? '원본은 이런 모양이에요' : '이렇게 이해하신 것 같아요'}</h1>
          <p className="th-reason"><span className="th-shape">{shapeLabels[t.analysis.structure]}</span>{t.analysis.structureReason}</p>
          <div className="th-counts">
            <span className="chip warn">{signalLabels.misunderstanding} {counts.misunderstanding}</span>
            <span className="chip study">{signalLabels.study} {counts.study}</span>
            <span className="chip moon">다른 순간의 나 {t.related.length}</span>
            {t.comparison && <span className="chip warn">원본과 다름 {t.comparison.items.filter(i => i.verdict === 'different').length}</span>}
          </div>
          {scan.redacted > 0 && <p className="ev-note">키나 연락처로 보이는 {scan.redacted}곳은 가려서 저장했어요.</p>}
        </> : t.status === 'failed' ? <><h1>{scan.on ? '스캔하지 못했어요' : '모양을 그리지 못했어요'}</h1><p className="th-reason">AI 응답이 늦거나 끊겼어요. 원문은 그대로 보관돼 있고, 운영진이 다시 돌릴 수 있어요.</p></>
          : t.status === 'held' ? <><h1>이 생각은 화면에 올라가지 않았어요</h1><p className="th-reason">공개 화면에 부적절할 수 있는 표현이 있어 보류했어요.</p></>
          : <div className={`th-wait ${scan.on ? 'scan' : ''}`}><span className="th-scanner"><MoonCharacter large/></span><div><h1>{scan.on ? '뇌를 스캔하는 중이에요' : '모양을 그리는 중이에요'}</h1><p className="th-reason">{scan.on ? '고치지 않고, 말한 그대로 이해한 모양을 찾고 있어요. 비교인지, 흐름인지, 개념 나무인지. 보통 10초 안팎 걸려요.' : '고치지 않고, 이해한 모양 그대로 그리고 있어요. 보통 10초 안팎 걸려요.'}</p></div></div>}
      </section>

      {t.analysis && t.status === 'done' && <section className="th-shape-area" aria-label="생각의 구조">
        <ShapeView analysis={t.analysis} selected={selected} onSelect={id => setSelected(selected === id ? null : id)} related={related}/>
        {t.analysis.fallback && <p className="ev-note">구조화가 두 번 실패해서 문장을 그대로 놓았어요.</p>}
      </section>}

      {t.comparison ? <section className="th-compare" aria-label="원본과 비교">
        <h2><AudioLines size={16}/>원본과 비교 · {t.comparison.materialTitle}</h2>
        <p className="th-reason">{t.comparison.summary}</p>
        <ul>{t.comparison.items.map(it => <li key={it.answer} className={`cmp ${it.verdict}`}>
          <span className={`cmp-tag ${it.verdict}`}>{verdictLabels[it.verdict]}</span>
          <p className="cmp-mine">“{t.sentences[it.answer]}”</p>
          {it.note && <p className="cmp-note">{it.note}</p>}
          {it.original.map(o => { const qt = t.comparison!.quotes.find(x => x.index === o); return qt && <Link key={o} className="cmp-quote" href={`/t/${t.comparison!.materialEntryId}?at=${qt.time}`}><Play size={12}/>{clock(qt.time)} “{qt.text}”</Link>; })}
        </li>)}</ul>
      </section> : t.originalAvailable && t.status === 'done' && t.kind !== 'decision' && <section className="th-compare"><p className="ev-note"><LoaderCircle size={14} className="spin"/> 원본 녹음과 비교하는 중이에요…</p></section>}

      <div className="th-grid">
        <section className="th-original" aria-label={t.material ? '원본 녹음' : '원문'}>
          {t.material ? <>
            <h2><LockKeyhole size={15}/>원본 · 녹음 그대로</h2>
            <audio ref={player} className="th-audio" controls preload="metadata" src={`/api/materials/${t.material.id}/file`}/>
            <ol className="th-transcript">{t.sentences.map((s, i) => <li key={i} className={highlight.has(i) ? 'hl' : ''}>
              <button type="button" onClick={() => seek(t.material!.sentenceTimes[i])}><span>{clock(t.material!.sentenceTimes[i] ?? 0)}</span>{s}</button>
            </li>)}</ol>
          </> : <>
            <h2><LockKeyhole size={15}/>원문 · 그때의 나</h2>
            <p>{t.sentences.map((s, i) => <span key={i} className={highlight.has(i) ? 'hl' : ''}>{s} </span>)}</p>
          </>}
          {node && <div className="th-node-detail">
            <span className="ev-eyebrow">{roleName(node.role)}{node.empty ? ' · 쓰지 않은 자리' : ''}</span>
            {t.analysis?.signals.filter(s => s.node === node.id).map(s => <div key={s.id} className={`th-signal ${s.kind} ${s.state}`}>
              <strong>{signalLabels[s.kind]}</strong><p>{s.reason}</p>
              {s.state === 'open' ? <button className="ev-link" onClick={() => dismiss(s.id)}>이건 맞아요 <Check size={14}/></button> : <small>{s.state === 'dismissed' ? '내가 맞다고 표시함 · 기록은 남아 있어요' : '해결됨'}</small>}
            </div>)}
          </div>}
        </section>

        <section className="th-related" aria-label="다른 순간의 나">
          <h2><Orbit size={15}/>다른 순간의 나</h2>
          {t.related.length ? <ul>{t.related.map(r => <li key={r.linkId} className={selected === r.selfNode ? 'on' : ''}>
            <span className={`th-kind ${r.kind}`}>{linkLabels[r.kind]}</span>
            <Link href={`/t/${r.otherEntry}`} className="th-other">“{r.otherText}”<span>{timeLabel(r.otherCreatedAt)}</span></Link>
            <p>{r.reason}</p>
          </li>)}</ul> : <p className="ev-note">{t.status === 'done' ? '아직 이어진 생각이 없어요. 머릿속에 생각이 쌓이면 여기에 붙어요.' : '구조가 그려지면 연결을 찾아요.'}</p>}
        </section>
      </div>

      {t.status === 'done' && t.analysis && t.kind !== 'decision' && <section className="th-cross" aria-label="갈림길">
        <div className="th-cross-head">
          <h2><GitFork size={17}/>갈림길</h2>
          <p>MOONS는 답을 골라주지 않아요. 갈 수 있는 길과, 고르려면 알아야 할 것만 펼쳐요.</p>
        </div>
        {!t.crossroad ? <button className="ev-primary" onClick={openCrossroad} disabled={crossBusy}>{crossBusy ? <><LoaderCircle size={17} className="spin"/>길을 살피는 중…</> : <>갈림길 펼치기<GitFork size={16}/></>}</button> : <>
          <p className="th-situation">{t.crossroad.situation}</p>
          <div className="th-paths">{t.crossroad.paths.map(p => {
            const chosen = t.crossroad!.chosenPath === p.id;
            return <button key={p.id} type="button" className={`th-path ${pick === p.id || chosen ? 'on' : ''} ${t.crossroad!.chosenPath && !chosen ? 'off' : ''}`} disabled={!!t.crossroad!.chosenPath} onClick={() => setPick(p.id)}>
              <strong>{p.title}</strong>
              <span className="th-path-change">{p.whatChanges}</span>
              <span className="th-path-label">고르려면 알아야 할 것</span>
              <ul>{p.needToKnow.map((k, i) => <li key={i}>{k}</li>)}</ul>
              <span className="th-path-cost">{p.cost}</span>
              <span className="th-path-basis">근거 {p.basis.length}개{p.basis.some(b => b.startsWith('link:')) ? ' · 다른 순간의 나 포함' : ''}</span>
              {chosen && <span className="th-chosen"><Check size={14}/>고른 길</span>}
            </button>;
          })}</div>
          {t.crossroad.chosenPath ? <div className="th-decision">
            <span className="ev-eyebrow">결정이 머릿속에 착지했어요</span>
            <p>결정: {t.crossroad.paths.find(p => p.id === t.crossroad!.chosenPath)?.title}{t.crossroad.chosenReason ? ` · ${t.crossroad.chosenReason}` : ''}</p>
            <div className="th-decision-links">{t.crossroad.decisionEntry && <Link className="ev-link" href={`/t/${t.crossroad.decisionEntry}`}>결정 노드 보기 <ArrowUpRight size={14}/></Link>}<Link className="ev-link" href="/universe">우주에서 보기 <ArrowUpRight size={14}/></Link></div>
          </div> : pick && <form className="th-choose" onSubmit={e => { e.preventDefault(); choose(); }}>
            <label htmlFor="choose-reason">왜 이 길인가요? (선택)</label>
            <input id="choose-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={200} placeholder="예: 이미 토스를 쓰고 있고 오늘 안에 고칠 수 있어서"/>
            <button className="ev-primary" disabled={choosing}>{choosing ? <LoaderCircle size={16} className="spin"/> : null}이 길로 갈게요</button>
          </form>}
        </>}
        {crossError && <p className="ev-error">{crossError}</p>}
      </section>}
    </main>}
  </div>;
}
