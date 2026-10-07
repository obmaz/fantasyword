/** DOM/저장소에 의존하지 않는 전투 출제·채점·보상 규칙. */
const battleRules = Object.freeze({
    buildPool(day, source) {
        return day === 'all' || day === 'boss'
            ? source
            : source.filter((item) => Number(item.day) === Number(day));
    },
    interleave(a, b) {
        const result = [];
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            if (i < a.length) result.push(a[i]);
            if (i < b.length) result.push(b[i]);
        }
        return result;
    },
    buildList(pool, count, type, shuffle) {
        count = Math.max(0, Math.min(pool.length, Math.floor(Number(count) || 0)));
        const selected = shuffle(pool).slice(0, count);
        if (type === 'objective' || type === 'subjective') {
            return selected.map((q) => ({ ...q, isBoss: type === 'subjective' }));
        }
        const midpoint = Math.floor(count / 2);
        return battleRules.interleave(
            shuffle(selected.slice(midpoint).map((q) => ({ ...q, isBoss: false }))),
            shuffle(selected.slice(0, midpoint).map((q) => ({ ...q, isBoss: true })))
        );
    },
    spellingHint(word) {
        return word.replace(/\S+/g, (part) => part[0] + '_'.repeat(part.length - 1));
    },
    checkSpelling(input, word) {
        const answer = word.trim().toLowerCase();
        const value = input.trim().toLowerCase();
        // 기존 입력 규칙: 전체 철자 또는 맨 앞 한 글자를 제외한 철자를 허용한다.
        return value.length > 0 && (value === answer || value === answer.slice(1));
    },
    reward({ mode, subjective, count, timeLeft, maxTime, multiplier = 1, glove = false }) {
        const base =
            mode === 'boss' ? 80 : subjective ? (count >= 20 ? 600 : count >= 10 ? 200 : 100) : 40;
        const ratio =
            mode === 'boss' || subjective ? 1 : Math.max(0, Math.min(1, timeLeft / maxTime));
        let gain = Math.floor(Math.floor(base * (0.5 + ratio * 0.5)) * multiplier);
        if (glove) gain = Math.floor(gain * 1.5);
        return gain;
    },
    resultRows(session, win) {
        const encounters = session.mode === 'boss' ? session.encounterHistory : session.list;
        if (encounters?.some((q) => q.questionKind)) {
            const rows = [
                ['뜻 고르기', ['meaning']],
                ['철자 조립', ['spelling']],
                ['발음 듣기', ['listening']],
                ['보스 문제', ['cloze', 'riddle']],
            ].flatMap(([label, kinds]) => {
                const questions = encounters.filter((q) => kinds.includes(q.questionKind));
                return questions.length
                    ? [
                          {
                              label,
                              correct: questions.filter((q) => q.wasCorrect).length,
                              total: questions.length,
                          },
                      ]
                    : [];
            });
            rows.push({
                label: '전체',
                correct: encounters.filter((q) => q.wasCorrect).length,
                total: encounters.length,
            });
            return rows;
        }
        if (session.mode === 'boss') {
            return [
                {
                    label: '✍️ 주관식',
                    correct: session.subjectiveCorrect,
                    total: win ? session.bossTotalWaves : session.idx + 1,
                },
            ];
        }
        const rows = [];
        const objective = session.list.filter((q) => !q.isBoss).length;
        const subjective = session.list.length - objective;
        if (objective)
            rows.push({
                label: '📋 객관식',
                correct: session.sessionCorrectObjective,
                total: objective,
            });
        if (subjective)
            rows.push({
                label: '✍️ 주관식',
                correct: session.subjectiveCorrect,
                total: subjective,
            });
        if (session.battleQuestionType === 'mixed')
            rows.push({
                label: '📊 전체',
                correct: session.sessionCorrectObjective + session.subjectiveCorrect,
                total: session.list.length,
            });
        return rows;
    },
});
