import {chatPersonal} from '@/lib/server/personal';
import {clientIp, fail, fromError, limited} from '@/lib/server/http';

export const maxDuration = 120;

export async function POST(request: Request) {
  if (limited(`pc:${clientIp(request)}`, 20)) return fail(429, 'RATE_LIMITED', '잠시 후 다시 시도해 주세요.');
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const messages = (Array.isArray(body.messages) ? body.messages : []).flatMap(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text.trim() ? [{role: m.role as 'user' | 'assistant', text: m.text.slice(0, 6000)}] : []).slice(-20);
    if (!messages.length || messages[messages.length - 1].role !== 'user') return fail(400, 'EMPTY', '보낼 메시지가 없어요.');
    const context = (Array.isArray(body.context) ? body.context : []).flatMap(c => c && typeof c.body === 'string' ? [{title: String(c.title ?? '').slice(0, 200), body: c.body.slice(0, 4000),
      structure: typeof c.structure === 'string' ? c.structure : null, signals: Array.isArray(c.signals) ? c.signals.filter((s: unknown): s is string => typeof s === 'string').slice(0, 6) : []}] : []).slice(0, 6);
    return Response.json({text: await chatPersonal({messages, context})});
  } catch (error) { return fromError(error); }
}
