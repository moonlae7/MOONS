import {AIError, type Embedder, type JsonTask, type MoonsAI} from './provider.ts';

const BASE = 'https://api.openai.com/v1';
const HANGUL = /[\uAC00-\uD7A3]/;
// Context for the speech model: Korean answers about the hackathon, English terms mixed in.
const SPEECH_HINT = '해커톤 파이어사이드 챗에 대한 한국어 소감입니다. AI, API, OpenAI 같은 영어 단어가 섞일 수 있어요.';
// Lines speech models invent on near-silence. Treated as nothing heard.
const PHANTOM = /시청해\s*주셔서\s*감사합니다|구독과\s*좋아요|자막\s*(제공|by)|MBC\s*뉴스|thanks?\s+for\s+watching/i;

function key() {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new AIError('OPENAI_API_KEY is not set', 'AI_UNAVAILABLE');
  return k;
}

async function call(path: string, init: RequestInit, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(BASE + path, {...init, signal: controller.signal, headers: {Authorization: `Bearer ${key()}`, ...(init.headers ?? {})}});
    if (res.status === 429) throw new AIError('OpenAI rate limit', 'RATE_LIMITED');
    if (!res.ok) throw new AIError(`OpenAI ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`, 'AI_FAILED');
    return res;
  } catch (error) {
    if (error instanceof AIError) throw error;
    throw new AIError(`OpenAI ${path} failed: ${(error as Error).message}`, 'AI_FAILED');
  } finally { clearTimeout(timer); }
}

export const openai: MoonsAI = {
  name: 'openai',
  async json<T>(task: JsonTask) {
    const model = task.tier === 'deep' ? (process.env.OPENAI_MODEL_DEEP || 'gpt-5.4') : (process.env.OPENAI_MODEL || 'gpt-5.4-mini');
    const res = await call('/chat/completions', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        model,
        reasoning_effort: task.tier === 'deep' ? (process.env.OPENAI_DEEP_EFFORT || 'low') : 'low',
        messages: [{role: 'system', content: task.system}, {role: 'user', content: task.user}],
        response_format: {type: 'json_schema', json_schema: {name: task.name, strict: true, schema: task.schema}},
      }),
    }, task.tier === 'deep' ? 90000 : 60000);
    const body = await res.json() as {choices?: {message?: {content?: string; refusal?: string}}[]};
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new AIError(`Empty response (${body.choices?.[0]?.message?.refusal ?? 'no content'})`, 'PARSE_FAILED');
    try { return {data: JSON.parse(content) as T, model}; }
    catch { throw new AIError('Model returned invalid JSON', 'PARSE_FAILED'); }
  },
  async transcribe(audio, filename) {
    const once = async (model: string) => {
      const form = new FormData();
      form.append('file', audio, filename);
      form.append('model', model);
      form.append('language', 'ko');
      form.append('prompt', SPEECH_HINT);
      const res = await call('/audio/transcriptions', {method: 'POST', body: form}, 60000);
      const text = ((await res.json() as {text?: string}).text ?? '').trim();
      return PHANTOM.test(text) && text.length < 40 ? '' : text;
    };
    const primary = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-transcribe';
    const text = await once(primary);
    if (HANGUL.test(text) || primary === 'whisper-1') return text;
    // Korean speech sometimes comes back as a short English line. Ask Whisper once more and keep Korean if it hears it.
    try { const again = await once('whisper-1'); if (HANGUL.test(again)) return again; } catch {}
    return text;
  },
  async moderate(text) {
    try {
      const res = await call('/moderations', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({model: 'omni-moderation-latest', input: text})}, 15000);
      // "flagged" alone is too eager for casual Korean ("AI랑 싸움"); hold only clear cases.
      const body = await res.json() as {results?: {category_scores?: Record<string, number>}[]};
      const scores = body.results?.[0]?.category_scores ?? {};
      const strict = ['sexual/minors', 'hate/threatening', 'harassment/threatening', 'self-harm/instructions', 'violence/graphic', 'illicit/violent'];
      return Object.entries(scores).some(([k, v]) => strict.includes(k) ? v > 0.5 : v > 0.85);
    } catch { return false; } // moderation outage should not block input; admins can still hide
  },
};

export const openaiEmbedder: Embedder = {
  model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
  async embed(texts) {
    if (!texts.length) return [];
    const res = await call('/embeddings', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({model: this.model, input: texts})}, 30000);
    const body = await res.json() as {data: {index: number; embedding: number[]}[]};
    return body.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
  },
};
