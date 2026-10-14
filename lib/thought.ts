// Shared types for the server pipeline and the event screens (/now, /live, /t/:id).
// Personal-mode types in lib/model.ts predate these; the shapes here are the target for both.

export const shapes = ['흐름', '이항대립', '파편', '주장-근거', '비교', '지식나열', '문학', 'IRAC', 'ANT'] as const;
export type Shape = typeof shapes[number];

export const shapeLabels: Record<Shape, string> = {
  '흐름': '흐름',
  '이항대립': '이항대립',
  '파편': '흩어진 조각',
  '주장-근거': '주장과 근거',
  '비교': '비교',
  '지식나열': '개념 나무',
  '문학': '장면과 해석',
  'IRAC': 'IRAC',
  'ANT': '행위자 관계',
};

export type SignalKind = 'misunderstanding' | 'study';
export const signalLabels: Record<SignalKind, string> = { misunderstanding: '잘못 알았을 수 있어요', study: '더 공부해 볼 곳' };

export type ThoughtNode = {
  id: string;
  text: string;          // the user's own words; '' when empty
  role: string;          // layout slot
  group: string | null;  // side (이항대립) or subject (비교)
  source: number[];      // sentence indices in the original
  empty: boolean;        // a place the user did not write
  hesitant: boolean;     // "~것 같은데", "뭐였더라"
};
export type ThoughtEdge = { from: string; to: string; label: string | null };
export type ThoughtSignal = {
  id: string;
  node: string;
  kind: SignalKind;
  reason: string;
  basis: string;         // checklist:<id> | logic | hesitation | gap
  state: 'open' | 'resolved' | 'dismissed';
};
export type ThoughtAnalysis = {
  id: string;
  structure: Shape;
  structureReason: string;
  nodes: ThoughtNode[];
  edges: ThoughtEdge[];
  signals: ThoughtSignal[];
  planetIds: string[];
  model: string;
  promptVersion: string;
  fallback: boolean;     // true when the model output failed verification twice
  createdAt: string;
};

export type EntryKind = 'spark' | 'quiz' | 'decision' | 'media';
export type EntryStatus = 'saved' | 'analyzing' | 'done' | 'failed' | 'held';

export type Planet = { id: string; name: string; color: string; x: number; y: number };
export type Question = { id: string; kind: '고민' | '떠오른 생각' | '개발 퀴즈' | '소감' | '아이스브레이킹' | '가벼운 질문' | '개념 질문' | '상식 퀴즈' | '파이어사이드 챗'; text: string; planetId?: string };
export type SpaceInfo = { id: string; name: string; tagline: string; planets: Planet[]; questions: Question[] };

export const linkKinds = ['fills_gap', 'same_mistake', 'contradicts', 'supports', 'decides'] as const;
export type LinkKind = typeof linkKinds[number];
export const linkLabels: Record<LinkKind, string> = {
  fills_gap: '빈 칸을 채울 경험',
  same_mistake: '같은 실수',
  contradicts: '지금 생각과 어긋남',
  supports: '같은 생각',
  decides: '이 생각에서 나온 결정',
};

export type UniverseThought = {
  id: string;
  kind: EntryKind;
  status: EntryStatus;
  preview: string;
  planetIds: string[];
  openSignals: number;
  structure: Shape | null;
  createdAt: string;
};
export type UniverseLink = { a: string; b: string; kind: LinkKind };
export type UniverseDTO = {
  space: SpaceInfo;
  thoughts: UniverseThought[];
  links: UniverseLink[];
  stats: { thoughts: number; links: number; openSignals: number };
  now: string;
};

export type RelatedNode = {
  linkId: string;
  kind: LinkKind;
  reason: string;
  direction: 'out' | 'in';
  selfNode: string;      // node id in this entry
  otherEntry: string;
  otherNode: string;
  otherText: string;
  otherCreatedAt: string;
};

export type CrossroadPath = {
  id: string;
  title: string;
  whatChanges: string;
  needToKnow: string[];
  basis: string[];       // "self:<nodeId>" or "link:<linkId>"
  cost: string;
};
export type Crossroad = {
  id: string;
  situation: string;
  paths: CrossroadPath[];
  chosenPath: string | null;
  chosenReason: string | null;
  decisionEntry: string | null;
  createdAt: string;
};

export type ThoughtDTO = {
  id: string;
  kind: EntryKind;
  status: EntryStatus;
  input: 'text' | 'voice';
  body: string;
  sentences: string[];
  questionId: string | null;
  createdAt: string;
  analysis: ThoughtAnalysis | null;
  related: RelatedNode[];
  crossroad: Crossroad | null;
  space: SpaceInfo;
};

export function splitSentences(body: string): string[] {
  if (!body.trim()) return [];
  return body.match(/[^\n.!?。！？]+(?:[.!?。！？]+|$)/gu)?.map(s => s.trim()).filter(Boolean) ?? [body.trim()];
}

export function preview(body: string, max = 90) {
  const one = body.replace(/\s+/g, ' ').trim();
  return one.length > max ? one.slice(0, max - 1) + '…' : one;
}
