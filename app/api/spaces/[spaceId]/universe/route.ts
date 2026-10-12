import {ensureSpace, spaceById, universe} from '@/lib/server/pipeline';
import {fail, fromError} from '@/lib/server/http';

export async function GET(_: Request, ctx: RouteContext<'/api/spaces/[spaceId]/universe'>) {
  const {spaceId} = await ctx.params;
  const space = spaceById(spaceId);
  if (!space) return fail(404, 'NOT_FOUND', '없는 공간이에요.');
  try { await ensureSpace(space); return Response.json(await universe(space), {headers: {'Cache-Control': 'no-store'}}); }
  catch (error) { return fromError(error); }
}
