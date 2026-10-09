/** DOM/저장소에 의존하지 않는 전투 출제·채점·보상 규칙. */
const REWARD_POLICY = Object.freeze({
    objective: 10,
    subjective: 12,
    boss: 12,
    assault: 4,
    mistake: 6,
    minimumShare: 0.25,
    untimedDecaySeconds: 30,
});
const battleRules = Object.freeze({
    assaultReward: () => REWARD_POLICY.assault,
    penalty: (gold, protectedGold = false) =>
        Math.min(gold, protectedGold ? REWARD_POLICY.mistake / 2 : REWARD_POLICY.mistake),
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
        return word.replace(/\S+/g, (part) =>
            part.length === 1 ? '_' : part[0] + '_'.repeat(part.length - 1)
        );
    },
    checkSpelling(input, word) {
        const answer = word.trim().toLowerCase();
        const value = input.trim().toLowerCase();
        // 밑줄 칸은 첫 글자도 비어 있으므로 전체 철자가 일치해야 한다.
        return value.length > 0 && value === answer;
    },
    hintRemovalCount(wrongCount) {
        return Math.max(0, Math.min(2, wrongCount - 1));
    },
    reward({
        mode,
        subjective,
        timeLeft,
        maxTime,
        elapsedSeconds = 0,
        multiplier = 1,
        glove = false,
    }) {
        const base =
            mode === 'boss'
                ? REWARD_POLICY.boss
                : subjective
                  ? REWARD_POLICY.subjective
                  : REWARD_POLICY.objective;
        const ratio = subjective
            ? Math.max(
                  0,
                  1 - Math.floor(Math.max(0, elapsedSeconds)) / REWARD_POLICY.untimedDecaySeconds
              )
            : Math.max(0, Math.min(1, Math.ceil(timeLeft) / maxTime));
        let gain = Math.floor(
            base *
                (REWARD_POLICY.minimumShare + ratio * (1 - REWARD_POLICY.minimumShare)) *
                multiplier
        );
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
        if (session.mode === 'boss' && encounters?.length) {
            const objective = encounters.filter((q) => !q.isBoss);
            const subjective = encounters.filter((q) => q.isBoss);
            return [
                ...(objective.length
                    ? [
                          {
                              label: '📋 객관식',
                              correct: objective.filter((q) => q.wasCorrect).length,
                              total: objective.length,
                          },
                      ]
                    : []),
                ...(subjective.length
                    ? [
                          {
                              label: '✍️ 주관식',
                              correct: subjective.filter((q) => q.wasCorrect).length,
                              total: subjective.length,
                          },
                      ]
                    : []),
                { label: '전체', correct: session.idx, total: encounters.length },
            ];
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
