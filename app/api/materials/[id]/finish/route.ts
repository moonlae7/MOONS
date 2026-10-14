import {after} from 'next/server';
import {finishMaterial, material} from '@/lib/server/material';
import {createEntry, ensureSpace, processEntry, spaceById} from '@/lib/server/pipeline';
import {fail, fromError, isAdmin} from '@/lib/server/http';

// All stretches are in: lock the transcript as the original, then structure it and read every answer against it.
export const maxDuration = 300;

export async function POST(request: Request, ctx: RouteContext<'/api/materials/[id]/finish'>) {
  if (!isAdmin(request)) return fail(401, 'UNAUTHORIZED', '관리자 토큰이 맞지 않아요.');
  const {id} = await ctx.params;
  try {
    const m = await material(id);
    if (!m) return fail(404, 'NOT_FOUND', '없는 원본이에요.');
    if (m.entry_id) return Response.json({entryId: m.entry_id});
    const space = spaceById(m.space_id);
    if (!space) return fail(404, 'NOT_FOUND', '없는 공간이에요.');
    await ensureSpace(space);
    const done = await finishMaterial(id, body => createEntry({spaceId: space.id, participantId: `material:${id}`, kind: 'media', body, input: 'voice'}));
    if (!done?.entryId) return fail(400, 'EMPTY', '녹음에서 말소리를 찾지 못했어요. 다른 파일로 다시 해 주세요.');
    const entryId = done.entryId;
    after(() => processEntry(entryId));
    return Response.json({entryId}, {status: 201});
  } catch (error) { return fromError(error); }
}
