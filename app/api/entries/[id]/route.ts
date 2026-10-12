import {thought} from '@/lib/server/pipeline';
import {fail, fromError} from '@/lib/server/http';

export async function GET(_: Request, ctx: RouteContext<'/api/entries/[id]'>) {
  const {id} = await ctx.params;
  try {
    const t = await thought(id);
    return t ? Response.json(t, {headers: {'Cache-Control': 'no-store'}}) : fail(404, 'NOT_FOUND', '이 생각을 찾을 수 없어요.');
  } catch (error) { return fromError(error); }
}
