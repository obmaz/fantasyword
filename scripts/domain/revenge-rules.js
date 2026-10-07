/** 오답 재도전 → 하루 뒤 회상. 단어장과 UI에 의존하지 않는 저장 규칙. */
const revengeRules = Object.freeze({
    recallDelay: 24 * 60 * 60 * 1000,
    key: (q) => JSON.stringify([q.word.trim().toLowerCase(), q.meaning.trim()]),
    normalize(value) {
        const clean = {};
        if (!value || typeof value !== 'object' || Array.isArray(value)) return clean;
        for (const [book, entries] of Object.entries(value)) {
            if (!/^book-\d+$/.test(book) || !entries || typeof entries !== 'object') continue;
            clean[book] = {};
            for (const entry of Object.values(entries)) {
                if (typeof entry?.word !== 'string' || typeof entry.meaning !== 'string') continue;
                if (!entry.word.trim() || !entry.meaning.trim()) continue;
                const timestamp = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : 0);
                const q = {
                    word: entry.word.trim(),
                    meaning: entry.meaning.trim(),
                    monsterId: ['slime', 'goblin', 'bat', 'dragon'].includes(entry.monsterId)
                        ? entry.monsterId
                        : 'slime',
                    phase: ['revenge', 'recall', 'complete'].includes(entry.phase)
                        ? entry.phase
                        : 'revenge',
                    dueAt: timestamp(entry.dueAt),
                    failures: Math.max(1, timestamp(entry.failures)),
                    revengeRewarded: entry.revengeRewarded === true,
                    recallRewarded: entry.recallRewarded === true,
                };
                clean[book][revengeRules.key(q)] = q;
            }
        }
        return clean;
    },
    failed(previous, question) {
        return {
            ...previous,
            word: question.word,
            meaning: question.meaning,
            monsterId: question.monsterId || (question.isBoss ? 'dragon' : 'slime'),
            phase: 'revenge',
            dueAt: 0,
            failures: (previous?.failures || 0) + 1,
            revengeRewarded: previous?.revengeRewarded === true,
            recallRewarded: previous?.recallRewarded === true,
        };
    },
    ready(entry, now) {
        return entry.phase === 'revenge' || (entry.phase === 'recall' && now >= entry.dueAt);
    },
    succeeded(entry, now) {
        if (!entry || !revengeRules.ready(entry, now)) return { entry, bonus: 0 };
        if (entry.phase === 'revenge')
            return {
                entry: {
                    ...entry,
                    phase: 'recall',
                    dueAt: now + revengeRules.recallDelay,
                    revengeRewarded: true,
                },
                bonus: entry.revengeRewarded ? 0 : 50,
            };
        return {
            entry: { ...entry, phase: 'complete', recallRewarded: true },
            bonus: entry.recallRewarded ? 0 : 100,
        };
    },
    entries(records, source) {
        return source
            .flatMap((q) => {
                const entry = records[revengeRules.key(q)];
                return entry ? [{ ...entry, source: q }] : [];
            })
            .filter(
                (entry, i, all) =>
                    all.findIndex(
                        (other) => revengeRules.key(other) === revengeRules.key(entry)
                    ) === i
            );
    },
});
