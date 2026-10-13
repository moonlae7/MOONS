import type {SpaceInfo} from '@/lib/thought';

// The hackathon space. Planet positions are fractions of the /live canvas.
// Edit names, colors and questions here; the DB copy is refreshed on boot.
export const EVENT_SPACE_ID = process.env.EVENT_SPACE_ID || 'hackathon-1014';

export const eventSpace: SpaceInfo = {
  id: EVENT_SPACE_ID,
  name: '오늘 하루, 한 사람의 머릿속',
  tagline: 'QR을 찍고 질문에 말로 답하면, 당신의 뇌를 스캔해 드려요. 답은 이 우주의 별이 됩니다.',
  // Brain scan: light, concept and trivia questions. Every question belongs to one planet,
  // so an answer lands next to it the moment it is sent.
  planets: [
    {id: 'today', name: '오늘', color: '#7BA4F8', x: 0.30, y: 0.42},
    {id: 'concept', name: '개념', color: '#A58BE8', x: 0.55, y: 0.30},
    {id: 'trivia', name: '상식', color: '#5DB89B', x: 0.50, y: 0.70},
    {id: 'ai', name: 'AI와 나', color: '#E0A84F', x: 0.76, y: 0.55},
    {id: 'choice', name: '고민 중', color: '#E58A7A', x: 0.80, y: 0.22},
    {id: 'me', name: '나', color: '#E6A0C4', x: 0.20, y: 0.78},
  ],
  questions: [
    {id: 'q1', kind: '가벼운 질문', planetId: 'me', text: '처음 만난 사람에게 나를 한 문장으로 소개한다면?'},
    {id: 'q2', kind: '가벼운 질문', planetId: 'today', text: '오늘 이 해커톤에 온 진짜 이유는?'},
    {id: 'q3', kind: '가벼운 질문', planetId: 'today', text: '오늘 만들고 싶은 것과, 그걸 고른 이유는?'},
    {id: 'q4', kind: '가벼운 질문', planetId: 'ai', text: 'AI 덕분에 쉬워진 일 하나, 아직도 어려운 일 하나.'},
    {id: 'q5', kind: '가벼운 질문', planetId: 'choice', text: '요즘 A냐 B냐 고민하는 게 있어요? 양쪽 이유도 같이.'},
    {id: 'q6', kind: '개념 질문', planetId: 'concept', text: 'API가 뭔지 친구한테 설명하듯 말해주세요.'},
    {id: 'q7', kind: '개념 질문', planetId: 'ai', text: 'ChatGPT는 다음에 할 말을 어떻게 고를까요? 아는 만큼 설명해 주세요.'},
    {id: 'q8', kind: '개념 질문', planetId: 'concept', text: '요즘 새로 알게 된 개념 하나를 설명해 주세요.'},
    {id: 'q9', kind: '상식 퀴즈', planetId: 'trivia', text: '하늘은 왜 파랄까요? 아는 대로 이유를 말해주세요.'},
    {id: 'q10', kind: '상식 퀴즈', planetId: 'trivia', text: '여름이 더운 건 지구가 태양에 가까워져서일까요? 이유도 같이.'},
    {id: 'q11', kind: '상식 퀴즈', planetId: 'trivia', text: '그 무거운 비행기는 어떻게 하늘에 뜰까요?'},
    {id: 'q12', kind: '상식 퀴즈', planetId: 'trivia', text: '달은 왜 늘 같은 면만 보일까요?'},
  ],
};
