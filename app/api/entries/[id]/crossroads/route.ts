import {makeCrossroad, thought} from '@/lib/server/pipeline';
import {clientIp, fail, fromError, limited} from '@/lib/server/http';

export const maxDuration = 120;

export async function POST(request: Request, ctx: RouteContext<'/api/entries/[id]/crossroads'>) {
  const {id} = await ctx.params;
  if (limited(`cross:${clientIp(request)}`, 6)) return fail(429, 'RATE_LIMITED', '잠시 후 다시 시도해 주세요.');
  try {
    const t = await thought(id);
    if (!t) return fail(404, 'NOT_FOUND', '이 생각을 찾을 수 없어요.');
    if (t.status !== 'done' || !t.analysis) return fail(409, 'NOT_READY', '구조가 아직 그려지는 중이에요.');
    return Response.json(await makeCrossroad(id), {status: 201});
  } catch (error) { return fromError(error); }
}
