import type {SpaceInfo} from '@/lib/thought';

// The hackathon space. Planet positions are fractions of the /live canvas.
// Edit names, colors and questions here; the DB copy is refreshed on boot.
export const EVENT_SPACE_ID = process.env.EVENT_SPACE_ID || 'hackathon-1014';

export const eventSpace: SpaceInfo = {
  id: EVENT_SPACE_ID,
  name: '오늘 하루, 한 사람의 머릿속',
  tagline: '오늘 파이어사이드 챗, 어땠어요? QR로 답하면 뇌를 스캔해 드리고, 답은 이 우주의 별이 됩니다.',
  // One question about the opening fireside chat. Every answer lands on the central planet right away;
  // the analysis then pulls it toward the reaction it shows (a quote that stuck, agreement, doubt, ...).
  planets: [
    {id: 'fireside', name: '파이어사이드 챗', color: '#F2B27E', x: 0.50, y: 0.50},
    {id: 'quote', name: '기억에 남는 말', color: '#7BA4F8', x: 0.27, y: 0.38},
    {id: 'agree', name: '공감', color: '#5DB89B', x: 0.73, y: 0.38},
    {id: 'doubt', name: '의문', color: '#E58A7A', x: 0.50, y: 0.24},
    {id: 'learned', name: '새로 안 것', color: '#A58BE8', x: 0.30, y: 0.74},
    {id: 'action', name: '해보고 싶은 것', color: '#E0A84F', x: 0.70, y: 0.72},
  ],
  questions: [
    {id: 'fireside', kind: '파이어사이드 챗', planetId: 'fireside', text: '오늘 해커톤을 열었던 파이어사이드 챗, 어땠어요? 기억에 남는 말과 그에 대한 내 생각을 같이 들려주세요.'},
  ],
};
