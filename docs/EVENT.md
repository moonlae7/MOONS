# 행사 모드 (10.14 해커톤)

개인 MOONS(`/`, `/notes`, `/universe`, `/chat`)는 그대로 두고, 행사용 화면 4개와 백엔드를 추가했다.

| 주소 | 누가 | 하는 일 |
| --- | --- | --- |
| `/now` | 참가자 휴대폰 (QR) | "당신의 뇌를 스캔해 드립니다". 오프닝 파이어사이드 챗 소감을 묻는 질문 하나에 말이나 글로 답하기. 3000자, 녹음 8분까지. 화살표 없음. 보내면 바로 `/t/:id?scan=1`로 넘어감. 로그인 없음 |
| `/universe` = `/live` | 프로젝터·휴대폰 | 같은 화면. Three.js 입체 성운과 별자리 안에 답 하나가 별 하나로 뜸. 드래그·방향키 회전, 스크롤·핀치 확대. `d` 우주·라이트·다크 전환, `f` 전체화면 |
| `/t/:id` | 발표자, 참가자 | 이해한 모양 그대로의 구조, 신호 2종, 다른 순간의 나, 갈림길 → 결정 노드 |
| `/admin` | 운영 팀원 | 숨기기, 실패한 것 다시 돌리기. `ADMIN_TOKEN` 필요 |

### 입체 우주 조작

- 별자리 이름을 누르면 해당 공간으로 이동하고 그 주제의 생각 목록을 보여준다. 별을 누르면 미리보기가 열리고, '생각 자세히 보기'로 기존 `/t/:id`에 들어간다.
- 하단에 움직임 정지, 확대·축소, 전체 보기, 모든 연결 보기, 생각 목록, 전체화면 버튼이 있다. 기본은 연결선을 숨기고 선택한 생각·별자리의 연결만 보여준다. 범례는 우측 '별과 연결의 의미'에서 펼친다.
- 실제 통계, QR 참여 주소, 새 생각의 밝기, 처리 중 상태, 아직 모르는 곳의 고리는 기존 API 데이터를 사용한다. 숨김 처리된 생각은 장면과 목록에서 제외한다.
- 2.5초 간격의 기존 데이터 조회를 이어가며, 응답 완료 후 다음 조회를 예약해 느린 응답의 순서 역전을 막는다. 새 생각이 추가되거나 조회 순서가 달라져도 기존 별의 위치와 사용자가 정한 시점을 유지한다.
- 모바일은 배경 별 수와 렌더링 해상도를 낮춘다. 비활성 탭에서는 그리기를 멈추고, '동작 줄이기' 설정에서는 자동 회전·반짝임·카메라 이동 애니메이션을 끈다.
- WebGL을 사용할 수 없거나 그래픽 연결이 끊기면 기존 SVG 화면으로 전환한다. 생각 목록, 상세 이동, QR 참여는 계속 사용할 수 있다.
- 이미지 원본이나 외부 텍스처를 다운로드하지 않는다. 성운은 셰이더로, 배경 별은 결정적 난수로 생성한다. Three.js는 브라우저에서 필요할 때 별도 청크로 읽는다.

## 원본 녹음 (파이어사이드 챗)

개인 MOONS의 Materials, Video / Audio 페이지 위쪽에서 녹음 파일(mp3, m4a, mp4, wav 등, 150MB까지)을 관리자 토큰과 함께 올린다.

1. 파일 자체가 원본이다. 그대로 4MB 조각으로 `material_parts`에 저장되고, `/api/materials/:id/file`에서 구간 재생된다.
2. 브라우저가 소리를 16kHz 모노로 읽어 2분씩 잘라 보내면 서버가 OpenAI로 받아쓴다(`material_chunks`, 언어 자동). 문장마다 녹음 시각이 붙는다.
3. 받아쓴 원본은 `media` 기록으로 잠기고 같은 구조화를 거친다. 우주 가운데 행성에 "원본" 별로 뜬다.
4. 참가자 답은 원본이 아니라 각자의 생각이다. 답마다 원본과 대조해 `comparisons`에 남긴다: 원본과 같아요 / 원본과 달라요 / 내 생각. 원본보다 먼저 들어온 답은 원본 등록 직후 한꺼번에, 그 뒤 답은 구조화 직후 대조한다. 결과 페이지의 인용을 누르면 원본 그 시각부터 재생된다.

## 음성 답

`/now`의 "말로 답하기"는 실시간 받아쓰기다. 브라우저가 마이크 소리를 바로 16kHz로 받아, 말을 잠깐(약 0.7초) 멈출 때마다 그 구절만 WAV로 `/api/transcribe`에 보낸다(OpenAI, 한국어). 받아쓴 글은 말하는 동안 입력칸에 순서대로 채워지고, 끝낸 뒤 고쳐서 보낸다. 목소리가 없는 구간은 보내지 않는다. 받아쓰기 모델에 힌트 문장(prompt)은 보내지 않는다. 조용한 소리에서 모델이 힌트를 그대로 읽어 돌려주기 때문이다. 같은 말이 반복되는 오류는 `cleanTranscript`가 하나로 줄인다. 답은 3000자, 녹음은 8분까지.

## 개인 MOONS의 AI

개인 기록은 브라우저에 남고, 구조화(`/api/personal/analyze`)와 MOONS 채팅(`/api/personal/chat`)만 서버를 거쳐 OpenAI를 쓴다. 서버에는 저장하지 않는다.

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
