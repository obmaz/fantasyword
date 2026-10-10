const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');

test('전체 철자 입력은 첫 글자가 빠진 답을 오답으로 처리하고 골드를 주지 않는다', () => {
    const r = browserRuntime();
    r.evaluate('game.battleQuestionType = "subjective"; game.init("battle", 1)');
    r.advance(500);
    const answer = r.evaluate('game.currentQ.word');
    r.getElement('boss-input').value = answer.slice(1);
    r.evaluate('game.checkBossAnswer()');
    assert.equal(r.evaluate('game.subjectiveCorrect'), 0);
    assert.equal(r.evaluate('game.stats.gain'), 0);
    assert.equal(r.evaluate('game.sessionMistakes'), 1);
});

function failWrite(r, key) {
    const write = r.sandbox.localStorage.setItem;
    r.sandbox.localStorage.setItem = (name, value) => {
        if (name === key) throw new Error('QuotaExceededError');
        write(name, value);
    };
    return () => {
        r.sandbox.localStorage.setItem = write;
    };
}

test('물음표 공개와 골드 저장 중 하나라도 실패하면 비용·공개를 모두 되돌린다', () => {
    const r = browserRuntime({ v7_gold: '200' });
    r.evaluate('storyJourney.select(0, 1)');
    const restore = failWrite(r, 'v7_gold');
    r.evaluate('storyJourney.revealMystery()');
    assert.equal(r.evaluate('db.gold'), 200);
    assert.equal(r.store.get('v7_gold'), '200');
    assert.equal(r.evaluate('storyJourney.nodes()[0][1].kind'), 'mystery');
    restore();
    r.evaluate('storyJourney.revealMystery()');
    assert.equal(r.evaluate('db.gold'), 100);
    assert.equal(r.evaluate('storyJourney.events["0:1"].revealed'), true);
});

test('상자 보상 저장 실패는 상자를 소모하지 않으며 재시도 후 한 번만 보상한다', () => {
    const r = browserRuntime({ v7_gold: '0' });
    r.evaluate(
        'storyJourney.random = () => 0.55; storyJourney.select(0, 1); storyJourney.enterMystery()'
    );
    const restore = failWrite(r, 'v7_gold');
    r.evaluate('storyJourney.claimTreasure()');
    assert.equal(r.evaluate('db.gold'), 0);
    assert.equal(r.evaluate('storyJourney.events["0:1"].claimed'), undefined);
    assert.equal(r.evaluate('storyJourney.stage'), 0);
    restore();
    r.evaluate('storyJourney.claimTreasure(); storyJourney.claimTreasure()');
    assert.equal(r.evaluate('db.gold'), 50);
    assert.equal(r.evaluate('storyJourney.stage'), 1);
});

test('진행 저장 실패 뒤 숨겨진 상자를 재입장해도 이미 받은 보상을 반복하지 않는다', () => {
    const r = browserRuntime({ v7_gold: '0' });
    r.evaluate(
        'storyJourney.random = () => 0.55; storyJourney.select(0, 1); storyJourney.enterMystery()'
    );
    const restore = failWrite(r, 'v7_story_stage_book-1');
    r.evaluate('storyJourney.claimTreasure()');
    assert.equal(r.evaluate('db.gold'), 50);
    assert.equal(r.evaluate('storyJourney.stage'), 0);
    assert.equal(r.evaluate('storyJourney.path.length'), 0);
    assert.equal(r.evaluate('storyJourney.events["0:1"].cleared'), undefined);
    restore();
    const reloaded = browserRuntime(Object.fromEntries(r.store));
    reloaded.evaluate(
        'storyJourney.select(0, 1); storyJourney.enterMystery(); storyJourney.claimTreasure()'
    );
    assert.equal(reloaded.evaluate('db.gold'), 50);
    assert.equal(reloaded.evaluate('storyJourney.stage'), 1);
});

test('클리어 기록·경로·진행도 저장은 실패 시 모두 기존 값을 유지한다', () => {
    const r = browserRuntime();
    r.evaluate('storyJourney.select(0, 0)');
    const restore = failWrite(r, 'v7_story_stage_book-1');
    r.evaluate('storyJourney.completeBattle({ mistakes: 0 })');
    assert.equal(r.evaluate('storyJourney.stage'), 0);
    assert.equal(r.evaluate('storyJourney.path.length'), 0);
    assert.equal(r.evaluate('storyJourney.events["0:0"]?.cleared'), undefined);
    restore();
    r.evaluate('storyJourney.completeBattle({ mistakes: 0 })');
    assert.equal(r.evaluate('storyJourney.stage'), 1);
    assert.equal(r.evaluate('storyJourney.path[0]'), 0);
    assert.equal(r.evaluate('storyJourney.events["0:0"].mistakes'), 0);
});

test('묶음 저장 실패는 이미 있던 키와 새로 쓴 키를 모두 원래 상태로 복원한다', () => {
    const r = browserRuntime({ v7_gold: '200' });
    failWrite(r, 'blocked');
    assert.equal(
        r.evaluate('gameStorage.setBatch({ v7_gold: "100", created: "new", blocked: "fail" })'),
        false
    );
    assert.equal(r.store.get('v7_gold'), '200');
    assert.equal(r.store.has('created'), false);
});

test('전체 초기화 도중 삭제 실패는 먼저 지운 게임 기록과 다른 출처 데이터를 보존한다', () => {
    const r = browserRuntime({ v7_gold: '200', v7_stats: '{}', unrelated: 'keep' });
    const before = Object.fromEntries(r.store);
    const remove = r.sandbox.localStorage.removeItem;
    r.sandbox.localStorage.removeItem = (key) => {
        if (key === 'v7_stats') throw new Error('SecurityError');
        remove(key);
    };
    assert.equal(r.evaluate('gameStorage.clearGameData()'), false);
    assert.deepEqual(Object.fromEntries(r.store), before);
});

test('상점의 무기·장비·스킬·가방 구매 저장 실패는 비용과 상품을 모두 보존한다', () => {
    for (const [id, type, blockedKey] of [
        ['fire', 'weapon', 'v7_owned'],
        ['goldGlove', 'item', 'v7_dura'],
        ['hint', 'skill', 'v7_skills'],
        ['backpack', 'backpack', 'v7_inventory_capacity'],
    ]) {
        const r = browserRuntime({ v7_gold: '5000' });
        r.evaluate('inventory.render = () => {}; shop.render = () => {}');
        const before = r.evaluate(
            'JSON.stringify([db.gold, db.owned, db.inventory, db.durability, db.skills, db.inventoryCapacity])'
        );
        const savedBefore = Object.fromEntries(r.store);
        const restore = failWrite(r, blockedKey);
        r.evaluate(`shop.buy('${id}', '${type}')`);
        assert.equal(
            r.evaluate(
                'JSON.stringify([db.gold, db.owned, db.inventory, db.durability, db.skills, db.inventoryCapacity])'
            ),
            before
        );
        assert.deepEqual(Object.fromEntries(r.store), savedBefore);
        restore();
        r.evaluate(`shop.buy('${id}', '${type}')`);
        assert.ok(r.evaluate('db.gold') < 5000);
    }
});

test('암시장 성공 상품과 비용은 함께 저장하고 결제 실패는 골드를 보존한다', () => {
    for (const [random, blockedKey] of [
        [0, 'v7_owned'],
        [0.9, 'v7_gold'],
    ]) {
        const r = browserRuntime({ v7_gold: '500' });
        r.evaluate(`storyJourney.random = () => ${random}`);
        const restore = failWrite(r, blockedKey);
        r.evaluate('storyJourney.buy()');
        assert.equal(r.evaluate('db.gold'), 500);
        assert.equal(r.store.get('v7_gold'), '500');
        assert.equal(r.evaluate('db.has("shadowCompass")'), false);
        restore();
        r.evaluate('storyJourney.buy()');
        assert.equal(r.evaluate('db.gold'), 320);
        assert.equal(r.evaluate('db.has("shadowCompass")'), random === 0);
    }
});

test('연습 필터 선택은 보조기술에도 전달되고 빈 목록의 암기 상태를 초기화한다', () => {
    const r = browserRuntime();
    const chips = ['all', 'memorized', 'not-memorized'].map((value) => {
        const chip = r.getElement(`filter-${value}`);
        chip.getAttribute = (name) => (name === 'data-filter' ? value : null);
        return chip;
    });
    r.sandbox.document.querySelectorAll = (selector) =>
        selector === '#practice-filter-chips .practice-chip' ? chips : [];
    r.evaluate('practiceMemorization.start(1); practiceMemorization.applyFilter("memorized")');
    assert.deepEqual(
        chips.map((chip) => chip['aria-pressed']),
        ['false', 'true', 'false']
    );
    r.getElement('practice-memorized-btn').textContent = '외움 취소';
    r.evaluate('practiceMemorization.applyFilter("memorized")');
    assert.equal(r.getElement('practice-memorized-btn').textContent, '외웠어요');
    assert.equal(r.getElement('practice-memorized-btn')['aria-pressed'], 'false');
});

test('아이템 상세를 닫으면 호출 버튼으로, 렌더 뒤 버튼이 없으면 장비 닫기로 포커스를 복원한다', () => {
    for (const connected of [true, false]) {
        const r = browserRuntime({ v7_inventory: '["helmet"]' });
        const trigger = r.getElement('item-trigger');
        let focused;
        trigger.focus = () => {
            focused = trigger;
        };
        const close = r.getElement('inventory-close');
        close.focus = () => {
            focused = close;
        };
        trigger.isConnected = connected;
        r.sandbox.document.activeElement = trigger;
        r.getElement('inventory-modal').contains = () => true;
        r.getElement('inv-item-detail').contains = () => false;
        r.sandbox.document.querySelector = (selector) =>
            selector === '#inventory-modal .modal-header .modal-close-x' ? close : null;
        r.evaluate('inventory.showDetails("helmet", "item"); inventory.hideDetails()');
        assert.equal(focused, connected ? trigger : close);
    }
});
