# 구조와 코드 규칙

## 실행과 책임

원본은 classic script를 순서대로 로드하는 정적 앱이다. `index.html`이 JS/CSS 로드 순서를 소유한다.
단어장은 JS 변수로 제공해 fetch/CORS 없이 원본과 dist를 직접 열 수 있다.
ES modules·프레임워크·번들 전환은 실행/배포 계약을 바꾸는 별도 결정이다.

| 위치                              | 책임                                                           |
| --------------------------------- | -------------------------------------------------------------- |
| `scripts/app.js`                  | 세션·뷰·저장소·시계·타이머·음성·난수 서비스 조립               |
| `scripts/init.js`                 | 초기화와 DOM 이벤트 등록                                       |
| `scripts/config.js`               | 제한 시간·음악·전환 정책                                       |
| `scripts/core/`                   | 저장소 접근, 검증·정규화·마이그레이션·영속화                   |
| `scripts/data/`                   | 단어장/아이템 로딩·인덱스·장착 가능 손 규칙                    |
| `scripts/domain/`                 | DOM 없는 출제·채점·보상·몬스터·지도·퍼즐·퀘스트·장비·공격 규칙 |
| `scripts/game/`                   | 주입받은 서비스로 배틀·연습·총공세·야바위·퍼즐 진행            |
| `scripts/features/`               | 상점·장착·설정·통계·음성·스토리·인쇄·퀘스트 UI 서비스          |
| `scripts/ui/`                     | 모델과 콜백을 받아 DOM 표현·모달·이동·레이아웃 처리            |
| `scripts/utils/`                  | 여러 기능이 공유하는 작은 helper·디버그                        |
| `styles/base/`                    | 변수·애니메이션·버튼·모달·알림                                 |
| `styles/screens/`                 | 화면별 배치                                                    |
| `styles/theme/`                   | 공통 이미지 재질·최종 메뉴/게임 표현·무기 효과                 |
| `data/`                           | 단어장·아이템·예문·유사 오답·퍼즐·MP3                          |
| `images/battle/`, `images/theme/` | 런타임 이미지; `theme/parts/`는 독립 부품                      |
| `types/`, `tools/`, `tests/`      | 타입 계약·빌드/검증/데이터 도구·동작 테스트                    |
| `docs/`, `docs/design/`           | 현행 문서·디자인 참고; 배포 제외                               |

`manifest.webmanifest`와 루트 `sw.js`는 PWA 설치·오프라인을 담당한다.
`features/app-install.js`는 설치 이벤트와 Safari 안내를 처리하고 `init.js`에서 초기화한다.
빌드는 워커의 앱 버전과 음악을 제외한 사전 저장 목록을 주입한다. 워커는 저장 데이터에 접근하지 않는다.
`features/haptics.js`는 저장된 ON/OFF·길이를 읽는 공통 오답 진동 서비스다.
`features/sound-effects.js`는 사용자 입력 후 지연 생성하는 AudioContext와 제한된 음원 풀을 소유한다.
화면별 채널 취소·설정 OFF·문서 비활성화를 처리하며 UI나 세션은 `play/stop`만 호출한다.
`ui/game-presentation.js`는 저장 성공 후 획득 알림·장착 강조·결과 캐릭터·일회성 지도 해금 연출을 소유한다.
복제 캐릭터의 ID는 제거하며 화면 전환 시 타이머·알림을 정리한다. 저장 데이터나 지급 규칙을 변경하지 않는다.
`config.js`의 `EQUIPMENT_CONFIG`는 장비 수치, `HAPTICS_CONFIG`는 진동 기본값·선택지,
`PRESENTATION_CONFIG`는 등장·반격·보상 길이, 파티클·동시 음원 상한을 소유한다.
아이템 데이터·마이그레이션·보상·설정·HUD는 같은 정책을 참조한다. 독립 도메인 테스트도 이 설정을 먼저 로드한다.
`app.js`가 게임 세션의 오답 콜백에 주입하며, 진동 API 오류는 게임 진행에 전파하지 않는다.

`domain/`은 값과 함수만 입력받고 `game/`은 브라우저 전역을 직접 조회하지 않는다.
뷰는 `game`/`db`를 직접 조회하지 않는다. 실제 난수는 `app.js`에서 공급하고 테스트는 결정적인 함수를 주입한다.
상점·설정·통계 등 일부 주변 서비스는 전역 API를 사용한다.
`init.js`는 DOM 준비 시 조작을 한 번만 등록한다. 이미지 로드 뒤의 `load` 폴백은 초기화를 반복하지 않는다.
설치 이벤트는 먼저 연결하고 서비스 워커 등록·오프라인 사전 저장은 첫 화면 `load` 뒤에 시작해 초기 다운로드와의 경쟁을 줄인다.
게임 시작 예약은 `APP_CONFIG.gameStartDelayMs`, 팝업 닫기 시간은 `overlayCloseMs`로 분리한다.

## 기능별 구현과 테스트

아래 경로는 `scripts/`, 테스트 파일은 `tests/` 기준이다.

| 기능           | 구현 시작점                                                                                            | 주요 테스트                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| 출제·채점·보상 | `domain/questions.js`, `domain/battle-rules.js`, `game/battle-answer.js`, `game/game-engine.js`        | `game-engine.test.js`, `regressions.test.js`, `equipment-roles.test.js`   |
| 몬스터별 문제  | `domain/monster-encounters.js`, `data/battle-examples.js`(루트 data)                                   | `monster-encounters.test.js`                                              |
| 연습·발음      | `game/practice-session.js`, `features/speech.js`, `ui/practice-view.js`                                | `practice-session.test.js`, `speech-fallback.test.js`                     |
| 복수 퀘스트    | `domain/revenge-rules.js`, `features/revenge-quests.js`                                                | `revenge-quests.test.js`                                                  |
| 장비·착용·경제 | `domain/equipment-rules.js`, `data/items-loader.js`, `features/inventory.js`, `ui/image-components.js` | `equipment-roles.test.js`, `inventory.test.js`, `economy-avatar.test.js`  |
| 무기 모션      | `domain/attack-profiles.js`, `ui/battle-view.js`                                                       | `weapon-effects.test.js`                                                  |
| 스토리·이벤트  | `domain/story-map.js`, `domain/story-progress.js`, `features/story-journey.js`                         | `story-journey.test.js`, `story-events.test.js`, `story-progress.test.js` |
| 총공세         | `game/skyfall-session.js`, `ui/skyfall-view.js`                                                        | `skyfall-session.test.js`                                                 |
| 사자성어       | `domain/idiom-rules.js`, `game/game-engine.js`                                                         | `story-events.test.js`                                                    |
| 야바위         | `game/shell-session.js`, `ui/shell-view.js`                                                            | `shell-session.test.js`                                                   |
| 속담·대장간    | `domain/story-puzzle-rules.js`, `game/story-puzzle-session.js`, `ui/story-puzzle-view.js`              | `story-puzzles.test.js`                                                   |
| 행맨           | `features/hangman.js`, `ui/gameplay-controls.js`                                                       | `hangman.test.js`                                                         |
| 문제지         | `domain/worksheet-rules.js`, `features/worksheet.js`                                                   | `worksheet.test.js`                                                       |
| 저장·초기화    | `core/storage.js`, `core/database.js`, `features/settings.js`                                          | `smoke-load.test.js`, `full-reset.test.js`                                |
| 메뉴·전체화면  | `ui/layout-manager.js`, `modal-manager.js`, `navigation.js`                                            | `design-improvements.test.js`, `navigation-practice.test.js`              |
| 어드민 해금    | `features/settings.js`                                                                                 | `admin-games.test.js`, `progression-settings.test.js`                     |

과거 결함의 동작 검증은 `review-regressions.test.js`, `review-2026-10-09.test.js`에도 유지한다.
리뷰 문서 정리는 회귀 테스트 삭제의 근거가 아니다.

## 상태·저장·비동기

`database.js`의 `DB_STORAGE_FIELDS`가 필드·키·직렬화를 관리하고 `gameStorage`만 localStorage에 접근한다.
설정·외움·장착/해제·통계·구매·이벤트는 사본에서 계산한 변경을 `db.commitChanges`로 저장한 뒤 메모리에 적용한다.
`db.grantGold`는 정답 골드·아이템 소모·복수 완료 기록을 함께 저장한다.
복수 서비스의 `prepareSuccess`는 변경 계획만 반환하며 실제 지급 성공 뒤에 목록을 갱신한다.
스킬 저장이 실패하면 보기 제거·즉시 정답을 실행하지 않는다. 실패한 보상은 획득 합계에 포함하지 않는다.
단순 출제 선택은 변경된 선택 키만 저장하며 게임 데이터 전체를 다시 직렬화하지 않는다.
`gameStorage.setBatch`는 변경 전 값을 보관하고 실패 시 역순 복원한다.
진행/왕관·지급·초기화도 같은 경계를 쓰며 강제 종료나 복원 차단까지 원자성을 보장하지 않는다.
스토리 전투 완료가 저장되지 않으면 결과 모달과 지도에서 같은 완료 결과를 재시도하고, 재시도 전까지 다른 지점을 선택할 수 없다.
저장 형식은 [사양의 저장 계약](spec.md#저장-계약과-제약)을 따른다.

배틀 예약은 `game.later`, 취소는 `game.stop`을 사용한다.
문제/공격 버전과 세션 세대로 이전 보기·프레임·음성·효과·저장 재시도가 다음 상태에 적용되지 않게 한다.
발음 완료/실패/취소는 음악 잠금을 해제하고 완료된 요청의 늦은 오류는 원격 폴백을 시작하지 않는다.
전투/총공세 시간은 주입된 `performance.now()` 기반 마감 시각이며 interval/rAF는 표시·진행 갱신용이다.
입력 직전에도 마감·낙하를 검사한다. 퀘스트의 회상 시각은 재시작 후 유지되는 `Date.now()`다.

`story-map.js`는 종류·출제 수·왕관·연결·비전투 연속 금지·배치 검증·중복 없는 Day 배정을 소유한다.
`routeWidths`의 세 단계별 지점 수 구조와 `layoutIndex`로 기존 저장 배열을 식별한다.
`regenerate(shuffle, previousRows)`는 다음 구조를 선택하고 이벤트를 섞으며 입력 배열은 수정하지 않는다.
초기화·최종 클리어는 다음 배치와 초기 진행을 함께 저장한다. 실패·재진입·새로고침은 구조 순서를 바꾸지 않는다.
연결은 공개된 ? 결과가 아닌 원래 종류로 계산한다.
`storyJourney.selection`은 확인 전 임시 선택이며 확인 후에만 Day와 이벤트를 저장한다.
지도 렌더링은 layout·stage·path·events를 한 번씩 읽은 사본으로 연결과 선택 가능 상태를 계산한다.
다시 열 때는 새로 읽으므로 진행·초기화·단어장 변경 결과를 즉시 반영한다.
미니보스의 `type: spelling`, `monsterId: dragon`은 출제 방식과 외형을 분리하고 진행 중인 지점에만 적용한다.
스토리 총공세는 시작 옵션과 종료/복귀 콜백으로 연결해 일반 Day 전체 출제를 보존한다.

사자성어는 `data/story-idioms.js`를 영어 풀과 분리한다.
문제 모델의 `kind: 'idiom'`을 뷰가 `data-question-kind`로 표현하며 헤더가 이를 별도로 덮어쓰지 않는다.
속담·대장간 데이터와 한국어 뜻은 `data/story-puzzles.js`, 이웃·최단 경로(BFS)·출제는 퍼즐 도메인이 소유한다.
뷰는 `data-phase`로 문제/풀이/결과를 표현한다.
속담은 별도 ID 접두사의 전투 장면에서 `createBattleView`의 공격·피격·효과 초기화를 재사용한다.
화면 전환 시 효과 세대를 갱신해 이전 공격 콜백이 다음 문제나 다른 전투에 영향을 주지 않게 한다.
전투 뷰는 무기 impactMs와 같은 예약 시점에 타격음·화면 반응을 적용하고 공격 버전으로 이전 반격 정리를 차단한다.
`game-presentation.test.js`는 음향 정책·동시 음원 제한·채널 취소·보스 피격·타격 타이밍·저장 실패·지도 진행을 검증한다.
야바위는 컵 ID/자리·주사위를 세션에, 이동·선택 DOM은 뷰에 둔다.
스토리 퍼즐/야바위 지급은 결과 콜백으로만 저장한다. 어드민은 실제 지급 콜백을 주입하지 않는다.

`equipmentRules.appearance` → `renderEquipmentAvatar`를 장비/전투가 공유한다.
`ui.updateVisuals`는 장갑 소모·해제·교체를 갱신하며 시각화에 기본 무기 fallback을 넣지 않는다.
같은 무기의 레이어 DOM은 재사용한다. `ui.updateSkills`는 장면의 콤보 값과 장비·스킬 표시를 갱신하며 중복 콤보 태그를 만들지 않는다.
상점·장비 목록의 `refresh`는 열린 목록만 재생성한다. 닫힌 장비 화면은 용량·아바타·스킬만 갱신하고, 열 때 최신 목록을 렌더링한다.
전투 능력의 `equipmentRules.load` 기본 무기와 구분한다.
무기 손잡이·회전 중심·마스크는 UI의 `HELD_WEAPON_POSES`/CSS가 소유하고 도메인 장착 규칙과 분리한다.
몸 이미지의 HTML 빌드 버전 주소를 유지하며 장비 레이어에 예전 sprite 의사 요소나 슬롯 아이콘 좌표를 적용하지 않는다.

## CSS·레이아웃·팝업

HTML의 실제 cascade를 유지한다. 공통/화면 기본 규칙 뒤에는 다음 순서가 적용된다.

1. `theme/fantasy-theme.css`
2. `theme/guild-gameplay.css`
3. `theme/image-components.css`
4. `theme/approved-menus.css`
5. `theme/weapon-effects.css`
6. `screens/skyfall-mode.css`, `hangman-mode.css`, `story-events.css`, `story-puzzles.css`
7. `theme/shared-ui.css` — 공통 보기·진행 버튼, 프롬프트 정렬, 고정된 풀이/다음 영역, 메뉴 안내 띠
8. `theme/game-presentation.css` — 전체 캐릭터·몬스터 동작, 타격 반응, 획득·승리·지도 진행과 reduced motion

이름만 보고 재정렬하지 않고 기존 소유 규칙에 변경을 반영한다. 끝없는 override 누적을 피한다.
CSS 이미지 상대 경로는 `../../images/`이며 빌드가 내용 버전을 붙인다.
공통 글자·정답·입력칸·중성 색상은 `base/variables.css`, 이미지 부품 변수는 `theme/approved-menus.css`가 소유한다.
뒤쪽 공통 보기 스타일은 같은 이미지 변수를 참조하며 별도 경로·색상 사본을 정의하지 않는다.
전투 배경은 `#battle-mode-game::before`가 헤더/arena를 함께 덮는다.
`--battle-scene-height`는 기본/compact arena 높이와 함께 확인한다.
이미지는 nine-slice로 모서리를 유지하고 배치·텍스트는 HTML이 소유한다.

`layout-manager.js`는 현재 높이와 최대 3:4 너비로 로비/연습/배틀을 함께 계산한다.
주소창·회전·전체화면 변화에는 높이를 재측정하고 키보드 입력 중 높이 변화는 제외한다.
`modal-manager`는 native dialog 열기/닫기·포커스, `navigation`은 history/popstate를 담당한다.
설정 하위 메뉴는 같은 dialog 내부 패널이다.
공통 전체화면 버튼은 가장 위 dialog 또는 body로 이동하며 프레임 우상단 위치를 유지한다.
전체화면 전환은 열린 dialog를 같은 순서로 복원하고 실패 시에도 입력·스크롤·이력을 보존한다.
상단 조작과 영어 키보드는 `ui/gameplay-controls.js`에서 모드별 종료 콜백·삭제 키 여부를 받아 공유한다.
버튼 역할은 `data-confirm-tone`으로 표시하고 기존 이미지 스킨보다 우선하는 색상 매핑 한 곳에서 처리한다.
저장 실패·묶음 보상·화면 전환은 `review-reliability.test.js`, 캐시 오류/탐색은 `service-worker.test.js`로 검증한다.

## 코드·데이터 규칙

- Prettier·EditorConfig: 4칸·JS single quote·semicolon·LF·print width 100. YAML은 2칸.
- JS camelCase, 정책 묶음 UPPER_SNAKE_CASE, 파일·HTML ID·CSS class·data-action은 kebab-case.
- 기존 `rawData_1`, `background_music_1.mp3`, 아이템/저장/화면 ID는 호환 계약으로 유지한다.
- 재할당이 없으면 const, 필요할 때 let. 정책 값은 config나 소유 도메인에 둔다.
- Node 표준 모듈은 `node:fs` 같은 prefix를 사용한다.
- 문구는 textContent 우선, HTML 템플릿 데이터는 escapeHTML. inline 이벤트 속성을 추가하지 않는다.
- 새 파일은 소유 폴더에 둔다. 작은 공유 함수 외 기능별 규칙을 utils에 쌓지 않는다.

새 단어장은 `data/game-data-N.js`를 classic script로 등록하고 데이터셋 ID/`book-ID` 기록을 유지한다.
4번 단어장의 `explanationSources`는 출처 메타데이터이며 게임 출제 필드는 기존 계약을 따른다.
`node tools/check-decoy.js [단어장 ID]`는 오답 후보 누락 조회다.
`sync-decoy-with-gamedata.js`·`expand-small-groups.js`는 공유 후보 파일을 실제 수정하므로 단순 검증 중에는 실행하지 않는다.
데이터 작업에서만 실행하고 diff·`data-tools.test.js`로 Day·단어·뜻과 원문 보존을 확인한다.

## 검증과 빌드

`npm run check`는 문법·등록/에셋·책임 경계·문서 링크·타입·동작 테스트·포맷을 검사한다.
strict checkJs는 연습 세션/뷰/발음에 적용하며 전체 앱 타입 검사는 아니다.
실제 브라우저·푸시·배포 절차는 [작업 인계](handoff.md)에서 관리한다.

`tools/build.js`는 런타임 확장자만 dist에 복사한다.
프로젝트 검사는 중복 HTML ID와 JS/CSS 중복 로드도 거부한다.
이미지 → CSS → HTML 순서로 내용 해시 버전을 붙이고 `.nojekyll`·SHA-256 `build-manifest.json`을 만든다.
소스/로드 순서는 보존하고 symlink와 외부 dist 경로를 거부한다.
문서·시안·도구·테스트·npm 파일은 배포하지 않으며 `build.test.js`가 재현성과 제외 정책을 검사한다.

스토리의 학습 지점은 미완료/완료 이벤트에 기록된 Day를 확인해 가장 낮은 미출제 Day부터 배정한다. 갈림길·이벤트 배치는 계속 무작위로 생성한다.

스토리 완료 변경 집합은 `domain/story-progress.js`에서 순수 계산하고, `features/story-journey.js`가 저장·재시도를 담당한다.

전투 세션은 출제·수명주기를 조율하고, `game/battle-answer.js`는 답변 판정 후 보상·재시도·피격 연출을 맡는다.
