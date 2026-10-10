# 단어장 4 출처와 범위

`data/game-data-4.js`는 **능률보카 고등 기본 (2025개정)** 단어장이다.
첨부된 `[Vocab Test #2 - 1강씩]` 전체모음 ZIP의 Day 1·2 PDF 정답표에서 각각 40개 항목을 읽었다.
원래 순서·영단어·뜻을 보존하며 파생어와 구동사도 개별 출제 항목이다. Day 3 이후는 아직 추가하지 않았다.

## 뜻풀이 출처

- 영어: [Oxford Learner’s Dictionaries](https://www.oxfordlearnersdictionaries.com/).
- 한국어: 정부 기관 국립국어원의 [표준국어대사전](https://stdict.korean.go.kr/).

각 항목의 `explanationSources.english`, `explanationSources.korean`에 확인한 사전 항목 URL을,
`koreanHeadword`에 선택한 국문 표제어와 동음이의어 번호를 기록했다.
풀이 문장은 해당 의미를 바탕으로 짧게 재서술한 학습 설명이며 사전 원문을 그대로 인용한 문장이 아니다.
복수 의미 중 대표 의미를 풀이하므로 첨부 정답표의 모든 품사를 한 문장에 나열하지 않는다.

국문 사전의 영어 번역 항목을 사용한 것이 아니라 대응되는 한국어 표제어를 확인했다.
예를 들어 reputation은 `평판3`, value/worth는 `가치4`, carry out은 `수행하다2`에 연결한다.
가치1(개비), 평판의 다른 동음이의어, 불교의 수행 등은 사용하지 않는다.
`decade`는 `년2`의 단위를 바탕으로 열 해라는 수량을 설명한다.
구동사와 품사가 다른 대응 표제어는 그 의미를 바탕으로 표현을 구성한다.
`behavior`는 첨부의 미국식 철자를 유지하며 Oxford의 영국식 `behaviour` 항목을 연결한다.

## 오답 후보

80개 항목 각각에 철자·발음이 비슷한 실제 단어 또는 구동사 후보를 세 개 이상 연결했다.
공유 `data/decoy-words-set.js`에 추가하므로 기존 단어장에서도 같은 단어에 활용할 수 있다.
예를 들어 value/valve/vague/venue, reputation/repetition/reparation/representation,
carry out/carry on/carry over/carry off를 포함한다.
영어 선택지가 필요한 문제에서 기존 출제 규칙이 이 후보를 우선 사용하고 부족하면 단어장에서 보충한다.
한국어 뜻 선택지는 기존 단어장의 뜻 풀을 사용한다.
