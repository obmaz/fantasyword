const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');
const { loadScripts } = require('./helpers/load-module');

test('사자성어는 독립된 네 단계의 30개와 정부 사전 출처를 가진다', () => {
    const r = browserRuntime();
    const rows = r.evaluate('storyIdioms');
    assert.equal(rows.length, 120);
    assert.equal(new Set(rows.map((row) => row.word)).size, 120);
    for (let level = 1; level <= 4; level++) {
        const pool = r.evaluate(`idiomRules.pool(storyIdioms, ${level})`);
        assert.equal(pool.length, 30);
        for (const row of pool) {
            assert.match(row.word, /^[가-힣]{4}$/);
            assert.match(
                row.source,
                /^https:\/\/stdict.korean.go.kr\/search\/searchView.do\?word_no=\d+$/
            );
            const choices = r.evaluate('idiomRules').options(row, pool, (values) => [...values]);
            assert.equal(choices.length, 4);
            assert.equal(new Set(choices.map((choice) => choice.label)).size, 4);
            assert.equal(choices.filter((choice) => choice.correct).length, 1);
        }
    }
    assert.equal(
        r.evaluate('rawData.some(row => storyIdioms.some(idiom => idiom.word === row.word))'),
        false
    );
});

test('기본 지도와 재배치 지도는 비전투가 연속되지 않고 모든 지점에서 다음 길이 열린다', () => {
    const r = loadScripts(['scripts/domain/story-map.js']);
    const rules = r.evaluate('storyMapRules');
    let seed = 817;
    const shuffle = (values) =>
        [...values].sort(() => {
            seed = (seed * 16807) % 2147483647;
            return seed % 2 ? 1 : -1;
        });
    for (const rows of [
        rules.rows,
        ...Array.from({ length: 100 }, () => rules.regenerate(shuffle)),
    ]) {
        assert.equal(rules.validLayout(rows), true);
        assert.ok(rows.flat().includes('casino'));
        assert.ok(rows.flat().includes('mystery'));
        assert.ok(rows.flat().includes('proverb'));
        assert.ok(rows.flat().includes('forge'));
        for (let stage = 0; stage < rows.length - 1; stage++) {
            const incoming = new Set();
            rows[stage].forEach((kind, index) => {
                const targets = rules.connections(stage, index, rows);
                assert.ok(targets.length > 0);
                targets.forEach((target) => {
                    incoming.add(target);
                    assert.equal(
                        rules.nonCombat(kind) && rules.nonCombat(rows[stage + 1][target]),
                        false
                    );
                });
            });
            assert.equal(incoming.size, rows[stage + 1].length);
        }
    }
    const blocked = rules.rows.map((row) => [...row]);
    blocked[0].fill('market');
    blocked[1].fill('casino');
    assert.equal(rules.validLayout(blocked), false);
});

test('고정 전투 Day는 확인 이후에만 저장되며 다른 지점에 중복 배정되지 않는다', () => {
    const r = browserRuntime();
    const journey = r.evaluate('storyJourney');
    journey.stage = 1;
    journey.requestSelection(1, 0);
    const firstDay = journey.selection.day;
    assert.ok(Number.isInteger(firstDay));
    assert.equal(journey.events['1:0'], undefined);
    assert.equal(journey.pendingStage, null);
    journey.cancelSelection();
    assert.equal(journey.events['1:0'], undefined);
    journey.requestSelection(1, 0);
    journey.confirmSelection();
    const savedDay = journey.events['1:0'].day;
    assert.equal(journey.nodes()[1][0].day, savedDay);
    assert.equal(r.evaluate('story.day'), savedDay);
    journey.completeBattle({ mistakes: 0 });
    journey.stage = 4;
    journey.remember(3, 0);
    journey.requestSelection(4, 1);
    assert.notEqual(journey.selection.day, savedDay);
    journey.confirmSelection();
    assert.equal(new Set(Object.values(journey.events).map((event) => event.day)).size, 2);
});

test('스토리 초기화는 50골드와 진행·왕관·지도 배치를 함께 저장한다', () => {
    const r = browserRuntime({ v7_gold: '99' });
    const journey = r.evaluate('storyJourney');
    journey.stage = 7;
    journey.remember(0, 0);
    r.evaluate(
        'gameStorage.set(storyJourney.eventsKey, JSON.stringify({"0:0": {cleared:true,mistakes:0,day:1}}))'
    );
    journey.requestReset();
    assert.equal(r.evaluate('db.gold'), 99);
    journey.confirmSelection();
    assert.equal(r.evaluate('db.gold'), 49);
    assert.equal(journey.stage, 0);
    assert.equal(journey.path.length, 0);
    assert.equal(Object.keys(journey.events).length, 0);
    assert.equal(r.evaluate('storyMapRules.validLayout(storyJourney.rows)'), true);
    assert.notEqual(JSON.stringify(journey.rows), r.evaluate('JSON.stringify(storyMapRules.rows)'));
    journey.requestReset();
    journey.confirmSelection();
    assert.equal(r.evaluate('db.gold'), 49);
});

test('스토리 초기화 저장 실패는 골드와 이전 지도를 모두 보존한다', () => {
    const r = browserRuntime({ v7_gold: '100', 'v7_story_stage_book-1': '7' });
    const before = Object.fromEntries(r.store);
    const write = r.sandbox.localStorage.setItem;
    r.sandbox.localStorage.setItem = (key, value) => {
        if (key === 'v7_story_layout_book-1') throw new Error('quota');
        write(key, value);
    };
    r.evaluate('storyJourney.requestReset(); storyJourney.confirmSelection()');
    assert.deepEqual(Object.fromEntries(r.store), before);
    assert.equal(r.evaluate('db.gold'), 100);
    assert.equal(r.evaluate('storyJourney.stage'), 7);
});

test('사자성어 ? 전투와 테스트는 같은 객관식을 쓰고 영어 기록은 바꾸지 않는다', () => {
    for (const level of [1, 2, 3, 4]) {
        const r = browserRuntime({ v7_gold: '99' });
        r.getElement('idiom-test-level').value = String(level);
        r.evaluate('game.init("idiom-test", "all")');
        r.advance(400);
        assert.ok(
            r.evaluate(
                `game.list.every(row => row.difficulty === ${level} && row.questionKind === 'idiom')`
            )
        );
        assert.equal(r.evaluate('game.list.length'), 5);
        const before = r.evaluate('JSON.stringify(db.stats)');
        r.evaluate('game.gear.shield = 0; game.handleAnswer(false, null)');
        r.advance(2500);
        r.evaluate('game.handleAnswer(true, null)');
        assert.equal(r.evaluate('db.gold'), 99);
        assert.equal(r.evaluate('JSON.stringify(db.stats)'), before);
        assert.equal(r.evaluate('game.sessionWrongWords.length'), 0);
    }
    const r = browserRuntime();
    r.evaluate(
        'storyJourney.random = () => 0.95; storyJourney.select(0, 1); storyJourney.enterMystery(); game.init("story", "all")'
    );
    r.advance(400);
    assert.equal(r.evaluate('game.list.length'), 5);
    assert.ok(
        r.evaluate('game.list.every(row => row.questionKind === "idiom" && row.difficulty === 1)')
    );
    assert.equal(r.getElement('q-text').innerText, r.evaluate('game.currentQ.meaning'));
});

test('확장 암시장 유물은 스토리에만 추가 힌트·재도전·상자 보상을 준다', () => {
    const r = browserRuntime({ v7_gold: '5000' });
    r.evaluate('storyJourney.random = () => 0.1');
    for (const id of ['shadowLantern', 'wardingSigil', 'pilgrimMedal']) {
        r.evaluate(`shop.buy('${id}', 'passive')`);
        assert.equal(r.evaluate(`db.has('${id}')`), false);
        r.evaluate(`storyJourney.buy('${id}')`);
        assert.equal(r.evaluate(`db.has('${id}')`), true);
    }
    assert.equal(r.evaluate('storyJourney.treasureGold(0)'), 80);
    r.evaluate('game.init("battle", 1)');
    const normal = r.evaluate('[game.gear.hint, game.gear.shield]');
    r.evaluate('game.stop(); storyJourney.select(0, 0); game.init("story", "all")');
    assert.equal(r.evaluate('game.gear.hint'), normal[0] + 1);
    assert.equal(r.evaluate('game.gear.shield'), normal[1] + 1);
});

test('도박장 보상 저장·진행 재시도는 한 번만 지급하며 지난 단어장 콜백을 차단한다', () => {
    const r = browserRuntime({ v7_gold: '99' });
    r.evaluate(
        'shellGame.start = (options) => { window.casinoOptions = options; }; storyJourney.stage = 5; storyJourney.select(5, 0)'
    );
    const write = r.sandbox.localStorage.setItem;
    r.sandbox.localStorage.setItem = (key, value) => {
        if (key === 'v7_story_stage_book-1') throw new Error('quota');
        write(key, value);
    };
    assert.equal(r.evaluate('window.casinoOptions.onSettle(20)'), false);
    assert.equal(r.evaluate('db.gold'), 119);
    r.sandbox.localStorage.setItem = write;
    assert.equal(r.evaluate('window.casinoOptions.onSettle(20)'), true);
    assert.equal(r.evaluate('window.casinoOptions.onSettle(20)'), false);
    assert.equal(r.evaluate('db.gold'), 119);
    assert.equal(r.evaluate('storyJourney.stage'), 6);
    r.evaluate('window.currentGameDataSetId = 2');
    assert.equal(r.evaluate('window.casinoOptions.onSettle(20)'), false);
});
