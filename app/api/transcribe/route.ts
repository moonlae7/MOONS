import {ai} from '@/lib/server/ai';
import {clientIp, fail, fromError, limited, participantOk} from '@/lib/server/http';
import {MAX_AUDIO, trimSpoken} from '@/lib/server/text';

// Speech to text only. The phone shows the result in the answer box so people can check and fix it
// before anything reaches the big screen.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const form = await request.formData().catch(() => null);
    if (!form) return fail(400, 'BAD_REQUEST', '녹음을 받지 못했어요. 다시 말해주세요.');
    const participantId = form.get('participantId');
    if (!participantOk(participantId)) return fail(400, 'BAD_REQUEST', '기기 정보를 확인하지 못했어요. 새로고침해 주세요.');
    if (limited(`tr:${participantId}`, 8) || limited(`trip:${clientIp(request)}`, 60)) return fail(429, 'RATE_LIMITED', '조금만 천천히 해주세요. 1분 뒤에 다시 시도해 주세요.');
    const audio = form.get('audio');
    if (!(audio instanceof File) || !audio.size) return fail(400, 'EMPTY', '녹음이 비어 있어요. 다시 말해주세요.');
    if (audio.size > MAX_AUDIO) return fail(413, 'TOO_LARGE', '녹음이 너무 길어요. 45초 안으로 말해주세요.');
    const text = trimSpoken((await ai().transcribe(audio, audio.name || 'voice.webm')).trim());
    // Diagnostics only (no transcript text): format and size explain most bad transcriptions.
    console.log('[moons] transcribe', JSON.stringify({bytes: audio.size, type: audio.type, name: audio.name, chars: text.length, hangul: /[\uAC00-\uD7A3]/.test(text)}));
    if (!text) return fail(400, 'EMPTY', '목소리를 알아듣지 못했어요. 조금 더 크게, 천천히 말해주세요.');
    return Response.json({text});
  } catch (error) { return fromError(error); }
}
