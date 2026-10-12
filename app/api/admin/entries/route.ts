import {adminList} from '@/lib/server/pipeline';
import {EVENT_SPACE_ID} from '@/lib/server/event';
import {fail, fromError, isAdmin} from '@/lib/server/http';

export async function GET(request: Request) {
  if (!isAdmin(request)) return fail(401, 'UNAUTHORIZED', '관리자 토큰이 맞지 않아요.');
  try { return Response.json(await adminList(EVENT_SPACE_ID), {headers: {'Cache-Control': 'no-store'}}); }
  catch (error) { return fromError(error); }
}
