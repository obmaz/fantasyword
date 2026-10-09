/**
 * game-engine.js의 DOM에 의존하지 않는 순수 로직 테스트.
 *
 * 실행: npm test
 */
const test = require('node:test');
const assert = require('node:assert');
const { loadScripts } = require('./helpers/load-module');

/** 테스트용 단어 데이터 */
const WORDS = [
    { day: 1, word: 'apple', meaning: '사과' },
    { day: 1, word: 'banana', meaning: '바나나' },
    { day: 2, word: 'cherry', meaning: '체리' },
    { day: 2, word: 'date', meaning: '대추' },
    { day: 3, word: 'elderberry', meaning: '엘더베리' },
];

/**
 * game 객체를 스텁 전역과 함께 로드합니다.
 * @param {Object} [overrides] - window에 얹을 값 (rawDataData 등)
 */
function loadGame(overrides = {}) {
    const { evaluate } = loadScripts(
        [
            'scripts/domain/questions.js',
            'scripts/domain/battle-rules.js',
            'scripts/game/game-engine.js',
        ],
        {
            rawData: WORDS,
            rawDataData: WORDS,
            db: { has: () => false, skills: { hint: 0, ultimate: 0 } },
            ...overrides,
        }
    );
    return evaluate('createBattleSession')({
        questions: evaluate('questionTools'),
        rules: evaluate('battleRules'),
        db: { has: () => false },
        getSource: () => overrides.rawDataData || WORDS,
        getDecoys: overrides.getDecoyWordCandidates,
        getDayLabel: (day) => overrides.dayCatalog?.[day]?.label,
        timers: {},
        screens: {},
    });
}

test('shuffle: 원본 배열을 변형하지 않고 사본을 반환한다', () => {
    const game = loadGame();
    const original = [1, 2, 3, 4, 5];
    const snapshot = [...original];

    const result = game.shuffle(original);

    assert.deepStrictEqual(original, snapshot, '원본이 변형되면 안 됨');
    assert.notStrictEqual(result, original, '같은 참조를 반환하면 안 됨');
    assert.deepStrictEqual([...result].sort(), [...original].sort(), '원소 집합은 같아야 함');
});

test('shuffle: 빈 배열과 1개 배열도 안전하게 처리한다', () => {
    const game = loadGame();
    // vm 샌드박스의 배열은 realm이 달라 deepStrictEqual이 실패하므로 호스트 배열로 복사해 비교
    assert.deepStrictEqual([...game.shuffle([])], []);
    assert.deepStrictEqual([...game.shuffle(['x'])], ['x']);
});

test('shuffle: 분포가 한쪽으로 치우치지 않는다 (Fisher-Yates)', () => {
    const game = loadGame();
    const N = 4;
    const RUNS = 4000;
    // counts[value][position] = 등장 횟수
    const counts = Array.from({ length: N }, () => new Array(N).fill(0));

    for (let i = 0; i < RUNS; i++) {
        game.shuffle([0, 1, 2, 3]).forEach((value, pos) => {
            counts[value][pos]++;
        });
    }

    // 균등하면 각 칸의 기대값은 RUNS/N. 편향 셔플(sort 기반)은 이 범위를 크게 벗어난다.
    const expected = RUNS / N;
    for (let value = 0; value < N; value++) {
        for (let pos = 0; pos < N; pos++) {
            const ratio = counts[value][pos] / expected;
            assert.ok(
                ratio > 0.8 && ratio < 1.2,
                `값 ${value}가 위치 ${pos}에 치우침 (기대 대비 ${ratio.toFixed(2)}배)`
            );
        }
    }
});

test('_buildPool: all/boss는 전체, 숫자 day는 해당 Day만 반환한다', () => {
    const game = loadGame();

    assert.strictEqual(game._buildPool('all', WORDS).length, 5);
    assert.strictEqual(game._buildPool('boss', WORDS).length, 5);

    const day1 = game._buildPool(1, WORDS);
    assert.strictEqual(day1.length, 2);
    assert.ok(
        day1.every((w) => Number(w.day) === 1),
        'Day 간 누출이 있으면 안 됨'
    );

    // 문자열 day도 숫자와 동일하게 취급
    assert.strictEqual(game._buildPool('2', WORDS).length, 2);
    // 없는 Day는 빈 배열
    assert.strictEqual(game._buildPool(99, WORDS).length, 0);
});

test('_interleave: 두 배열을 번갈아 배치한다', () => {
    const game = loadGame();
    assert.deepStrictEqual([...game._interleave(['a', 'b'], [1, 2])], ['a', 1, 'b', 2]);
});

test('_interleave: 길이가 달라도 남은 원소를 모두 보존한다', () => {
    const game = loadGame();
    assert.deepStrictEqual([...game._interleave(['a'], [1, 2, 3])], ['a', 1, 2, 3]);
    assert.deepStrictEqual([...game._interleave(['a', 'b', 'c'], [1])], ['a', 1, 'b', 'c']);
    assert.deepStrictEqual([...game._interleave([], [1, 2])], [1, 2]);
});

test('_buildBattleList: objective/subjective는 전부 한 종류로 채운다', () => {
    const game = loadGame();

    const objective = game._buildBattleList(WORDS, 4, 'objective');
    assert.strictEqual(objective.length, 4);
    assert.ok(
        objective.every((q) => q.isBoss === false),
        '객관식만 나와야 함'
    );

    const subjective = game._buildBattleList(WORDS, 4, 'subjective');
    assert.strictEqual(subjective.length, 4);
    assert.ok(
        subjective.every((q) => q.isBoss === true),
        '주관식만 나와야 함'
    );
});

test('_buildBattleList: 혼합형은 같은 유형이 연속되지 않는다', () => {
    const game = loadGame();

    // 인터리브가 결정적이므로 몇 번을 돌려도 연속이 나오면 안 된다
    for (let run = 0; run < 50; run++) {
        const list = game._buildBattleList(WORDS, 4, 'mixed');
        assert.strictEqual(list.length, 4);
        for (let i = 1; i < list.length; i++) {
            assert.notStrictEqual(
                list[i].isBoss,
                list[i - 1].isBoss,
                `같은 유형이 연속됨: ${list.map((q) => (q.isBoss ? 'S' : 'O')).join('')}`
            );
        }
    }
});

test('_buildBattleList: 원본 데이터를 변형하지 않는다', () => {
    const game = loadGame();
    const before = JSON.stringify(WORDS);
    game._buildBattleList(WORDS, 4, 'mixed');
    assert.strictEqual(JSON.stringify(WORDS), before, 'pool 원본이 변형되면 안 됨');
});

test('getDistractors: 정답과 겹치지 않는 고유한 오답 3개를 반환한다', () => {
    const game = loadGame();

    for (const w of WORDS) {
        const opts = game.getDistractors(w.word, 'word');
        assert.strictEqual(opts.length, 3, `${w.word}의 오답이 3개가 아님`);
        assert.ok(!opts.includes(w.word), '정답이 오답에 섞이면 안 됨');
        assert.strictEqual(new Set(opts).size, 3, '오답이 중복되면 안 됨');
    }
});

test('getDistractors: 고유 값이 부족해도 무한 루프에 빠지지 않는다', () => {
    // 고유 단어가 2개뿐인 데이터셋 — 오답 3개를 만들 수 없다
    const tiny = [
        { day: 1, word: 'same', meaning: '같음' },
        { day: 1, word: 'other', meaning: '다름' },
    ];
    const game = loadGame({ rawData: tiny, rawDataData: tiny });

    const opts = game.getDistractors('same', 'word');
    assert.ok(opts.length < 3, '부족하면 확보된 만큼만 반환해야 함');
    assert.ok(!opts.includes('same'), '정답이 섞이면 안 됨');
});

test('getDistractors: decoy 그룹 후보를 우선 사용한다', () => {
    const game = loadGame({
        getDecoyWordCandidates: (word) => (word === 'apple' ? ['applet', 'appeal', 'ample'] : []),
    });

    const opts = game.getDistractors('apple', 'word');
    assert.deepStrictEqual(
        [...opts].sort(),
        ['ample', 'appeal', 'applet'],
        'decoy 후보가 충분하면 랜덤 오답을 섞지 않아야 함'
    );
});

test('dayLabel: all/boss/숫자를 사람이 읽는 라벨로 바꾼다', () => {
    const game = loadGame({ dayCatalog: { 3: { label: 'Day 3 (숲)' } } });

    assert.strictEqual(game.dayLabel('all'), '전체');
    assert.strictEqual(game.dayLabel('boss'), '보스 모드');
    assert.strictEqual(game.dayLabel(3), 'Day 3 (숲)', 'dayCatalog 라벨을 우선 사용');
    assert.strictEqual(game.dayLabel(9), 'Day 9', '카탈로그에 없으면 기본 형식');
});

test('정답 골드는 문제 수와 무관하고 남은 시간 또는 풀이 시간에 따라 감소한다', () => {
    const rules = loadScripts(['scripts/domain/battle-rules.js']).evaluate('battleRules');
    const objective = (timeLeft) =>
        rules.reward({ mode: 'battle', subjective: false, timeLeft, maxTime: 10 });
    const subjective = (elapsedSeconds, count = 10) =>
        rules.reward({ mode: 'battle', subjective: true, elapsedSeconds, count });
    assert.equal(objective(10), 10);
    assert.equal(objective(9.99), 10);
    assert.equal(objective(7), 7);
    assert.equal(objective(0), 2);
    assert.equal(subjective(0), 12);
    assert.equal(subjective(0.01), 12);
    assert.equal(subjective(15), 7);
    assert.equal(subjective(30, 100), 3);
    assert.equal(rules.reward({ mode: 'boss', subjective: true, elapsedSeconds: 15 }), 7);
    assert.equal(
        rules.reward({
            mode: 'battle',
            subjective: false,
            timeLeft: 10,
            maxTime: 10,
            multiplier: 1.5,
            glove: true,
        }),
        22
    );
});
