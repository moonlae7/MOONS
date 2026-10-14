import {analyzePersonal} from '@/lib/server/personal';
import {clientIp, fail, fromError, limited} from '@/lib/server/http';

export const maxDuration = 120;

export async function POST(request: Request) {
  if (limited(`pa:${clientIp(request)}`, 12)) return fail(429, 'RATE_LIMITED', '잠시 후 다시 시도해 주세요.');
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const sentences = Array.isArray(body.sentences) ? body.sentences.filter((s): s is string => typeof s === 'string').map(s => s.slice(0, 2000)).slice(0, 400) : [];
    if (!sentences.length) return fail(400, 'EMPTY', '구조화할 문장이 없어요.');
    const planets = Array.isArray(body.planets) ? body.planets.flatMap(p => p && typeof p.id === 'string' && typeof p.name === 'string' ? [{id: p.id.slice(0, 80), name: p.name.slice(0, 60)}] : []).slice(0, 30) : [];
    const analysis = await analyzePersonal({sentences, planets,
      title: typeof body.title === 'string' ? body.title.slice(0, 200) : undefined,
      mediaType: typeof body.mediaType === 'string' ? body.mediaType.slice(0, 20) : undefined,
      structure: typeof body.structure === 'string' ? body.structure.slice(0, 20) : undefined});
    return Response.json({analysis});
  } catch (error) { return fromError(error); }
}
