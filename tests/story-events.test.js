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
    let previous = rules.rows;
    for (const rows of [
        previous,
        ...Array.from({ length: 99 }, () => (previous = rules.regenerate(shuffle, previous))),
    ]) {
        assert.equal(rules.validLayout(rows), true);
        assert.ok(rows.flat().includes('casino'));
        assert.ok(rows.flat().includes('mystery'));
        assert.ok(rows.flat().includes('proverb'));
        assert.ok(rows.flat().includes('forge'));
        assert.equal(rows[7][0], 'miniboss');
        assert.equal(rows[11][0], 'miniboss');
        assert.equal(rows.at(-1)[0], 'boss');
        let reachable = new Set(rows[0].map((_, index) => index));
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
            reachable = new Set(
                [...reachable].flatMap((index) => rules.connections(stage, index, rows))
            );
            assert.equal(reachable.size, rows[stage + 1].length);
        }
    }
    const blocked = rules.rows.map((row) => [...row]);
    blocked[0].fill('market');
    blocked[1].fill('casino');
    assert.equal(rules.validLayout(blocked), false);
});

test('이벤트 셔플과 독립적으로 세 갈림길 구조를 순환하고 실제 연결 모양도 다르다', () => {
    const rules = loadScripts(['scripts/domain/story-map.js']).evaluate('storyMapRules');
    const shapes = [];
    let rows = rules.rows;
    for (let cycle = 0; cycle < 7; cycle++) {
        assert.equal(rules.layoutIndex(rows), cycle % 3);
        const shape = JSON.stringify(
            rows.map((row, stage) => row.map((_, index) => rules.connections(stage, index, rows)))
        );
        if (cycle < 3) shapes.push(shape);
        const before = JSON.stringify(rows);
        const previous = rows;
        rows = rules.regenerate((values) => [...values], rows);
        assert.equal(JSON.stringify(previous), before);
        assert.notEqual(JSON.stringify(rows), before);
    }
    assert.equal(new Set(shapes).size, 3);
    assert.equal(rules.validLayout(null), false);
    assert.equal(rules.validLayout([['boss']]), false);
});

test('초기화와 최종 클리어는 현재 구조의 다음 지도를 저장하고 새로고침·단어장별로 유지한다', () => {
    let r = browserRuntime({ v7_gold: '500' });
    for (const expected of [1, 2, 0, 1]) {
        r.evaluate('storyJourney.requestReset(); storyJourney.confirmSelection()');
        assert.equal(r.evaluate('storyMapRules.layoutIndex(storyJourney.rows)'), expected);
        const saved = Object.fromEntries(r.store);
        r = browserRuntime(saved);
        assert.equal(r.evaluate('storyMapRules.layoutIndex(storyJourney.rows)'), expected);
        assert.deepEqual(Object.fromEntries(r.store), saved);
    }
    r.evaluate(
        'storyJourney.stage=14;storyJourney.select(14,0);storyJourney.completeBattle({mistakes:0})'
    );
    assert.equal(r.evaluate('storyMapRules.layoutIndex(storyJourney.rows)'), 2);
    assert.equal(r.evaluate('storyJourney.stage'), 0);
    assert.equal(r.evaluate('storyJourney.path.length'), 0);
    assert.equal(r.evaluate('Object.keys(storyJourney.events).length'), 0);
    r = browserRuntime({ ...Object.fromEntries(r.store), selectedGameDataSet: '2' });
    assert.equal(r.evaluate('storyMapRules.layoutIndex(storyJourney.rows)'), 0);
    r.evaluate('storyJourney.requestReset();storyJourney.confirmSelection()');
    assert.equal(r.evaluate('storyMapRules.layoutIndex(storyJourney.rows)'), 1);
    r = browserRuntime({ ...Object.fromEntries(r.store), selectedGameDataSet: '1' });
    assert.equal(r.evaluate('storyMapRules.layoutIndex(storyJourney.rows)'), 2);
});

test('기존 저장 지도의 이벤트·왕관·선택 경로는 열기·진입 취소만으로 교체되지 않는다', () => {
    const legacy = browserRuntime().evaluate('JSON.stringify(storyMapRules.rows)');
    const r = browserRuntime({
        'v7_story_layout_book-1': legacy,
        'v7_story_stage_book-1': '4',
        'v7_story_path_book-1': '[0,0,0,0]',
        'v7_story_events_book-1': '{"0:0":{"cleared":true,"mistakes":0,"day":1}}',
    });
    const before = Object.fromEntries(r.store);
    r.evaluate('storyJourney.open();storyJourney.close();storyJourney.open()');
    assert.deepEqual(Object.fromEntries(r.store), before);
    assert.equal(r.evaluate('storyMapRules.layoutIndex(storyJourney.rows)'), 0);
    assert.equal(r.evaluate('storyJourney.canSelect(4,0)'), true);
    r.evaluate('storyJourney.requestSelection(4,0);storyJourney.cancelSelection()');
    assert.deepEqual(Object.fromEntries(r.store), before);
});

test('구조 저장 실패 시 초기화·최종 클리어는 순서·골드·진행을 보존하고 재시도한다', () => {
    for (const finish of [false, true]) {
        const r = browserRuntime({ v7_gold: '200' });
        r.evaluate('storyJourney.requestReset();storyJourney.confirmSelection()');
        r.evaluate(
            finish
                ? 'storyJourney.stage=14;storyJourney.select(14,0)'
                : 'storyJourney.requestReset()'
        );
        const before = Object.fromEntries(r.store);
        const write = r.sandbox.localStorage.setItem;
        r.sandbox.localStorage.setItem = (key, value) => {
            if (key === 'v7_story_layout_book-1') throw Error('quota');
            write(key, value);
        };
        const settle = finish
            ? 'storyJourney.completeBattle({mistakes:0})'
            : 'storyJourney.confirmSelection()';
        r.evaluate(settle);
        assert.deepEqual(Object.fromEntries(r.store), before);
        assert.equal(r.evaluate('storyMapRules.layoutIndex(storyJourney.rows)'), 1);
        r.sandbox.localStorage.setItem = write;
        r.evaluate(settle);
        assert.equal(r.evaluate('storyMapRules.layoutIndex(storyJourney.rows)'), 2);
        assert.equal(r.evaluate('storyJourney.stage'), 0);
    }
});

test('전투 완료 저장 실패는 결과를 보존하고 진행 커밋을 재시도한다', () => {
    const r = browserRuntime();
    const journey = r.evaluate('storyJourney');
    journey.select(0, 0);
    const write = r.sandbox.localStorage.setItem;
    r.sandbox.localStorage.setItem = (key, value) => {
        if (key === 'v7_story_stage_book-1') throw new Error('QuotaExceededError');
        write(key, value);
    };

    assert.equal(r.evaluate('storyJourney.completeBattle({ mistakes: 1 })'), false);
    assert.equal(journey.stage, 0);
    assert.equal(journey.pendingCompletion.mistakes, 1);
    assert.equal(journey.pendingStage, 0);

    r.sandbox.localStorage.setItem = write;
    assert.equal(r.evaluate('storyJourney.retryCompletion()'), true);
    assert.equal(journey.stage, 1);
    assert.equal(journey.pendingCompletion, null);
    assert.equal(journey.pendingStage, null);
});

test('스토리 승리 결과는 진행 저장 실패를 알리고 결과 모달에서 재시도할 수 있다', () => {
    const r = browserRuntime();
    const journey = r.evaluate('storyJourney');
    journey.select(0, 0);
    r.evaluate(`
        game.active = true;
        game.mode = 'story';
        game.list = [{}, {}, {}, {}];
        game.sessionMistakes = 0;
        game.sessionCorrectObjective = 4;
        game.view.results = (...args) => { window.storyProgressFailureShown = args.at(-1); };
    `);
    const write = r.sandbox.localStorage.setItem;
    r.sandbox.localStorage.setItem = (key, value) => {
        if (key === 'v7_story_stage_book-1') throw new Error('QuotaExceededError');
        write(key, value);
    };

    r.evaluate('game.end(true)');
    assert.equal(r.evaluate('window.storyProgressFailureShown'), true);
    assert.equal(r.evaluate('storyJourney.stage'), 0);
    assert.equal(r.getElement('result-modal').open, true);

    r.sandbox.localStorage.setItem = write;
    r.evaluate('storyJourney.retryCompletion()');
    assert.equal(r.evaluate('storyJourney.stage'), 1);
    assert.equal(r.evaluate('storyJourney.pendingCompletion'), null);
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

test('스토리 전투 입장은 한 번 확인하면 추가 시작창 없이 선택한 Day와 유형으로 실행한다', () => {
    for (const [stage, index, type, count] of [
        [0, 0, 'monsters', 8],
        [1, 0, 'objective', 6],
        [2, 1, 'spelling', 6],
        [4, 2, 'listening', 6],
        [7, 0, 'spelling', 5],
        [14, 0, 'dragon', 8],
    ]) {
        const r = browserRuntime();
        const journey = r.evaluate('storyJourney');
        journey.stage = stage;
        journey.requestSelection(stage, index);
        assert.equal(r.evaluate('game.active'), false);
        const day = journey.selection.day;
        journey.confirmSelection();
        r.advance(400);
        assert.equal(journey.selection, null);
        assert.equal(r.getElement('story-confirm-modal').open, false);
        assert.equal(r.getElement('battle-mode-story-modal').open, false);
        assert.equal(r.getElement('battle-mode-story-modal').style.display, 'none');
        assert.equal(r.getElement('battle-mode-game').style.display, 'flex');
        assert.equal(r.evaluate('game.active'), true);
        assert.equal(r.evaluate('game.mode'), 'story');
        assert.equal(r.evaluate('game.currentDay'), day);
        assert.equal(r.evaluate('game.battleQuestionType'), type);
        assert.equal(r.evaluate('game.list.length'), count);
        assert.equal(journey.pendingStage, stage);
        assert.equal(journey.pendingIndex, index);
    }
});

test('스토리 전투 확인을 취소하면 전투와 Day 배정을 시작하지 않는다', () => {
    const r = browserRuntime();
    const journey = r.evaluate('storyJourney');
    journey.stage = 1;
    journey.requestSelection(1, 0);
    journey.cancelSelection();
    r.advance(400);
    assert.equal(r.evaluate('game.active'), false);
    assert.equal(journey.events['1:0'], undefined);
    assert.equal(journey.pendingStage, null);
    assert.equal(r.getElement('battle-mode-story-modal').open, false);
    assert.equal(r.getElement('story-map-modal').style.display, 'flex');
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
    assert.match(r.getElement('story-confirm-copy').textContent, /저장하지 못했습니다/);
    assert.equal(r.getElement('story-confirm-start').disabled, false);
    r.sandbox.localStorage.setItem = write;
    r.evaluate('storyJourney.confirmSelection()');
    assert.equal(r.evaluate('db.gold'), 50);
    assert.equal(r.evaluate('storyJourney.stage'), 0);
    assert.equal(r.evaluate('storyJourney.selection'), null);
});

test('완료 저장 실패 후 지도 초기화를 저장하면 이전 완료 재시도를 정리하고 새 지점을 연다', () => {
    for (const stage of [0, 4]) {
        const r = browserRuntime({ v7_gold: '200' });
        const journey = r.evaluate('storyJourney');
        journey.stage = stage;
        journey.select(stage, 0);
        const write = r.sandbox.localStorage.setItem;
        r.sandbox.localStorage.setItem = (key, value) => {
            if (key === 'v7_story_stage_book-1') throw new Error('quota');
            write(key, value);
        };
        assert.equal(journey.completeBattle({ mistakes: 1 }), false);
        const before = Object.fromEntries(r.store);
        journey.requestReset();
        journey.confirmSelection();
        assert.deepEqual(Object.fromEntries(r.store), before);
        assert.equal(journey.pendingCompletion.mistakes, 1);
        assert.equal(journey.pendingStage, stage);

        r.sandbox.localStorage.setItem = write;
        journey.confirmSelection();
        assert.equal(r.evaluate('db.gold'), 150);
        assert.equal(journey.stage, 0);
        assert.equal(journey.pendingCompletion, null);
        assert.equal(journey.pendingStage, null);
        assert.equal(journey.pendingIndex, null);
        assert.equal(journey.pendingBook, null);
        assert.equal(journey.pendingKind, null);
        assert.equal(journey.returnAfterResult, false);
        assert.equal(journey.canSelect(0, 0), true);
        assert.equal(journey.retryCompletion(), true);
        assert.equal(journey.stage, 0);
        assert.deepEqual(Object.keys(journey.events), []);
    }
});

test('스토리 초기화는 부족한 금액을 표시하고 50골드부터 확인할 수 있다', () => {
    for (const gold of [0, 49, 50]) {
        const r = browserRuntime({ v7_gold: String(gold), 'v7_story_stage_book-1': '7' });
        const before = Object.fromEntries(r.store);
        r.evaluate('storyJourney.requestReset()');
        const button = r.getElement('story-confirm-start');
        const copy = r.getElement('story-confirm-copy').textContent;
        assert.equal(button.textContent, '초기화');
        assert.equal(button.dataset.confirmTone, 'warning');
        assert.equal(button.disabled, gold < 50);
        assert.ok(copy.includes(`보유 골드 ${gold}`));
        if (gold < 50) {
            assert.match(copy, /골드가 부족해 스토리를 초기화할 수 없습니다/);
            assert.ok(copy.includes(`${50 - gold}골드 부족`));
            r.evaluate('storyJourney.confirmSelection()');
            assert.deepEqual(Object.fromEntries(r.store), before);
            assert.equal(r.evaluate('db.gold'), gold);
            assert.equal(r.evaluate('storyJourney.stage'), 7);
        } else {
            r.evaluate('storyJourney.confirmSelection()');
            assert.equal(r.evaluate('db.gold'), 0);
            assert.equal(r.evaluate('storyJourney.stage'), 0);
        }
    }
});

test('스토리 초기화 확인 도중 골드가 줄면 부족 안내로 갱신하고 진행을 보존한다', () => {
    const r = browserRuntime({ v7_gold: '99', 'v7_story_stage_book-1': '7' });
    r.evaluate('storyJourney.requestReset(); db.commitChanges({ gold: 10 })');
    const before = Object.fromEntries(r.store);
    r.evaluate('storyJourney.confirmSelection()');
    assert.deepEqual(Object.fromEntries(r.store), before);
    assert.equal(r.evaluate('storyJourney.stage'), 7);
    assert.equal(r.getElement('story-confirm-start').disabled, true);
    assert.match(r.getElement('story-confirm-copy').textContent, /40골드 부족/);
});

test('스토리 초기화 확인을 닫고 전투를 고르면 진행 버튼을 복원한다', () => {
    const r = browserRuntime({ v7_gold: '0' });
    r.evaluate('storyJourney.requestReset(); storyJourney.cancelSelection()');
    r.evaluate('storyJourney.requestSelection(0, 0)');
    assert.equal(r.getElement('story-confirm-start').textContent, '진행');
    assert.equal(r.getElement('story-confirm-start').dataset.confirmTone, 'execute');
    assert.equal(r.getElement('story-confirm-start').disabled, false);
    assert.doesNotMatch(r.getElement('story-confirm-copy').textContent, /부족|초기화/);
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
        assert.equal(r.getElement('battle-mode-game').dataset.questionKind, 'idiom');
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
    assert.equal(r.getElement('battle-mode-game').dataset.questionKind, 'idiom');
    r.evaluate('game.stop(); game.init("battle", 1)');
    r.advance(400);
    assert.notEqual(r.getElement('battle-mode-game').dataset.questionKind, 'idiom');
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

test('도박장 150G 보상 저장·진행 재시도는 한 번만 지급하며 지난 단어장 콜백을 차단한다', () => {
    const r = browserRuntime({ v7_gold: '99' });
    r.evaluate(
        'shellGame.start = (options) => { window.casinoOptions = options; }; storyJourney.stage = 5; storyJourney.select(5, 0)'
    );
    const write = r.sandbox.localStorage.setItem;
    r.sandbox.localStorage.setItem = (key, value) => {
        if (key === 'v7_story_stage_book-1') throw new Error('quota');
        write(key, value);
    };
    assert.equal(r.evaluate('window.casinoOptions.onSettle(150)'), false);
    assert.equal(r.evaluate('db.gold'), 249);
    r.sandbox.localStorage.setItem = write;
    assert.equal(r.evaluate('window.casinoOptions.onSettle(150)'), true);
    assert.equal(r.evaluate('window.casinoOptions.onSettle(150)'), false);
    assert.equal(r.evaluate('db.gold'), 249);
    assert.equal(r.evaluate('storyJourney.stage'), 6);
    r.evaluate('window.currentGameDataSetId = 2');
    assert.equal(r.evaluate('window.casinoOptions.onSettle(150)'), false);
});

test('도박장 안전 수령 50G도 스토리에서 정상 지급하고 진행한다', () => {
    const r = browserRuntime({ v7_gold: '99' });
    r.evaluate(
        'shellGame.start = (options) => { window.casinoOptions = options; }; storyJourney.stage = 5; storyJourney.select(5, 0)'
    );

    assert.equal(r.evaluate('window.casinoOptions.onSettle(50)'), true);
    assert.equal(r.evaluate('db.gold'), 149);
    assert.equal(r.evaluate('storyJourney.stage'), 6);
});

test('보물 보상은 진행 저장에 실패해도 재시도할 수 있고 중복 지급되지 않는다', () => {
    const r = browserRuntime({ v7_gold: '99' });
    r.evaluate(`
        storyJourney.pendingStage = 0;
        storyJourney.pendingIndex = 1;
        storyJourney.pendingBook = db.getBookKey();
        storyJourney.pendingKind = 'treasure';
    `);
    const write = r.sandbox.localStorage.setItem;
    r.sandbox.localStorage.setItem = (key, value) => {
        if (key === 'v7_story_stage_book-1') throw new Error('QuotaExceededError');
        write(key, value);
    };

    r.evaluate('storyJourney.claimTreasure()');
    const reward = r.evaluate('db.gold');
    assert.ok(reward > 99);
    assert.equal(r.getElement('story-treasure-retry').hidden, false);
    assert.match(r.getElement('story-treasure-status').textContent, /진행 저장에 실패/);

    r.sandbox.localStorage.setItem = write;
    assert.equal(r.evaluate('storyJourney.claimTreasureProgress()'), true);
    assert.equal(r.evaluate('db.gold'), reward);
    assert.equal(r.evaluate('storyJourney.stage'), 1);
});
