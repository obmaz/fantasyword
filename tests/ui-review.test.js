const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');

const quiet = { v7_settings: '{"musicPlay":false,"wordRead":false}' };

test('동작 줄이기에서는 팝업 닫기 대기 없이 즉시 조작을 돌려준다', () => {
    const r = browserRuntime(quiet, { matchMedia: () => ({ matches: true }) });
    r.getElement('shop-modal').classList.add('screen-overlay');
    r.evaluate('shop.open(); shop.close()');
    assert.equal(r.getElement('shop-modal').open, false);
    assert.equal(r.getElement('shop-modal').style.display, 'none');
});

test('DOM 준비만으로 조작을 초기화하며 뒤따르는 load는 리스너를 중복 등록하지 않는다', () => {
    const r = browserRuntime(quiet);
    for (const listener of r.documentEvents.DOMContentLoaded) listener();
    const clicks = r.documentEvents.click.length;
    const header = r.getElement('battle-header-host').children[0];
    r.sandbox.onload();
    r.sandbox.onload();
    assert.equal(r.documentEvents.click.length, clicks);
    assert.equal(r.getElement('battle-header-host').children[0], header);
    assert.ok(header);
});

test('도전 시작은 닫기 애니메이션을 기다리지 않고 첫 문제를 준비한다', () => {
    const r = browserRuntime(quiet);
    r.sandbox.onload();
    r.getElement('battle-mode-modal-count-select').value = '10';
    r.getElement('battle-mode-modal-day-select').value = '1';
    r.evaluate('openBattleModeModal()');
    r.getElement('battle-mode-modal-start-btn').dispatch('click');
    r.advance(0);
    assert.equal(r.getElement('battle-mode-modal').open, false);
    assert.equal(r.getElement('battle-mode-game').style.display, 'flex');
    assert.ok(r.evaluate('game.currentQ'));
});

test('스토리 지도는 저장 데이터를 각 한 번 읽고 새로 열면 최신 진행을 반영한다', () => {
    const r = browserRuntime(quiet);
    const reads = new Map();
    const original = r.sandbox.localStorage.getItem;
    r.sandbox.localStorage.getItem = (key) => {
        reads.set(key, (reads.get(key) || 0) + 1);
        return original(key);
    };
    r.evaluate('storyJourney.render()');
    for (const suffix of ['stage', 'layout', 'path', 'events']) {
        assert.equal(reads.get(`v7_story_${suffix}_book-1`), 1, suffix);
    }
    r.evaluate('storyJourney.stage = 2; storyJourney.remember(1, 0)');
    const snapshot = r.evaluate('storyJourney.render()');
    assert.equal(snapshot.stage, 2);
    assert.equal(snapshot.path[1], 0);
});

test('게임 보상은 숨겨진 상점·장비 목록을 재생성하지 않고 열 때 최신 내용을 표시한다', () => {
    const r = browserRuntime({ ...quiet, v7_gold: '1000' });
    let shopRenders = 0;
    let inventoryRenders = 0;
    const shop = r.evaluate('shop');
    const inventory = r.evaluate('inventory');
    const renderShop = shop.render;
    const renderInventory = inventory.render;
    shop.render = () => {
        shopRenders++;
        renderShop();
    };
    inventory.render = () => {
        inventoryRenders++;
        renderInventory();
    };
    inventory.grantReward('backpack');
    assert.equal(shopRenders, 0);
    assert.equal(inventoryRenders, 0);
    inventory.open();
    assert.equal(inventoryRenders, 1);
    assert.match(r.getElement('inventory-capacity-summary').textContent, /4칸/);
    shop.open();
    assert.equal(shopRenders, 1);
    assert.match(r.getElement('shop-container').innerHTML, /최대 4칸 → 5칸/);
});

test('건틀릿 잔여 횟수는 아이템 수명과 같은 분모를 표시한다', () => {
    const r = browserRuntime({
        ...quiet,
        v7_equipped: '{"gloves":"goldGlove"}',
        v7_dura: '{"goldGlove":8}',
    });
    r.evaluate('ui.updateSkills()');
    const glove = r.getElement('skill-display').children.find((el) => el.title.includes('건틀릿'));
    assert.match(glove.innerHTML, /8\/10/);
    assert.equal(r.evaluate('items.find(item => item.id === "goldGlove").durability'), 10);
});

test('콤보가 없는 장비 모델에서도 재도전·힌트 항목을 잃지 않는다', () => {
    const r = browserRuntime({
        ...quiet,
        v7_owned: '["basic","shield_item"]',
        v7_equipped: '{"hand-2":"shield_item","head":"helmet"}',
    });
    r.evaluate('game.gear = equipmentRules.load(db.equipped, weapons, null); ui.updateSkills()');
    assert.equal(r.evaluate('game.gear.weapon'), false);
    assert.equal(r.getElement('battle-mode-game').dataset.combo, '');
    assert.ok(
        r.getElement('equipment-display').children.some((el) => el.innerHTML.includes('힌트'))
    );
    assert.ok(
        r.getElement('equipment-display').children.some((el) => el.innerHTML.includes('재도전'))
    );
});

test('변하지 않은 무기 레이어는 골드·장비 UI 갱신에서 같은 이미지 DOM을 유지한다', () => {
    const r = browserRuntime(quiet);
    const root = r.getElement('avatar-cache-test');
    const weapon = r.getElement('avatar-cache-weapon');
    let writes = 0;
    Object.defineProperty(weapon, 'innerHTML', {
        get: () => '',
        set: () => {
            writes++;
        },
    });
    root.querySelectorAll = (selector) =>
        selector === '[data-avatar-part="weapon"]' ? [weapon] : [];
    const render = (id) =>
        r.evaluate('renderEquipmentAvatar')(root, {
            equipped: { 'hand-1': id },
            durability: {},
            weapons: r.evaluate('weapons'),
            items: r.evaluate('items'),
            fallback: null,
        });
    render('basic');
    render('basic');
    assert.equal(writes, 1);
    render('fire');
    assert.equal(writes, 2);
    render(null);
    assert.equal(writes, 3);
    assert.equal(weapon.hidden, true);
});
