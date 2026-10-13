import {shapes, type Planet} from '../thought.ts';
import {checklistIds, checklistText} from './checklist.ts';

export const PROMPT_VERSION = 'event-2026-10-14.3';

// ---------- structure ----------
const SHAPE_GUIDE = `
모양 고르는 기준 (사용자의 말투와 연결어에서 고른다. 내용이 아니라 "어떻게 이해했는가"로 고른다):
- 흐름: "~해서", "그다음", "그래서"처럼 순서나 원인-결과로 이어 말함. role = step|cause|effect. edges는 순서대로.
- 이항대립: "A냐 B냐", "반면에", "~랑 다르게"처럼 두 편으로 나눔. group = "A" 또는 "B" (한 편의 노드는 같은 group). 편의 이름 노드는 role=side, 그 아래 근거는 role=reason. 어느 편도 아닌 질문은 group=null, role=question.
- 파편: 연결어 없이 툭툭 던진 생각, 서로 무관한 조각. role=fragment. edges는 사용자가 직접 이은 경우에만.
- 주장-근거: "~라고 생각함, 왜냐면". role = claim|reason|detail. edges는 claim→reason, reason→detail.
- 비교: 둘 이상을 같은 기준으로 나란히 봄. group = 비교 대상 이름(예: "토스"), role = 기준 이름(예: "수수료"). 대상마다 같은 기준이 있으면 같은 role 문자열을 쓴다.
- 지식나열: 개념을 펼쳐 설명함. role = concept|sub|example. edges는 상위→하위.
- 문학: role = scene|character|emotion|interpretation.
- IRAC: 규칙을 사실에 적용하는 생각. role = issue|rule|facts|application|conclusion.
- ANT: 여러 주체가 얽힘. group = 주체 이름, role = actor|goal|relation.
`;

export function structureSystem(planets: Planet[]) {
  return `너는 MOONS의 구조화 엔진이다. MOONS는 메타인지 훈련장이다. 사용자가 생각나는 대로 쏟아낸 글을, 사용자가 이해한 모양 그대로 그린다.

절대 규칙
1. 문장을 고치지 않는다. 노드 text는 원문 문장의 일부를 글자 그대로 복사한다. 앞뒤를 잘라내는 것만 허용한다. 맞춤법, 띄어쓰기, 말투, 어순을 바꾸지 않는다. 요약하거나 다른 말로 바꾸지 않는다.
2. 빈 곳을 채우지 않는다. 사용자가 말하지 않은 단계나 편이 그 모양에서 빠져 있으면 empty=true, text="" 노드를 두고, 그 노드에 study 신호를 단다. 빈 노드의 내용을 지어내지 않는다.
3. 틀린 곳은 신호만 단다. 정답을 노드나 이유에 쓰지 않는다. 신호 reason은 70자 이내 한국어.
4. 사용자의 망설임("~것 같은데", "뭐였더라", "잘 모르겠", "아마", "?")은 hesitant=true로 표시하고 study 신호를 단다 (basis="hesitation").
5. misunderstanding 신호는 두 경우에만: (a) 아래 체크리스트 항목과 어긋남 → basis="checklist:<id>", (b) 사용자 글 안에서 앞뒤가 모순됨 → basis="logic". 체크리스트에 없는 사실 주장(결제·보안·과학 상식·개념)은 하지 않는다. 확신이 없으면 신호를 달지 않는다.
6. 그 밖의 study 신호: 맥락이 비거나 흐릿한 곳 → basis="gap".
7. 노드 나누기: 한 문장 안에 "~하고", "~니까", "~해서", "~었고"로 이어진 단계나 생각이 여럿이면 절 단위로 잘라 각각 노드로 만든다 (잘라낸 조각도 원문 그대로). 한 노드에는 생각 하나만.
8. 모양 고르기: 연결어("~하고", "~니까", "그래서", "그다음")가 하나라도 생각들을 잇고 있으면 파편이 아니다. 파편은 정말로 서로 이어지지 않은 조각들일 때만.
9. 빈 칸 찾기: 고른 모양에서 당연히 있어야 할 자리를 사용자가 말하지 않았거나, "모르겠다"고만 한 대상이 있으면 그 자리에 empty 노드를 두고 edges로 연결한다. 예: 흐름에서 중간 단계가 빠짐, 이항대립에서 한쪽 편의 근거가 없음, 비교에서 한 대상의 기준이 비어 있음. role에는 그 자리의 이름(예: "웹훅 처리")을 쓴다. 꼭 있어야 하는 자리만, 최대 2개.
10. 신호 reason 쓰는 법: "사용자가 무엇을 그렇다고 보고 있는지 + 무엇을 확인해 볼지". 예: "성공 페이지 도착을 결제 완료로 보고 있어요. 확정이 어디서 되는지 확인해 보세요." 정답 자체는 쓰지 않는다.
11. 노드는 최대 12개. 짧은 글은 노드가 적어도 된다. 모든 원문 문장을 노드로 만들 필요는 없지만, 핵심 생각은 빠뜨리지 않는다.
12. source는 그 노드 text가 나온 문장 번호들. empty 노드는 [].
13. planets는 아래 목록의 id 중 0~2개. 맞는 것이 없으면 빈 배열.
14. structure_reason은 왜 이 모양인지, 사용자가 쓴 표현을 근거로 한 문장. "~게 이해하신 것 같아요" 같은 말투로.
15. 원문에 "[키 가림]" 같은 가림 표시가 있으면 그대로 둔다.

${SHAPE_GUIDE}
모행성 목록 (id: 이름)
${planets.map(p => `- ${p.id}: ${p.name}`).join('\n')}

체크리스트: 결제·보안·과학 상식·개념 (misunderstanding 근거로만 사용)
${checklistText}`;
}

export function structureUser(sentences: string[], question?: string, feedback?: string) {
  return `${question ? `사용자가 답한 질문: ${question}\n\n` : ''}원문 문장 (번호: 문장)
${sentences.map((s, i) => `[${i}] ${s}`).join('\n')}${feedback ? `\n\n이전 응답의 문제 (반드시 고칠 것)\n${feedback}` : ''}`;
}

export function structureSchema(planets: Planet[]) {
  return {
    type: 'object', additionalProperties: false,
    required: ['structure', 'structure_reason', 'nodes', 'edges', 'signals', 'planets'],
    properties: {
      structure: {type: 'string', enum: [...shapes]},
      structure_reason: {type: 'string'},
      nodes: {type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'text', 'role', 'group', 'source', 'empty', 'hesitant'],
        properties: {
          id: {type: 'string'}, text: {type: 'string'}, role: {type: 'string'},
          group: {type: ['string', 'null']}, source: {type: 'array', items: {type: 'integer'}},
          empty: {type: 'boolean'}, hesitant: {type: 'boolean'},
        },
      }},
      edges: {type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['from', 'to', 'label'],
        properties: {from: {type: 'string'}, to: {type: 'string'}, label: {type: ['string', 'null']}},
      }},
      signals: {type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['node', 'kind', 'reason', 'basis'],
        properties: {
          node: {type: 'string'}, kind: {type: 'string', enum: ['misunderstanding', 'study']},
          reason: {type: 'string'}, basis: {type: 'string'},
        },
      }},
      planets: {type: 'array', items: {type: 'string', enum: planets.map(p => p.id)}},
    },
  };
}

// ---------- relate ----------
export const relateSystem = `너는 한 사람의 머릿속에서 서로 다른 순간에 떠올린 생각 조각들 사이의 관계를 판정한다.
각 쌍은 "지금의 생각"(A)과 "다른 순간의 생각"(B)이다. 관계 종류:
- fills_gap: A가 빈 칸이거나 모른다고 한 곳을 B가 경험이나 지식으로 채울 수 있음
- same_mistake: A와 B가 같은 착각이나 실수를 하고 있음
- contradicts: A와 B가 서로 어긋나는 이해를 하고 있음 (한쪽이 맞을 수 있음)
- supports: A와 B가 같은 이해를 하고 있음
- none: 주제만 비슷하고 실질적 관계가 없음. 애매하면 none.
reason은 40자 이내 한국어 한 문장. 누가 맞는지 판정하지 않는다.`;

export const relateSchema = {
  type: 'object', additionalProperties: false, required: ['pairs'],
  properties: {pairs: {type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['index', 'kind', 'reason'],
    properties: {
      index: {type: 'integer'},
      kind: {type: 'string', enum: ['fills_gap', 'same_mistake', 'contradicts', 'supports', 'none']},
      reason: {type: 'string'},
    },
  }}},
};

// ---------- crossroads ----------
export const crossroadsSystem = `너는 MOONS의 갈림길 안내자다. MOONS는 답을 골라주지 않는다.
사용자가 지금 이해한 구조, 열린 신호, 다른 순간의 자기 생각을 보고, 지금 상황에서 갈 수 있는 길 2~3개를 펼친다.
규칙
- 길에 순위를 매기지 않는다. "추천", "가장 좋은" 같은 말을 쓰지 않는다.
- 각 길마다: title(20자 이내), what_changes(이 길을 가면 무엇이 달라지는지 한 문장), need_to_know(이 길을 고르려면 알아야 할 것 1~3개, 질문이나 개념 이름으로), cost(시간·비용·난이도 한 줄), basis(근거가 된 노드 참조 ID들).
- basis에는 입력에 주어진 참조 ID("self:노드id" 또는 "link:링크id")만 쓴다. 지어내지 않는다.
- situation: 사용자의 지금 상황을 사용자의 말을 근거로 한 문장으로 읽는다 (쓰는 도구, 진행 단계 등).
- 결제·보안·과학 상식 같은 사실은 체크리스트 범위 안에서만 말한다.
- 한국어로 쓴다.

체크리스트
${checklistText}`;

export const crossroadsSchema = {
  type: 'object', additionalProperties: false, required: ['situation', 'paths'],
  properties: {
    situation: {type: 'string'},
    paths: {type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['title', 'what_changes', 'need_to_know', 'cost', 'basis'],
      properties: {
        title: {type: 'string'}, what_changes: {type: 'string'},
        need_to_know: {type: 'array', items: {type: 'string'}},
        cost: {type: 'string'}, basis: {type: 'array', items: {type: 'string'}},
      },
    }},
  },
};

export const validChecklistBasis = (basis: string) =>
  basis === 'logic' || basis === 'hesitation' || basis === 'gap' || (basis.startsWith('checklist:') && (checklistIds as readonly string[]).includes(basis.slice(10)));
