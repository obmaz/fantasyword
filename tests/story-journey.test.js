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
    assert.equal(journey.nodes().length, 5);
    assert.equal(journey.nodes()[1][1].kind, 'market');
    journey.remember(0, 1);
    assert.equal(journey.path[0], 1);
    r.evaluate("shop.buy('shadowCompass', 'passive')");
    assert.equal(r.evaluate("db.has('shadowCompass')"), false);
    assert.equal(r.evaluate('db.gold'), 500);
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
