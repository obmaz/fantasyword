/** 몬스터와 학습 방식의 연결. 단어장 원본, DOM, 저장소를 변경하지 않는다. */
const monsterEncounters = Object.freeze({
    catalog: Object.freeze({
        slime: { name: '슬라임', lesson: '뜻 고르기', sprite: 'monster-slime', kind: 'meaning' },
        goblin: { name: '고블린', lesson: '철자 조립', sprite: 'monster-goblin', kind: 'spelling' },
        bat: { name: '박쥐', lesson: '발음 듣기', sprite: 'monster-bat', kind: 'listening' },
        dragon: { name: '드래곤', lesson: '보스 문제', sprite: 'quest-dragon', kind: 'riddle' },
    }),
    normalize(value) {
        return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
    },
    usesSpelling(kind) {
        return ['spelling', 'cloze', 'riddle'].includes(kind);
    },
    cloze(data) {
        const sentence =
            data.exampleSentence || battleExamples[monsterEncounters.normalize(data.word)];
        if (typeof sentence !== 'string') return null;
        const escaped = data.word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(^|[^a-z])(${escaped})(?=$|[^a-z])`, 'gi');
        if (!pattern.test(sentence)) return null;
        pattern.lastIndex = 0;
        const prompt = sentence.replace(pattern, (_, prefix) => `${prefix}_____`);
        return prompt !== sentence ? prompt : null;
    },
    prepare(data, monsterId) {
        const monster = monsterEncounters.catalog[monsterId];
        const cloze = monsterId === 'dragon' ? monsterEncounters.cloze(data) : null;
        const riddle =
            monsterId === 'dragon' && !cloze
                ? monsterEncounters.cloze({
                      word: data.word,
                      exampleSentence: data.englishExplanation,
                  })
                : null;
        return {
            ...data,
            monsterId,
            questionKind: cloze ? 'cloze' : monster.kind,
            encounterPrompt: cloze || riddle || null,
            isBoss: !['meaning', 'listening'].includes(monster.kind),
        };
    },
    buildList(pool, count, shuffle) {
        count = Math.max(0, Math.min(pool.length, Math.floor(Number(count) || 0)));
        const order = shuffle(['slime', 'goblin', 'bat']);
        return shuffle(pool)
            .slice(0, count)
            .map((data, index) =>
                monsterEncounters.prepare(
                    data,
                    index === count - 1 ? 'dragon' : order[index % order.length]
                )
            );
    },
    spellingTiles(word, shuffle) {
        const letters = [...word].filter((letter) => /[a-z]/i.test(letter));
        // Common letters make plausible decoys while every answer letter remains available.
        const common = [...'aeiourstnl'];
        const used = new Set(letters.map((letter) => letter.toLowerCase()));
        const unusedCommon = common.filter((letter) => !used.has(letter));
        const uncommon = [...'abcdefghijklmnopqrstuvwxyz'].filter(
            (letter) => !used.has(letter) && !common.includes(letter)
        );
        const extras = [...shuffle(unusedCommon), ...shuffle(uncommon)].slice(0, 3);
        return [...letters, ...extras].sort((a, b) =>
            a.toLowerCase().localeCompare(b.toLowerCase(), 'en')
        );
    },
    spellingAnswer(word, tiles, chosen) {
        let index = 0;
        return [...word]
            .map((letter) => (/[a-z]/i.test(letter) ? tiles[chosen[index++]] || '_' : letter))
            .join('');
    },
    checkAnswer(input, word) {
        return monsterEncounters.normalize(input) === monsterEncounters.normalize(word);
    },
});
