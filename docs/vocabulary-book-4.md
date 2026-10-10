# 단어장 4 출처와 범위

`data/game-data-4.js`는 **능률보카 고등 기본 (2025개정)** 단어장이다.
첨부된 `[Vocab Test #2 - 1강씩]` 전체모음 ZIP의 Day 1~40 PDF 정답표에서 **1,595개 항목**을 읽었다.
Day 26은 원본에 35개, 나머지는 각 40개다. 먼저 제공한 Day 1·2의 80개 항목을 유지하고 Day 3~40의 1,515개를 추가했다.

원래 순서·영단어·뜻을 보존하며 PDF의 줄바꿈으로 끊긴 한국어 단어는 이어 붙였다.
파생어와 구동사도 개별 출제 항목이다. 서로 다른 Day에 반복되는 단어도 보존하므로 고유 영단어는 1,538개다.
게임·연습·인쇄 범위 선택에는 40개 Day가 모두 포함된다.

## 뜻풀이 출처

- 영어: [Oxford Learner’s Dictionaries](https://www.oxfordlearnersdictionaries.com/).
- 한국어: 정부 기관 국립국어원의 [표준국어대사전](https://stdict.korean.go.kr/).

각 항목의 `explanationSources.english`, `explanationSources.korean`에 확인한 사전 항목 URL을,
`koreanHeadword`에 선택한 국문 표제어와 동음이의어 번호를 기록했다.
풀이 문장은 사전의 해당 의미를 학습용으로 짧게 정리한 설명이다. 긴 풀이와 영어 정답을 포함한 설명은 재서술했다.
복수 의미 중 대표 의미를 풀이하므로 첨부 정답표의 모든 품사를 한 문장에 나열하지 않는다.
영어 풀이는 정답 단어를 그대로 노출하지 않으며 새 항목은 30단어 이하, 한국어 풀이는 140자 이하로 제한했다.

국문 사전의 영어 번역 항목을 사용한 것이 아니라 대응되는 한국어 표제어를 확인했다.
예를 들어 reputation은 `평판3`, value/worth는 `가치4`, carry out은 `수행하다2`에 연결한다.
institution은 조직을 뜻하는 `기관11`, outcome은 `결과2`의 결말 의미, species는 `종9`의 생물 분류 의미를 사용한다.
principal/prime은 인명 ‘주요한’ 대신 `주요하다`의 의미를 바탕으로 설명한다.
가치1(개비), 평판의 다른 동음이의어, 불교의 수행 등은 사용하지 않는다.

`decade`는 `년2`의 단위를 바탕으로 열 해라는 수량을 설명한다.
구동사와 파생어, 품사가 다른 대응 표제어는 그 의미를 바탕으로 표현을 구성한다.
Oxford에서 기본형을 참고해 파생어 풀이를 구성한 경우 `englishBasis`도 기록한다.
`behavior`, `enroll`, `enrollment`, `counselor` 등은 첨부의 미국식 철자를 유지하며 Oxford의 영국식 항목을 연결한다.

## 오답 후보

전체 항목 각각에 철자·발음이 비슷한 실제 단어 또는 구동사 후보를 세 개 이상 연결했다.
기존 Day 1·2의 80개 그룹에 이어 Day 3~40에서 부족한 후보를 497개 그룹으로 보완했다.
공유 `data/decoy-words-set.js`에 추가하므로 기존 단어장에서도 같은 단어에 활용할 수 있다.
자동 추천 후보에서 잘린 어근·오타를 제외하고 완전한 단어로 보완했다.

예를 들어 value/valve/vague/venue, reputation/repetition/reparation/representation,
carry out/carry on/carry over/carry off, editor/edition/auditor/creditor를 포함한다.
영어 선택지가 필요한 문제에서 기존 출제 규칙이 이 후보를 우선 사용하고 부족하면 단어장에서 보충한다.
한국어 뜻 선택지는 기존 단어장의 뜻 풀을 사용한다.
