# 디자인 에셋

사용자 디자인 의도는 [요구사항](user-requirements.md), 화면 동작·수치는 [사양](spec.md)에서 관리한다.
이 문서는 승인 참고 이미지와 실제 부품·제작 방법을 안내한다.

## 승인 참고 이미지

| 파일                                                                                       | 용도                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| [시작 메뉴](design/approved-lobby.webp)                                                    | 초록 숲·남자아이·버튼 재질 기준                   |
| [내부 메뉴](design/approved-menus.webp)                                                    | 상점·장비·통계·설정의 재질과 톤                   |
| [영어 키보드](design/approved-english-keyboard.webp)                                       | 주관식 캐릭터·문제판·키·공격 버튼                 |
| [파비콘 원본](design/favicon.webp)                                                         | 숲색 타일·책·금색 왕관                            |
| [지도 초안](design/story-map-draft.webp)                                                   | 지도 제작 참고; 현행 배경·경로는 아래 런타임 사용 |
| [초기 길드](design/guild-lobby-concept.webp), [메뉴 탐색](design/quest-menu-concepts.webp) | 제작 참고; 현재 메뉴 배치의 기준은 아님           |

시안의 예시 숫자·가격·슬롯·뒤로 버튼을 실제 계약으로 해석하지 않는다.
현행 로비는 스토리·도전·연습 한 줄과 하단 개별 메뉴다.
옛 프롬프트·변경 과정은 Git 이력에서 확인한다. 새 제작은 승인 WebP와 아래 기준으로 이어간다.

## 런타임 이미지

아래 경로는 `images/theme/` 기준이다.

| 파일/패턴                                                         | 실제 역할                                                   |
| ----------------------------------------------------------------- | ----------------------------------------------------------- |
| `quest-lobby-{forest,sunset,moonlight}.webp`                      | 랜덤 로비 배경                                              |
| `guild-titles.webp`                                               | 여섯 타이틀의 2×3 atlas                                     |
| `parts/menu-*.webp`, `ui-*.webp`, `calm-*.webp`                   | 모드·메뉴·기능별 독립 아이콘/부품                           |
| `parts/game-action.webp`, `game-danger.webp`, `game-control.webp` | 일반·도전/위험·하단 메뉴와 공통 조작 재질                   |
| `parts/confirm-cancel.webp`, `confirm-execute.webp`               | 회색 취소·밝고 차분한 파란 실행; 경고는 game-danger         |
| `parts/proverb-blank.webp`                                        | 생성한 초록색·금색 테두리의 둥근 사각형 속담 빈칸           |
| `parts/approved-*.webp`, `surface-*.webp`                         | 메뉴 프레임·양피지·입력·슬롯·코인·기본 재질                 |
| `parts/revenge-icon.webp`                                         | 검·회전 화살표 복수 아이콘; 이름은 HTML                     |
| `parts/quest-{hero,dragon,key,delete,paper,attack}.webp`          | 주관식 장면/키보드 부품; 장비 몸 그림은 아래 전용 파일 사용 |
| `parts/monster-*.webp`, `item-*.webp`, `weapon-*.webp`            | 몬스터·상점/장비·착용 부품                                  |
| `parts/combat-{basic,fire,ice,lightning,void,gold}.webp`          | 투명 공격 효과 여섯 종류                                    |
| `skyfall-field.webp`                                              | 총공세 탑뷰 숲 공터                                         |
| `story-map-background.webp`                                       | 들판·강/호수·협곡·설산·화산; 실제 길/지점은 SVG/HTML        |
| `story-map.webp`                                                  | 예전 길/아이콘 포함 지도 참고 이미지                        |
| `hangman-stage.webp`                                              | 칠판·목조 무대; 그림·단어·키보드는 별도 UI                  |
| `shell-tavern.webp`, `parts/shell-cup.webp`                       | 초록 테이블 도박장과 독립 컵; 주사위/이동은 DOM             |
| `proverb-study.webp`, `idiom-study.webp`                          | 낮의 서당·달빛 서예방; 문제판/하단 보기는 별도 UI           |

단어 대장간은 길드 공터를 사용한다. 속담·사자성어에 아이템 두루마리를 배경으로 확대하지 않는다.
`data-confirm-tone`이 취소/실행/경고 이미지를 고르며 글자·동작·비활성화는 HTML이 처리한다.
영어·사자성어·속담·대장간의 `answer-choice`는 `shared-ui.css`에서 동일한 game-action/confirm-execute/game-danger 이미지와 크기를 공유한다.
총공세 보기는 이 공통 크기에서 제외한다. 속담 빈칸은 이미지 테두리 안에 HTML 정답을 표시하며 문제판을 확대하지 않는다.
예전 글자가 포함된 메뉴 이미지와 기본 재질도 cascade에 참조가 남을 수 있으므로 이름만 보고 삭제하지 않는다.
`images/battle/`는 기존 모험가/몬스터 sprite다. JS 동적 경로와 CSS/HTML 직접 참조를 함께 확인한다.

파비콘은 루트 `favicon.ico`(16·32·48·64px), `images/icons/favicon-32.png`,
`images/icons/apple-touch-icon.png`(180px)다. 빌드가 복사·내용 버전을 붙인다.
PWA의 `images/icons/app-{192,512}.png`는 같은 승인 파비콘 원본에서 만든 설치 아이콘이다.

## 착용 캐릭터

`parts/quest-hero-unarmed.webp`·`quest-hero-unarmed-helmet.webp`는 384×384 투명 몸 그림이다.
무기·방패·칼집이 없고 실제 헬름 장착 시 같은 포즈의 헬름 몸 그림으로 전환한다.
이전 몸 파일은 캐시 호환용으로 보존하며 현행 HTML은 새 파일을 사용한다.
빈 오른손에는 무기 레이어를 넣지 않는다.

`parts/avatar-equipment.webp`는 2172×724 투명 atlas다. 정사각형 세 칸 중 건틀릿·부츠를 손/발에 클립하며
헬름 칸은 착용 표시에 사용하지 않는다.
`weapon-{basic,sword,gold-dagger,midas-sword,tycoon-axe,fire,ice,lightning,void,shield}.webp`는 서로 다른 384px 투명 부품이다.
상점/슬롯·착용/공격이 같은 무기 부품을 사용한다.

장비/전투는 정사각형 몸 원점과 같은 렌더러를 공유한다.
`HELD_WEAPON_POSES`가 무기별 손잡이·크기·회전을 소유하고 `--held-hand-x/y` 마스크·건틀릿을 위에 겹친다.
오른손 중심은 (41%, 62%), 왼손은 (88.5%, 58.5%)이며 손잡이를 주먹에 맞춘다.
피격은 두 몸 그림에 적용하고 전환/종료 때 정리한다. 몸 그림의 HTML 빌드 버전 주소를 외형 갱신에서 덮어쓰지 않는다.

## 제작과 보존

- 새 부품은 승인 시안을 참조해 이미지 생성 도구로 만든다. 초록 재질·크림색 테두리·만화풍·부드러운 음영·분명한 실루엣을 유지한다.
- 배경은 차분하게, 캐릭터는 남자아이로 만든다. 컵·그림·문제 등 움직이는 UI를 장면에 미리 그리지 않는다.
- 버튼/패널에는 글자·가짜 수치·아이콘을 넣지 않고 HTML 공간을 비운다. 아이콘은 별도로 생성하고 투명 부품은 실제 알파 채널을 사용한다.
- 추출·비율 유지 축소·WebP 인코딩으로 최적화한다. 기존 부품은 대체로 바탕 최대 512px, 아이콘 128~224px, 캐릭터/효과 최대 384px다.
- quality 92~93/method 6과 lossless 추출을 사용해 왔지만 파일별 해상도·알파·표시 크기를 확인해 선택한다.
- 효과의 색/모양은 이미지, 무기별 이동은 CSS가 맡으며 reduced motion 표현도 제공한다.
- 시안은 `docs/design/`, 작업용 PNG·스크린샷·로그는 저장소 밖 또는 무시된 경로에 둔다. 생성 PNG 전체가 Git에 있다고 가정하지 않는다.
- 참조를 직접/동적 경로로 검토한 뒤 미사용 이미지를 정리한다. 경로/에셋 변경은 검사·빌드·실제 브라우저 검증이 필요하다.

생성 도구의 임시 경로를 프로젝트 의존성으로 삼지 않는다.
Git에 있는 승인 시안과 런타임 WebP로 작업을 재개하고 과거 원본/삭제 파일은 Git 이력에서 복구한다.
