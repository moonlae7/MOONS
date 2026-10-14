'use client';
import {forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react';
import type {UniverseDTO} from '@/lib/thought';
import {layoutUniverse, type Position3, type UniverseSelection} from '@/lib/live-universe';
import type {UniverseEngine} from './engine';
import FlatUniverse from './FlatUniverse';

export type SceneHandle = {
  zoom: (scale: number) => void; reset: () => void;
  rotate: (horizontal: number, vertical: number) => void;
  spread: (value: number) => void;
  pickAt: (x: number, y: number) => UniverseSelection;
  nearest: (x: number, y: number, radius: number, planetsOnly?: boolean) => {selection: UniverseSelection; x: number; y: number} | null;
  movePlanet: (id: string, x: number, y: number) => void;
  savePlanets: () => void;
  resetPlanets: () => void;
};
// Planets placed by hand stay where they were put on this screen.
const placedKey = (spaceId: string) => `moons.placed.${spaceId}`;
function loadPlaced(spaceId: string): Record<string, Position3> {
  try { return JSON.parse(localStorage.getItem(placedKey(spaceId)) ?? '{}') ?? {}; } catch { return {}; }
}
type Props = {
  data: UniverseDTO; fresh: Set<string>; selection: UniverseSelection;
  showLinks: boolean; paused: boolean; reducedMotion: boolean;
  onSelect: (selection: UniverseSelection) => void;
  onAvailability: (available: boolean) => void;
};

const UniverseScene = forwardRef<SceneHandle, Props>(function UniverseScene(props, ref) {
  const {data, fresh, selection, showLinks, paused, reducedMotion, onSelect} = props;
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<UniverseEngine | null>(null);
  const labels = useRef(new Map<string, HTMLButtonElement>());
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [placed, setPlaced] = useState<Record<string, Position3>>({});
  useEffect(() => {setPlaced(loadPlaced(data.space.id));}, [data.space.id]);
  const placedNow = useRef(placed);
  placedNow.current = placed;
  const layout = useMemo(() => layoutUniverse(data, placed), [data, placed]);
  const current = useRef({layout, ...props});
  current.current = {layout, ...props};

  useImperativeHandle(ref, () => ({
    zoom: scale => engine.current?.zoom(scale), reset: () => engine.current?.reset(),
    rotate: (horizontal, vertical) => engine.current?.rotate(horizontal, vertical),
    spread: value => engine.current?.spread(value),
    pickAt: (x, y) => engine.current?.pickAt(x, y) ?? null,
    nearest: (x, y, radius, planetsOnly) => engine.current?.nearest(x, y, radius, planetsOnly) ?? null,
    movePlanet: (id, x, y) => {
      const point = engine.current?.planetPoint(id, x, y);
      if (point) setPlaced(value => ({...value, [id]: point}));
    },
    savePlanets: () => {try { localStorage.setItem(placedKey(current.current.data.space.id), JSON.stringify(placedNow.current)); } catch {}},
    resetPlanets: () => {
      setPlaced({});
      try { localStorage.removeItem(placedKey(current.current.data.space.id)); } catch {}
    },
  }), []);
  useEffect(() => {
    let alive = true;
    const fail = () => {
      if (!alive) return;
      engine.current?.dispose();engine.current = null;setStatus('fallback');
      current.current.onAvailability(false);
    };
    void import('./engine').then(({createUniverse}) => {
      if (!alive || !host.current) return;
      engine.current = createUniverse(host.current, {
        select: selected => current.current.onSelect(selected), fail,
        project: (id, x, y, visible) => {
          const label = labels.current.get(id);
          if (!label) return;
          label.hidden = !visible;
          label.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,0)`;
        },
      });
      const value = current.current;
      engine.current.motion(value.paused, value.reducedMotion);
      engine.current.update(value.layout, value.fresh, value.selection, value.showLinks);
      setStatus('ready');
      current.current.onAvailability(true);
    }).catch(fail);
    return () => {alive = false;engine.current?.dispose();engine.current = null;};
  }, []);
  useEffect(() => {engine.current?.update(layout, fresh, selection, showLinks);}, [layout, fresh, selection, showLinks]);
  useEffect(() => {engine.current?.motion(paused, reducedMotion);}, [paused, reducedMotion]);

  return <div className="uv-scene" data-renderer={status}>
    {status !== 'fallback' && <>
      <div ref={host} className="uv-canvas" role="group" tabIndex={0}
        aria-label="3차원 우주. 드래그 또는 방향키로 회전하고 스크롤로 확대합니다. 별을 선택하거나 생각 목록을 이용하세요."
        onKeyDown={event => {
          if (event.key.startsWith('Arrow')) {
            event.preventDefault();
            engine.current?.rotate(event.key === 'ArrowLeft' ? .12 : event.key === 'ArrowRight' ? -.12 : 0,
              event.key === 'ArrowUp' ? .08 : event.key === 'ArrowDown' ? -.08 : 0);
          }
        }}/>
      <nav className="uv-labels" aria-label="별자리로 이동">
        {layout.clusters.map(cluster => <button key={cluster.id} type="button" hidden={status !== 'ready'}
          ref={element => {if (element) labels.current.set(cluster.id, element);else labels.current.delete(cluster.id);}}
          className="uv-cluster" data-planet={cluster.id} aria-pressed={selection?.kind === 'planet' && selection.id === cluster.id}
          aria-label={`${cluster.name}, ${cluster.count}개의 생각`}
          onClick={() => onSelect({kind: 'planet', id: cluster.id})}>
          <span>{cluster.name}</span><small>{cluster.count}개의 생각</small>
        </button>)}
      </nav>
    </>}
    {status === 'loading' && <p className="uv-loading" role="status">우주를 펼치고 있어요</p>}
    {status === 'fallback' && <>
      <FlatUniverse data={data} fresh={fresh} cosmos onSelect={id => onSelect({kind: 'thought', id})}/>
      <p className="uv-fallback" role="status">이 기기에서는 기본 우주 화면으로 보여드려요.</p>
    </>}
  </div>;
});
export default UniverseScene;
