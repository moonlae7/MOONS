# MOONS

생각을 편하게 기록하고, 원문을 보존한 채 배움을 쌓는 웹 프론트엔드입니다.
영문 UI를 기본으로 하며, 스케치의 로고·말풍선·입력창 구성을 따릅니다.

## 행사 모드 (10.14 해커톤)

`/now`(휴대폰 입력), `/live`(큰 화면), `/t/:id`(생각의 모양·갈림길), `/admin`(운영)이 추가됐습니다.
백엔드는 Next.js API 라우트 + Postgres(로컬은 내장 PGlite) + OpenAI입니다. 실행·배포·점검은 [docs/EVENT.md](docs/EVENT.md)를 보세요.
개인 MOONS 화면은 아직 브라우저 저장소와 목업 구조화를 씁니다.

## 실행

Node.js 22 이상에서 프로젝트 폴더를 열고 실행합니다.

```sh
npm install
npm run dev
```

브라우저에서 http://127.0.0.1:3000 을 엽니다. Windows에서는 `start-moons.cmd`를 더블클릭해도 됩니다.
이미 설치되어 있다면 `npm install`은 생략할 수 있습니다.
Windows 격리 환경과의 호환성을 위해 Webpack 빌드를 사용합니다.

```sh
npm test
npm run typecheck
npm run build
npm start
```

## 실제로 작동하는 것

- 생각 입력, Enter 저장 / Shift+Enter 줄바꿈, 한글 조합 중 오발송 방지, 초안 자동 보관
- 책·논문·기사·영상·기타 기록, 매체별 초안, 선택 정보 접기, 저장 접수 도장
- 메모함, 제목·본문 검색, 종류·상태·모행성 필터
- 원본 고유 경로, 원문 문장 하이라이트, 원문 수정 방지
- 모행성 생성·삭제·다중 분류, 드래그 위치 저장, 기록 수에 따른 크기, 확대·축소·핀치
- 구조 8종 레이아웃, 관계선, 노드 상세, 신호 반박, 업데이트 추가, 이전 구조 보관
- 모행성별 페이지 목록, Dwarf Planet, 크기 조절·닫기가 가능한 Space 관리 패널
- 모행성 위치와 상호 거리를 관계 기준값으로 저장
- 여러 MOONS 대화의 기록·초안·참조 노드 저장, 우측 노드 비교, 사용자 발언을 노드로 저장
- 로컬 프로필의 표시 이름을 우선하는 개인 Space 이름
- 로컬 데이터 JSON 백업 다운로드, 키보드 포커스, 반응형 화면, reduced-motion

## AI와 저장 범위

백엔드와 외부 AI는 연결되어 있지 않습니다. 저장은 이 브라우저의 localStorage에만 남습니다.
기기·브라우저·포트가 달라지면 같은 데이터가 보이지 않습니다. 로그인, 서버 저장, 동기화, 공유 기능은 없습니다.
저장 버튼은 분석을 시작하지 않습니다. 구조화는 별도 요청 시에만 체험용 결과를 생성합니다.
목업은 입력 문장을 순서대로 배치하며 의미를 판단하지 않습니다. 예시용 신호는 화면에 명시됩니다.
업데이트를 추가해도 실제 AI 재확인이나 자동 신호 해결을 했다고 표시하지 않습니다.
대화 답변은 AI 미연결을 알리는 고정 문구입니다. 대화별 기록·초안·참조 노드는 새로고침 후에도 보관됩니다. 필요한 사용자 발언은 노드로 저장할 수 있습니다.

## 둘러보기

좌측 상단 햄버거 메뉴에서 Matter / Nodes / 개인 Space / MOONS로 이동합니다. Matter에서 Sparks 또는 Materials로 기록하고, Nodes에서 분류합니다. Space에서 모행성을 선택해 뷰를 저장하고 확대하면 제목과 본문 발췌를 볼 수 있습니다. 모행성을 클릭하면 우측에 해당 페이지 목록이 열립니다. Profile에 표시 이름을 입력하면 개인 Space 제목에 반영됩니다.

## 코드 위치

- `app/layout.tsx`: 공통 레이아웃. 화면 이동 시 입력·필터 상태를 유지합니다.
- `components/Moons.tsx`: 기록·메모·우주·원본·구조·대화 화면과 로컬 동작
- `components/Brand.tsx`: 선 로고, 눈 움직임, 말풍선과 달 캐릭터
- `components/UniverseWorkspace.tsx`: 우주 그래프, 이동·확대, 모행성 선택, 뷰 저장
- `components/SplitWorkspace.tsx`: 겹치지 않는 가변 크기 분할 패널
- `components/ChatWorkspace.tsx`, `lib/chat.ts`: 여러 대화, 초안, 참조 노드와 비교
- `app/workspace.css`: 화이트 화면, 분할 패널, 프로필·채팅 스타일
- `lib/universe.ts`: 유사도 근사, 결정적 배치, 메모 노드·카메라·뷰 모델
- `app/refinement.css`: 스케치 기반 홈과 우주, 채팅 사이드 패널
- `components/GraphLines.tsx`: 실제 노드 위치를 기준으로 그리는 관계선
- `lib/model.ts`: 공통 타입, 원문 보존, 분류·통계, 체험용 구조화
- `app/globals.css`: 디자인 토큰과 데스크톱·모바일 스타일
- `tests/universe.test.ts`: 뷰·배치·확대·메모 노드 검증
- `tests/workspace.test.ts`: Dwarf Planet, 관계 기준값, 대화 복원·프로필 호환성
- `tests/model.test.ts`: 원문 보존, 명시적 분석, 8종 목업, 업데이트, 분류, 저장 복구 검증
- `references/`: 제공받은 명세와 원본 스케치. 원본 로고 파일은 변경하지 않았습니다.
- `docs/HANDOFF.md`: 백엔드 연결 방법과 남은 결정 사항

폰트는 Pretendard CDN을 사용하며 로딩할 수 없으면 시스템 산세리프로 표시합니다.
