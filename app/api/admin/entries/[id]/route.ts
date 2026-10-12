import {setHidden} from '@/lib/server/pipeline';
import {fail, fromError, isAdmin} from '@/lib/server/http';

export async function PATCH(request: Request, ctx: RouteContext<'/api/admin/entries/[id]'>) {
  if (!isAdmin(request)) return fail(401, 'UNAUTHORIZED', '관리자 토큰이 맞지 않아요.');
  const {id} = await ctx.params;
  const body = await request.json().catch(() => ({})) as {hidden?: unknown};
  if (typeof body.hidden !== 'boolean') return fail(400, 'BAD_REQUEST', 'hidden 값이 필요해요.');
  try { await setHidden(id, body.hidden); return Response.json({ok: true}); }
  catch (error) { return fromError(error); }
}
