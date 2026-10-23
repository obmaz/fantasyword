const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');

test('확장한 모든 사자성어는 각 난이도의 스토리·어드민 5문제에 출제될 수 있다', () => {
    const r = browserRuntime({ v7_settings: '{"musicPlay":false,"wordRead":false}' });
    const original = r.evaluate('JSON.stringify(storyIdioms)');
    for (let level = 1; level <= 4; level++) {
        const expected = new Set(
            r.evaluate(`idiomRules.pool(storyIdioms, ${level})`).map((row) => row.word)
        );
        assert.equal(expected.size, 60);
        for (const mode of ['story', 'idiom-test']) {
            const seen = new Set();
            for (let offset = 0; offset < 60; offset += 5) {
                r.evaluate(`
                    game.stop();
                    game.shuffle = (values) => [
                        ...values.slice(${offset}), ...values.slice(0, ${offset})
                    ];
                    storyJourney.stage = ${(level - 1) * 4};
                    storyJourney.pendingStage = storyJourney.stage;
                    storyJourney.pendingIndex = 0;
                    storyJourney.pendingBook = db.getBookKey();
                    storyJourney.pendingKind = 'idiom';
                    game.battleQuestionType = 'idiom';
                `);
                r.getElement('idiom-test-level').value = String(level);
                r.evaluate(`game.init('${mode}', 'all')`);
                r.advance(0);
                const list = r.evaluate('game.list');
                assert.equal(list.length, 5, `${mode} 난이도 ${level}`);
                assert.equal(new Set(list.map((row) => row.word)).size, 5);
                assert.ok(
                    list.every(
                        (row) =>
                            row.difficulty === level &&
                            row.questionKind === 'idiom' &&
                            expected.has(row.word)
                    )
                );
                list.forEach((row) => seen.add(row.word));
                assert.equal(r.evaluate('game.currentQ.meaning'), list[0].meaning);
                const options = r.evaluate('game.options');
                assert.equal(options.length, 4);
                assert.equal(new Set(options.map((option) => option.label)).size, 4);
                assert.equal(options.filter((option) => option.correct).length, 1);
                assert.equal(options.find((option) => option.correct).label, list[0].word);
            }
            assert.deepEqual(seen, expected, `${mode} 난이도 ${level} 전체 출제 가능`);
        }
    }
    r.evaluate('game.stop()');
    assert.equal(r.evaluate('JSON.stringify(storyIdioms)'), original);
});
