// Local test data only. Do not run against the event database.
const base = process.argv[2] || 'http://127.0.0.1:3100';
const items = [
  ['q5', '결제 성공 페이지 도착하면 완료 아님. 서버에서 승인 API 불러야 확정되는 걸로 알아요.'],
  ['q1', '결제창 닫으면 주문이 pending으로 남아서 웹훅으로 정리했어요. 웹훅 안 붙였으면 돈은 나갔는데 주문은 안 된 사람이 생겼을 듯.'],
  ['q6', 'NEXT_PUBLIC_ 붙여서 env에 시크릿 키 넣었다가 번들에 그대로 들어간 거 나중에 알았음. 진짜 식은땀.'],
  ['q8', 'anon key는 공개돼도 된다고 들었는데 그럼 아무나 내 DB 읽을 수 있는 거 아닌가? RLS가 뭔지 정확히는 모르겠어요.'],
  ['q2', '배포하고 나서 로그 보니까 이상한 IP가 계속 로그인 시도하더라. 그때 처음으로 rate limit 걸었어요.'],
  ['q4', 'AI가 짜준 미들웨어 코드 그냥 붙였는데 사실 뭐 하는 건지 모름. 돌아가니까 넘어감.'],
  ['q3', '외주 맡기면 결제 하나에 몇백 든다길래 혼자 해보는 중인데, 테스트 키로는 되는데 라이브는 사업자 등록 필요하다고 해서 막힘.'],
  ['q9', '오늘 AI한테 제일 많이 물어본 건 CORS 에러. 결국 서버에서 헤더 열어서 해결.'],
  ['', '토스냐 포트원이냐 고민. 토스는 문서가 친절한데 포트원은 여러 PG 묶어줘서 나중에 바꾸기 쉽다던데.'],
  ['q10', '오늘 새로 안 것: 같은 결제 요청 두 번 오면 주문번호로 막아야 한다는 거. 멱등성이라고 하던데.'],
  ['', '아이디어: 바이브코딩한 서비스 보안 점검해주는 체크리스트 봇. 근데 이미 있을 것 같기도.'],
  ['q9', '3시간 내내 AI랑 싸움. 그래도 혼자였으면 하루 걸렸을 듯.'],
];
let i = 0;
for (const [q, text] of items) {
  const res = await fetch(base + '/api/spaces/hackathon-1014/entries', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({participantId: `seed-person-${String(i++).padStart(3, '0')}`, questionId: q || null, text})});
  console.log(res.status, (await res.json()).id ?? '');
  await new Promise(r => setTimeout(r, 1500));
}
