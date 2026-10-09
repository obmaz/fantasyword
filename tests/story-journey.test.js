const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');

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
    assert.ok(nodes.some((row) => row.length === 4));
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
