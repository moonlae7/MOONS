import {material, putChunk} from '@/lib/server/material';
import {fail, fromError, isAdmin} from '@/lib/server/http';

// One stretch of the recording (16kHz mono WAV made in the browser) to text.
export const maxDuration = 60;

export async function PUT(request: Request, ctx: RouteContext<'/api/materials/[id]/chunks/[seq]'>) {
  if (!isAdmin(request)) return fail(401, 'UNAUTHORIZED', '관리자 토큰이 맞지 않아요.');
  const {id, seq} = await ctx.params;
  const url = new URL(request.url);
  const n = Number(seq), start = Number(url.searchParams.get('start')), end = Number(url.searchParams.get('end'));
  if (!Number.isInteger(n) || n < 0 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return fail(400, 'BAD_REQUEST', '구간 정보가 맞지 않아요.');
  try {
    if (!(await material(id))) return fail(404, 'NOT_FOUND', '없는 원본이에요.');
    const wav = new Uint8Array(await request.arrayBuffer());
    if (wav.length < 1000) return Response.json({chars: 0});
    const chars = await putChunk(id, n, start, end, new Blob([wav], {type: 'audio/wav'}));
    return Response.json({chars});
  } catch (error) { return fromError(error); }
}
