/** 영어 단어장과 독립적인 사자성어 출제 규칙. */
const idiomRules = Object.freeze({
    difficulty(stage) {
        return Math.max(1, Math.min(4, Math.floor(stage / 4) + 1));
    },
    pool(source, difficulty) {
        return source.filter((row) => row.difficulty === difficulty);
    },
    questions(source, count, shuffle) {
        return shuffle(source)
            .slice(0, count)
            .map((row) => ({
                ...row,
                isBoss: false,
                questionKind: 'idiom',
            }));
    },
    options(question, source, shuffle) {
        const others = source.filter(
            (row) => row.word !== question.word && row.meaning !== question.meaning
        );
        return shuffle([
            question.word,
            ...shuffle(others)
                .slice(0, 3)
                .map((row) => row.word),
        ]).map((label) => ({ label, correct: label === question.word, disabled: false }));
    },
});
