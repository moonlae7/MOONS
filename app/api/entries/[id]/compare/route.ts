import {compareEntry} from '@/lib/server/material';
import {clientIp, fail, fromError, limited} from '@/lib/server/http';

// Reads this answer against the original if that has not happened yet (an answer sent before the original was uploaded).
export const maxDuration = 60;

export async function POST(request: Request, ctx: RouteContext<'/api/entries/[id]/compare'>) {
  const {id} = await ctx.params;
  if (limited(`cmp:${clientIp(request)}`, 10)) return fail(429, 'RATE_LIMITED', '잠시 후 다시 시도해 주세요.');
  try {
    const comparison = await compareEntry(id);
    return comparison ? Response.json({comparison}) : fail(404, 'NOT_FOUND', '비교할 원본이 아직 없어요.');
  } catch (error) { return fromError(error); }
}
