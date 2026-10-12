'use client';
import type {ReactNode} from 'react';
import {signalLabels, type ThoughtAnalysis, type ThoughtNode} from '@/lib/thought';

const roleNames: Record<string, string> = {
  step: '단계', cause: '원인', effect: '결과', side: '편', reason: '근거', question: '질문', fragment: '조각', claim: '주장', detail: '세부',
  concept: '개념', sub: '하위 개념', example: '예시', scene: '장면', character: '인물', emotion: '감정', interpretation: '해석',
  issue: '쟁점', rule: '규칙', facts: '사실', application: '적용', conclusion: '결론', actor: '행위자', goal: '목표', relation: '관계',
  decision: '결정', idea: '생각',
};
export const roleName = (role: string) => roleNames[role] ?? role;

type Props = {
  analysis: ThoughtAnalysis;
  selected: string | null;
  onSelect: (id: string) => void;
  related: Record<string, number>;
};

function order(nodes: ThoughtNode[], edges: ThoughtAnalysis['edges']) {
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const indeg = new Map(nodes.map(n => [n.id, 0]));
  edges.forEach(e => indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1));
  const out: ThoughtNode[] = [], used = new Set<string>();
  const queue = nodes.filter(n => !indeg.get(n.id));
  while (out.length < nodes.length) {
    if (!queue.length) { const next = nodes.find(n => !used.has(n.id)); if (!next) break; queue.push(next); }
    queue.sort((a, b) => index.get(a.id)! - index.get(b.id)!);
    const n = queue.shift()!;
    if (used.has(n.id)) continue;
    used.add(n.id); out.push(n);
    edges.filter(e => e.from === n.id).forEach(e => {
      indeg.set(e.to, (indeg.get(e.to) ?? 1) - 1);
      const t = nodes.find(x => x.id === e.to);
      if (t && !used.has(t.id) && indeg.get(t.id)! <= 0) queue.push(t);
    });
  }
  return out;
}

function Node({node, analysis, selected, onSelect, related}: {node: ThoughtNode} & Props) {
  const signals = analysis.signals.filter(s => s.node === node.id && s.state === 'open');
  const kind = signals.find(s => s.kind === 'misunderstanding') ? 'warn' : signals.length ? 'study' : '';
  return <button type="button" className={`sv-node ${node.empty ? 'empty' : ''} ${kind} ${selected === node.id ? 'selected' : ''}`} onClick={() => onSelect(node.id)} aria-pressed={selected === node.id}>
    <span className="sv-role">{roleName(node.role)}{node.group && analysis.structure !== '이항대립' && analysis.structure !== '비교' ? ` · ${node.group}` : ''}{node.hesitant && <em> · 망설임</em>}{related[node.id] ? <b className="sv-rel" aria-label={`다른 순간 ${related[node.id]}개`}>↔ {related[node.id]}</b> : null}</span>
    <span className="sv-text">{node.empty ? '쓰지 않은 자리' : node.text}</span>
    {signals.map(s => <span key={s.id} className={`sv-signal ${s.kind}`}><strong>{signalLabels[s.kind]}</strong>{s.reason}</span>)}
  </button>;
}

function Flow(p: Props) {
  const nodes = order(p.analysis.nodes, p.analysis.edges);
  return <div className="sv-flow">{nodes.map((n, i) => {
    const next = nodes[i + 1];
    const edge = next && p.analysis.edges.find(e => e.from === n.id && e.to === next.id);
    return <div className="sv-flow-step" key={n.id}><Node node={n} {...p}/>{next && <span className={`sv-arrow ${edge ? '' : 'loose'}`} aria-hidden="true">{edge?.label && <small>{edge.label}</small>}<svg width="34" height="14" viewBox="0 0 34 14"><path d="M1 7h30m-6-5 6 5-6 5" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg></span>}</div>;
  })}</div>;
}

function Opposition(p: Props) {
  const groups = [...new Set(p.analysis.nodes.map(n => n.group).filter((g): g is string => !!g))].slice(0, 2);
  const side = (g: string) => p.analysis.nodes.filter(n => n.group === g);
  const rest = p.analysis.nodes.filter(n => !n.group || !groups.includes(n.group));
  return <div className="sv-opp">
    <div className="sv-opp-cols">{groups.map((g, i) => <div key={g} className="sv-opp-side">{side(g).map(n => <Node key={n.id} node={n} {...p}/>)}{i === 0 && groups.length > 1 && <span className="sv-vs" aria-hidden="true">vs</span>}</div>)}</div>
    {rest.length > 0 && <div className="sv-opp-rest">{rest.map(n => <Node key={n.id} node={n} {...p}/>)}</div>}
  </div>;
}

function Fragments(p: Props) {
  return <div className="sv-frag">{p.analysis.nodes.map((n, i) => <div key={n.id} style={{marginTop: [0, 28, 10, 40, 4, 22][i % 6]}}><Node node={n} {...p}/></div>)}</div>;
}

function treeOf(p: Props) {
  const {nodes, edges} = p.analysis;
  const children = (id: string) => edges.filter(e => e.from === id).map(e => nodes.find(n => n.id === e.to)).filter((n): n is ThoughtNode => !!n);
  const hasParent = new Set(edges.map(e => e.to));
  const seen = new Set<string>();
  const roots = nodes.filter(n => !hasParent.has(n.id));
  if (!roots.length && nodes[0]) roots.push(nodes[0]);
  return {roots, children, seen, orphans: () => nodes.filter(n => !seen.has(n.id))};
}

function OrgChart(p: Props) {
  const t = treeOf(p);
  const render = (n: ThoughtNode, depth: number): ReactNode => {
    if (t.seen.has(n.id) || depth > 4) return null;
    t.seen.add(n.id);
    const kids = t.children(n.id).filter(k => !t.seen.has(k.id));
    return <div className="sv-org-item" key={n.id}><Node node={n} {...p}/>{kids.length > 0 && <div className="sv-org-kids">{kids.map(k => render(k, depth + 1))}</div>}</div>;
  };
  const top = t.roots.map(r => render(r, 0));
  const left = t.orphans();
  return <div className="sv-org"><div className="sv-org-roots">{top}</div>{left.length > 0 && <div className="sv-org-rest">{left.map(n => <Node key={n.id} node={n} {...p}/>)}</div>}</div>;
}

function Outline(p: Props) {
  const t = treeOf(p);
  const render = (n: ThoughtNode, depth: number): ReactNode => {
    if (t.seen.has(n.id) || depth > 5) return null;
    t.seen.add(n.id);
    const kids = t.children(n.id).filter(k => !t.seen.has(k.id));
    return <li key={n.id}><Node node={n} {...p}/>{kids.length > 0 && <ul>{kids.map(k => render(k, depth + 1))}</ul>}</li>;
  };
  const top = t.roots.map(r => render(r, 0));
  const left = t.orphans();
  return <ul className="sv-outline">{top}{left.map(n => <li key={n.id}><Node node={n} {...p}/></li>)}</ul>;
}

function Compare(p: Props) {
  const nodes = p.analysis.nodes;
  const cols = [...new Set(nodes.map(n => n.group).filter((g): g is string => !!g))];
  const rows = [...new Set(nodes.filter(n => n.group).map(n => n.role))];
  const loose = nodes.filter(n => !n.group);
  if (cols.length < 2) return <Fragments {...p}/>;
  return <div className="sv-cmp-wrap">
    {loose.length > 0 && <div className="sv-cmp-loose">{loose.map(n => <Node key={n.id} node={n} {...p}/>)}</div>}
    <div className="sv-cmp" style={{gridTemplateColumns: `minmax(90px,.6fr) repeat(${cols.length}, minmax(180px,1fr))`}}>
      <span/>{cols.map(c => <span key={c} className="sv-cmp-head">{c}</span>)}
      {rows.map(r => <div key={r} className="sv-cmp-row" style={{display: 'contents'}}>
        <span className="sv-cmp-crit">{roleName(r)}</span>
        {cols.map(c => { const cell = nodes.filter(n => n.group === c && n.role === r); return <div key={c} className="sv-cmp-cell">{cell.length ? cell.map(n => <Node key={n.id} node={n} {...p}/>) : <span className="sv-cmp-missing">말하지 않음</span>}</div>; })}
      </div>)}
    </div>
  </div>;
}

function Columns(p: Props & {by: 'role' | 'group'}) {
  const keys = [...new Set(p.analysis.nodes.map(n => (p.by === 'group' ? n.group : n.role) ?? '기타'))];
  return <div className="sv-cols" style={{gridTemplateColumns: `repeat(${Math.min(keys.length, 5)}, minmax(170px, 1fr))`}}>{keys.map(k => <div key={k} className="sv-col"><span className="sv-col-head">{p.by === 'role' ? roleName(k) : k}</span>{p.analysis.nodes.filter(n => ((p.by === 'group' ? n.group : n.role) ?? '기타') === k).map(n => <Node key={n.id} node={n} {...p}/>)}</div>)}</div>;
}

export default function ShapeView(p: Props) {
  const s = p.analysis.structure;
  return <div className={`sv sv-${s}`}>
    {s === '흐름' || s === 'IRAC' ? <Flow {...p}/>
      : s === '이항대립' ? <Opposition {...p}/>
      : s === '파편' ? <Fragments {...p}/>
      : s === '주장-근거' ? <OrgChart {...p}/>
      : s === '지식나열' ? <Outline {...p}/>
      : s === '비교' ? <Compare {...p}/>
      : s === 'ANT' ? <Columns by="group" {...p}/>
      : <Columns by="role" {...p}/>}
  </div>;
}
