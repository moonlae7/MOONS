import {q, json, iso, newId} from './db.ts';
import {ai, embedder, AIError} from './ai/index.ts';
import {eventSpace} from './event.ts';
import {PROMPT_VERSION, structureSystem, structureUser, structureSchema, relateSystem, relateSchema, crossroadsSystem, crossroadsSchema} from './prompts.ts';
import {verifyStructure, fragmentsFallback, cosine, type RawStructure} from './verify.ts';
import {preview, splitSentences, linkKinds, type Crossroad, type CrossroadPath, type EntryKind, type EntryStatus, type LinkKind, type RelatedNode, type SpaceInfo, type ThoughtAnalysis, type ThoughtDTO, type UniverseDTO} from '../thought.ts';

type EntryRow = {id: string; space_id: string; participant_id: string; nickname: string | null; kind: EntryKind; question_id: string | null; body: string; sentences: string[]; input: 'text' | 'voice'; hidden: boolean; status: EntryStatus; error: string | null; parent_entry: string | null; created_at: unknown};
type AnalysisRow = {id: string; entry_id: string; structure: string; structure_reason: string; nodes: ThoughtAnalysis['nodes']; edges: ThoughtAnalysis['edges']; signals: ThoughtAnalysis['signals']; planet_ids: string[]; model: string; prompt_version: string; fallback: boolean; created_at: unknown};
type LinkRow = {id: string; from_entry: string; from_node: string; to_entry: string; to_node: string; kind: LinkKind; reason: string; score: number};

const log = (...args: unknown[]) => console.log('[moons]', ...args); // never log entry bodies

// ---------- spaces ----------
const g = globalThis as unknown as {__moonsSpaces?: Map<string, Promise<void>>; __moonsBusy?: Set<string>};
export async function ensureSpace(space: SpaceInfo = eventSpace) {
  g.__moonsSpaces ??= new Map();
  if (!g.__moonsSpaces.has(space.id)) {
    g.__moonsSpaces.set(space.id, q(`insert into spaces (id, kind, config) values ($1, 'event', $2::jsonb)
      on conflict (id) do update set config = excluded.config`, [space.id, json(space)]).then(() => undefined)
      .catch(error => { g.__moonsSpaces?.delete(space.id); throw error; }));
  }
  await g.__moonsSpaces.get(space.id);
  return space;
}
export function spaceById(id: string): SpaceInfo | null { return id === eventSpace.id ? eventSpace : null; }

// ---------- entries ----------
export async function createEntry(input: {spaceId: string; participantId: string; nickname?: string | null; kind: EntryKind; questionId?: string | null; body: string; input: 'text' | 'voice'; parentEntry?: string | null}) {
  const id = newId();
  const sentences = splitSentences(input.body);
  await q(`insert into entries (id, space_id, participant_id, nickname, kind, question_id, body, sentences, input, parent_entry)
    values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`,
  [id, input.spaceId, input.participantId, input.nickname || null, input.kind, input.questionId || null, input.body, json(sentences), input.input, input.parentEntry || null]);
  return id;
}

async function entry(id: string) { return (await q<EntryRow>('select * from entries where id = $1', [id]))[0]; }
async function latestAnalysis(entryId: string) { return (await q<AnalysisRow>('select * from analyses where entry_id = $1 order by created_at desc limit 1', [entryId]))[0]; }
const setStatus = (id: string, status: EntryStatus, error: string | null = null) => q('update entries set status = $2, error = $3 where id = $1', [id, status, error]);

function toAnalysis(row: AnalysisRow): ThoughtAnalysis {
  return {id: row.id, structure: row.structure as ThoughtAnalysis['structure'], structureReason: row.structure_reason, nodes: row.nodes, edges: row.edges, signals: row.signals, planetIds: row.planet_ids, model: row.model, promptVersion: row.prompt_version, fallback: row.fallback, createdAt: iso(row.created_at)};
}

// ---------- pipeline ----------
export async function processEntry(id: string) {
  g.__moonsBusy ??= new Set();
  if (g.__moonsBusy.has(id)) return;
  g.__moonsBusy.add(id);
  const started = Date.now();
  try {
    const row = await entry(id);
    if (!row) return;
    const space = spaceById(row.space_id);
    if (!space) throw new Error('unknown space');
    await setStatus(id, 'analyzing');
    if (await ai().moderate(row.body)) { await q('update entries set hidden = true, status = $2 where id = $1', [id, 'held']); log('held by moderation', id); return; }
    const question = space.questions.find(x => x.id === row.question_id)?.text;
    let feedback: string | undefined, verified: ReturnType<typeof verifyStructure> | null = null, model = '', lastPlanets: string[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await ai().json<RawStructure>({name: 'moons_structure', tier: 'fast', system: structureSystem(space.planets), user: structureUser(row.sentences, question, feedback), schema: structureSchema(space.planets)});
      model = res.model; lastPlanets = res.data.planets ?? [];
      verified = verifyStructure(res.data, row.sentences, space.planets);
      if (verified.ok) break;
      feedback = verified.issues.join('\n');
      log('structure retry', id, verified.issues.length, 'issues');
    }
    const value = verified?.ok ? verified.value : fragmentsFallback(row.sentences, lastPlanets.filter(p => space.planets.some(pl => pl.id === p)));
    await q(`insert into analyses (id, entry_id, structure, structure_reason, nodes, edges, signals, planet_ids, model, prompt_version, fallback)
      values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11)`,
    [newId(), id, value.structure, value.structureReason, json(value.nodes), json(value.edges), json(value.signals), json(value.planetIds), model, PROMPT_VERSION, !verified?.ok]);
    await setStatus(id, 'done');
    log('structured', id, value.structure, `${Date.now() - started}ms`);
    await linkEntry(id).catch(error => log('link failed', id, (error as Error).message));
  } catch (error) {
    const code = error instanceof AIError ? error.code : 'ANALYSIS_FAILED';
    await setStatus(id, 'failed', code).catch(() => {});
    log('failed', id, code, (error as Error).message);
  } finally { g.__moonsBusy.delete(id); }
}

function vectorText(node: ThoughtAnalysis['nodes'][number], analysis: ThoughtAnalysis) {
  if (!node.empty) return node.text;
  const reason = analysis.signals.find(s => s.node === node.id)?.reason ?? '';
  return `(모르는 곳) ${node.role} ${reason}`.trim();
}

export async function linkEntry(id: string) {
  const row = await entry(id), a = await latestAnalysis(id);
  if (!row || !a) return;
  const analysis = toAnalysis(a);
  const nodes = analysis.nodes;
  const texts = nodes.map(n => vectorText(n, analysis));
  const vectors = await embedder().embed(texts);
  await q('delete from node_vectors where entry_id = $1', [id]);
  for (let i = 0; i < nodes.length; i++) await q('insert into node_vectors (entry_id, node_id, space_id, text, embedding) values ($1,$2,$3,$4,$5::jsonb)', [id, nodes[i].id, row.space_id, texts[i], json(vectors[i])]);

  const others = await q<{entry_id: string; node_id: string; text: string; embedding: number[]}>(
    `select v.entry_id, v.node_id, v.text, v.embedding from node_vectors v join entries e on e.id = v.entry_id
     where v.space_id = $1 and v.entry_id <> $2 and e.hidden = false and coalesce(e.parent_entry, '') <> $2`,
    [row.space_id, id]);
  if (!others.length) return;
  const candidates: {self: number; other: typeof others[number]; score: number}[] = [];
  nodes.forEach((_, i) => {
    others.map(o => ({self: i, other: o, score: cosine(vectors[i], o.embedding)}))
      .filter(c => c.score >= Number(process.env.LINK_THRESHOLD || 0.42))
      .sort((x, y) => y.score - x.score).slice(0, 3).forEach(c => candidates.push(c));
  });
  const top = candidates.sort((x, y) => y.score - x.score).slice(0, 12);
  if (!top.length) return;
  const user = top.map((c, i) => `#${i}\nA (지금): ${texts[c.self]}\nB (다른 순간): ${c.other.text}`).join('\n\n');
  const res = await ai().json<{pairs: {index: number; kind: LinkKind | 'none'; reason: string}[]}>({name: 'moons_relate', tier: 'fast', system: relateSystem, user, schema: relateSchema});
  await q('delete from links where from_entry = $1', [id]);
  const used = new Set<string>();
  for (const p of res.data.pairs) {
    const c = top[p.index];
    if (!c || p.kind === 'none' || !(linkKinds as readonly string[]).includes(p.kind)) continue;
    const key = `${nodes[c.self].id}|${c.other.entry_id}`;
    if (used.has(key)) continue;
    used.add(key);
    await q('insert into links (id, space_id, from_entry, from_node, to_entry, to_node, kind, reason, score) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [newId(), row.space_id, id, nodes[c.self].id, c.other.entry_id, c.other.node_id, p.kind, p.reason.slice(0, 100), c.score]);
  }
  log('linked', id, used.size);
}

// ---------- read models ----------
export async function universe(space: SpaceInfo): Promise<UniverseDTO> {
  const rows = await q<EntryRow & {structure: string | null; planet_ids: string[] | null; signals: ThoughtAnalysis['signals'] | null}>(
    `select e.*, a.structure, a.planet_ids, a.signals from entries e
     left join lateral (select structure, planet_ids, signals from analyses where entry_id = e.id order by created_at desc limit 1) a on true
     where e.space_id = $1 and e.hidden = false order by e.created_at asc limit 1000`, [space.id]);
  const visible = new Set(rows.map(r => r.id));
  const linkRows = await q<LinkRow>('select * from links where space_id = $1', [space.id]);
  const pairs = new Map<string, {a: string; b: string; kind: LinkKind}>();
  for (const l of linkRows) {
    if (!visible.has(l.from_entry) || !visible.has(l.to_entry)) continue;
    const key = [l.from_entry, l.to_entry].sort().join('|');
    if (!pairs.has(key) || l.kind === 'contradicts') pairs.set(key, {a: l.from_entry, b: l.to_entry, kind: l.kind});
  }
  const thoughts = rows.map(r => ({
    id: r.id, kind: r.kind, status: r.status, preview: preview(r.body), planetIds: r.planet_ids ?? [],
    openSignals: (r.signals ?? []).filter(s => s.state === 'open').length, structure: (r.structure as ThoughtAnalysis['structure']) ?? null, createdAt: iso(r.created_at),
  }));
  return {space, thoughts, links: [...pairs.values()], stats: {thoughts: thoughts.length, links: pairs.size, openSignals: thoughts.reduce((s, t) => s + t.openSignals, 0)}, now: new Date().toISOString()};
}

export async function thought(id: string): Promise<ThoughtDTO | null> {
  const row = await entry(id);
  if (!row || row.hidden) return null;
  const space = spaceById(row.space_id);
  if (!space) return null;
  const a = await latestAnalysis(id);
  const analysis = a ? toAnalysis(a) : null;
  const linkRows = await q<LinkRow & {other_body: string; other_sentences: string[]; other_nodes: ThoughtAnalysis['nodes'] | null; other_created: unknown; other_hidden: boolean}>(
    `select l.*, e.body as other_body, e.sentences as other_sentences, e.created_at as other_created, e.hidden as other_hidden,
       (select nodes from analyses where entry_id = e.id order by created_at desc limit 1) as other_nodes
     from links l join entries e on e.id = case when l.from_entry = $1 then l.to_entry else l.from_entry end
     where l.from_entry = $1 or l.to_entry = $1`, [id]);
  const related: RelatedNode[] = linkRows.filter(l => !l.other_hidden).map(l => {
    const out = l.from_entry === id;
    const otherNodeId = out ? l.to_node : l.from_node;
    const node = l.other_nodes?.find(n => n.id === otherNodeId);
    return {linkId: l.id, kind: l.kind, reason: l.reason, direction: out ? 'out' : 'in', selfNode: out ? l.from_node : l.to_node, otherEntry: out ? l.to_entry : l.from_entry, otherNode: otherNodeId,
      otherText: node ? (node.empty ? `(모르는 곳) ${node.role}` : node.text) : preview(l.other_body, 80), otherCreatedAt: iso(l.other_created)};
  });
  const c = (await q<{id: string; situation: string; paths: CrossroadPath[]; chosen_path: string | null; chosen_reason: string | null; decision_entry: string | null; created_at: unknown}>(
    'select * from crossroads where entry_id = $1 order by created_at desc limit 1', [id]))[0];
  const crossroad: Crossroad | null = c ? {id: c.id, situation: c.situation, paths: c.paths, chosenPath: c.chosen_path, chosenReason: c.chosen_reason, decisionEntry: c.decision_entry, createdAt: iso(c.created_at)} : null;
  return {id: row.id, kind: row.kind, status: row.status, input: row.input, body: row.body, sentences: row.sentences, questionId: row.question_id, createdAt: iso(row.created_at), analysis, related, crossroad, space};
}

// ---------- crossroads ----------
export async function makeCrossroad(id: string): Promise<Crossroad> {
  const row = await entry(id), a = await latestAnalysis(id);
  if (!row || !a) throw new AIError('Structure is not ready', 'AI_FAILED');
  const analysis = toAnalysis(a);
  const detail = await thought(id);
  const refs = new Set<string>();
  const lines: string[] = ['원문:', row.body, '', `이해한 모양: ${analysis.structure} (${analysis.structureReason})`, '노드:'];
  for (const n of analysis.nodes) { refs.add(`self:${n.id}`); lines.push(`- [self:${n.id}] (${n.role}${n.group ? `/${n.group}` : ''}) ${n.empty ? '(빈 칸)' : n.text}`); }
  lines.push('', '열린 신호:');
  for (const s of analysis.signals.filter(s => s.state === 'open')) lines.push(`- [self:${s.node}] ${s.kind === 'misunderstanding' ? '잘못 알았을 수 있음' : '더 공부할 곳'}: ${s.reason} (${s.basis})`);
  lines.push('', '다른 순간의 나:');
  for (const r of detail?.related ?? []) { refs.add(`link:${r.linkId}`); lines.push(`- [link:${r.linkId}] ${r.kind}: "${r.otherText}" (${r.reason})`); }
  const res = await ai().json<{situation: string; paths: {title: string; what_changes: string; need_to_know: string[]; cost: string; basis: string[]}[]}>({name: 'moons_crossroads', tier: 'deep', system: crossroadsSystem, user: lines.join('\n'), schema: crossroadsSchema});
  const paths: CrossroadPath[] = res.data.paths.slice(0, 3).map((p, i) => ({id: `p${i + 1}`, title: p.title.slice(0, 40), whatChanges: p.what_changes, needToKnow: p.need_to_know.slice(0, 3), cost: p.cost, basis: p.basis.filter(b => refs.has(b))}));
  if (paths.length < 2) throw new AIError('Not enough paths', 'PARSE_FAILED');
  const cid = newId();
  await q('insert into crossroads (id, entry_id, situation, paths, model) values ($1,$2,$3,$4::jsonb,$5)', [cid, id, res.data.situation, json(paths), res.model]);
  return {id: cid, situation: res.data.situation, paths, chosenPath: null, chosenReason: null, decisionEntry: null, createdAt: new Date().toISOString()};
}

export async function choosePath(crossroadId: string, pathId: string, reason: string, participantId: string) {
  const c = (await q<{id: string; entry_id: string; paths: CrossroadPath[]; decision_entry: string | null}>('select * from crossroads where id = $1', [crossroadId]))[0];
  if (!c) return null;
  if (c.decision_entry) return c.decision_entry;
  const path = c.paths.find(p => p.id === pathId);
  const source = await entry(c.entry_id), a = await latestAnalysis(c.entry_id);
  if (!path || !source || !a) return null;
  const body = `결정: ${path.title}.${reason.trim() ? ` 이유: ${reason.trim()}` : ''}`;
  const decisionId = await createEntry({spaceId: source.space_id, participantId, kind: 'decision', body, input: 'text', parentEntry: source.id});
  const sentences = splitSentences(body);
  const nodes = [{id: 'n1', text: body, role: 'decision', group: null, source: sentences.map((_, i) => i), empty: false, hesitant: false}];
  await q(`insert into analyses (id, entry_id, structure, structure_reason, nodes, edges, signals, planet_ids, model, prompt_version)
    values ($1,$2,'파편','갈림길에서 고른 판단',$3::jsonb,'[]'::jsonb,'[]'::jsonb,$4::jsonb,'decision',$5)`, [newId(), decisionId, json(nodes), json(a.planet_ids), PROMPT_VERSION]);
  await setStatus(decisionId, 'done');
  await q('update crossroads set chosen_path = $2, chosen_reason = $3, decision_entry = $4 where id = $1', [crossroadId, pathId, reason.trim() || null, decisionId]);
  const target = path.basis.find(b => b.startsWith('self:'))?.slice(5) ?? a.nodes.find(n => !n.empty)?.id ?? 'n1';
  await q('insert into links (id, space_id, from_entry, from_node, to_entry, to_node, kind, reason, score) values ($1,$2,$3,$4,$5,$6,$7,$8,1)',
    [newId(), source.space_id, decisionId, 'n1', source.id, target, 'decides', path.title.slice(0, 100)]);
  linkEntry(decisionId).catch(error => log('decision link failed', decisionId, (error as Error).message));
  return decisionId;
}

// ---------- signals & admin ----------
export async function dismissSignal(entryId: string, signalId: string) {
  const a = await latestAnalysis(entryId);
  if (!a) return false;
  const signals = a.signals.map(s => s.id === signalId ? {...s, state: 'dismissed' as const} : s);
  await q('update analyses set signals = $2::jsonb where id = $1', [a.id, json(signals)]);
  return true;
}

export async function adminList(spaceId: string) {
  const rows = await q<EntryRow>('select * from entries where space_id = $1 order by created_at desc limit 200', [spaceId]);
  return rows.map(r => ({id: r.id, kind: r.kind, status: r.status, hidden: r.hidden, error: r.error, input: r.input, nickname: r.nickname, body: r.body, createdAt: iso(r.created_at)}));
}
export async function setHidden(id: string, hidden: boolean) { await q('update entries set hidden = $2 where id = $1', [id, hidden]); }
