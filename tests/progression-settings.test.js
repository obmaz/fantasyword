const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');
const { assembleAnswer } = require('./helpers/assemble-answer');

test('배낭 구매는 보관함 용량과 화면 표시를 즉시 늘리고 재로딩 후에도 보존한다', () => {
    const r = browserRuntime({ v7_gold: '500' });
    r.evaluate('inventory.render(); shop.render()');
    assert.match(r.getElement('inventory-capacity-summary').textContent, /0 \/ 3칸/);
    assert.match(
        r.evaluate('shop.createItemHtml(relics.find(i => i.id === "backpack"), "backpack")'),
        /3칸 → 4칸/
    );
    r.evaluate('shop.buy("backpack", "backpack"); shop.buy("backpack", "backpack")');
    assert.equal(r.evaluate('db.inventoryCapacity'), 5);
    assert.equal(r.evaluate('db.gold'), 260);
    assert.match(r.getElement('inventory-capacity-summary').textContent, /0 \/ 5칸 · 빈칸 5칸/);
    assert.match(r.getElement('shop-container').innerHTML, /최대 5칸 → 6칸/);
    const restored = browserRuntime(Object.fromEntries(r.store));
    assert.equal(restored.evaluate('db.inventoryCapacity'), 5);
});

test('관리 도구는 설정 음악 OFF→ON 3회에만 열리고 닫기·다른 설정·시간 지연은 연속 입력을 초기화한다', () => {
    const r = browserRuntime();
    r.sandbox.onload();
    r.evaluate('settingsManager.open()');
    const toggle = r.getElement('setting-music-play');
    function change(enabled) {
        toggle.checked = enabled;
        toggle.dispatch('change');
    }
    for (let i = 0; i < 2; i++) {
        change(false);
        change(true);
    }
    assert.equal(r.getElement('settings-admin-gold').hidden, true);
    change(false);
    change(true);
    assert.equal(r.getElement('settings-admin-gold').hidden, false);
    assert.equal(r.getElement('settings-admin-stats').hidden, false);
    r.evaluate('settingsManager.close(); settingsManager.open()');
    assert.equal(r.getElement('settings-admin-gold').hidden, true);
    change(false);
    change(true);
    r.advance(5001);
    assert.equal(r.evaluate('settingsManager.musicTogglePairs'), 0);
    change(false);
    change(true);
    r.getElement('setting-word-read').dispatch('change');
    assert.equal(r.evaluate('settingsManager.musicTogglePairs'), 0);
});

test('스토리 최종 보스는 실제 철자 타일로 답을 입력하고 동 왕관도 다음 단계로 진행한다', () => {
    const r = browserRuntime({ v7_settings: '{"musicPlay":false,"wordRead":false}' });
    r.sandbox.rawDataData = [
        'apple',
        'zzlexeme',
        'cat',
        'dog',
        'banana',
        'paper',
        'machine',
        'season',
    ].map((word) => ({ day: 1, word, meaning: '뜻', englishExplanation: 'a puzzle to solve' }));
    const journey = r.evaluate('storyJourney');
    const game = r.evaluate('game');
    game.shuffle = (list) => [...list];
    journey.stage = 14;
    journey.select(14, 0);
    game.init('story', 'all');
    r.advance(400);
    game.gear.shield = 0;
    for (let i = 0; i < 8; i++) {
        assert.ok(['cloze', 'riddle'].includes(game.currentQ.questionKind));
        // 가짜 DOM의 innerHTML 초기화는 자식 배열을 비우지 않으므로 현재 렌더의 키를 고른다.
        const first = r.getElement('spelling-tiles').children.at(-game.spellingTiles.length);
        first.click();
        assert.equal(game.spellingChosen.length, 1);
        game.removeSpellingLetter();
        assert.equal(game.spellingChosen.length, 0);
        if (i < 2) game.handleAnswer(false, null);
        else {
            assembleAnswer(game);
            game.checkBossAnswer();
        }
        r.advance(i < 2 ? 2500 : 800);
    }
    assert.equal(journey.stage, 15);
    assert.equal(journey.events['14:0'].mistakes, 2);
    assert.equal(r.evaluate('storyMapRules.crown(storyJourney.events["14:0"].mistakes)'), 'bronze');
});

test('건틀릿은 4회로 제한하고 남은 1회 및 저장된 0골드는 보존한다', () => {
    const r = browserRuntime({
        v7_gold: '0',
        v7_inventory: '["goldGlove"]',
        v7_dura: '{"goldGlove":1}',
    });
    assert.equal(r.evaluate('db.gold'), 0);
    assert.equal(r.evaluate('db.durability.goldGlove'), 1);
    assert.equal(r.evaluate('items.find(i => i.id === "goldGlove").durability'), 4);
    const old = browserRuntime({ v7_dura: '{"goldGlove":30}' });
    assert.equal(old.evaluate('db.durability.goldGlove'), 4);
    assert.equal(JSON.parse(old.store.get('v7_dura')).goldGlove, 4);
});
