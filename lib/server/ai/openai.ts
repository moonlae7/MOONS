import {AIError, type Embedder, type JsonTask, type MoonsAI} from './provider.ts';

const BASE = 'https://api.openai.com/v1';

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
    const form = new FormData();
    form.append('file', audio, filename);
    form.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-transcribe');
    form.append('language', 'ko');
    const res = await call('/audio/transcriptions', {method: 'POST', body: form}, 60000);
    const body = await res.json() as {text?: string};
    return (body.text ?? '').trim();
  },
  async moderate(text) {
    try {
      const res = await call('/moderations', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({model: 'omni-moderation-latest', input: text})}, 15000);
      const body = await res.json() as {results?: {flagged?: boolean}[]};
      return !!body.results?.[0]?.flagged;
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
