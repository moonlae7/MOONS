'use client';
import {useRouter} from 'next/navigation';
import {useEffect, useMemo, useRef, useState} from 'react';
import {MoonCharacter} from '@/components/Brand';
import {api, hash, SPACE_ID, timeLabel} from '@/lib/client';
import {linkLabels, type SpaceInfo, type UniverseDTO, type UniverseThought} from '@/lib/thought';

const W = 1600, H = 900, GOLDEN = 2.39996;
type Placed = UniverseThought & {x: number; y: number; color: string; pending: boolean};

function layout(data: UniverseDTO) {
  const planets = data.space.planets.map(p => {
    const count = data.thoughts.filter(t => t.status === 'done' && t.planetIds.includes(p.id)).length;
    return {...p, cx: p.x * W, cy: p.y * H, count, r: Math.min(96, 34 + 7 * Math.sqrt(count))};
  });
  const byId = new Map(planets.map(p => [p.id, p]));
  const groups = new Map<string, number>();
  let arriving = 0;
  const placed: Placed[] = data.thoughts.filter(t => t.status !== 'held').map(t => {
    const pending = t.status === 'saved' || t.status === 'analyzing';
    if (pending) {
      const k = arriving++;
      return {...t, pending, color: '#9AA3B5', x: W / 2 + ((k % 7) - 3) * 30, y: 168 + Math.floor(k / 7) * 26};
    }
    const ps = t.planetIds.map(id => byId.get(id)).filter((p): p is typeof planets[number] => !!p).slice(0, 2);
    const key = ps.map(p => p.id).sort().join('+') || 'none';
    const i = groups.get(key) ?? 0;
    groups.set(key, i + 1);
    const angle = i * GOLDEN + hash(key) * Math.PI * 2;
    let cx: number, cy: number, dist: number;
    if (ps.length === 1) { cx = ps[0].cx; cy = ps[0].cy; dist = ps[0].r + 18 + 12 * Math.sqrt(i); }
    else if (ps.length === 2) { cx = (ps[0].cx + ps[1].cx) / 2; cy = (ps[0].cy + ps[1].cy) / 2; dist = 6 + 12 * Math.sqrt(i); }
    else { cx = W * 0.07; cy = H * 0.5; dist = 8 + 11 * Math.sqrt(i); }
    const color = t.kind === 'decision' ? '#6D3FC0' : ps[0]?.color ?? '#9AA3B5';
    return {...t, pending, color, x: Math.max(20, Math.min(W - 20, cx + Math.cos(angle) * dist)), y: Math.max(130, Math.min(H - 30, cy + Math.sin(angle) * dist))};
  });
  return {planets, placed};
}

export default function LivePage({space}: {space: SpaceInfo}) {
  const router = useRouter();
  const [data, setData] = useState<UniverseDTO | null>(null);
  const [error, setError] = useState('');
  const [dark, setDark] = useState(false);
  const [hover, setHover] = useState<Placed | null>(null);
  const [origin, setOrigin] = useState('');
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    setOrigin(window.location.origin);
    let alive = true;
    const load = async () => {
      try {
        const next = await api<UniverseDTO>(`/api/spaces/${SPACE_ID}/universe`);
        if (!alive) return;
        const ids = new Set(next.thoughts.map(t => t.id));
        if (seen.current) {
          const added = [...ids].filter(id => !seen.current!.has(id));
          if (added.length) { setFresh(new Set(added)); setTimeout(() => alive && setFresh(new Set()), 2600); }
        }
        seen.current = ids;
        setData(next); setError('');
      } catch (e) { if (alive) setError((e as Error).message); }
    };
    load();
    const timer = setInterval(load, 2500);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'd') setDark(d => !d);
      if (e.key === 'f') document.documentElement.requestFullscreen?.().catch(() => {});
    };
    window.addEventListener('keydown', key);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('keydown', key); };
  }, []);

  const view = useMemo(() => layout(data ?? {space, thoughts: [], links: [], stats: {thoughts: 0, links: 0, openSignals: 0}, now: ''}), [data, space]);
  const pos = useMemo(() => new Map(view?.placed.map(p => [p.id, p]) ?? []), [view]);
  const latest = useMemo(() => [...(data?.thoughts ?? [])].reverse().find(t => t.status === 'done' && t.kind !== 'decision'), [data]);
  const nowUrl = origin ? `${origin}/now` : '';

  return <div className={`ev ev-live ${dark ? 'dark' : ''}`}>
    <div className="lv-stage">
      <svg className="lv-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="오늘 들어온 생각들이 주제별 모행성 주위에 모여 있는 우주">
        <defs>
          {view?.planets.map(p => <radialGradient key={p.id} id={`glow-${p.id}`}><stop offset="0" stopColor={p.color} stopOpacity=".28"/><stop offset="1" stopColor={p.color} stopOpacity="0"/></radialGradient>)}
        </defs>
        {view?.planets.map(p => <circle key={`g${p.id}`} cx={p.cx} cy={p.cy} r={p.r * 2.1} fill={`url(#glow-${p.id})`} className="lv-glow"/>)}
        <g className="lv-links">
          {data?.links.map(l => {
            const a = pos.get(l.a), b = pos.get(l.b);
            if (!a || !b || a.pending || b.pending) return null;
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y;
            const d = `M${a.x} ${a.y} Q${mx - dy * 0.15} ${my + dx * 0.15} ${b.x} ${b.y}`;
            const isFresh = fresh.has(l.a) || fresh.has(l.b);
            return <path key={`${l.a}-${l.b}`} d={d} className={`lv-link ${l.kind} ${isFresh ? 'fresh' : ''}`} pathLength={1}/>;
          })}
        </g>
        {view?.planets.map(p => <g key={p.id} className="lv-planet" style={{transform: `translate(${p.cx}px, ${p.cy}px)`}}>
          <circle r={p.r + 10} className="lv-orbit"/>
          <circle r={p.r} fill={p.color} className="lv-body"/>
          <text y={-2} textAnchor="middle" className="lv-pname">{p.name}</text>
          <text y={22} textAnchor="middle" className="lv-pcount">{p.count}</text>
        </g>)}
        <text x={W * 0.07} y={H * 0.5 + 4} textAnchor="middle" className="lv-zone">분류 전</text>
        {view && view.placed.some(p => p.pending) && <text x={W / 2} y={140} textAnchor="middle" className="lv-zone">도착 중 · 모양을 그리는 중</text>}
        {view?.placed.map(t => <g key={t.id} className={`lv-thought ${t.pending ? 'pending' : ''} ${fresh.has(t.id) ? 'fresh' : ''} ${t.kind}`} style={{transform: `translate(${t.x}px, ${t.y}px)`}}
          onMouseEnter={() => setHover(t)} onMouseLeave={() => setHover(h => h?.id === t.id ? null : h)} onClick={() => !t.pending && router.push(`/t/${t.id}`)}>
          {t.openSignals > 0 && !t.pending && <circle r={11} className="lv-ring"/>}
          {t.kind === 'decision' ? <g><rect x={-7} y={-7} width={14} height={14} transform="rotate(45)" fill={t.color} className="lv-dot"/></g> : <circle r={t.pending ? 6 : 7} fill={t.pending ? 'none' : t.color} className="lv-dot"/>}
          <circle r={18} fill="transparent"/>
        </g>)}
      </svg>

      <header className="lv-head">
        <span className="lv-eyebrow">MOONS · LIVE</span>
        <h1>{space.name}</h1>
        <p>{space.tagline}</p>
      </header>
      <dl className="lv-stats">
        <div><dt>생각</dt><dd>{data?.stats.thoughts ?? 0}</dd></div>
        <div><dt>연결</dt><dd>{data?.stats.links ?? 0}</dd></div>
        <div><dt>아직 모르는 곳</dt><dd>{data?.stats.openSignals ?? 0}</dd></div>
      </dl>
      <ul className="lv-legend">
        <li><i className="supports"/>{linkLabels.supports}</li>
        <li><i className="contradicts"/>{linkLabels.contradicts}</li>
        <li><i className="fills_gap"/>{linkLabels.fills_gap}</li>
        <li><i className="ring"/>아직 모르는 곳이 있는 생각</li>
      </ul>

      {latest && <div className="lv-ticker" key={latest.id}>
        <span>방금 · {timeLabel(latest.createdAt)}</span>
        <p>“{latest.preview}”</p>
      </div>}
      {data && !data.thoughts.length && <div className="lv-empty">아직 조용해요. 오른쪽 아래 QR로 첫 생각을 넣어주세요.</div>}

      <aside className="lv-join">
        {nowUrl && <img src={`/api/qr?url=${encodeURIComponent(nowUrl)}`} alt="생각 넣기 QR 코드"/>}
        <div><strong>생각 넣기</strong><span>{nowUrl.replace(/^https?:\/\//, '')}</span></div>
        <MoonCharacter/>
      </aside>

      {hover && !hover.pending && <div className="lv-tip" style={{left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%`}}>
        <p>{hover.preview}</p>
        <span>{timeLabel(hover.createdAt)}{hover.structure ? ` · ${hover.structure}` : ''}{hover.openSignals ? ` · 모르는 곳 ${hover.openSignals}` : ''}</span>
      </div>}
      {error && <div className="lv-error">연결이 잠시 끊겼어요. 마지막 화면을 보여주고 있어요.</div>}
    </div>
  </div>;
}
