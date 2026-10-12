# MOONS 프론트 / 백엔드 연결

작업본: C:\Users\EAN11\Desktop\MOONS.

## 2026-10-12 화면

- 전체 화면 배경은 흰색. 원본 로고의 색상은 유지한다.
- 좌측 상단 햄버거 메뉴: Matter / Nodes / 개인 Space / MOONS / Profile.
- Matter 입력 버튼은 아이콘과 Sparks / Materials 글자를 함께 표시한다. Space와 Sparks의 아이콘은 다르다.
- 프로필 제목은 displayName, username 순으로 사용한다. 없으면 My space다. 실제 회원가입·로그인은 연결 전이다.
- 분류 명칭은 사용자 표현인 모행성으로 표기했다. 미분류 기록은 Dwarf Planet에 자동 표시한다.
- 원본 로고의 달은 포인터를 따라 눈을 움직인다. 1.2초 대기 후 0.9–2.4초 간격으로 다양한 방향을 바라보고, 그림자 곡면과 면적도 시선에 따라 변한다. 원본 로고 본체는 흔들리지 않는다.
- 달 그림자는 얼굴 안에 clip한다. 문서가 숨겨지면 애니메이션을 멈추며 reduced-motion에서는 자동 두리번거림과 깜빡임을 생략한다.
- 말풍선은 연결된 하나의 SVG 윤곽이다. 새로고침마다 대사가 바뀐다.

## Space와 관계 기준값

메모 하나가 노드 하나다. 여러 모행성에 분류된 메모도 한 번만 그리며 각 모행성과 연결한다. 모행성 크기는 메모 수에 따라 커진다. 선택한 모행성으로 표시할 노드 범위가 결정되며, 별도 노드 포함/제외 기능은 후속 설계다.

모행성 추가·삭제와 Pages / Views는 오른쪽 분할 영역에서 처리한다. 경계선을 끌거나 방향키로 크기를 바꾸고 패널을 닫을 수 있다. 모바일에서는 위아래로 분할한다. 모행성을 클릭하면 해당 페이지 목록이 열린다.

lib/universe.ts는 공통 메모와 텍스트 겹침으로 유사도를 근사한다. 실제 AI 의미 분석이 아니다. 자동 배치 이후 드래그/방향키로 위치를 바꾸고, 현재 좌표·카메라를 저장한다. 확대 시 제목과 본문 발췌가 표시된다.

Dwarf Planet은 spaceStore()가 만드는 가상 분류다. 원래 Entry.planetIds를 바꾸지 않는다. 모행성을 지워도 기록은 남으며 다른 유효 분류가 없으면 Dwarf Planet에 표시한다.

Capture baseline은 현재 모행성 좌표, 쌍별 거리와 정규화된 거리를 복사해 저장한다. 이미지 캡처가 아니라 추후 AI가 비교할 수치 기준값이다. Dwarf Planet은 기준값의 관계 쌍에서 제외한다. Store.baselines에 이력을 보관하고, 현재 UniverseState 및 저장한 뷰에도 기준값을 포함한다. 실제 관계 제안은 미연결이다.

## 데이터와 대화

기존 Store version 1의 메모를 보존하며 선택 필드를 확장했다.

- profile: username, displayName
- universe: UniverseState, views: UniverseView[]
- baselines: SpatialBaseline[]
- chats: ChatThread[], activeChatId

UniverseState는 planetIds, positions, camera, activeViewId, manual, layoutKey, baseline을 가진다. 뷰에는 노드 ID 목록을 저장하지 않는다. 추후 생성한 노드도 해당 모행성에 분류하면 자동 표시된다.

ChatThread는 id, title, createdAt, updatedAt, messages, contextIds, draft를 가진다. 대화마다 초안과 참조 노드를 독립 보관한다. 첫 사용자 발언으로 기본 제목을 만들며 직접 변경할 수 있다. 우측에 노드를 고정하고 두 노드를 골라 비교한다. 사용자 발언의 Save as node는 원문을 보존해 기록하고 중복 저장을 막는다.

현재 채팅 답변은 AI가 연결되지 않았음을 알리는 고정 문구다. 모든 기록은 같은 브라우저·출처의 localStorage에 저장된다. 실제 AI 전송, 서버 동기화, 인증은 없다.

## API 연결 지점

| 프론트 | 백엔드 연결 |
| --- | --- |
| saveDump / MediaEditor.save | POST /entries, 저장만 수행 |
| 목록 / 원본 | GET /entries, GET /entries/:id/original |
| 명시적 구조화 | POST /entries/:id/analyze 및 결과 조회 |
| 노드 업데이트 | POST /entries/:id/nodes/:nodeId/updates |
| 신호 해제 | PATCH /signals/:id |
| 다중 모행성 분류 | PUT /entries/:id/tags |
| 모행성 CRUD | /planets |
| 뷰·관계 기준값 | 사용자별 CRUD, 좌표와 거리 스냅샷 |
| 유사도 배치·관계 제안 | 로컬 어댑터를 AI 응답으로 교체, 사용자 기준값과 비교 |
| Profile | 인증된 사용자 id / username / displayName 매핑 |
| ChatWorkspace | 대화·메시지 CRUD, contextIds를 근거 노드로 전달, 답변 스트리밍 |

백엔드 단계에서 인증 프로필 필드, API 주소, 목록 페이지네이션, 유사도 응답, 임베딩 갱신 시점, 원문 문장 인덱스, 재분석 후 업데이트/신호 연결 정책을 확정해야 한다.
