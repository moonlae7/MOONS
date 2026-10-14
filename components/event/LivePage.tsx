'use client';
import Link from 'next/link';
import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {Expand, Hand, List, Minus, Network, Pause, Play, Plus, RotateCcw} from 'lucide-react';
import type {SpaceInfo, UniverseDTO} from '@/lib/thought';
import type {UniverseSelection} from '@/lib/live-universe';
import type {GestureEvent} from '@/lib/hand-gesture';
import UniverseScene, {type SceneHandle} from './live-universe/UniverseScene';
import FlatUniverse from './live-universe/FlatUniverse';
import ThoughtInspector from './live-universe/ThoughtInspector';
import HandControl, {toScreen, type HandStatus} from './live-universe/HandControl';
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
  const [hands, setHands] = useState(false);
  const [handStatus, setHandStatus] = useState<HandStatus>('off');
  const reducedMotion = useSyncExternalStore(subscribeMotion, getMotion, serverMotion);
  const origin = useSyncExternalStore(subscribeOrigin, getOrigin, serverOrigin);
  const scene = useRef<SceneHandle>(null);
  const view = useMemo<UniverseDTO>(() => data ?? {space, thoughts: [], links: [], stats: {thoughts: 0, links: 0, openSignals: 0}, now: ''}, [data, space]);
  const visibleSelection = selection && (selection.kind === 'planet'
    ? view.space.planets.some(p => p.id === selection.id)
    : view.thoughts.some(t => t.id === selection.id && t.status !== 'held')) ? selection : null;
  const reset = useCallback(() => {setSelection(null);setShowList(false);scene.current?.reset();}, []);
  const select = useCallback((next: UniverseSelection) => {setSelection(next);setShowList(false);}, []);
  // Pinch to pick a star, pinch and move to turn, fist to pull every thought in, open hand to spread them out.
  const gesture = useCallback((events: GestureEvent[]) => {
    for (const event of events) {
      if (event.type === 'select') {
        const at = toScreen(event);
        const picked = scene.current?.pickAt(at.x, at.y) ?? null;
        if (picked) select(picked); else {setSelection(null);setShowList(false);}
      } else if (event.type === 'orbit') scene.current?.rotate(event.dx * 4.2, event.dy * 3);
      else if (event.type === 'spread') scene.current?.spread(0.12 + event.value * 1.13);
      else scene.current?.spread(1);
    }
  }, [select]);
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
      if (event.key === 'h') setHands(value => !value);
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
      {/* The universe carries no text of its own. A thought's words appear only when someone picks its star. */}
      <h1 className="sr-only">{view.space.name}</h1>
      {theme === 'cosmos' && sceneReady && <HandControl active={hands} onEvents={gesture} onStatus={setHandStatus}/>}
      <ThoughtInspector data={view} selection={visibleSelection} showList={showList} onClose={reset} onSelect={select}/>
      <div className="uv-bottom">
        <div className="uv-controls" aria-label="우주 화면 조작">
          {theme === 'cosmos' && sceneReady && <>
            <button type="button" onClick={() => setPaused(value => !value)} aria-pressed={paused || reducedMotion}
              disabled={reducedMotion} title={reducedMotion ? '기기의 동작 줄이기 설정이 적용됐어요' : paused ? '자동 움직임 시작' : '자동 움직임 멈춤'}
              aria-label={paused || reducedMotion ? '자동 움직임 시작' : '자동 움직임 멈춤'}>{paused || reducedMotion ? <Play size={15}/> : <Pause size={15}/>}</button>
            <button type="button" onClick={() => scene.current?.zoom(1.2)} aria-label="축소" title="축소"><Minus size={17}/></button>
            <button type="button" onClick={() => scene.current?.zoom(.82)} aria-label="확대" title="확대"><Plus size={17}/></button>
            <button type="button" onClick={reset} aria-label="전체 우주로 돌아가기" title="전체 우주로 돌아가기"><RotateCcw size={16}/></button>
            <button type="button" onClick={() => setShowLinks(value => !value)} aria-pressed={showLinks} aria-label="모든 연결 보기" title="모든 연결 보기"><Network size={17}/></button>
            <button type="button" onClick={() => setHands(value => !value)} aria-pressed={hands}
              className={`uv-hand-toggle ${handStatus}`} aria-label="손으로 조작 (카메라)" title="손으로 조작 (H)"><Hand size={17}/></button>
          </>}
          <button type="button" onClick={() => {setSelection(null);setShowList(value => !value);}} aria-expanded={showList} aria-label="생각 목록" title="생각 목록"><List size={17}/></button>
          <button type="button" onClick={fullscreen} aria-label="전체 화면 전환" title="전체 화면 (F)"><Expand size={16}/></button>
        </div>
        <Link href="/now" className="uv-qr" aria-label="뇌 스캔 받고 생각 남기기">
          {nowUrl && <img src={`/api/qr?url=${encodeURIComponent(nowUrl)}`} alt="이 화면의 참여 주소로 연결되는 QR 코드" width={96} height={96}/>}
        </Link>
      </div>
      {error && <p className="sr-only" role="status">{data ? '연결이 잠시 끊겼어요. 마지막 화면을 보여주고 있어요.' : '생각을 불러오지 못했어요. 잠시 후 다시 연결할게요.'}</p>}
    </div>
  </main>;
}
