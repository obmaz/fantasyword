const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load-module');
const { browserRuntime } = require('./helpers/browser-runtime');
const domain = loadScripts([
    'data/story-puzzles.js',
    'scripts/domain/story-puzzle-rules.js',
    'scripts/game/story-puzzle-session.js',
]);
const rules = domain.evaluate('storyPuzzleRules');
const words = domain.evaluate('wordForgeWords');
const paths = domain.evaluate('wordForgePaths');
const proverbs = domain.evaluate('storyProverbs');

test('속담은 고유한 30문항·정답 하나의 네 보기이며 영어 학습 풀에 섞이지 않는다', () => {
    assert.equal(proverbs.length, 30);
    assert.equal(new Set(proverbs.map((q) => q.before + q.answer + q.after)).size, 30);
    for (const q of proverbs) {
        assert.equal(new Set([q.answer, ...q.decoys]).size, 4);
        assert.ok(q.meaning.length > 0);
    }
    const r = browserRuntime();
    assert.equal(
        r.evaluate('rawData.some(row => storyProverbs.some(q => row.word === q.answer))'),
        false
    );
});

test('대장간 모든 문제는 사전에 있는 단어를 한 글자씩 바꾸는 해답이 존재한다', () => {
    assert.equal(new Set(words).size, words.length);
    assert.ok(words.every((word) => /^[A-Z]{3}$/.test(word)));
    for (const route of paths) {
        assert.ok(route.every((word) => words.includes(word)));
        assert.ok(route.slice(1).every((word, i) => rules.differsByOne(route[i], word)));
        const shortest = rules.path(route[0], route.at(-1), words);
        assert.ok(shortest.length >= 3 && shortest.length <= route.length);
        assert.ok(shortest.slice(1).every((word, i) => rules.differsByOne(shortest[i], word)));
    }
    assert.equal(rules.path('CAT', 'XYZ', words), null);
    assert.equal(rules.differsByOne('CAT', 'CAT'), false);
    assert.equal(rules.differsByOne('CAT', 'CATS'), false);
});

function runtime(kind, options = null) {
    const seen = { results: [] };
    const session = domain.evaluate('createStoryPuzzleSession')({
        rules,
        proverbs,
        paths,
        words,
        shuffle: (values) => [...values],
        onOpen() {},
        onExit() {},
        view: {
            init() {},
            open() {},
            exit() {},
            question(model, choose) {
                Object.assign(seen, { model, choose });
            },
            review(model, next) {
                Object.assign(seen, { review: model, next });
            },
            done(result) {
                seen.results.push(result);
            },
            saveFailed(retry) {
                seen.retry = retry;
            },
        },
    });
    session.start(kind, options);
    return { session, seen };
}
function solve(r) {
    while (!r.seen.results.length && !r.seen.retry) {
        if (r.seen.model.kind === 'proverb') {
            r.seen.choose(proverbs[r.seen.model.round - 1].answer);
        } else {
            const route = rules.path(r.seen.model.current, r.seen.model.prompt, words);
            for (const word of route.slice(1)) r.seen.choose(word);
        }
        r.seen.next();
    }
}

test('퍼즐 완료 보상·저장 재시도는 같은 결과를 한 번만 처리하며 늦은 입력을 차단한다', () => {
    for (const kind of ['proverb', 'forge']) {
        let writes = 0;
        const r = runtime(kind, { onSettle: () => ++writes > 1 });
        const oldChoose = r.seen.choose;
        solve(r);
        assert.equal(writes, 1);
        const retry = r.seen.retry;
        retry();
        retry();
        assert.equal(writes, 2);
        assert.equal(r.seen.results.length, 1);
        assert.equal(r.seen.results[0].won, true);
        assert.equal(r.seen.results[0].mistakes, 0);
        assert.equal(r.seen.results[0].points, kind === 'proverb' ? 30 : 18);
        r.session.exit();
        r.session.start(kind);
        oldChoose(kind === 'proverb' ? proverbs[0].answer : 'COT');
        assert.equal(r.seen.model.round, 1);
        assert.equal(r.seen.model.mistakes, 0);
    }
});

test('속담 세 번 오답과 대장간 변환 소진은 실패하며 잘못된 단어 입력은 무시한다', () => {
    const proverb = runtime('proverb');
    for (let i = 0; i < 3; i++) {
        proverb.seen.choose(proverbs[i].decoys[0]);
        proverb.seen.next();
    }
    assert.equal(proverb.seen.results[0].won, false);
    assert.equal(proverb.seen.results[0].points, 0);
    const forge = runtime('forge');
    forge.seen.choose('XYZ');
    forge.seen.choose('DOG');
    assert.equal(forge.seen.model.current, 'CAT');
    let moves = forge.seen.model.remaining;
    while (moves--) forge.seen.choose(moves % 2 ? 'CAT' : 'COT');
    // 같은 단어 재선택은 무시되므로 실제 교환으로 남은 횟수를 사용한다.
    while (!forge.seen.review)
        forge.seen.choose(forge.seen.model.current === 'CAT' ? 'COT' : 'CAT');
    forge.seen.next();
    assert.equal(forge.seen.results[0].won, false);
    assert.equal(forge.seen.results[0].points, 0);
});

test('스토리 퍼즐의 왕관・골드・진행은 원자적으로 저장하고 이전 단어장 결과는 무시한다', () => {
    for (const [kind, index, points] of [
        ['forge', 1, 18],
        ['proverb', 2, 30],
    ]) {
        const r = browserRuntime({ v7_gold: '99' });
        r.evaluate(
            `storyJourney.stage = 6; storyPuzzle.start = (mode, options) => { window.puzzleOptions = options; }; storyJourney.requestSelection(6, ${index}); storyJourney.confirmSelection()`
        );
        assert.equal(r.evaluate('storyJourney.pendingKind'), kind);
        const callback = r.evaluate('window.puzzleOptions.onSettle');
        const write = r.sandbox.localStorage.setItem;
        const before = Object.fromEntries(r.store);
        r.sandbox.localStorage.setItem = (key, value) => {
            if (key === 'v7_story_stage_book-1') throw new Error('quota');
            write(key, value);
        };
        const result = { kind, won: true, mistakes: 2, points };
        assert.equal(callback(result), false);
        assert.deepEqual(Object.fromEntries(r.store), before);
        assert.equal(r.evaluate('db.gold'), 99);
        r.sandbox.localStorage.setItem = write;
        assert.equal(callback(result), true);
        assert.equal(callback(result), false);
        assert.equal(r.evaluate('db.gold'), 99 + points);
        assert.equal(r.evaluate('storyJourney.stage'), 7);
        assert.equal(r.evaluate(`storyJourney.events['6:${index}'].mistakes`), 2);
        r.evaluate('window.currentGameDataSetId = 2');
        assert.equal(callback(result), false);
    }
});

test('스토리 퍼즐 실패·중도 나가기는 같은 지점으로 돌아가고 어드민은 골드를 바꾸지 않는다', () => {
    const r = browserRuntime({ v7_gold: '99' });
    r.sandbox.onload();
    r.evaluate('storyJourney.stage = 6; storyJourney.select(6, 2)');
    for (let i = 0; i < 3; i++) {
        const options = r.getElement('puzzle-choices').children;
        const answer = r.getElement('puzzle-prompt').textContent;
        const wrong = options.find(
            (btn) =>
                !r
                    .evaluate('storyProverbs')
                    .some(
                        (q) =>
                            `${q.before}____${q.after}` === answer && q.answer === btn.textContent
                    )
        );
        wrong.click();
        r.getElement('puzzle-controls').children[0].click();
    }
    assert.equal(r.evaluate('db.gold'), 99);
    assert.equal(r.evaluate('storyJourney.stage'), 6);
    r.evaluate('navigation.back()');
    assert.equal(r.evaluate('storyPuzzle.active'), false);
    assert.equal(r.evaluate('storyJourney.pendingStage'), null);
    assert.equal(r.getElement('story-map-modal').style.display, 'flex');
    r.evaluate("storyJourney.close(); storyPuzzle.start('proverb')");
    for (let i = 0; i < 5; i++) {
        const prompt = r.getElement('puzzle-prompt').textContent;
        const q = r
            .evaluate('storyProverbs')
            .find((row) => `${row.before}____${row.after}` === prompt);
        r.getElement('puzzle-choices')
            .children.find((btn) => btn.textContent === q.answer)
            .click();
        r.getElement('puzzle-controls').children[0].click();
    }
    assert.equal(r.evaluate('db.gold'), 99);
    assert.match(r.getElement('puzzle-feedback').textContent, /테스트 점수 30/);
});

test('대장간 이전 보기·다음 콜백은 새 문제에서 작동하지 않고 우회 횟수는 왕관에 반영한다', () => {
    const r = runtime('forge');
    const oldChoose = r.seen.choose;
    r.seen.choose('COT');
    oldChoose('COT');
    assert.equal(r.seen.model.remaining, 4);
    r.seen.choose('CAT'); // 두 번 우회 후 최단 경로로 완료한다.
    r.seen.choose('COT');
    r.seen.choose('DOT');
    r.seen.choose('DOG');
    assert.equal(r.seen.review.mistakes, 2);
    const oldNext = r.seen.next;
    oldNext();
    oldNext();
    assert.equal(r.seen.model.round, 2);
    assert.equal(r.seen.model.mistakes, 2);
    solve(r);
    assert.equal(r.seen.results[0].won, true);
    assert.equal(r.seen.results[0].mistakes, 2);
});
