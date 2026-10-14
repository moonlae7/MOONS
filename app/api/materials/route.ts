import {createMaterial} from '@/lib/server/material';
import {eventSpace} from '@/lib/server/event';
import {ensureSpace, spaceById} from '@/lib/server/pipeline';
import {fail, fromError, isAdmin} from '@/lib/server/http';
import {MATERIAL_MAX_BYTES} from '@/lib/thought';

// Start an original upload (a recording). Admin only: the file is stored and made public on result pages.
export async function POST(request: Request) {
  if (!isAdmin(request)) return fail(401, 'UNAUTHORIZED', '관리자 토큰이 맞지 않아요.');
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const space = spaceById(typeof body.spaceId === 'string' ? body.spaceId : eventSpace.id);
    if (!space) return fail(404, 'NOT_FOUND', '없는 공간이에요.');
    const bytes = Number(body.bytes), duration = Number(body.duration);
    if (!Number.isFinite(bytes) || bytes <= 0) return fail(400, 'BAD_REQUEST', '파일 크기를 확인하지 못했어요.');
    if (bytes > MATERIAL_MAX_BYTES) return fail(413, 'TOO_LARGE', '150MB 이하 파일만 올릴 수 있어요. 영상이면 소리만 따로 저장해서 올려 주세요.');
    await ensureSpace(space);
    const id = await createMaterial({spaceId: space.id, title: String(body.title ?? '').trim().slice(0, 120) || '원본 녹음',
      filename: String(body.filename ?? '').slice(0, 200), mime: String(body.mime ?? '').slice(0, 80), bytes, duration: Number.isFinite(duration) ? duration : 0});
    return Response.json({id}, {status: 201});
  } catch (error) { return fromError(error); }
}
