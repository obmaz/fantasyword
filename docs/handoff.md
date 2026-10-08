# 다음 작업을 위한 인계

2026-10-07 정리 기준. 사용자 요청은 당분간 개발을 멈추기 전에 저장소를 정리하고
나중에 AI가 코드·요구사항·배포 상태를 빠르게 이해할 수 있게 하는 것이었다.
새 기능을 자동으로 계속 만들거나 로드맵을 이미 승인된 작업으로 취급하지 않는다.

## 먼저 읽을 것

[AGENTS.md](../AGENTS.md) → [사용자 요구사항](user-requirements.md) → [현행 사양](spec.md).
구현 위치는 [아키텍처](architecture.md), 그림 기준은 [디자인 에셋](design-assets.md),
이번 정리 근거는 [리뷰](review.md)를 확인한다. `archive/`는 과거 기록이다.

## 완료된 기능과 찾아갈 코드

| 주제                    | 시작 파일                                                                                           | 테스트                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 몬스터별 문제           | `scripts/domain/monster-encounters.js`, `data/battle-examples.js`                                   | `monster-encounters.test.js`                                     |
| 오답 재도전·24시간 회상 | `scripts/domain/revenge-rules.js`, `scripts/features/revenge-quests.js`                             | `revenge-quests.test.js`                                         |
| 장비의 학습/전투 역할   | `scripts/domain/equipment-rules.js`, `scripts/data/items-loader.js`                                 | `equipment-roles.test.js`, `inventory.test.js`                   |
| 무기별 모션·보조 속성   | `scripts/domain/attack-profiles.js`, `scripts/ui/battle-view.js`, `styles/theme/weapon-effects.css` | `weapon-effects.test.js`                                         |
| 채점·보상·진행          | `scripts/domain/battle-rules.js`, `scripts/game/game-engine.js`                                     | `game-engine.test.js`, `regressions.test.js`                     |
| 연습·발음               | `scripts/game/practice-session.js`, `scripts/features/speech.js`, `scripts/ui/practice-view.js`     | `practice-session.test.js`, `speech-fallback.test.js`            |
| 저장/복원               | `scripts/core/database.js`, `scripts/core/storage.js`                                               | `inventory.test.js`, `smoke-load.test.js`, `regressions.test.js` |
| 비율·전체화면·화면 전환 | `scripts/ui/layout-manager.js`, `scripts/ui/modal-manager.js`, `scripts/ui/navigation.js`           | `design-improvements.test.js`, `navigation-practice.test.js`     |
| 최종 메뉴/버튼 디자인   | `styles/theme/approved-menus.css`, `styles/theme/image-components.css`                              | 실제 브라우저 확인                                               |

테스트 파일은 `tests/` 아래에 있다. 세션/뷰 연결은 `scripts/app.js`, DOM 이벤트는 `scripts/init.js`에서 찾는다.
몬스터 방식·퀘스트·장비 역할·무기 모션은 이미 구현되었으므로 다시 계획 단계로 돌아가지 않는다.

## 새 환경에서 재개

1. 현재 브랜치, `git status --short`, remote를 확인하고 사용자 변경을 보존한다. 이전 임시 경로/프로세스가 살아 있다고 가정하지 않는다.
2. Node.js 22 이상인지 확인하고 `npm ci`를 실행한다. npm lockfile을 유지한다.
3. `npm run check`, `npm run build`로 기준 상태를 확인한다.
4. 저장소 루트에서 `python3 -m http.server 8000 --directory dist`로 새 정적 서버를 시작한다. Python은 개발 편의 도구이며 배포 의존성은 아니다.
5. 브라우저 자동화 도구가 환경에 있으면 재사용하고, 없다면 이용 가능한 실제 브라우저로 확인한다. `/workspace/.browser-tools`, `/tmp`의 이전 검사 스크립트는 저장소 의존성이 아니다.
6. 인증은 환경의 HTTPS Git 프록시를 재사용한다. 변수에 토큰이 안 보여도 `git ls-remote origin HEAD`로 실제 읽기를 먼저 확인한다. 비밀 값 출력이나 임의 로그인 설정을 하지 않는다.

## 브라우저 검증 목록

- 390×844 긴 폰, 320×427 작은 3:4 화면, 768×1024 큰 3:4 화면, 844×390 가로 뷰포트에서 가운데 세로 프레임 확인.
- 로비 → 배틀/연습 선택 → 실제 게임 → 결과 → 마을. 상점·장비·통계·설정·복수 목록도 열어 본다.
- 글자 대비, select/option 20곡, 번호 없는 답안 글자 중앙, 제목/5자리 골드/상단 조작의 여백과 넘침 확인.
- 전체화면 공통 버튼의 모서리·프레임 우상단 위치·팝업 내부 동작 확인. 지원하지 않는 브라우저의 안내도 유지.
- 연습 화면은 뜻·설명을 바로 표시하고 회상 안내/뜻 확인 버튼이 없는지, 긴 내용 스크롤이 게임 프레임 안에 머무는지, 필터·발음·이동 버튼 이미지 재질이 같은지 확인.
- 짧은 화면의 남자아이, 양손/양발 행, 실제 장착 선택/외형/설명 일치 확인.
- 슬라임 뜻·고블린 조립·박쥐 듣기/실패 폴백·드래곤 입력, 정답/오답/타임아웃과 결과 확인.
- 무기 형태/속성/보조 속성·방패 가드가 구별되고 reduced motion에서 이동이 줄어드는지 확인.
- 다음 문제·나가기 후 효과/음성이 남지 않고 저장/복습/퀘스트/보상이 중복 처리되지 않는지 확인.

단위 테스트용 가짜 DOM은 실제 렌더링/포커스를 검증하지 않는다. 경로 변경도 브라우저 에셋 로딩 확인이 필요하다.

## 푸시·배포 절차

해당 작업에서 사용자가 요청한 경우 검증 후 수행한다. 작성자·커미터 이름은 `obmaz`, 이메일은 `zambobmaz@gmail.com`으로 유지한다. 커밋 전 저장소 로컬 Git 설정을 확인한다.
현재 저장소는 `obmaz/fantasyword`, 작업 경로는 `/workspace/fantasyword`다. 새 Git 이력은 `init` 하나로 시작한다.
브랜치 이름을 확인하며 초기 브랜치는 `main`이다.

```sh
git push origin HEAD:main
```

새 저장소는 `Validate`가 push 시 실행되고 `Deploy Pages`는 수동 실행이다.
`dokdok.quest`는 이 저장소의 Pages에 연결됐고 HTTPS 인증서와 강제 설정이 적용돼 있다.
기존 저장소의 Custom domain은 해제했으며 DNS는 GitHub Pages IP를 그대로 사용한다.
`Validate` 성공 후 `gh workflow run pages.yml --repo obmaz/fantasyword --ref main`으로 배포한다.
GitHub의 `Validate`, `Deploy Pages`를 **방금 푸시한 전체 HEAD SHA** 기준으로 확인한다.
두 workflow가 성공해도 공개 페이지가 이전 버전일 수 있으므로 `https://dokdok.quest/build-manifest.json`을
로컬 `dist/build-manifest.json`과 비교하고 변경된 HTML/CSS/JS/이미지 응답의 SHA-256을 검사한다.
HTTP 캐시 확인에는 현재 커밋을 쿼리로 붙일 수 있다. TLS 검증·환경 프록시는 유지한다.
실패했다면 새 배포를 완료했다고 보고하지 않고 실패 단계와 마지막 정상 배포를 구분한다.

이전 커밋과 Git 메타데이터는 새 저장소로 가져오지 않았다. 최신 전투 상단/골드 배치까지 포함한 현재 코드 스냅샷이다.
재개 시 Git 원격과 workflow를 다시 읽는다.
현재 배포의 정확한 SHA는 Git 이력과 Actions에서 확인한다.

## 남은 제약과 선택 가능한 후속 작업

다음은 제약이며 이번 요청에서 추가 구현을 승인한 목록이 아니다.

- 일부 상점/설정/통계 서비스의 전역 결합과 큰 CSS cascade가 남아 있다. 폴더는 정리했지만 전면 재설계하지 않았다.
- strict 타입 검사는 연습/발음 경로만 대상으로 한다. 전체 TypeScript/ES modules 전환은 별도 결정이다.
- 모든 단어에 검토된 예문이 있지는 않다. 드래곤의 뜻 풀이 폴백을 유지한다.
- 복수 퀘스트는 24시간 회상 1회다. 전체 단어 장기 간격 반복·숙련도 모델·계정 동기화는 없다.
- 발음 품질·오프라인 재생은 브라우저 설치 음성에 의존하고 원격 TTS는 서비스 가용성에 의존한다.
- 장비 손 슬롯·보상·복수 상태·기존 저장 키는 계약이다. 확장할 때 마이그레이션과 의미 있는 테스트가 필요하다.
- 생성 PNG 원본 전체는 현재 환경에만 있을 수 있다. Git의 승인 시안과 WebP만으로도 이어갈 수 있게 한다.
