import {after} from 'next/server';
import {ai} from '@/lib/server/ai';
import {createEntry, ensureSpace, processEntry, spaceById} from '@/lib/server/pipeline';
import {redact} from '@/lib/server/redact';
import {clientIp, fail, fromError, limited, participantOk} from '@/lib/server/http';
import {MAX_AUDIO, MAX_TEXT, trimSpoken} from '@/lib/server/text';

export const maxDuration = 120;

export async function POST(request: Request, ctx: RouteContext<'/api/spaces/[spaceId]/entries'>) {
  const {spaceId} = await ctx.params;
  const space = spaceById(spaceId);
  if (!space) return fail(404, 'NOT_FOUND', '없는 공간이에요.');
  try {
    let participantId: unknown, nickname: unknown, questionId: unknown, text = '', audio: File | null = null, spoken = false;
    if ((request.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      const form = await request.formData();
      participantId = form.get('participantId'); nickname = form.get('nickname'); questionId = form.get('questionId');
      text = String(form.get('text') ?? '');
      const file = form.get('audio');
      if (file instanceof File && file.size > 0) audio = file;
    } else {
      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
      participantId = body.participantId; nickname = body.nickname; questionId = body.questionId; text = String(body.text ?? '');
      spoken = body.input === 'voice'; // text the person checked after the transcribe step
    }
    if (!participantOk(participantId)) return fail(400, 'BAD_REQUEST', '기기 정보를 확인하지 못했어요. 새로고침해 주세요.');
    if (limited(`p:${participantId}`, 6) || limited(`ip:${clientIp(request)}`, 40)) return fail(429, 'RATE_LIMITED', '조금만 천천히 넣어주세요. 1분 뒤에 다시 시도해 주세요.');
    let input: 'text' | 'voice' = spoken ? 'voice' : 'text';
    if (audio) {
      if (audio.size > MAX_AUDIO) return fail(413, 'TOO_LARGE', '녹음이 너무 길어요. 45초 안으로 말해주세요.');
      text = await ai().transcribe(audio, audio.name || 'voice.webm');
      input = 'voice';
    }
    text = audio ? trimSpoken(text.trim()) : text.trim();
    if (!text) return fail(400, 'EMPTY', input === 'voice' ? '목소리를 알아듣지 못했어요. 다시 말해주세요.' : '생각을 한 줄이라도 적어주세요.');
    if (text.length > MAX_TEXT) return fail(413, 'TOO_LONG', `${MAX_TEXT}자 안으로 줄여주세요.`);
    const masked = redact(text);
    await ensureSpace(space);
    const q = typeof questionId === 'string' && space.questions.some(x => x.id === questionId) ? questionId : null;
    const kind = q && space.questions.find(x => x.id === q)?.kind === '개발 퀴즈' ? 'quiz' : 'spark';
    const id = await createEntry({spaceId, participantId, nickname: typeof nickname === 'string' ? nickname.trim().slice(0, 30) : null, kind, questionId: q, body: masked.text, input});
    after(() => processEntry(id));
    return Response.json({id, input, text: masked.text, redacted: masked.count}, {status: 201});
  } catch (error) { return fromError(error); }
}
