import type {SpaceInfo} from '@/lib/thought';

// The hackathon space. Planet positions are fractions of the /live canvas.
// Edit names, colors and questions here; the DB copy is refreshed on boot.
export const EVENT_SPACE_ID = process.env.EVENT_SPACE_ID || 'hackathon-1014';

export const eventSpace: SpaceInfo = {
  id: EVENT_SPACE_ID,
  name: '오늘 하루, 한 사람의 머릿속',
  tagline: 'QR로 질문에 답하면, 그 답이 바로 이 우주의 별이 돼요.',
  // Icebreaking: every question belongs to one planet, so an answer lands next to it the moment it is sent.
  planets: [
    {id: 'why', name: '온 이유', color: '#7BA4F8', x: 0.30, y: 0.42},
    {id: 'learn', name: '요즘 배운 것', color: '#A58BE8', x: 0.55, y: 0.30},
    {id: 'build', name: '만들 것', color: '#5DB89B', x: 0.50, y: 0.70},
    {id: 'ai', name: 'AI와 나', color: '#E0A84F', x: 0.76, y: 0.55},
    {id: 'choice', name: '고민 중', color: '#E58A7A', x: 0.80, y: 0.22},
    {id: 'me', name: '나', color: '#E6A0C4', x: 0.20, y: 0.78},
  ],
  questions: [
    {id: 'q1', kind: '아이스브레이킹', planetId: 'me', text: '처음 만난 사람에게 나를 한 문장으로 소개한다면?'},
    {id: 'q2', kind: '아이스브레이킹', planetId: 'why', text: '오늘 이 해커톤에 온 진짜 이유는?'},
    {id: 'q3', kind: '아이스브레이킹', planetId: 'build', text: '오늘 만들고 싶은 것과, 그걸 고른 이유는?'},
    {id: 'q4', kind: '아이스브레이킹', planetId: 'ai', text: 'AI 덕분에 쉬워진 일 하나, 아직도 어려운 일 하나.'},
    {id: 'q5', kind: '아이스브레이킹', planetId: 'learn', text: '요즘 새로 알게 된 걸 친구한테 설명하듯 말해주세요.'},
    {id: 'q6', kind: '아이스브레이킹', planetId: 'choice', text: '요즘 A냐 B냐 고민하는 게 있어요? 양쪽 이유도 같이.'},
    {id: 'q7', kind: '아이스브레이킹', planetId: 'ai', text: 'AI가 짜준 코드 중 이해 안 하고 넘어간 게 있어요?'},
    {id: 'q8', kind: '아이스브레이킹', planetId: 'build', text: '만들면서 제일 막힐 것 같은 곳은 어디예요?'},
    {id: 'q9', kind: '아이스브레이킹', planetId: 'learn', text: '최근에 "아, 이거 잘못 알고 있었네" 했던 순간은?'},
    {id: 'q10', kind: '아이스브레이킹', planetId: 'me', text: '오늘 여기서 꼭 만나고 싶은 사람은?'},
  ],
};
