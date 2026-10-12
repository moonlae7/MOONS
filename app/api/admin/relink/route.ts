import {after} from 'next/server';
import {relinkAll} from '@/lib/server/pipeline';
import {EVENT_SPACE_ID} from '@/lib/server/event';
import {fail, isAdmin} from '@/lib/server/http';

export const maxDuration = 300;

// Re-run linking for every visible thought, e.g. after changing LINK_THRESHOLD.
export async function POST(request: Request) {
  if (!isAdmin(request)) return fail(401, 'UNAUTHORIZED', '관리자 토큰이 맞지 않아요.');
  after(() => relinkAll(EVENT_SPACE_ID));
  return Response.json({ok: true}, {status: 202});
}
