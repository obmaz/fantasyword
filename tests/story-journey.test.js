const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');
const { assembleAnswer, assembleWrongAnswer } = require('./helpers/assemble-answer');

test('스토리 진행은 단어장별로 저장하고 암시장 유물은 일반 상점에서 살 수 없다', () => {
    const r = browserRuntime({ v7_gold: '500' });
    const journey = r.evaluate('storyJourney');
    assert.equal(journey.stage, 0);
    journey.stage = 2;
    assert.equal(journey.stage, 2);
    assert.equal(r.evaluate('gameStorage.get(storyJourney.key)'), '2');
    assert.equal(journey.nodes().length, 15);
    assert.equal(journey.nodes()[1][1].kind, 'market');
    journey.remember(0, 1);
    assert.equal(journey.path[0], 1);
    r.evaluate("shop.buy('shadowCompass', 'passive')");
    assert.equal(r.evaluate("db.has('shadowCompass')"), false);
    assert.equal(r.evaluate('db.gold'), 500);
});

test('스토리 지도는 연결된 분기만 선택하고 모든 다음 행 지점에 도달할 수 있다', () => {
    const r = browserRuntime();
    const journey = r.evaluate('storyJourney');
    const nodes = journey.nodes();
    assert.ok(nodes.some((row) => row.length === 1));
    assert.ok(nodes.some((row) => row.length === 3));
    const forks = new Set(
        nodes.flatMap((row, stage) =>
            row.map((_, index) => journey.connections(stage, index).length)
        )
    );
    assert.ok(forks.has(1) && forks.has(2) && forks.has(3));
    assert.equal(nodes.at(-1)[0].kind, 'boss');
    for (let row = 0; row < nodes.length - 1; row++) {
        const reachable = new Set(
            nodes[row].flatMap((_, index) => journey.connections(row, index))
        );
        assert.equal(reachable.size, nodes[row + 1].length);
    }
    journey.stage = 2;
    journey.remember(1, 0);
    const connected = journey.connections(1, 0);
    for (let index = 0; index < nodes[2].length; index++) {
        assert.equal(journey.canSelect(2, index), connected.includes(index));
    }
    const blocked = nodes[2].findIndex((_, index) => !connected.includes(index));
    journey.select(2, blocked);
    assert.equal(journey.pendingStage, null);
    assert.equal(journey.canSelect(3, 0), false);
});

test('기존 5단계 진행은 보존해 확장 지도에서 이어가며 마지막은 15단계다', () => {
    const r = browserRuntime();
    const journey = r.evaluate('storyJourney');
    journey.stage = 5;
    journey.remember(4, 0);
    assert.equal(journey.stage, 5);
    assert.equal(journey.path[4], 0);
    journey.stage = 99;
    assert.equal(journey.stage, 15);
});

test('암시장 구매 실패는 골드만 차감하고 재구매할 수 있으며 성공 시 유물을 준다', () => {
    const r = browserRuntime({ v7_gold: '500' });
    const journey = r.evaluate('storyJourney');
    journey.random = () => 0.9;
    journey.buy();
    assert.equal(r.evaluate('db.gold'), 320);
    assert.equal(r.evaluate("db.has('shadowCompass')"), false);
    assert.match(r.getElement('story-market-status').textContent, /거래 실패/);
    journey.random = () => 0.1;
    journey.buy();
    assert.equal(r.evaluate('db.gold'), 140);
    assert.equal(r.evaluate("db.has('shadowCompass')"), true);
});

test('물음표는 미리 보여주지 않고 입장 후 전투·암시장·보물·총공세 결과를 고정한다', () => {
    for (const [random, kind] of [
        [0, 'battle'],
        [0.3, 'market'],
        [0.55, 'treasure'],
        [0.75, 'assault'],
        [0.95, 'idiom'],
    ]) {
        const r = browserRuntime();
        const journey = r.evaluate('storyJourney');
        r.evaluate(
            'window.assaultOptions = null; skyfall.start = (day, options) => { window.assaultOptions = options; };'
        );
        journey.random = () => random;
        journey.select(0, 1);
        assert.equal(journey.pendingKind, null);
        assert.equal(journey.nodes()[0][1].kind, 'mystery');
        journey.enterMystery();
        assert.equal(journey.nodes()[0][1].kind, 'mystery');
        assert.equal(journey.events['0:1'].kind, kind);
        assert.equal(journey.pendingKind, kind);
        journey.cancelBattleReturn();
        journey.random = () => 1 - random;
        journey.select(0, 1);
        journey.enterMystery();
        assert.equal(journey.events['0:1'].kind, kind);
        assert.equal(journey.pendingKind, kind);
        if (kind === 'assault') assert.equal(r.evaluate('window.assaultOptions.count'), 8);
    }
});

test('보물 상자는 한 번만 골드를 주고 다음 단계로 진행하며 나가기는 보상을 주지 않는다', () => {
    const r = browserRuntime({ v7_gold: '0' });
    const journey = r.evaluate('storyJourney');
    journey.random = () => 0.55;
    journey.select(0, 1);
    journey.enterMystery();
    journey.leaveTreasure();
    assert.equal(r.evaluate('db.gold'), 0);
    assert.equal(journey.stage, 0);
    journey.select(0, 1);
    journey.enterMystery();
    journey.claimTreasure();
    assert.equal(r.evaluate('db.gold'), 50);
    assert.equal(journey.stage, 1);
    journey.claimTreasure();
    assert.equal(r.evaluate('db.gold'), 50);
});

test('물음표 확인은 100골드를 한 번만 차감하고 저장·닫기·재입장 후에도 공개를 유지한다', () => {
    const r = browserRuntime({ v7_gold: '250' });
    const journey = r.evaluate('storyJourney');
    journey.random = () => 0.3;
    journey.select(0, 1);
    assert.equal(r.evaluate('db.gold'), 250);
    assert.deepEqual(Object.keys(journey.events), []);
    journey.revealMystery();
    assert.equal(r.evaluate('db.gold'), 150);
    assert.equal(journey.nodes()[0][1].kind, 'market');
    assert.equal(journey.stage, 0);
    journey.revealMystery();
    assert.equal(r.evaluate('db.gold'), 150);
    journey.leaveMystery();
    journey.random = () => 0.9;
    journey.select(0, 1);
    assert.equal(journey.pendingKind, 'market');
    assert.equal(r.evaluate('db.gold'), 150);
    assert.equal(journey.events['0:1'].revealed, true);
});

test('골드 부족·닫기·단어장 변경·연결되지 않은 지점은 물음표 정보나 골드를 바꾸지 않는다', () => {
    const r = browserRuntime({ v7_gold: '99' });
    const journey = r.evaluate('storyJourney');
    journey.select(0, 1);
    journey.revealMystery();
    assert.equal(r.evaluate('db.gold'), 99);
    assert.equal(journey.nodes()[0][1].kind, 'mystery');
    assert.deepEqual(Object.keys(journey.events), []);
    journey.leaveMystery();
    journey.revealMystery();
    assert.equal(r.evaluate('db.gold'), 99);
    journey.select(0, 1);
    journey.mysterySelection.book = 'other-book';
    r.evaluate('db.addGold(101)');
    journey.revealMystery();
    assert.equal(r.evaluate('db.gold'), 200);
    journey.mysterySelection.book = r.evaluate('db.getBookKey()');
    journey.stage = 1;
    journey.revealMystery();
    journey.enterMystery();
    assert.equal(r.evaluate('db.gold'), 200);
    assert.equal(journey.pendingKind, null);
});

test('총공세 승리만 스토리를 진행하고 패배·중도 종료는 같은 지점으로 돌아간다', () => {
    for (const won of [false, true]) {
        const r = browserRuntime();
        const journey = r.evaluate('storyJourney');
        r.evaluate('skyfall.start = (day, options) => { window.storyAssault = options; };');
        journey.random = () => 0.75;
        journey.select(0, 1);
        journey.enterMystery();
        r.evaluate(`window.storyAssault.onFinish(${won})`);
        assert.equal(journey.stage, won ? 1 : 0);
        r.evaluate('window.storyAssault.onExit()');
        assert.equal(journey.pendingStage, null);
        assert.equal(journey.stage, won ? 1 : 0);
    }
});

test('지난 총공세 완료 콜백은 다음 지점의 진행과 선택을 바꾸지 않는다', () => {
    const r = browserRuntime();
    const journey = r.evaluate('storyJourney');
    r.evaluate('skyfall.start = (day, options) => { window.storyAssault = options; };');
    journey.random = () => 0.75;
    journey.select(0, 1);
    journey.enterMystery();
    r.evaluate('window.oldStoryAssault = window.storyAssault; window.storyAssault.onFinish(true)');
    journey.random = () => 0.3;
    journey.select(1, journey.connections(0, 1)[0]);
    r.evaluate('window.oldStoryAssault.onFinish(true); window.oldStoryAssault.onExit();');
    assert.equal(journey.stage, 1);
    assert.equal(journey.pendingKind, 'objective');
});

test('고정 철자·듣기·보스 칸은 Day 없이 지정한 방식으로 출제한다', () => {
    const r = browserRuntime();
    for (const [type, kind] of [
        ['spelling', 'spelling'],
        ['listening', 'listening'],
        ['dragon', 'riddle'],
    ]) {
        const questions = r.evaluate(`game._buildBattleList(rawData, 6, '${type}')`);
        assert.equal(questions.length, 6);
        assert.ok(
            questions.every((q) =>
                type === 'dragon'
                    ? ['riddle', 'cloze'].includes(q.questionKind)
                    : q.questionKind === kind
            )
        );
    }
    const journey = r.evaluate('storyJourney');
    journey.pendingKind = 'miniboss';
    assert.equal(journey.canComplete(2, 5), false);
    assert.equal(journey.canComplete(3, 5), true);
    journey.pendingKind = 'boss';
    assert.equal(journey.canComplete(5, 8), false);
    assert.equal(journey.canComplete(6, 8), true);
});

test('두 미니보스는 드래곤 외형과 한국어 뜻 철자조립으로 출제하고 왕관으로 다음 길을 연다', () => {
    for (const stage of [7, 11]) {
        for (const mistakes of [0, 1, 2, 3]) {
            const r = browserRuntime();
            const journey = r.evaluate('storyJourney');
            const game = r.evaluate('game');
            journey.stage = stage;
            journey.select(stage, 0);
            game.init('story', 'all');
            r.advance(400);
            game.gear.shield = 0;
            assert.equal(game.list.length, 5);
            assert.ok(game.list.every((q) => q.monsterId === 'dragon'));
            assert.ok(game.list.every((q) => q.questionKind === 'spelling'));
            for (let index = 0; index < 5; index++) {
                assert.equal(r.getElement('q-text').innerText, game.currentQ.meaning);
                assert.equal(r.getElement('spelling-panel').hidden, false);
                assert.equal(r.getElement('boss-box').style.display, 'none');
                assert.equal(
                    game.spellingTiles.length,
                    [...game.currentQ.word].filter((letter) => /[a-z]/i.test(letter)).length + 3
                );
                if (index < mistakes) assembleWrongAnswer(game);
                else assembleAnswer(game);
                game.checkBossAnswer();
                r.advance(index < mistakes ? 2500 : 800);
            }
            assert.equal(journey.stage, mistakes <= 2 ? stage + 1 : stage);
            if (mistakes <= 2) {
                assert.equal(journey.events[`${stage}:0`].cleared, true);
                assert.equal(journey.events[`${stage}:0`].mistakes, mistakes);
                for (const index of journey.connections(stage, 0))
                    assert.equal(journey.canSelect(stage + 1, index), true);
            } else assert.equal(journey.events[`${stage}:0`], undefined);
        }
    }
});

test('미니보스 중도 종료 후 일반 철자조립은 고블린으로 돌아가고 마지막 보스는 영어 문제를 유지한다', () => {
    const r = browserRuntime();
    const journey = r.evaluate('storyJourney');
    const game = r.evaluate('game');
    journey.stage = 7;
    journey.select(7, 0);
    game.init('story', 'all');
    r.advance(400);
    game.exit();
    assert.equal(journey.events['7:0'], undefined);
    game.battleQuestionType = 'spelling';
    game.init('battle', 1);
    r.advance(400);
    assert.ok(game.list.every((q) => q.monsterId === 'goblin'));
    game.exit();
    journey.stage = 14;
    journey.select(14, 0);
    game.init('story', 'all');
    r.advance(400);
    assert.equal(game.list.length, 8);
    assert.ok(
        game.list.every(
            (q) => q.monsterId === 'dragon' && ['cloze', 'riddle'].includes(q.questionKind)
        )
    );
});

test('스토리 전투의 문제 수는 일반 전투 select와 독립적으로 5·6·8개를 사용한다', () => {
    for (const [stage, index, count] of [
        [0, 0, 8],
        [2, 1, 6],
        [4, 2, 6],
        [7, 0, 5],
        [14, 0, 8],
    ]) {
        const r = browserRuntime();
        const journey = r.evaluate('storyJourney');
        journey.stage = stage;
        journey.select(stage, index);
        r.getElement('count-select').value = '20';
        r.evaluate("game.init('story', 'all')");
        r.advance(400);
        assert.equal(r.evaluate('game.list.length'), count);
        assert.equal(r.evaluate('game.currentDay'), 'all');
    }
});

test('스토리 클리어는 실제 오답 수를 저장하고 0·1·2개에 금·은·동 왕관을 준다', () => {
    for (const [mistakes, crown] of [
        [0, 'gold'],
        [1, 'silver'],
        [2, 'bronze'],
        [3, null],
    ]) {
        const r = browserRuntime();
        const journey = r.evaluate('storyJourney');
        journey.select(0, 0);
        r.evaluate("game.init('story', 'all')");
        r.advance(400);
        r.evaluate('game.gear.shield = 0');
        for (let index = 0; index < 8; index++) {
            r.evaluate(`game.handleAnswer(${index >= mistakes}, null)`);
            r.advance(index < mistakes ? 2500 : 800);
        }
        assert.equal(journey.stage, crown ? 1 : 0);
        if (!crown) {
            assert.equal(journey.events['0:0'], undefined);
            continue;
        }
        assert.equal(journey.events['0:0'].cleared, true);
        assert.equal(journey.events['0:0'].mistakes, mistakes);
        assert.equal(r.evaluate(`storyMapRules.crown(${mistakes})`), crown);
        const saved = JSON.parse(r.evaluate('gameStorage.get(storyJourney.eventsKey)'));
        assert.equal(saved['0:0'].mistakes, mistakes);
    }
});

test('방패로 다시 맞춘 문제도 오답 횟수에 포함하고 실패·중도 종료는 클리어를 기록하지 않는다', () => {
    const r = browserRuntime();
    const journey = r.evaluate('storyJourney');
    journey.select(0, 0);
    r.evaluate("game.init('story', 'all')");
    r.advance(400);
    r.evaluate('game.gear.shield = 1; game.handleAnswer(false, null)');
    r.advance(800);
    for (let index = 0; index < 8; index++) {
        r.evaluate('game.handleAnswer(true, null)');
        r.advance(800);
    }
    assert.equal(journey.events['0:0'].mistakes, 1);
    const failed = browserRuntime();
    failed.evaluate("storyJourney.select(0, 0); game.init('story', 'all')");
    failed.advance(400);
    failed.evaluate('game.end(false)');
    assert.equal(failed.evaluate('storyJourney.stage'), 0);
    assert.equal(failed.evaluate("storyJourney.events['0:0']"), undefined);
    failed.evaluate('storyJourney.cancelBattleReturn()');
    assert.equal(failed.evaluate('storyMapRules.crown(undefined)'), null);
});
