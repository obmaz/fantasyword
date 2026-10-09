# 구조와 코드 규칙

## 실행과 의존성

원본은 classic script를 순서대로 로드하는 정적 앱이다. `index.html`이 JS와 CSS 순서를 소유한다.
`app.js`는 세션·렌더러·서비스를 조립하고 `init.js`는 초기화와 이벤트를 등록한다.
단어장은 JavaScript 변수로 제공하므로 fetch/CORS 없이 원본과 dist를 직접 열 수 있다.
ES modules나 프레임워크·번들러 전환은 현재 실행/배포 계약을 바꾸는 별도 작업이다.

| 위치                              | 책임                                                  |
| --------------------------------- | ----------------------------------------------------- |
| `scripts/config.js`               | 제한 시간·음악 수·팝업 전환 등 정책                   |
| `scripts/core/`                   | 저장소 접근, 정규화·마이그레이션·영속화               |
| `scripts/data/`                   | 단어장/아이템 로딩과 조회 인덱스                      |
| `scripts/domain/`                 | DOM 없는 출제·채점·보상·몬스터·퀘스트·장비·공격 규칙  |
| `scripts/game/`                   | 배틀·연습·낙하전 세션과 진행 상태                     |
| `scripts/features/`               | 상점·장착·설정·통계·음성·스토리·인쇄·퀘스트 UI 서비스 |
| `scripts/ui/`                     | 모달·이동·레이아웃·알림·전투/연습/낙하전 렌더링       |
| `scripts/utils/`                  | 공유하는 작은 helper와 디버그                         |
| `styles/base/`                    | 공통 변수·애니메이션·버튼·모달·알림 기본 규칙         |
| `styles/screens/`                 | 화면별 기본 배치                                      |
| `styles/theme/`                   | 생성 이미지 재질·최종 메뉴/게임 표현·무기 효과        |
| `images/battle/`, `images/theme/` | 런타임 이미지; `theme/parts/`는 독립 부품             |
| `data/`                           | 단어장·아이템·예문·오답 후보·MP3                      |
| `types/`, `tools/`, `tests/`      | 타입 계약·빌드/검증/데이터 도구·회귀 테스트           |
| `docs/design/`, `docs/archive/`   | 디자인 참고 이미지·과거 기록; 배포 제외               |

`domain/`은 값과 함수만 입력받는다. `game/`은 저장소·시계·타이머·음성·화면 서비스를 주입받고 브라우저 전역을 조회하지 않는다.
스토리 지도 종류·출제 수·통과 기준·분기 연결은 `domain/story-map.js`가 소유한다. `features/story-journey.js`는 지점 선택·이벤트 저장·보상·지도 복귀를 맡는다. 스토리 총공세는 세션 시작 옵션의 문제 수와 종료/복귀 콜백으로 연결하며 일반 총공세의 Day 전체 출제를 유지한다.
전투/연습/낙하전 렌더러는 모델과 콜백을 받아 DOM을 갱신하고 `game`/`db`를 직접 조회하지 않는다.
상점·설정·통계 등 일부 주변 서비스는 여전히 전역 API로 연결되어 있다.

## 상태와 비동기 작업

`database.js`가 영속 데이터와 마이그레이션을 소유하고 `gameStorage`만 localStorage를 접근한다.
저장 오류는 안내하되 게임 실행은 계속한다. 저장 키는 [사양](spec.md#저장-계약)을 따른다.
`DB_STORAGE_FIELDS`가 기존 필드·키·직렬화를 한 곳에서 관리한다. 구매는 사본에서 계산한 변경값을 `db.commitChanges`로 저장하고 성공 후 메모리에 적용한다. 스토리 비용/보상에는 관련 이벤트 키도 함께 넘긴다. `gameStorage.setBatch`는 변경 전 값을 읽고 쓰기 실패 시 역순으로 복원한다. 진행도·경로·왕관과 초기화도 같은 경계를 사용한다. 강제 종료나 복원 자체가 차단된 저장소까지 완전한 원자성을 보장하지는 않는다.

배틀 지연 작업은 `game.later`, 종료는 `game.stop`으로 처리해 이전 판의 콜백을 취소한다.
전투 뷰는 문제 버전과 별도의 공격 버전으로 늦은 입력/이펙트/정리 콜백을 차단한다.
공격 프로필은 무기 형태·주속성·보조속성·콤보를 분리한다. 효과는 720ms 안에 정리하고 다음 문제 전환은 800ms다.
발음 요청도 취소/늦은 오류를 분리해 이전 단어의 원격 폴백을 막는다.
낙하전은 세션 세대로 늦은 프레임을 차단하고, 렌더러가 단어·공격 효과·정리 타이머를 종료 시 제거한다.
발음 플레이어는 완료·실패·취소 때 음악 잠금을 해제한다. 발음 중 음악 ON/곡 변경도 완료 후 재생하며,
완료된 요청의 늦은 오류는 원격 TTS를 시작하지 않는다.

제한 시간은 `performance.now()` 기반 마감 시각으로 계산한다. interval은 표시 갱신용이다.
클릭/스킬에서도 마감을 검사하므로 백그라운드 지연이 시간 제한을 늘리지 않는다.
낙하전도 같은 주입 시계로 실제 경과 시간을 측정하고 선택/정답 제출 직전에 마감을 검사한다.
총공세의 입력과 rAF는 같은 시간·낙하 갱신을 사용해 프레임 재개 전의 입력도 도착선을 판정한다. 정지 사용 여부는 정지 타임스탬프와 별도로 보관하며, 정지 시간은 최대 3초만 합산한다.
퀘스트의 24시간 회상은 새로고침 후에도 유지해야 하므로 저장된 `Date.now()` 시각을 사용한다.

## CSS 순서와 이미지

스타일 폴더 이동은 책임을 구분하기 위한 것이며 HTML의 적용 순서를 바꾸지 않았다.
공통/화면 기본 규칙 다음에 아래 테마 순서가 적용된다.

1. `theme/fantasy-theme.css`: 공통 테마·로고·장소·스킨.
2. `theme/guild-gameplay.css`: 게임 프레임·로비/게임 배치와 세부 대응.
3. `theme/image-components.css`: 독립 이미지 부품과 아이콘.
4. `theme/approved-menus.css`: 승인된 메뉴·최종 버튼 재질·상단 조작·가독성.
5. `theme/weapon-effects.css`: 무기별 모션과 공격/방패 효과·reduced motion.

이 파일들은 앞선 규칙을 덮어쓰는 구조다. 이름만 보고 순서를 재정렬하지 않는다.
추가 변경은 해당 화면/컴포넌트의 기존 규칙에 반영하고 끝없는 override 블록 누적을 피한다.
전체 cascade 통합은 이번 정리 범위에 포함하지 않았다.

부품 이미지는 nine-slice로 모서리를 유지하며 배치·텍스트·값은 HTML이 소유한다.
시안과 원본 생성 이미지에 대한 설명은 [디자인 에셋](design-assets.md)을 따른다.
CSS의 이미지 상대 경로는 `../../images/`이며 빌드가 버전을 붙인다.
전투 배경은 `#battle-mode-game::before`가 상단 헤더와 arena 높이를 덮는 한 장으로 그린다.
`--battle-scene-height`는 기본/compact arena 높이와 맞춰야 하므로 arena 크기 정책을 바꿀 때 함께 확인한다.
헤더는 대비를 위한 반투명 음영, arena는 투명 배경이며 내용과 이펙트의 기존 위치/클리핑은 유지한다.

## 화면·팝업·전체화면

`layout-manager.js`는 너비 `min(innerWidth, lockedAppHeight × 3/4)`로 세로 프레임을 계산한다.
로비/연습/배틀에 같은 크기를 적용한다. 주소창·회전·전체화면 변화 시 현재 보이는 높이를 다시 측정해
하단 조작이 화면 밖으로 밀리지 않게 한다. 키보드 입력 중 높이 변화는 제외한다.

일반 화면의 레이어는 CSS layer 변수로 관리한다. native `<dialog>.showModal()`은 top layer이며 배경 inert와 포커스 복원을 제공한다.
`modal-manager`가 root dialog 열기/닫기, `navigation`이 history/popstate를 담당한다.
설정의 암호/인쇄/골드 편집은 같은 dialog 내부 패널이다.
전체화면 버튼은 가장 위 열린 dialog 또는 body로 옮겨 항상 접근 가능하게 하고 게임 프레임 우상단 위치를 유지한다.
전체화면 진입/종료 시 열린 dialog를 잠시 닫은 뒤 같은 순서로 다시 top layer에 올린다. 전환 거부 시에도 복원하며 DOM 입력·스크롤·navigation 이력은 그대로 유지한다.
Escape/모바일 뒤로 가기는 기존 닫기 흐름을 쓴다.

## 컨벤션

- Prettier: 4칸·JS single quote·semicolon·print width 100·LF. YAML은 2칸. `.editorconfig`와 `.gitattributes`도 적용한다.
- JS camelCase, 변경하지 않는 정책 묶음/에셋 배열 UPPER_SNAKE_CASE. 파일·HTML ID·CSS class·data-action은 kebab-case.
- 기존 데이터의 `rawData_1`, 음악 파일의 `background_music_1.mp3`, 아이템/저장 ID는 호환 계약으로 유지한다.
- 재할당이 없으면 const, 필요할 때 let. 의미 있는 정책 값은 config에 두되 모든 CSS 값/인덱스를 상수화하지 않는다.
- Node 도구는 `require('node:fs')`처럼 표준 모듈 prefix를 사용한다.
- 문자열은 textContent를 우선 사용하고 HTML 템플릿 데이터는 escapeHTML로 처리한다. 인라인 이벤트 속성을 넣지 않는다.
- helper는 여러 기능이 공유하는 작은 함수만 둔다. 기능별 규칙은 소유 모듈에 둔다.

## 데이터 관리 도구

`node tools/check-decoy.js [1|2|3]`는 오답 후보에 미등록된 단어를 조회한다.
`sync-decoy-with-gamedata.js`와 `expand-small-groups.js`는 `data/decoy-words-set.js`를 실제로 다시 쓴다.
단순 환경 설정/검증 중에는 실행하지 않는다. 데이터를 수정하는 작업에서 필요할 때만 실행하고 diff를 검토한다.
단어장 원본은 기존 JS 래핑과 ID를 유지하며 Day·영단어·뜻을 보존한다. `data-tools.test.js`가 유효성과 원문 보존을 검사한다.

## 검증과 배포

`npm run check`는 문법·등록/에셋·책임 경계·문서 링크·타입·동작 테스트·포맷을 확인한다.
strict checkJs 대상은 연습 세션/렌더러/발음이며 전체 앱 타입 검사는 아니다.
테스트용 DOM은 native dialog의 실제 레이아웃/포커스를 대체하지 않는다. 브라우저 확인 절차는 [작업 인계](handoff.md)를 따른다.

`tools/build.js`는 runtime 확장자만 `dist/`에 복사한다. CSS 이미지 → CSS → HTML 순서로 내용 해시 버전을 붙이고
`.nojekyll`과 SHA-256 `build-manifest.json`을 만든다. 소스와 script 순서를 보존하고 심볼릭 링크를 거부한다.
문서·시안·도구·테스트·npm 파일은 배포하지 않는다. 기존 dist는 안전한 저장소 내부 경로에서만 재생성한다.
`Deploy Pages`는 수동 실행이며 검증·빌드·artifact·Pages 순서다. deploy job만 pages/id-token 쓰기 권한을 가진다.
`obmaz/fantasyword`의 Pages는 Source가 GitHub Actions이며 Custom domain은 `dokdok.quest`, HTTPS 강제는 활성화 상태다.
DNS는 GitHub Pages IP를 유지한다. 기존 저장소의 Custom domain 연결은 해제했다.
