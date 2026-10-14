import Link from 'next/link';
import {ArrowUpRight, X} from 'lucide-react';
import {timeLabel} from '@/lib/client';
import type {UniverseDTO} from '@/lib/thought';
import type {UniverseSelection} from '@/lib/live-universe';

export default function ThoughtInspector({data, selection, showList, onClose, onSelect}: {
  data: UniverseDTO; selection: UniverseSelection; showList: boolean;
  onClose: () => void; onSelect: (selection: UniverseSelection) => void;
}) {
  const thought = selection?.kind === 'thought' ? data.thoughts.find(t => t.id === selection.id && t.status !== 'held') : null;
  const planet = selection?.kind === 'planet' ? data.space.planets.find(p => p.id === selection.id) : null;
  const listed = data.thoughts.filter(t => t.status !== 'held' && (!planet || t.planetIds.includes(planet.id)));
  if (!showList && !thought) return null; // a constellation only moves the camera; its list opens from the list button
  const pending = thought?.status === 'saved' || thought?.status === 'analyzing';
  return <aside className={`uv-inspector${thought ? ' reading' : ''}`} aria-label={thought ? '선택한 생각' : '생각 목록'}>
    <header><h2>{thought ? '작은 생각 하나' : planet?.name ?? '이 우주의 생각'}{!thought && <span>{listed.length}</span>}</h2>
      <button type="button" aria-label="생각 패널 닫기" onClick={onClose}><X size={17}/></button></header>
    {thought ? <div className="uv-reading" aria-live="polite">
      <p>“{thought.preview}”</p>
      <small>{timeLabel(thought.createdAt)}{thought.structure ? ` · ${thought.structure}` : ''}
        {thought.openSignals > 0 ? ` · 아직 모르는 곳 ${thought.openSignals}` : ''}</small>
      {pending ? <span className="uv-pending">도착했어요. 생각의 모양을 그리고 있어요.</span>
        : <Link href={`/t/${encodeURIComponent(thought.id)}`}>생각 자세히 보기 <ArrowUpRight size={15}/></Link>}
    </div> : <div className="uv-thought-list">
      {listed.length ? listed.map(t => <button key={t.id} type="button" onClick={() => onSelect({kind: 'thought', id: t.id})}>
        <span>{t.preview || '도착 중인 생각'}</span><small>{t.status === 'saved' || t.status === 'analyzing' ? '모양을 그리는 중' : timeLabel(t.createdAt)}</small>
      </button>) : <p>아직 별이 없어요. 첫 생각을 남겨 보세요.</p>}
    </div>}
  </aside>;
}
