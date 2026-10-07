/** 배열만 입력받는 출제 규칙. DOM, 저장소, 전투 상태에 의존하지 않는다. */
const questionTools = {
    getDistractors: (correct, key, question, currentRawData, getCandidates = () => []) => {
        const distractors = [];
        const norm = (v) =>
            String(v || '')
                .trim()
                .toLowerCase();
        const correctNorm = norm(correct);
        // 동일한 질문(뜻/영단어)에 대응하는 다른 정답을 오답 보기로 내지 않는다.
        const promptKey = key === 'word' ? 'meaning' : 'word';
        const accepted = new Set([correctNorm]);
        if (question) {
            currentRawData.forEach((row) => {
                if (norm(row[promptKey]) === norm(question[promptKey]))
                    accepted.add(norm(row[key]));
            });
        }

        // 추천 방식: 유사 단어 집합(decoyWordsSet)이 있으면 word 보기에서 우선 사용
        // - 그룹 매핑이 없으면 아래 랜덤 로직으로 fallback 됨
        if (key === 'word' && typeof getCandidates === 'function') {
            const candidates = getCandidates(correct) || [];
            const shuffledCandidates = questionTools.shuffle([...candidates]);
            for (const c of shuffledCandidates) {
                const cNorm = norm(c);
                if (!cNorm || accepted.has(cNorm)) continue;
                if (!distractors.some((d) => norm(d) === cNorm)) {
                    distractors.push(c);
                }
                if (distractors.length >= 3) break;
            }
        }
        if (distractors.length >= 3) return distractors.slice(0, 3);
        const shuffled = questionTools.shuffle([...currentRawData]);
        for (let i = 0; i < shuffled.length; i++) {
            const value = shuffled[i] && shuffled[i][key];
            const valueNorm = norm(value);
            if (!valueNorm || accepted.has(valueNorm)) continue;
            if (!distractors.some((d) => norm(d) === valueNorm)) {
                distractors.push(value);
            }
            if (distractors.length >= 3) break;
        }
        // 전체 풀을 한 번 확인했으므로 재셔플을 반복해도 고유 보기를 더 찾을 수 없다.
        // 고유 값이 부족하면 채워진 만큼만 반환 (호출부가 빈/부족한 보기를 처리)
        return distractors.slice(0, 3);
    },
    // Fisher–Yates 셔플: 균등 분포 보장 + 원본 배열을 변형하지 않도록 사본 반환
    shuffle: (arr) => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    },
};
