# MOONS 3D Universe — Replit 재구현 명세서

작성일: 2026-10-14 · 대상: `/universe` 및 같은 화면을 제공하는 `/live`

이 문서는 기존 소스를 ZIP이나 Git import로 옮기지 않고, Replit Agent가 같은 화면과 동작을 새로 구현하기 위한 명세다. 화면 재구현과 기존 데이터 연결은 별개의 작업이다. 기존 DB, 사용자 기록, AI 분석 기능은 이 문서만으로 이전되지 않는다.

기준 화면: https://moons-git-codex-immersive-universe-luxyvenoms-projects.vercel.app/universe

기준 구현: MOONS PR #1, `codex/immersive-universe`, 커밋 `2d84b48`. 링크가 Vercel 로그인 화면을 보여주면 이 문서와 함께 제공한 `MOONS-universe-reference.webp`를 기준으로 작업한다. 로그인 우회나 저장소 복제는 필요하지 않다. 문서의 수치와 동작은 기준 구현에서 확인했으며, Replit 실행 구성과 데모 어댑터는 재구현을 위한 제안이다.

## 1. 사용자가 Replit에 전달하는 순서

1. Replit에서 새 웹 앱 프로젝트를 시작한다.
2. 이 Markdown 문서와 `MOONS-universe-reference.webp`를 Agent에 함께 전달한다. 파일 첨부가 어려우면 문서 전문을 채팅에 붙여 넣는다.
3. 아래 시작 프롬프트를 입력한다.
4. 첫 결과에서 성운, 별의 깊이, 타이포그래피, 카메라 조작을 먼저 비교한다. 데이터 연결은 4단계에서 진행한다.

### 복사할 시작 프롬프트

```text
첨부한 MOONS-REPLIT-SPEC.md와 MOONS-universe-reference.webp를 읽고,
MOONS의 /universe 화면을 이 Replit 프로젝트에 새로 구현해 주세요.
ZIP, GitHub import, 기존 프로젝트 소스 복사 없이 명세를 바탕으로 작성해 주세요.

목표는 레퍼런스와 같은 화면 구성과 조작입니다. 새로운 디자인으로 재해석하지 마세요.
Next.js + React + TypeScript + Three.js를 사용하고, 브라우저에서 실제로 회전·확대되는
3D 성운과 별을 구현해 주세요. 성운은 카메라 좌표를 사용하는 volumetric ray marching,
별은 깊이가 다른 GPU point cloud로 구현하세요.
배경 사진, 동영상, CSS 그라디언트만으로 우주를 대체하지 마세요.

명세의 색상, 한국어 문구, 6개 별자리, 카메라 수치, 모바일 배치,
별 선택·상세 패널·연결선·접근성·WebGL 대체 화면을 지켜 주세요.
특히 연결선은 기본적으로 숨기고 선택한 별의 관계만 보여 주세요.

명세의 1~3단계를 순서대로 완료하고 브라우저에서 검증해 주세요.
우선 재현 가능한 데모 데이터로 동작시키고 데모 상태를 분명히 표시하세요.
데이터 공급 부분은 교체 가능한 어댑터로 분리해 주세요.
실제 MOONS API나 AI 분석이 연결되지 않았다면 연결됐다고 표현하지 마세요.

프로젝트에 이 명세를 저장하고, replit.md에는 명세 위치와 핵심 제약을 기록해 주세요.
완료 시 실행 가능한 /universe 주소, 검증 결과, 실제 데이터 연결에 남은 항목을 알려 주세요.
```

## 2. 제품과 화면의 목적

사람의 생각 하나를 별 하나로 표현한다. 질문에 대한 답은 주제별 별자리 근처에 놓이고, 생각 사이의 관계는 선으로 표현한다. 화면은 행사장의 큰 디스플레이와 개인 휴대폰 모두에서 사용할 수 있다.

시각적 우선순위는 깊이 있는 우주 공간 → 읽을 수 있는 생각과 별자리 → 조용한 조작 UI 순서다. 넓은 검은 공간 사이로 푸른 가스와 어두운 먼지층이 흐르고, 오른쪽에는 절제된 적갈색 성운이 보인다. 작은 별이 촘촘하지만 큰 발광 별은 드물어야 한다.

현재 화면의 6개 주제는 **오늘 / 개념 / 상식 / AI와 나 / 고민 중 / 나**다. 이전 이미지의 `온 이유`, `요즘 배운 것`, `만들 것`으로 바꾸지 않는다. `planet`이라는 데이터 이름은 주제별 별자리를 뜻하며, 태양계 행성 모형을 만들라는 의미가 아니다.

### 구현 범위

| 범위 | 요구사항 |
|---|---|
| 첫 재구현 완료 | `/universe`, `/live`, 3D 장면, 반응형 UI, 선택/목록, 데모 데이터, 대체 화면 |
| 데이터 연결 단계 | 기존 API의 읽기, QR 참여 주소, 실제 생각 상세 주소 연결 |
| 별도 서비스 작업 | 회원가입, MOONS 전체 홈, 음성 인식, AI 뇌 스캔, 분석/임베딩 파이프라인, 관리자 화면, 기존 DB 이전 |

Blender 모델이나 텍스처 파일은 필수가 아니다. 기준 장면은 Three.js와 절차적 셰이더로 생성한다. 스크린샷은 비교 자료로만 사용하고 앱의 배경으로 삽입하지 않는다.

## 3. 기술 구조

- Next.js 16 계열 App Router, React 19, TypeScript, npm.
- 기준 그래픽 버전: `three@0.185.1`, `@types/three@0.185.0`. 아이콘은 `lucide-react`, QR 생성은 `qrcode` 또는 동등한 라이브러리.
- 처음 설치하는 프레임워크 패치는 설치 시 호환성과 보안 상태를 확인한다. Three.js 버전을 바꾸면 셰이더 출력과 OrbitControls 동작을 다시 비교한다.
- Three.js 엔진은 클라이언트 마운트 이후 동적 import한다. 서버 렌더링 중 `window`, `document`, WebGL에 접근하지 않는다.
- UI 상태와 GPU 렌더 루프를 분리한다. 프레임마다 React state를 갱신하지 않는다.
- 정적 배경 별은 한 번 생성한다. 생각 데이터 변경 시 생각과 관계만 갱신한다.
- CSS는 화면 범위 안에 한정한다. Tailwind 사용 여부보다 아래 치수와 스타일 일치가 우선이다.

권장 모듈 책임:

| 모듈 | 책임 |
|---|---|
| UniversePage | 헤더, 통계, 조작 버튼, 선택 상태, QR |
| UniverseScene | 브라우저 엔진 생명주기, 로딩/대체 상태, HTML 별자리 라벨 |
| universe-engine | 카메라, OrbitControls, 렌더 루프, 히트 테스트 |
| nebula | 절차적 가스 밀도와 먼지 흡수 셰이더, 저해상도 패스 |
| particles | 배경 별, 생각 별, 주제 비콘, 관계선 |
| universe-layout | ID 기반 결정적 3D 좌표 계산, 관계 필터 |
| universe-data | 데모/실제 API 어댑터, 폴링, 취소와 오류 처리 |
| ThoughtInspector | 선택한 생각, 주제별 목록, 전체 목록 |
| FlatUniverse | WebGL 미지원 시 SVG 대체 화면 |

Replit 실행 서버는 `0.0.0.0`에 바인딩하고 프로젝트의 외부 포트 매핑과 맞춘다. 예시 내부 포트 3000: 개발 `next dev --hostname 0.0.0.0 --port 3000`, 빌드 `next build`, 서비스 `next start --hostname 0.0.0.0 --port 3000`. Replit의 설정된 포트가 다르면 함께 변경한다. 참고 이미지 속 localhost 주소를 복사하지 않는다.

## 4. 화면 구성과 문구

배경은 화면 전체를 채운다. 좌측 사이드바나 상단 대형 내비게이션을 추가하지 않는다. UI는 캔버스 위에 HTML로 겹친다. 라벨은 3D 좌표를 화면 좌표로 투영한다.

| 위치 | 표시 내용 |
|---|---|
| 좌상단 | `MOONS` · 얇은 세로 구분선 · `나의 우주` |
| 우상단 작은 상태 | 연결 중 `우주에 연결하는 중`; 성공 `지금, 함께 만드는 우주`; 오류 `다시 연결하는 중` |
| 제목 위 | `A UNIVERSE WITHIN` |
| 좌측 제목 | `오늘 하루, 한 사람의 머릿속` |
| 제목 아래 | `QR을 찍고 질문에 말로 답하면, 당신의 뇌를 스캔해 드려요. 답은 이 우주의 별이 됩니다.` |
| 우측 통계 | 숫자 위주, 아래에 `생각`, `연결`, `아직 모르는 곳` |
| 통계 아래 | 기본 접힌 설명 `별과 연결의 의미` |
| 우주 내부 | 주제 이름과 `N개의 생각`; 클릭 가능한 작은 라벨 |
| 좌하단 최근 생각 | `최근 생각 · 시간`과 가장 최근 완료된 비결정 생각의 인용문 |
| 하단 왼쪽 힌트 | `드래그하여 둘러보기`, 다음 줄 `스크롤하여 가까이` |
| 하단 가운데 | 일시정지, 축소, 확대, 원위치, 모든 연결, 생각 목록, 전체 화면 |
| 하단 오른쪽 참여 카드 | QR, `작은 생각도 하나의 별이 돼요`, `뇌 스캔 받기 ↗`, 참여 URL |

데모 모드에서는 상태 근처에 `데모 데이터`를 표시한다. 실제 분석이 연결되지 않은 참여 화면에는 `데모에서는 AI 분석을 제공하지 않아요`라고 명시한다. 본 화면의 기존 문구와 실제 제공 기능을 혼동시키지 않는다.

## 5. 색상과 레이아웃 치수

기본 배경 `#05080e`, 본문 `#edf0f4`, 보조 글자 `#a8b1c2`, 강조 `#c4d9e4`. 유리 패널은 배경색 약 78% 불투명, 테두리는 본문색 약 17% 불투명. 두꺼운 흰색 테두리, 큰 불투명 카드, 과한 보라색 네온, 모든 별에 동일한 십자광을 사용하지 않는다.

폰트 스택은 `Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`. 다른 운영체제에서도 글자 폭을 가깝게 맞추려면 Pretendard를 일관되게 로드하고 실제 줄바꿈을 비교한다. UI 기본 line-height 1.65, letter-spacing -0.02em, 기본 margin 제거, border-box 적용.

### 데스크톱 기준: 1728 × 1040

| 요소 | 치수/스타일 |
|---|---|
| 전체 | 높이 100svh, 최소 높이 620px, stage relative + isolation |
| 상단 | 위 32px, 좌우 42px |
| MOONS | 23px, weight 600, 자간 .26em |
| 나의 우주 | 11px, weight 400, 왼쪽 margin 23px + padding 22px |
| 제목 블록 | 위 134px, 왼쪽 56px, 최대 폭 min(490px, 38vw) |
| 영문 eyebrow | 9px, weight 500, 자간 .25em, 아래 여백 24px |
| 제목 | clamp(30px, 3.05vw, 52px), weight 300, line-height 1.42, 자간 -.055em |
| 설명 | 12px, line-height 1.9, 위 여백 21px, 최대 폭 355px, keep-all |
| 통계 | 위 140px, 오른쪽 44px, 항목 간격 32px; 숫자 33px/400, 라벨 10px |
| 범례 | 위 227px, 오른쪽 44px, 펼쳤을 때 blur 18px 유리 패널 |
| 별자리 라벨 | 이름 13px/400, 아래 숫자 10px, 간격 5px; 작은 어두운 그림자 |
| 최근 생각 | 왼쪽 48px, 아래 137px, 폭 최대 430px, 본문 15px/300, 최대 2줄 |
| 하단 | 좌우 42px, 아래 max(28px, safe-area-inset-bottom), 요소 간격 20px |
| 조작 캡슐 | radius 40px, padding 5px 7px, 버튼 38×38px, blur 20px |
| QR 카드 | radius 13px, padding 12px 15px, gap 15px, QR 78×78px |
| 생각 패널 | 왼쪽 42px, 아래 153px, 폭 최대 370px, 최대 높이 min(460px,53svh), radius 15px, blur 24px |

상하 비네팅은 위쪽 배경색 65%에서 높이 32%까지 투명해지고, 60% 이후 아래쪽 배경색 85%로 진해진다. 제목은 이미지처럼 자연스럽게 2줄로 흐르도록 한다. 모든 화면 폭에 고정 줄바꿈을 강제하지 않는다.

### 모바일: CSS 분기 650px 이하

- 최소 높이 680px. 제목 위 96px / 왼쪽 26px, 제목 30px, 최대 폭 270px, line-height 1.45.
- 설명 10px, 최대 폭 268px, 위 여백 13px. 상단 브랜드를 축소하고 작은 화면의 상태 문구가 겹치지 않게 한다.
- 통계는 왼쪽 26px / 아래 197px로 이동. 숫자 25px, 라벨 9px, 항목 간격 25px.
- 하단 좌우 20px / 아래 max(19px, safe-area-inset-bottom). QR 카드가 위, 조작 캡슐이 아래에 오도록 세로 배치. 간격 14px.
- QR 58×58px, 카드 폭 100%, padding 10px 14px. 실제 도메인이 길어도 카드 밖으로 넘치지 않는다.
- 최근 생각 티커와 드래그 힌트는 숨긴다. 별자리 이름 11px, 숫자 9px.
- 생각 패널은 왼쪽 20px / 아래 186px, 폭 calc(100% - 40px), 최대 높이 43svh, 내부 스크롤.
- 터치 기기 버튼 높이 최소 44px. 390×844 및 320×720에서 수평 스크롤이나 카드/조작 버튼 겹침이 없어야 한다.
- 초기 카메라 거리를 화면 비율에 맞춰 조절해 여섯 주제를 볼 수 있게 한다. 단순히 데스크톱 캔버스를 잘라내지 않는다.

## 6. 3D 카메라와 조작

| 항목 | 기준값 |
|---|---|
| 투영 | PerspectiveCamera, near 0.1, far 1500 |
| FOV | 기본 49도, 엔진 초기 폭 700px 미만 58도 |
| 초기 target | (0, -1, 0) |
| 초기 camera | (0, 7, distance) |
| distance | clamp(113 / (2 × tan(FOV/2) × aspect), 98, 270), FOV는 라디안 변환 |
| OrbitControls | pan 비활성, damping .055, rotateSpeed .32, zoomSpeed .8 |
| 거리 제한 | 23~300 |
| 세로 회전 제한 | polar angle .2π~.8π |
| 자동 회전 | autoRotateSpeed .055; 선택/드래그/이동 중에는 중지 |
| 선택 시 카메라 | 현재 시선 방향 유지, 선택 위치에서 거리 48, 작은 화면 76 |
| 선택 이동 | 1550ms, smoothstep(t)=t²(3−2t) |
| 버튼 확대/축소 | 현재 target 거리 × .82 / × 1.2, 거리 제한 적용 |

마우스 드래그/터치로 회전하고 스크롤/핀치로 확대한다. Pointer 이동이 6px를 넘거나 두 손가락 제스처였으면 별 클릭으로 처리하지 않는다. 실제 생각 및 주제 비콘에만 raycast하며 배경 장식 별은 선택 대상이 아니다. Points raycast threshold 기준 1.1.

방향키는 우주 영역에 포커스가 있을 때 회전: 좌우 .12 rad, 상하 .08 rad. `Escape`는 선택/목록 해제와 초기 카메라 복귀, `F`는 전체 화면, `D`는 cosmos → light → dark → cosmos. 입력창과 편집 가능한 요소에서는 단축키를 가로채지 않는다.

별자리 라벨은 매 프레임 3D→NDC→CSS pixel로 투영하고 y에 18px 오프셋을 준다. 원점은 라벨 상단 중앙이다. NDC z가 (-1,1), |x|<.9, |y|<.78 조건일 때 표시한다. 라벨은 DOM button으로 키보드 접근 가능해야 한다.

## 7. 성운 렌더링 명세

이 섹션은 셰이더를 새로 작성하기 위한 수학 명세다. 카메라를 움직이면 가스와 별의 상대 위치가 변해야 한다. 화면 좌표에 붙은 평면 노이즈로 대체하지 않는다.

1. 카메라 inverse projection과 world matrix로 픽셀별 world-space ray direction을 구한다.
2. 광선마다 52회 샘플링한다. 샘플 거리 t = 12 + (i + jitter) × 4.7.
3. 샘플 위치 p = cameraPosition + rayDirection × t. 아래 밀도와 색을 전면에서 후면으로 누적한다.
4. 가스는 저해상도 RenderTarget에 렌더하고 그대로 전체 화면으로 복사한다. 별을 그리기 전 depth를 비운다.
5. 카메라 이동으로 공간감을 만든다. 기준 가스 자체에는 시간에 따른 흐름 변형이 없다.

### 노이즈 정의

- hash 입력 p에 `fract(p × .3183099 + (.11,.17,.13))`를 적용한 뒤 17배. 결과 hash = fract(px × py × pz × (px+py+pz)).
- 3D value noise는 격자 8개 꼭짓점 hash를 보간한다. 보간 계수는 f²(3−2f).
- FBM은 noise 4개를 가중 합산: .53, .27, .13, .07.
- 각 octave 좌표 변환은 순서대로 p×2.07+(3.4,7.3,1.8), p×2.13+(2.3,4.1,6.2), p×2.03.
- jitter = fract(sin(dot(fragmentPixelXY,(12.9898,78.233))) × 43758.5453).

### 밀도, 가스 색, 먼지층

아래 수식은 위에서 아래로 평가한다. scalar를 vector에 더할 때는 모든 성분에 더한다.

```text
q = p × .024
qx = qx + qy × .65
qy = qy + sin(qx × 1.12) × .5
warp = fbm(q × .62 + (7.5,1.2,3.7))
shape = exp(−(qy+.18+(warp−.5)×2.6)²×1.25 − (qz+.8)²×.52)
cloud = fbm(q × 3.4 + warp × 3.2)
detail = fbm(q × 14 + warp × 2.4)
structure = smoothstep(.46,.79,cloud)^1.6
density = shape × structure × .16 × (.4 + detail × 1.2)
ridge = max(0, 1−abs(cloud−.54)×4.8)^4
colorMix = smoothstep(−.5,2.7,qx+warp×.6)
cold = mix((.025,.07,.18),(.36,.7,.92),ridge×.8)
warm = mix((.18,.028,.015),(.67,.29,.15),ridge×.7)
light = mix(cold,warm,colorMix)
core = exp(−length((p−(13,−2,−19)) × (.035,.055,.035)))
light += (.17,.3,.44) × core × .7
dust = fbm(q×1.7+(13,7,3))
obscuration = smoothstep(.42,.64,dust) × shape
illumination = .85 + 1.4 × exp(−(qx+1.5)²×.65)

초기 col=(.008,.015,.028), transmission=1
각 샘플: col += transmission × density × light × 4.5 × illumination
각 샘플: transmission *= 1−density×.64−obscuration×.15
최종: col = 1−exp(−col×1.25)
```

가스 RenderTarget: width=round(min(viewWidth,1600)×.45), height=round(min(viewHeight,1000)×.45), 최소 1px. depth buffer 불필요. 출력 복사 시 추가 감마 변환을 중복 적용해 색을 희게 만들지 않는다. 기준의 짙은 먼지 골짜기와 푸른 가스의 밝기 차이를 유지한다.

## 8. 별의 밀도와 발광

배경 별, 실제 생각 별, 주제 비콘을 구분한다. 배경 별은 장식이며 통계에 포함하지 않는다.

### 배경 별

- 시드 43191의 결정적 난수. 기본 26,000개, 초기 화면 폭 700px 미만 12,000개. 여기에 밝은 별 95개를 추가한다.
- 처음 9,500개는 은하 띠: x=N(0,1)×46, y=N(0,1)×14+sin(x×.025)×17, z=N(0,1)×33−39.
- 나머지는 반경 100~580인 구면에 분포한다. cos(theta)를 -1~1에서 균일 샘플링한다.
- 색 팔레트: #cadff4, #e2eaf1, #b6d0f4, #e6a293, #db6271, #f1d8bb.
- 색 밝기 배수 .32+random²×1.15. 크기 속성 .45+random⁵×3.8.
- 밝은 별 95개는 (Gaussian×65, Gaussian×35, Gaussian×33−30), 크기 5~14. 색 #edb9a5 또는 #c6e3ff, 밝기 배수 1.7.
- Gaussian 샘플은 Box–Muller 방식: sqrt(-2×ln(max(.00001,r1)))×cos(2πr2). 난수 호출 순서를 고정한다.

### GPU point sprite

- AdditiveBlending, transparent=true, depthWrite=false, vertex colors.
- gl_PointSize = clamp(aSize×180/max(8,−viewZ),.7,56)×DPR.
- pointCoord를 -1~1로 변환한 p와 r=length(p)를 사용한다. r>1은 discard.
- 중심광 exp(−r²×36), halo exp(−r×5)×.35.
- 십자광 = [exp(−|px|×95)×exp(−|py|×7) + exp(−|py|×95)×exp(−|px|×7)]×.22.
- 색 = vertexColor×(중심광+halo+십자광)×(.88+.12×sin(time×.7+phase)). phase=index×2.39996.
- openSignals>0인 생각은 주황 링: 색 (1,.32,.14), 반경 .72, 강도 exp(−((r−.72)×55)²)×.6.
- 생각 크기는 pending 5, 그 외 7+min(8,degree×1.4). 새 생각은 2600ms 동안 크기 ×1.7.
- pending 밝기 ×.7, 나머지 생각 ×1.8. 주제 비콘 크기 19, 주제색을 #d6e7f5와 .5 혼합 후 밝기 ×1.7.

배경 난수는 생성 시 한 번 계산한다. 스냅샷 재수신이나 React rerender마다 배경을 재생성하지 않는다.

## 9. 별자리와 생각 좌표

| ID | 라벨 | 색 | 정규화 x | 정규화 y |
|---|---|---|---|---|
| today | 오늘 | #7BA4F8 | .30 | .42 |
| concept | 개념 | #A58BE8 | .55 | .30 |
| trivia | 상식 | #5DB89B | .50 | .70 |
| ai | AI와 나 | #E0A84F | .76 | .55 |
| choice | 고민 중 | #E58A7A | .80 | .22 |
| me | 나 | #E6A0C4 | .20 | .78 |

텍스트 ID를 FNV-1a 방식으로 해시한다: 시작 2166136261, 각 UTF-16 code unit마다 XOR 후 16777619를 32bit 정수 곱셈, 마지막 unsigned 변환. 해당 시드에서 LCG를 사용한다: seed=(1664525×seed+1013904223) mod 2³², random=unsigned(seed)/4294967296.

- 주제 중심 = ((x−.5)×130, (.5−y)×85, −22+첫 random×38).
- 생각 좌표의 난수는 생각 ID를 시드로 사용한다. 배열 순번을 시드로 쓰지 않는다.
- planetIds를 중복 제거·정렬하고 유효한 첫 2개 주제 중심의 평균을 기준점으로 삼는다.
- 주제가 없고 saved/analyzing이면 기준점 (0,28,−3), 그 외 미분류이면 (−43,−1,0).
- angle=random×2π, radius=5+sqrt(random)×(2개 주제이면 5, 그 외 11).
- 최종 위치 = 기준점 + (cos(angle)×radius, sin(angle)×radius×.66, (random−.5)×20).
- 같은 ID의 생각은 데이터 추가/삭제/정렬만으로 움직이지 않는다. 분석 완료에 따른 주제 변경은 위치에 반영할 수 있다.
- `held`는 장면·목록에서 제외한다. saved/analyzing은 회색 #9AA3B5, decision은 #B48CFF, 그 외 첫 유효 주제색 또는 #B6C7DA.
- 주제 아래 숫자는 해당 주제를 가진 `done` 생각만 센다. 복수 주제 생각도 별 자체는 1개다.

## 10. 관계선과 선택 패널

| kind | 범례 | 색 | 형태 |
|---|---|---|---|
| fills_gap | 빈 칸을 채울 경험 | #8fb3ff | 실선 |
| same_mistake | 같은 실수 | #f2c14e | 끊어진 선 |
| contradicts | 지금 생각과 어긋남 | #ff8a6b | 끊어진 선 |
| supports | 같은 생각 | #a1b6db | 옅은 실선 |
| decides | 이 생각에서 나온 결정 | #c3a4ff | 실선 |

기본은 관계선을 숨긴다. 생각 선택 시 그 생각에 닿은 관계를, 주제 선택 시 그 주제의 생각에 닿은 관계를 표시한다. `모든 연결 보기` 토글을 켜면 전체 관계를 표시한다. endpoints가 없거나 held/saved/analyzing인 관계는 그리지 않는다.

곡선은 quadratic Bézier: 양 끝은 생각 좌표, 제어점은 중간점+(0,2,−4). 18구간, 끊어진 종류는 매 세 번째 구간 생략. opacity는 supports .16, 다른 관계 .4. 카메라 이동에도 3D 별에 붙어 있어야 한다.

별을 누르면 `작은 생각 하나` 패널에 preview, 생성 시각, structure, openSignals를 보여준다. saved/analyzing은 `도착했어요. 생각의 모양을 그리고 있어요.`로 안내하고 상세 링크를 만들지 않는다. 그 외는 `/t/{encodeURIComponent(id)}`의 `생각 자세히 보기 ↗`를 제공한다.

주제 라벨을 누르면 해당 생각 목록을 보여주고, 목록의 생각을 누르면 그 별을 선택한다. 전체 목록 버튼은 모든 visible 생각을 표시한다. 닫기 및 Escape는 전체 우주로 복귀한다. 선택/목록 패널이 열린 동안 최근 생각 티커는 숨긴다.

## 11. 데이터 계약

기준 공간 ID는 `hackathon-1014`. 읽기 API는 `GET /api/spaces/{spaceId}/universe`이며 응답은 아래 객체다. Replit 앱 내부의 동일 출처 URL을 사용하거나 서버 측 어댑터를 둔다.

```ts
type Shape = '흐름' | '이항대립' | '파편' | '주장-근거' | '비교'
  | '지식나열' | '문학' | 'IRAC' | 'ANT';
type Planet = { id: string; name: string; color: string; x: number; y: number };
type Question = {
  id: string;
  kind: '고민' | '떠오른 생각' | '개발 퀴즈' | '소감' | '아이스브레이킹'
    | '가벼운 질문' | '개념 질문' | '상식 퀴즈';
  text: string;
  planetId?: string;
};
type UniverseThought = {
  id: string;
  kind: 'spark' | 'quiz' | 'decision' | 'media';
  status: 'saved' | 'analyzing' | 'done' | 'failed' | 'held';
  preview: string;
  planetIds: string[];
  openSignals: number;
  structure: Shape | null;
  createdAt: string; // ISO 8601
};
type UniverseLink = {
  a: string; b: string;
  kind: 'fills_gap' | 'same_mistake' | 'contradicts' | 'supports' | 'decides';
};
type UniverseDTO = {
  space: { id: string; name: string; tagline: string; planets: Planet[]; questions: Question[] };
  thoughts: UniverseThought[];
  links: UniverseLink[];
  stats: { thoughts: number; links: number; openSignals: number };
  now: string; // ISO 8601
};
```

### 데이터 갱신

- 첫 요청 후에는 이전 요청 완료 시점으로부터 2500ms 뒤에 다음 요청한다. setInterval 중첩 요청으로 과거 응답이 최신 상태를 덮지 않게 한다.
- 첫 응답 전 통계는 `·`. 실제 통계는 서버의 stats 값을 표시한다. 배경 별 수나 주제별 합계를 전체 생각 수로 쓰지 않는다.
- 이전 visible ID 집합에 없던 생각을 2600ms 강조한다. 첫 전체 로딩에는 모두를 새 별로 강조하지 않는다.
- 요청 실패 시 마지막 성공 스냅샷을 보존한다. 성공 기록이 있으면 `연결이 잠시 끊겼어요. 마지막 화면을 보여주고 있어요.`; 없으면 `생각을 불러오지 못했어요. 잠시 후 다시 연결할게요.`.
- 컴포넌트 해제 시 fetch abort 및 모든 타이머 취소. 폴링이 카메라를 초기화하지 않게 한다.
- 생각이 없는 정상 응답은 빈 우주다. 장식 별과 성운을 유지하고 `첫 번째 별을 기다리며`, `QR을 찍고, 당신의 생각을 별로 남겨 주세요.`를 표시한다.

### 데모 모드

비교 이미지의 84 / 60 / 16은 검증용 예시 데이터이며 현재 운영 DB의 숫자가 아니다. 데모 데이터는 고정 ID/시각을 가진 fixture로 별도 모듈에 둔다. 6개 주제에 골고루 배치하고 여러 관계 종류와 일부 신호를 포함한다. stats는 fixture와 일관되어야 한다. 카드에 숫자를 직접 하드코딩하지 않는다.

기본 시각 비교 fixture 외에 빈 데이터, saved/analyzing, failed, held, 복수 주제, 누락된 관계 endpoint, API 실패 fixture를 마련한다. 데모 상세 링크는 같은 fixture의 내용을 보여주는 `/t/:id`로 연결한다. 실제 참여 기능이 준비되지 않았다면 `/now`는 데모 안내를 제공하며 실제 AI 분석 완료를 흉내 내지 않는다.

## 12. 실제 서비스와 QR 연결

화면 재구현이 끝난 뒤 API 어댑터를 실제 데이터로 교체한다. 프리뷰 URL을 프런트엔드에서 직접 fetch하면 인증 또는 교차 출처 문제로 실패할 수 있다. 접근 가능한 정식 API와 허용된 서버 연결 방식을 확인한다. 로그인 HTML을 JSON 데이터로 처리하지 않는다.

같은 Replit 앱에서 참여 화면도 운영할 경우 QR은 런타임의 실제 origin + `/now`를 인코딩한다. QR 그림에 localhost나 Vercel preview 도메인을 하드코딩하지 않는다. QR 라이브러리로 실제로 읽히는 코드를 생성한다.

참여와 상세 화면을 기존 MOONS에 남겨두기로 했다면, 참여 URL과 상세 URL의 기준 origin을 명시적인 설정으로 분리하고 둘 다 같은 데이터 공간을 가리키게 한다. 이 경우 QR 하단에도 실제 이동할 주소를 표시한다. 표시용 Replit 도메인과 별도 참여 도메인을 혼동시키지 않는다.

기존 AI 분석/저장/음성 입력을 새로 만들려면 추가 백엔드 명세가 필요하다. 프런트엔드 데모, 실제 읽기 API 연결, 실제 참여/분석 연결의 완료 상태를 각각 보고한다. API 키와 DB 접속 정보는 클라이언트 번들에 넣지 않는다.

## 13. 성능, 접근성, 실패 복구

- 기본 목표는 최대 약 30fps. RAF 간격이 32ms 미만이면 렌더를 건너뛴다. 탭이 숨겨지면 렌더하지 않는다.
- renderer는 antialias=false. DPR 상한 기본 1.6, 초기 폭 700px 미만 1.25.
- 기준 엔진은 초기 50프레임의 JS 측 렌더 호출 시간 평균이 24ms를 넘으면 성운에 전달하는 width/height를 .65배로 낮춘다. 이는 GPU 전체 시간을 정확히 측정하는 지표는 아니다. 실제 기기 반응도 함께 확인한다.
- 일시정지 또는 reduced-motion에서는 자동 회전과 반짝임 시간을 멈추고, 입력/데이터/크기 변경 시 렌더한다.
- prefers-reduced-motion이면 선택 시 비행 애니메이션 대신 바로 이동. 일시정지 버튼을 비활성화하고 설정 적용을 설명한다.
- 모든 버튼에 한국어 accessible name, 키보드 포커스 표시. 작은 별을 클릭하기 어려운 사용자도 생각 목록으로 동일 내용에 접근할 수 있어야 한다.
- WebGL 생성 실패 또는 context loss 시 SVG 대체 화면으로 전환하고 `이 기기에서는 기본 우주 화면으로 보여드려요.` 표시. 생각 목록, QR, 별 선택은 계속 동작한다. 작동하지 않는 3D 조작 버튼은 숨긴다.
- light/dark 테마는 SVG 대체 렌더러를 사용한다. cosmos 복귀 시 캔버스를 하나만 생성한다.
- unmount 시 RAF, ResizeObserver, 포인터/키보드 리스너, OrbitControls, geometry, material, render target, renderer를 모두 정리한다.

## 14. 작업 순서와 통과 기준

### 1단계 — 뼈대와 고정 시각 기준

라우트, 데이터 타입, 데모 fixture, 전체 화면 DOM 레이어, 한국어 문구, desktop/mobile 배치를 만든다. 명세를 프로젝트에 보존하고 `replit.md`에서 참조한다. 데모 데이터와 실제 데이터의 선택 지점을 하나로 만든다.

### 2단계 — 우주 렌더링

카메라 → 별 포인트 클라우드 → 성운 ray marching → 별자리 좌표와 라벨 순서로 구현한다. 연결선은 숨겨 둔다. 초기 카메라, 같은 창 크기, 일시정지 상태에서 비교 이미지와 구도를 맞춘다.

### 3단계 — 동작과 검증

선택/카메라 이동, 패널/목록, 관계 토글, QR, 모바일, reduced-motion, WebGL fallback을 완성한다. 데모 환경에서 동작하는 `/universe`를 전달한다. 최소 아래 항목을 검증한다.

- [ ] 1728×1040 및 1440×900: 푸른 성운, 검은 먼지층, 오른쪽 따뜻한 가스가 보인다.
- [ ] 드래그/확대 시 앞뒤 별과 성운에 시차가 생긴다. 배경 그림만 움직이는 화면이 아니다.
- [ ] 첫 화면에 여섯 주제를 볼 수 있고 제목/통계/QR/조작 UI가 읽힌다.
- [ ] 연결선 기본 숨김, 선택 관계 표시, 전체 연결 토글이 각각 작동한다.
- [ ] 별과 주제 라벨 클릭, 목록을 통한 선택, 상세 링크, Escape 원위치가 작동한다.
- [ ] 390×844 및 320×720: 가로 넘침이 없고 QR/조작 버튼/패널이 사용 가능하다.
- [ ] 별 ID가 같으면 스냅샷 순서 변경과 다른 생각 추가/삭제 후에도 좌표가 같다.
- [ ] held가 장면/목록/관계에 새어 나오지 않고 pending은 상태 안내를 표시한다.
- [ ] 빈 데이터 및 요청 실패 시 올바른 안내와 마지막 정상 화면을 유지한다.
- [ ] reduced-motion, WebGL 실패, 테마 반복 전환에서 오류나 중복 캔버스가 없다.
- [ ] 이미지 속 84/60/16을 현재 운영 데이터라고 표현하지 않는다.
- [ ] 타입 검사와 프로덕션 빌드 통과, 예상치 못한 브라우저 콘솔 오류 없음.

### 4단계 — 실제 데이터 연결

접근 가능한 API와 참여/상세 URL을 받은 뒤 데모 어댑터를 교체한다. 두 기기에서 실제 참여 → 새 별 등장 → 상세 내용 일치를 확인한다. 이 단계를 마치기 전에는 운영 서비스 이전이 완료됐다고 보고하지 않는다.

## 15. 첫 결과를 다듬을 때 사용할 프롬프트

```text
명세와 현재 결과를 같은 뷰포트, 초기 카메라, 일시정지 상태로 비교해 주세요.
차이를 ① 성운의 밀도와 색 ② 별의 크기와 깊이 ③ 제목과 라벨 배치
④ 모바일 겹침 ⑤ 실제 동작 순서로 정리한 다음 수정해 주세요.
기준 구도와 문구를 유지하고 새로운 UI 섹션을 추가하지 마세요.
수정 후 데스크톱과 모바일 스크린샷, 작동 확인 결과를 보여 주세요.
```

명세만으로 첫 생성 결과가 픽셀 단위로 일치한다고 보장할 수는 없다. 노이즈 샘플 순서, 브라우저 폰트, GPU 색 출력에 차이가 있을 수 있으므로 위 비교 과정을 통해 맞춘다. 데이터 내용과 ID가 다르면 생각 별의 위치도 달라지는 것이 정상이다.

## 16. Replit 사용 근거

- [Replit Agent 안내](https://docs.replit.com/features/agent/overview): 자연어 요청으로 웹 앱을 만들고 결과를 반복 수정하는 흐름.
- [replit.md 안내](https://docs.replit.com/features/project-setup/replit-dot-md): 프로젝트 루트의 지침과 문맥을 Agent가 참고하는 방식.
- [포트 안내](https://docs.replit.com/features/project-setup/ports): 앱 서버의 포트 노출 설정.

위 문서들은 Replit 작업 방식의 참고 자료다. MOONS 시각·동작 명세의 출처는 위에 명시한 기준 구현이며, 특정 Replit 요금제나 UI 메뉴 이름을 요구하지 않는다.
