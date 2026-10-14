'use client';
import Link from 'next/link';
import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {ArrowUpRight, Expand, List, Minus, Network, Pause, Play, Plus, RotateCcw, Sparkles} from 'lucide-react';
import {timeLabel} from '@/lib/client';
import {linkKinds, linkLabels, type SpaceInfo, type UniverseDTO} from '@/lib/thought';
import type {UniverseSelection} from '@/lib/live-universe';
import UniverseScene, {type SceneHandle} from './live-universe/UniverseScene';
import FlatUniverse from './live-universe/FlatUniverse';
import ThoughtInspector from './live-universe/ThoughtInspector';
import {useLiveUniverse} from './live-universe/useLiveUniverse';
import './live-universe/universe.css';

type Theme = 'cosmos' | 'light' | 'dark';
const themes: Theme[] = ['cosmos', 'light', 'dark'];
const subscribeMotion = (callback: () => void) => {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const getMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const serverMotion = () => false;
const subscribeOrigin = () => () => {};
const getOrigin = () => window.location.origin;
const serverOrigin = () => '';

export default function LivePage({space}: {space: SpaceInfo}) {
  const {data, error, fresh} = useLiveUniverse(space.id);
  const [theme, setTheme] = useState<Theme>('cosmos');
  const [paused, setPaused] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [showList, setShowList] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [selection, setSelection] = useState<UniverseSelection>(null);
  const reducedMotion = useSyncExternalStore(subscribeMotion, getMotion, serverMotion);
  const origin = useSyncExternalStore(subscribeOrigin, getOrigin, serverOrigin);
  const scene = useRef<SceneHandle>(null);
  const view = useMemo<UniverseDTO>(() => data ?? {space, thoughts: [], links: [], stats: {thoughts: 0, links: 0, openSignals: 0}, now: ''}, [data, space]);
  const visibleSelection = selection && (selection.kind === 'planet'
    ? view.space.planets.some(p => p.id === selection.id)
    : view.thoughts.some(t => t.id === selection.id && t.status !== 'held')) ? selection : null;
  const latest = useMemo(() => [...view.thoughts].reverse().find(t => t.status === 'done' && t.kind !== 'decision'), [view]);
  const reset = useCallback(() => {setSelection(null);setShowList(false);scene.current?.reset();}, []);
  const select = useCallback((next: UniverseSelection) => {setSelection(next);setShowList(false);}, []);
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest('input,textarea,select'))) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'd') setTheme(value => themes[(themes.indexOf(value) + 1) % themes.length]);
      if (event.key === 'f') fullscreen();
      if (event.key === 'Escape') reset();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [reset]);
  const nowUrl = origin ? `${origin}/now` : '';

  return <main className={`ev ev-live lv-immersive ${theme}`}>
    <div className="lv-stage">
      {theme === 'cosmos' ? <UniverseScene ref={scene} data={view} fresh={fresh} selection={visibleSelection}
        showLinks={showLinks} paused={paused} reducedMotion={reducedMotion} onSelect={select} onAvailability={setSceneReady}/>
        : <FlatUniverse data={view} fresh={fresh} cosmos={false} onSelect={id => select({kind: 'thought', id})}/>}
      <div className="uv-vignette" aria-hidden="true"/>
      <div className="uv-topline">
        <Link href="/" className="uv-wordmark">MOONS<span>나의 우주</span></Link>
        <span className="uv-live-state"><i/>{error ? '다시 연결하는 중' : data ? '지금, 함께 만드는 우주' : '우주에 연결하는 중'}</span>
      </div>
      <header className="lv-head">
        <span className="lv-eyebrow">A UNIVERSE WITHIN</span>
        <h1>{view.space.name}</h1><p>{view.space.tagline}</p>
      </header>
      <dl className="lv-stats" aria-label="우주 통계">
        <div><dt>생각</dt><dd>{data?.stats.thoughts ?? '·'}</dd></div>
        <div><dt>연결</dt><dd>{data?.stats.links ?? '·'}</dd></div>
        <div><dt>아직 모르는 곳</dt><dd>{data?.stats.openSignals ?? '·'}</dd></div>
      </dl>
      <details className="uv-legend"><summary>별과 연결의 의미</summary><ul className="lv-legend">
        {linkKinds.map(kind => <li key={kind}><i className={kind}/>{linkLabels[kind]}</li>)}
        <li><i className="ring"/>아직 모르는 곳이 있는 생각</li>
      </ul></details>
      <ThoughtInspector data={view} selection={visibleSelection} showList={showList} onClose={reset} onSelect={select}/>
      {!visibleSelection && !showList && <div className="lv-ticker">
        {latest ? <><span>최근 생각 · {timeLabel(latest.createdAt)}</span><p>“{latest.preview}”</p></>
          : data && !view.thoughts.some(t => t.status !== 'held') ? <><span>첫 번째 별을 기다리며</span><p>QR을 찍고, 당신의 생각을 별로 남겨 주세요.</p></>
          : <><span>당신 안의 작은 우주</span><p>별을 선택해 생각을 살펴보세요.</p></>}
      </div>}
      <div className="uv-bottom">
        <p className="uv-hint">{theme === 'cosmos' && sceneReady ? <>드래그하여 둘러보기<span>스크롤하여 가까이</span></> : <>별을 선택해 살펴보세요<span>생각 목록으로도 탐색할 수 있어요</span></>}</p>
        <div className="uv-controls" aria-label="우주 화면 조작">
          {theme === 'cosmos' && sceneReady && <>
            <button type="button" onClick={() => setPaused(value => !value)} aria-pressed={paused || reducedMotion}
              disabled={reducedMotion} title={reducedMotion ? '기기의 동작 줄이기 설정이 적용됐어요' : paused ? '자동 움직임 시작' : '자동 움직임 멈춤'}
              aria-label={paused || reducedMotion ? '자동 움직임 시작' : '자동 움직임 멈춤'}>{paused || reducedMotion ? <Play size={15}/> : <Pause size={15}/>}</button>
            <button type="button" onClick={() => scene.current?.zoom(1.2)} aria-label="축소" title="축소"><Minus size={17}/></button>
            <button type="button" onClick={() => scene.current?.zoom(.82)} aria-label="확대" title="확대"><Plus size={17}/></button>
            <button type="button" onClick={reset} aria-label="전체 우주로 돌아가기" title="전체 우주로 돌아가기"><RotateCcw size={16}/></button>
            <button type="button" onClick={() => setShowLinks(value => !value)} aria-pressed={showLinks} aria-label="모든 연결 보기" title="모든 연결 보기"><Network size={17}/></button>
          </>}
          <button type="button" onClick={() => {setSelection(null);setShowList(value => !value);}} aria-expanded={showList} aria-label="생각 목록" title="생각 목록"><List size={17}/></button>
          <button type="button" onClick={fullscreen} aria-label="전체 화면 전환" title="전체 화면 (F)"><Expand size={16}/></button>
        </div>
        <Link href="/now" className="lv-join" aria-label="뇌 스캔 받고 생각 남기기">
          {nowUrl && <img src={`/api/qr?url=${encodeURIComponent(nowUrl)}`} alt="이 화면의 참여 주소로 연결되는 QR 코드" width={78} height={78}/>}
          <div><span>작은 생각도 하나의 별이 돼요</span><strong>뇌 스캔 받기 <ArrowUpRight size={15}/></strong><small>{nowUrl.replace(/^https?:\/\//, '')}</small></div>
          <Sparkles className="uv-join-spark" size={22} aria-hidden="true"/>
        </Link>
      </div>
      {error && <p className="lv-error" role="status">{data ? '연결이 잠시 끊겼어요. 마지막 화면을 보여주고 있어요.' : '생각을 불러오지 못했어요. 잠시 후 다시 연결할게요.'}</p>}
    </div>
  </main>;
}
