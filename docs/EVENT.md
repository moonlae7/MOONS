# 행사 모드 (10.14 해커톤)

개인 MOONS(`/`, `/notes`, `/universe`, `/chat`)는 그대로 두고, 행사용 화면 4개와 백엔드를 추가했다.

| 주소 | 누가 | 하는 일 |
| --- | --- | --- |
| `/now` | 참가자 휴대폰 (QR) | "당신의 뇌를 스캔해 드립니다". 오프닝 파이어사이드 챗 소감을 묻는 질문 하나에 말이나 글로 답하기. 300자, 녹음 45초까지. 화살표 없음. 보내면 바로 `/t/:id?scan=1`로 넘어감. 로그인 없음 |
| `/universe` = `/live` | 프로젝터 | 같은 화면. 오늘 하루, 한 사람의 머릿속. 답 하나가 별 하나로, 질문의 모행성 옆에 바로 뜸. 기본은 우주 테마, `d` 우주·라이트·다크 전환, `f` 전체화면 |
| `/t/:id` | 발표자, 참가자 | 이해한 모양 그대로의 구조, 신호 2종, 다른 순간의 나, 갈림길 → 결정 노드 |
| `/admin` | 운영 팀원 | 숨기기, 실패한 것 다시 돌리기. `ADMIN_TOKEN` 필요 |

## 흐름

0. 질문마다 모행성이 하나 정해져 있다(`lib/server/event.ts`의 `planetId`). 답은 저장되는 순간 그 모행성 옆에 별로 뜨고, 분석이 끝나면 AI가 고른 모행성이 하나 더 붙을 수 있다. AI가 실패해도 별은 제자리에 남는다.

1. `/now`에서 넣으면 저장 전에 키·연락처를 가리고(`lib/server/redact.ts`), 바로 응답한다.
2. 응답 뒤 서버가 이어서 처리한다(`after()` → `processEntry`): 유해 표현 확인 → 구조화 → 검사 → 저장 → 임베딩 → 연결 판정.
3. 구조화 결과는 서버가 검사한다(`lib/server/verify.ts`). 노드 문장이 원문에 글자 그대로 없으면 한 번 더 시키고, 두 번 실패하면 문장을 그대로 놓는다(파편).
4. `/t/:id`의 갈림길은 버튼을 눌렀을 때만 만든다. 고르면 결정 노드가 새 생각으로 쌓이고 원래 생각과 연결된다.

## 로컬 실행

```sh
npm install
npm run build
npm start          # http://127.0.0.1:3000
```

`DATABASE_URL`이 비어 있으면 `.data/pglite`에 내장 Postgres 파일을 만든다. 설치할 것 없음.
`npm run dev`는 라우트마다 처음 컴파일이 수십 초 걸리고, 이 폴더에서는 Windows 파일 잠금 오류가 가끔 난다. 데모·리허설은 반드시 `build` + `start`로.

테스트 데이터: `node scripts/seed-local.mjs http://127.0.0.1:3000` (로컬 전용, 행사 DB에 넣지 말 것).
파이프라인 점검: `node --env-file=.env.local --experimental-strip-types scripts/smoke.ts` (임시 DB, 실제 OpenAI 호출).

## 환경변수

`.env.example` 참고. 필수는 `OPENAI_API_KEY`, `ADMIN_TOKEN`, 배포 시 `DATABASE_URL`.
모델은 기본값 `gpt-5.4-mini`(구조화·연결), `gpt-5.4`(갈림길), `gpt-4o-transcribe`(음성), `text-embedding-3-small`(연결). 바꿀 때는 환경변수로.
연결이 너무 적거나 많으면 `LINK_THRESHOLD`(기본 0.36)를 바꾸고 `/api/admin/relink`를 POST로 호출한다.

## Vercel 연결 (한 줄)

본인 컴퓨터 터미널에 아래 한 줄을 붙여넣고, OpenAI API 키만 입력한다. Node.js 20.19 이상 필요.

```sh
node -e "fetch('https://raw.githubusercontent.com/moonlae7/MOONS/main/scripts/connect-vercel.mjs').then(r=>r.text()).then(t=>import('data:text/javascript;base64,'+Buffer.from(t).toString('base64')))"
```

`scripts/connect-vercel.mjs`가 하는 일: 키와 모델 확인, Vercel 로그인(처음 한 번), DB가 없으면 Neon 임시 Postgres 생성(`neon claim create`), `OPENAI_API_KEY`·`DATABASE_URL`·`ADMIN_TOKEN`을 production에 저장, 재배포, `/api/spaces/hackathon-1014/universe` 응답 확인. 새로 만든 ADMIN_TOKEN은 마지막에 한 번만 보여준다. 임시 DB를 계속 쓰려면 `npx neon@latest claim accept`.

## Replit 배포 (사용이 필수라면)

1. Replit에서 GitHub 저장소를 가져오거나 폴더를 올린다.
2. Database(Postgres)를 추가하면 `DATABASE_URL`이 자동으로 잡힌다. 아니면 Neon·Supabase 주소를 Secrets에 넣는다.
3. Secrets: `OPENAI_API_KEY`(당일 크레딧 키), `ADMIN_TOKEN`.
4. Build `npm run build`, Run `npm run start:host`.
5. 배포 형태는 **Reserved VM**. 응답 뒤 처리(`after`)와 호출 제한이 서버 메모리에 있어서, 요청마다 꺼지는 Autoscale은 맞지 않는다.
6. 배포 후 `/live` 오른쪽 아래 QR이 배포 주소를 가리키는지 확인한다(현재 접속한 주소로 만든다).

## 행사 전 체크

- [ ] 결제 체크리스트(`lib/server/checklist.ts`)를 결제 붙여본 팀원이 검수
- [ ] 모행성·질문 카드(`lib/server/event.ts`) 확정
- [ ] 씨앗 데이터: 지인 개발자에게 `/now` 링크로 실제 답 받기
- [ ] 예비 데모 입력 1개를 미리 넣고 `/t/:id` 결과 확인
- [ ] 배포 후 프론트 번들에 키 문자열이 없는지 검색
- [ ] 휴대폰(아이폰·안드로이드)에서 음성 입력 한 번씩
