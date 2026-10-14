import {ai} from '@/lib/server/ai';
import {clientIp, fail, fromError, limited, participantOk} from '@/lib/server/http';
import {cleanTranscript, MAX_AUDIO, trimSpoken} from '@/lib/server/text';

// Speech to text only. The phone sends each spoken phrase as it ends and shows the text in the answer box,
// so people can check and fix it before anything reaches the big screen.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const form = await request.formData().catch(() => null);
    if (!form) return fail(400, 'BAD_REQUEST', '녹음을 받지 못했어요. 다시 말해주세요.');
    const participantId = form.get('participantId');
    if (!participantOk(participantId)) return fail(400, 'BAD_REQUEST', '기기 정보를 확인하지 못했어요. 새로고침해 주세요.');
    // One phone sends a phrase every few seconds; the whole venue shares one Wi-Fi address.
    if (limited(`tr:${participantId}`, 60) || limited(`trip:${clientIp(request)}`, 1200)) return fail(429, 'RATE_LIMITED', '조금만 천천히 해주세요. 1분 뒤에 다시 시도해 주세요.');
    const audio = form.get('audio');
    if (!(audio instanceof File) || !audio.size) return fail(400, 'EMPTY', '녹음이 비어 있어요. 다시 말해주세요.');
    if (audio.size > MAX_AUDIO) return fail(413, 'TOO_LARGE', '녹음 조각이 너무 커요. 다시 녹음해 주세요.');
    const text = trimSpoken(cleanTranscript((await ai().transcribe(audio, audio.name || 'voice.webm')).trim()));
    // Diagnostics only (no transcript text): format and size explain most bad transcriptions.
    console.log('[moons] transcribe', JSON.stringify({bytes: audio.size, type: audio.type, name: audio.name, chars: text.length, hangul: /[\uAC00-\uD7A3]/.test(text)}));
    if (!text) return fail(400, 'EMPTY', '목소리를 알아듣지 못했어요. 조금 더 크게, 천천히 말해주세요.');
    return Response.json({text});
  } catch (error) { return fromError(error); }
}
