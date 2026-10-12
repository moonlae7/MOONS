import {dismissSignal} from '@/lib/server/pipeline';
import {fail, fromError} from '@/lib/server/http';

// "이건 맞아요": the signal is switched off but kept in the record.
export async function PATCH(_: Request, ctx: RouteContext<'/api/entries/[id]/signals/[signalId]'>) {
  const {id, signalId} = await ctx.params;
  try { return (await dismissSignal(id, signalId)) ? Response.json({ok: true}) : fail(404, 'NOT_FOUND', '신호를 찾을 수 없어요.'); }
  catch (error) { return fromError(error); }
}
