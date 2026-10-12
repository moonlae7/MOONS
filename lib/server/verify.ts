import {shapes, type Planet, type Shape, type ThoughtAnalysis, type ThoughtEdge, type ThoughtNode, type ThoughtSignal} from '../thought.ts';
import {validChecklistBasis} from './prompts.ts';

export type RawStructure = {
  structure: string;
  structure_reason: string;
  nodes: {id: string; text: string; role: string; group: string | null; source: number[]; empty: boolean; hesitant: boolean}[];
  edges: {from: string; to: string; label: string | null}[];
  signals: {node: string; kind: 'misunderstanding' | 'study'; reason: string; basis: string}[];
  planets: string[];
};

const norm = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim();
const trimEdges = (s: string) => s.replace(/^[\s"'“”‘’(\[{<…·,.!?~-]+|[\s"'“”‘’)\]}>…·,.!?~-]+$/g, '');

// "No correction" is enforced here: every written node must be a verbatim slice of the original.
export function verifyStructure(raw: RawStructure, sentences: string[], planets: Planet[]):
  {ok: true; value: Omit<ThoughtAnalysis, 'id' | 'model' | 'promptVersion' | 'createdAt' | 'fallback'>} | {ok: false; issues: string[]} {
  const issues: string[] = [];
  if (!(shapes as readonly string[]).includes(raw.structure)) issues.push(`structure "${raw.structure}"는 목록에 없음`);
  const body = norm(sentences.join(' '));
  const seen = new Set<string>();
  const nodes: ThoughtNode[] = [];
  for (const n of raw.nodes.slice(0, 12)) {
    let id = n.id || `n${nodes.length + 1}`;
    if (seen.has(id)) id = `${id}_${nodes.length}`;
    seen.add(id);
    const text = n.empty ? '' : trimEdges(norm(n.text));
    let source = (n.source ?? []).filter(i => Number.isInteger(i) && i >= 0 && i < sentences.length);
    if (!n.empty) {
      if (!text) { issues.push(`노드 ${id}: 내용이 비었는데 empty=false`); continue; }
      const inSource = source.length > 0 && norm(source.map(i => sentences[i]).join(' ')).includes(text);
      if (!inSource) {
        if (body.includes(text)) source = sentences.map((s, i) => norm(s).includes(text) || text.includes(trimEdges(norm(s))) ? i : -1).filter(i => i >= 0);
        else { issues.push(`노드 ${id}의 text "${n.text}"가 원문에 글자 그대로 없음. 원문 일부를 그대로 복사할 것`); continue; }
      }
    } else source = [];
    nodes.push({id, text, role: n.role || 'idea', group: n.group || null, source, empty: !!n.empty, hesitant: !!n.hesitant && !n.empty});
  }
  if (!nodes.some(n => !n.empty)) issues.push('원문에서 나온 노드가 하나도 없음');
  const ids = new Set(nodes.map(n => n.id));
  const edges: ThoughtEdge[] = raw.edges.filter(e => ids.has(e.from) && ids.has(e.to) && e.from !== e.to).map(e => ({from: e.from, to: e.to, label: e.label || null}));
  const signals: ThoughtSignal[] = raw.signals
    .filter(s => ids.has(s.node) && s.reason?.trim())
    .map((s, i) => ({id: `s${i + 1}`, node: s.node, kind: s.kind, reason: s.reason.trim().slice(0, 120), basis: validChecklistBasis(s.basis) ? s.basis : 'gap', state: 'open' as const}))
    // a misunderstanding without a valid basis is downgraded rather than shown as a claim
    .map(s => s.kind === 'misunderstanding' && !(s.basis === 'logic' || s.basis.startsWith('checklist:')) ? {...s, kind: 'study' as const} : s);
  const planetIds = [...new Set(raw.planets.filter(p => planets.some(pl => pl.id === p)))].slice(0, 2);
  if (issues.length) return {ok: false, issues};
  return {ok: true, value: {structure: raw.structure as Shape, structureReason: (raw.structure_reason || '').trim(), nodes, edges, signals, planetIds}};
}

// Used when the model fails twice: the thought still lands, as its own sentences.
export function fragmentsFallback(sentences: string[], planetIds: string[] = []) {
  const nodes: ThoughtNode[] = sentences.slice(0, 12).map((s, i) => ({id: `n${i + 1}`, text: s, role: 'fragment', group: null, source: [i], empty: false, hesitant: false}));
  return {structure: '파편' as Shape, structureReason: '구조화에 실패해 문장을 그대로 놓았어요.', nodes, edges: [], signals: [], planetIds};
}

export function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
