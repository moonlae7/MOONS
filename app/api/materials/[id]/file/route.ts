import {readRange} from '@/lib/server/material';
import {fail, fromError} from '@/lib/server/http';

// Streams the original recording in ranges, so audio players can seek to any sentence.
export async function GET(request: Request, ctx: RouteContext<'/api/materials/[id]/file'>) {
  const {id} = await ctx.params;
  try {
    const match = /bytes=(\d+)-(\d*)/.exec(request.headers.get('range') ?? '');
    const start = match ? Number(match[1]) : 0, end = match && match[2] ? Number(match[2]) : null;
    const r = await readRange(id, start, end);
    if (!r) return fail(404, 'NOT_FOUND', '없는 원본이에요.');
    if (start >= r.total) return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${r.total}`}});
    return new Response(r.data, {status: 206, headers: {
      'Content-Type': r.mime || 'application/octet-stream', 'Content-Length': String(r.data.length),
      'Content-Range': `bytes ${r.start}-${r.end}/${r.total}`, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600',
    }});
  } catch (error) { return fromError(error); }
}
