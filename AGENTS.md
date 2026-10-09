# 저장소 작업 지침

## 시작할 때

1. 이 파일 → [작업 인계](docs/handoff.md) → [사용자 요구사항](docs/user-requirements.md)를 읽는다.
2. [현행 사양](docs/spec.md), [구조·코드 규칙](docs/architecture.md), [디자인 에셋](docs/design-assets.md)에서 변경 대상의 계약을 확인한다.
3. `git status --short`, 현재 브랜치·원격 HEAD를 확인한다. 사용자 변경을 보존하고 기존 체크아웃에서 작업한다. worktree는 사용자가 요청할 때만 만든다.
4. Node.js 22 이상과 `npm ci`를 사용한다. CI는 Node.js 24다. 환경과 인증·프록시를 재사용하고 비밀 값을 출력하지 않는다.

`docs/archive/`는 과거 이력이다. 그 안의 9:16 고정 비율, 연습 모드 우선 배치, 통이미지 메뉴,
장비가 외형만 바꾼다는 설명을 현행 요구사항으로 되돌리지 않는다.

## 유지할 기준

- 차분한 초록 숲·크림색·만화풍 남자아이 모험가. 승인된 [시작 메뉴](docs/design/approved-lobby.webp)와 [내부 메뉴](docs/design/approved-menus.webp)의 느낌을 유지한다.
- 로비 모드는 스토리·붉은 도전·연습을 한 줄에 배치하고 작은 아이콘을 글자 왼쪽에 둔다. 전체 단어 도전은 도전 설정의 전투 유형으로 통합한다. 상점·장비·통계·설정은 아래 개별 버튼 이미지다.
- 생성형 이미지 부품을 실제 UI에 사용한다. 버튼·아이콘·패널을 각각 분리하고 가격·통계·문제·상태는 읽을 수 있는 HTML로 표시한다. 전체 화면을 한 장의 이미지와 클릭 좌표로 만들지 않는다.
- 게임 영역은 세로가 더 길다. 너비 `min(viewportWidth, appHeight × 3/4)`. 로비·연습·배틀 크기를 함께 맞춘다.
- 전체화면은 공통 버튼 하나를 게임 프레임 우상단에 항상 같은 위치로 표시한다. 현재 시작선 12px, 버튼 44px. native dialog를 열 때 top layer 내부로 이동시키는 동작을 유지한다.
- 밝은 입력칸·select/option은 어두운 글자, 어두운 패널은 밝은 글자. 음악은 실제 재생 상태에 따라 ON/OFF와 OFF 사선을 표시한다.
- 캐릭터·양손/양발 슬롯·보기 글자·콤보·골드·상단 조작의 정렬과 여백을 확인한다. 골드는 실제 자릿수에 맞춰 영역을 늘리며 0·5자리·6자리 이상을 검증한다. 저장 값을 임의로 99,999에 제한하지 않는다.

## 코드와 저장 계약

- Prettier와 `.editorconfig`를 따른다. 4칸, JS single quote·semicolon, LF, print width 100. JS camelCase, 정책 묶음 UPPER_SNAKE_CASE, 파일·HTML ID·CSS class는 kebab-case.
- `index.html`의 classic script 로드 순서와 CSS cascade 순서를 유지한다. file 실행을 지원하므로 ES modules/번들 전환은 별도 배포 정책 변경이다.
- `domain/`은 순수 규칙, `game/`은 주입받은 서비스로 세션 진행, `ui/`는 DOM 표현, `app.js`는 의존성 조립을 담당한다.
- `gameStorage`만 localStorage를 접근한다. `v7_*`, `book-ID` 저장 형식·아이템 ID·기존 화면 ID를 바꾸려면 마이그레이션과 동작 테스트가 필요하다.
- 늦은 타이머·발음·이펙트 콜백이 다음 문제나 다음 판에 영향을 주지 않게 한다. 무기 형태와 오른손/왼손 속성을 독립적으로 처리하고 reduced motion을 유지한다.
- 문구는 textContent를 우선 사용하고 HTML 템플릿 데이터는 escapeHTML로 처리한다. inline 이벤트 속성을 추가하지 않는다.
- 새 파일은 소유 폴더에 둔다. 이미지가 미사용인지 판단할 때 JS의 동적 경로도 확인한다. 시안은 `docs/design/`, 작업용 PNG·스크린샷·로그는 저장소 밖 또는 무시된 경로에 둔다.

## 검증과 마무리

- `npm run check`와 `npm run build`를 통과시킨다. 테스트 수와 실패/스킵은 실제 결과로 보고한다.
- UI나 에셋/경로를 변경했다면 실제 브라우저에서 390×844, 320×427, 768×1024, 844×390을 확인한다. 넘침, dialog, 전체화면 위치, 글자 대비, 캐릭터·슬롯 정렬, 음악 선택을 확인한다.
- 전투 변경은 실제 정답/오답·보상·방패 재시도·문제 전환·나가기와 효과 정리를 검증한다. 학습/저장 규칙 변경은 의미 있는 기존 테스트를 확장한다.
- README와 관련 현행 문서를 갱신한다. 임시 작업 기록을 현행 사양에 섞지 않는다.
- Git 작성자·커미터 이름은 `obmaz`, 이메일은 `zambobmaz@gmail.com`을 사용한다. 커밋 전 저장소 로컬 `user.name`과 `user.email`을 확인하고 이 값으로 설정한다. 실명이나 다른 이메일을 새 커밋에 넣지 않는다. 기존 이력 재작성은 별도 명시 요청이 있을 때만 한다.
- 푸시·배포는 해당 작업에서 사용자 요청이 있으면 수행한다. `obmaz/fantasyword`의 Pages가 `dokdok.quest`를 서비스한다. `git push origin HEAD:main` → 해당 HEAD의 `Validate` 성공 확인 → `gh workflow run pages.yml --repo obmaz/fantasyword --ref main` 순서다. `Deploy Pages`는 수동 실행이며 해당 HEAD의 배포 성공과 [실서비스](https://dokdok.quest/) 내용 해시를 확인한다.
- 체크아웃 브랜치명이 `work`일 수 있으므로 이름을 가정하지 않는다. 원격이 앞섰다면 변경을 확인하고 정상적으로 통합한다. 강제 푸시는 별도 요청 없이 하지 않는다.
- 배포 완료는 워크플로와 실제 서비스로 확인한 뒤 보고한다. `dist/`는 커밋하지 않는다. 문서·시안·도구·테스트·npm 파일은 배포하지 않는다.
