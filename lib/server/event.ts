import type {SpaceInfo} from '@/lib/thought';

// The hackathon space. Planet positions are fractions of the /live canvas.
// Edit names, colors and questions here; the DB copy is refreshed on boot.
export const EVENT_SPACE_ID = process.env.EVENT_SPACE_ID || 'hackathon-1014';

export const eventSpace: SpaceInfo = {
  id: EVENT_SPACE_ID,
  name: '오늘 하루, 한 사람의 머릿속',
  tagline: '결제를 처음 붙이는 바이브코더 한 사람. 오늘 여기 있는 모두가 그 사람의 생각이 됩니다.',
  planets: [
    {id: 'payment', name: '결제', color: '#7BA4F8', x: 0.30, y: 0.42},
    {id: 'security', name: '보안', color: '#A58BE8', x: 0.55, y: 0.30},
    {id: 'deploy', name: '배포', color: '#5DB89B', x: 0.50, y: 0.70},
    {id: 'ai', name: 'AI 활용', color: '#E0A84F', x: 0.76, y: 0.55},
    {id: 'idea', name: '아이디어', color: '#E58A7A', x: 0.80, y: 0.22},
    {id: 'feeling', name: '소감', color: '#9AA3B5', x: 0.20, y: 0.78},
  ],
  questions: [
    {id: 'q1', kind: '고민', text: '결제나 로그인 붙여본 적 있어요? 어디서 막혔어요?'},
    {id: 'q2', kind: '고민', text: '배포하고 나서 제일 불안했던 순간은?'},
    {id: 'q3', kind: '떠오른 생각', text: '오늘 만든 것 중 제일 자신 없는 부분은?'},
    {id: 'q4', kind: '떠오른 생각', text: 'AI가 짜준 코드 중 이해 안 하고 넘어간 게 있어요?'},
    {id: 'q5', kind: '개발 퀴즈', text: '결제 성공 페이지에 도착하면 결제 완료일까요? 이유도 같이.'},
    {id: 'q6', kind: '개발 퀴즈', text: 'API 키를 .env에 넣으면 안전할까요? 이유도 같이.'},
    {id: 'q7', kind: '개발 퀴즈', text: '같은 결제 요청이 두 번 들어오면 어떻게 될까요?'},
    {id: 'q8', kind: '개발 퀴즈', text: 'Supabase anon key는 공개돼도 될까요? 이유도 같이.'},
    {id: 'q9', kind: '소감', text: '3시간 동안 AI한테 제일 많이 물어본 것은?'},
    {id: 'q10', kind: '소감', text: '오늘 새로 알게 된 것 하나.'},
  ],
};
