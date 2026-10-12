import {choosePath} from '@/lib/server/pipeline';
import {fail, fromError, participantOk} from '@/lib/server/http';

export async function POST(request: Request, ctx: RouteContext<'/api/crossroads/[id]/choose'>) {
  const {id} = await ctx.params;
  const body = await request.json().catch(() => ({})) as {pathId?: unknown; reason?: unknown; participantId?: unknown};
  if (typeof body.pathId !== 'string' || !participantOk(body.participantId)) return fail(400, 'BAD_REQUEST', '고른 길을 확인하지 못했어요.');
  try {
    const decision = await choosePath(id, body.pathId, typeof body.reason === 'string' ? body.reason.slice(0, 200) : '', body.participantId);
    return decision ? Response.json({decisionEntry: decision}, {status: 201}) : fail(404, 'NOT_FOUND', '갈림길을 찾을 수 없어요.');
  } catch (error) { return fromError(error); }
}
