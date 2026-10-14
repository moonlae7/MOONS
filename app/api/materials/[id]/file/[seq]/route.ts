import {material, putPart} from '@/lib/server/material';
import {fail, fromError, isAdmin} from '@/lib/server/http';
import {MATERIAL_PART_BYTES} from '@/lib/thought';

// One 4MB piece of the original file, stored as uploaded.
export async function PUT(request: Request, ctx: RouteContext<'/api/materials/[id]/file/[seq]'>) {
  if (!isAdmin(request)) return fail(401, 'UNAUTHORIZED', '관리자 토큰이 맞지 않아요.');
  const {id, seq} = await ctx.params;
  const n = Number(seq);
  if (!Number.isInteger(n) || n < 0) return fail(400, 'BAD_REQUEST', '조각 번호가 맞지 않아요.');
  try {
    if (!(await material(id))) return fail(404, 'NOT_FOUND', '없는 원본이에요.');
    const data = new Uint8Array(await request.arrayBuffer());
    if (!data.length || data.length > MATERIAL_PART_BYTES) return fail(413, 'TOO_LARGE', '조각 크기가 맞지 않아요.');
    await putPart(id, n, data);
    return Response.json({ok: true});
  } catch (error) { return fromError(error); }
}
