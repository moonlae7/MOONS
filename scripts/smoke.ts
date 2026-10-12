// End-to-end check against real OpenAI with a throwaway PGlite DB.
// node --env-file=.env.local --experimental-strip-types scripts/smoke.ts
process.env.PGLITE_DIR = `./.data/smoke-${Date.now()}`;
const {ensureSpace, createEntry, processEntry, thought, universe, makeCrossroad, choosePath} = await import('../lib/server/pipeline.ts');
const {eventSpace} = await import('../lib/server/event.ts');
await ensureSpace();
const samples = [
  {p: 'a', body: '결제창 닫으면 주문이 pending으로 남아서 웹훅으로 정리했어요. 웹훅 안 붙였으면 돈은 나갔는데 주문은 안 된 사람이 생겼을 듯.'},
  {p: 'b', body: 'NEXT_PUBLIC_ 붙여서 env에 시크릿 키 넣었다가 번들에 그대로 들어간 거 나중에 알았음. 진짜 식은땀.'},
  {p: 'c', body: '결제 성공 페이지 도착하면 완료 아님. 서버에서 승인 API 불러야 확정되는 걸로 알아요.', q: 'q5'},
  {p: 'd', body: '토스 결제창 띄우고, 결제되면 성공 페이지로 넘어오니까 거기서 DB에 결제완료 저장했어요. 키는 env에 넣었고 웹훅은 뭔지 잘 모르겠어요.'},
];
const ids: string[] = [];
for (const s of samples) {
  const id = await createEntry({spaceId: eventSpace.id, participantId: s.p, kind: s.q ? 'quiz' : 'spark', questionId: s.q, body: s.body, input: 'text'});
  const t0 = Date.now(); await processEntry(id); ids.push(id);
  const t = await thought(id);
  console.log(`\n=== ${s.p} ${t?.status} ${Date.now() - t0}ms shape=${t?.analysis?.structure} fallback=${t?.analysis?.fallback} planets=${t?.analysis?.planetIds}`);
  console.log(' reason:', t?.analysis?.structureReason);
  for (const n of t?.analysis?.nodes ?? []) console.log(`  [${n.id}] ${n.role}${n.group ? '/' + n.group : ''}${n.empty ? ' (EMPTY)' : ''}${n.hesitant ? ' (망설임)' : ''}: ${n.text}`);
  for (const sg of t?.analysis?.signals ?? []) console.log(`  ! ${sg.kind} @${sg.node} ${sg.basis}: ${sg.reason}`);
  for (const r of t?.related ?? []) console.log(`  ~ ${r.kind} ${r.selfNode} -> "${r.otherText}" (${r.reason})`);
}
const last = ids[ids.length - 1];
const t1 = Date.now();
const c = await makeCrossroad(last);
console.log(`\n=== crossroad ${Date.now() - t1}ms: ${c.situation}`);
for (const p of c.paths) console.log(`  ${p.id} ${p.title} | ${p.whatChanges} | 알아야: ${p.needToKnow.join(' / ')} | ${p.cost} | ${p.basis.join(',')}`);
const d = await choosePath(c.id, c.paths[0].id, '이미 토스 쓰고 있어서', 'd');
console.log('decision', d);
await new Promise(r => setTimeout(r, 6000));
const u = await universe(eventSpace);
console.log('universe stats', u.stats, u.links);
process.exit(0);
