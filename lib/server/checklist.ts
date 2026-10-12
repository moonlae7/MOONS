// Grounding for payment/security comments. The model may only raise a payment or
// security "misunderstanding" that maps to one of these ids. Needs review by a teammate
// who has shipped payments before the event.
export const checklist = [
  {id: 'confirm', title: '결제 완료는 서버에서 확정', note: '성공 페이지로 돌아왔다고 결제가 끝난 것이 아니다. 토스페이먼츠 등은 서버에서 승인 API를 호출해야 결제가 확정된다.'},
  {id: 'amount', title: '금액은 서버가 검증', note: '프론트가 보낸 금액을 믿지 않고, 서버의 주문 금액과 대조해야 한다.'},
  {id: 'secret', title: '시크릿 키 위치', note: 'env에 넣어도 NEXT_PUBLIC_ 같은 공개 접두사가 붙거나 프론트 코드에서 읽으면 브라우저에 노출된다. 시크릿 키는 서버에서만.'},
  {id: 'webhook', title: '웹훅', note: '사용자가 창을 닫거나 가상계좌 입금처럼 페이지 밖에서 결제 상태가 바뀔 때 웹훅으로 받는다. 출처 검증이 필요하다.'},
  {id: 'idempotent', title: '중복 처리', note: '같은 주문이 두 번 처리될 수 있다. 고유 주문번호와 상태 확인으로 막는다.'},
  {id: 'live', title: '테스트 키와 라이브 키', note: '테스트에서 된다고 실결제가 되는 것이 아니다. 라이브 결제는 PG 계약과 심사가 필요하다.'},
  {id: 'card', title: '카드 정보', note: '카드 정보를 직접 받거나 저장하지 않고 PG 결제창을 쓴다.'},
  {id: 'refund', title: '취소와 환불', note: '결제만 만들고 취소 흐름이 없으면 운영에서 막힌다. 주문 상태에 취소를 포함한다.'},
  {id: 'rls', title: 'Supabase anon key와 RLS', note: 'anon key는 공개돼도 되도록 설계됐지만, RLS가 꺼져 있으면 누구나 테이블을 읽고 쓸 수 있다.'},
  {id: 'service-key', title: '서버 전용 키', note: 'service role key 같은 관리자 키는 RLS를 무시하므로 절대 프론트에 두지 않는다.'},
] as const;

export const checklistIds = checklist.map(c => c.id);
export const checklistText = checklist.map(c => `- ${c.id}: ${c.title}. ${c.note}`).join('\n');
