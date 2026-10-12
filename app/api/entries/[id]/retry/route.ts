import {after} from 'next/server';
import {processEntry} from '@/lib/server/pipeline';
import {fail, isAdmin} from '@/lib/server/http';

export const maxDuration = 120;

export async function POST(request: Request, ctx: RouteContext<'/api/entries/[id]/retry'>) {
  if (!isAdmin(request)) return fail(401, 'UNAUTHORIZED', '관리자만 다시 돌릴 수 있어요.');
  const {id} = await ctx.params;
  after(() => processEntry(id));
  return Response.json({ok: true}, {status: 202});
}
