const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');

function equipmentRuntime(saved = {}) {
    const r = browserRuntime({
        v7_owned: '["basic","midasSword","void","fire","goldDagger"]',
        v7_inventory_capacity: '12',
        ...saved,
    });
    r.evaluate('inventory.render = () => {}; shop.render = () => {}');
    return r;
}

test('황금장갑 구매·장착·해제는 전용 슬롯과 보관함에 한 번만 저장된다', () => {
    const r = equipmentRuntime({ v7_gold: '2000' });
    r.evaluate('shop.buy("goldGlove", "item"); inventory.equip("goldGlove", "item")');
    assert.equal(r.evaluate('db.gold'), 1900);
    assert.equal(r.evaluate('db.equipped.gloves'), 'goldGlove');
    assert.equal(r.evaluate('db.durability.goldGlove'), 10);
    assert.equal(r.evaluate('db.inventory.includes("goldGlove")'), false);
    r.evaluate('inventory.unequip("gloves")');
    assert.equal(r.evaluate('db.equipped.gloves'), undefined);
    assert.equal(r.evaluate('db.inventory.filter(id => id === "goldGlove").length'), 1);
    const restored = equipmentRuntime(Object.fromEntries(r.store));
    assert.equal(restored.evaluate('db.inventory.includes("goldGlove")'), true);
    assert.equal(restored.evaluate('db.durability.goldGlove'), 10);
});

test('이전 황금장갑 유물은 현행 10회 상한으로 장갑 슬롯에 한 번만 이전된다', () => {
    const r = equipmentRuntime({ v7_owned: '["basic","goldGlove"]', v7_dura: '{"goldGlove":7}' });
    assert.equal(r.evaluate('db.equipped.gloves'), 'goldGlove');
    assert.equal(r.evaluate('db.durability.goldGlove'), 7);
    assert.equal(r.evaluate('db.owned.includes("goldGlove")'), false);
    assert.equal(r.evaluate('inventory.getStoredCount()'), 0);
    const restored = equipmentRuntime(Object.fromEntries(r.store));
    assert.equal(restored.evaluate('db.equipped.gloves'), 'goldGlove');
    assert.equal(restored.evaluate('db.durability.goldGlove'), 7);
    assert.equal(restored.evaluate('db.inventory.includes("goldGlove")'), false);
});

test('오른손 전용 무기와 왼손 전용 이펙트는 잘못된 손 요청을 거부한다', () => {
    const r = equipmentRuntime();
    const before = r.evaluate('JSON.stringify(db.equipped)');
    r.evaluate('inventory.equip("midasSword", "weapon", "hand-2")');
    r.evaluate('inventory.equip("void", "weapon", "hand-1")');
    assert.equal(r.evaluate('JSON.stringify(db.equipped)'), before);
    r.evaluate('inventory.equip("midasSword", "weapon", "hand-1")');
    r.evaluate('inventory.equip("void", "weapon", "hand-2")');
    assert.equal(r.evaluate('db.equipped["hand-1"]'), 'midasSword');
    assert.equal(r.evaluate('db.equipped["hand-2"]'), 'void');
    assert.equal(r.evaluate('db.equippedWeapon'), 'midasSword');
});

test('같은 손의 새 무기는 이전 장비를 보관함으로 교체하고 다른 손은 유지한다', () => {
    const r = equipmentRuntime({
        v7_equipped: '{"hand-1":"midasSword","hand-2":"void"}',
        v7_equip: 'midasSword',
    });
    r.evaluate('inventory.showDetails("goldDagger", "weapon")');
    assert.equal(r.getElement('detail-actions').children[0].innerText, '오른손 교체');
    r.getElement('detail-actions').children[0].click();
    assert.equal(r.evaluate('db.equipped["hand-1"]'), 'goldDagger');
    assert.equal(r.evaluate('db.equipped["hand-2"]'), 'void');
    assert.equal(r.evaluate('db.equippedWeapon'), 'goldDagger');
    assert.equal(r.evaluate('Object.values(db.equipped).includes("midasSword")'), false);
    assert.equal(r.evaluate('db.has("midasSword")'), true);
    r.evaluate('inventory.showDetails("goldDagger", "weapon")');
    assert.equal(r.getElement('detail-actions').children.at(-3).disabled, true);
    const restored = equipmentRuntime(Object.fromEntries(r.store));
    assert.equal(restored.evaluate('db.equipped["hand-1"]'), 'goldDagger');
    assert.equal(restored.evaluate('db.equipped["hand-2"]'), 'void');
    assert.equal(restored.evaluate('db.equippedWeapon'), 'goldDagger');
});

test('무기 교체 저장이 실패하면 슬롯과 주무기 저장이 함께 이전 상태를 유지한다', () => {
    const r = equipmentRuntime({
        v7_equipped: '{"hand-1":"midasSword"}',
        v7_equip: 'midasSword',
    });
    const storage = r.sandbox.localStorage;
    const original = storage.setItem;
    storage.setItem = (key, value) => {
        if (key === 'v7_equip' && value === 'goldDagger') throw new Error('QuotaExceededError');
        original(key, value);
    };
    r.evaluate('inventory.equip("goldDagger", "weapon", "hand-1")');
    assert.equal(r.evaluate('db.equipped["hand-1"]'), 'midasSword');
    assert.equal(r.evaluate('db.equippedWeapon'), 'midasSword');
    assert.equal(JSON.parse(r.store.get('v7_equipped'))['hand-1'], 'midasSword');
    assert.equal(r.store.get('v7_equip'), 'midasSword');
});

test('장비 상세에서 제공하는 손 선택은 실제 장착 위치와 일치한다', () => {
    for (const [id, labels, slots] of [
        ['midasSword', ['오른손 장착'], ['hand-1']],
        ['void', ['왼손 장착'], ['hand-2']],
        ['fire', ['오른손 장착', '왼손 장착'], ['hand-1', 'hand-2']],
    ]) {
        const r = equipmentRuntime();
        r.evaluate(`inventory.showDetails("${id}", "weapon")`);
        const buttons = r.getElement('detail-actions').children;
        assert.deepEqual(
            buttons.map((button) => button.innerText),
            labels
        );
        buttons.forEach((button, index) => {
            button.click();
            assert.equal(r.evaluate(`db.equipped["${slots[index]}"]`), id);
            assert.equal(
                r.evaluate(`Object.values(db.equipped).filter(id => id === "${id}").length`),
                1
            );
        });
    }
});

test('양손 장착 가능한 경제형 무기도 골드 보너스는 오른손에서만 적용된다', () => {
    const r = equipmentRuntime();
    r.evaluate('inventory.showDetails("goldDagger", "weapon")');
    assert.match(r.getElement('detail-desc').innerText, /골드 보너스는 오른손/);
    r.evaluate('inventory.equip("goldDagger", "weapon", "hand-1")');
    assert.equal(r.evaluate('weapons.find(w => w.id === db.equippedWeapon).multiplier'), 1.2);
    r.evaluate('inventory.equip("goldDagger", "weapon", "hand-2")');
    assert.equal(r.evaluate('db.equipped["hand-1"]'), undefined);
    assert.equal(r.evaluate('db.equipped["hand-2"]'), 'goldDagger');
    assert.equal(r.evaluate('db.equippedWeapon'), 'basic');
});

test('부츠 한 켤레는 양발에 장착되고 어느 발에서 해제해도 한 번만 보관된다', () => {
    const r = equipmentRuntime({ v7_inventory: '["boots","helmet"]' });
    r.evaluate('inventory.equip("boots", "item")');
    assert.equal(r.evaluate('db.equipped["foot-1"]'), 'boots');
    assert.equal(r.evaluate('db.equipped["foot-2"]'), 'boots');
    assert.equal(r.evaluate('db.inventory.includes("boots")'), false);
    r.evaluate('inventory.unequip("foot-2")');
    assert.equal(r.evaluate('db.equipped["foot-1"]'), undefined);
    assert.equal(r.evaluate('db.equipped["foot-2"]'), undefined);
    assert.equal(r.evaluate('db.inventory.filter(id => id === "boots").length'), 1);
});

test('이전 무기 슬롯은 손으로 복원하며 손이 차 있으면 소유 장비를 보관함에 남긴다', () => {
    for (const occupied of [false, true]) {
        const r = equipmentRuntime({
            v7_owned: '["basic","midasSword","fire"]',
            v7_equipped: JSON.stringify({
                weapon: 'midasSword',
                ...(occupied ? { 'hand-1': 'fire' } : {}),
            }),
            v7_equip: 'midasSword',
        });
        assert.equal(r.evaluate('db.equipped.weapon'), undefined);
        assert.equal(r.evaluate('db.equipped["hand-1"]'), occupied ? 'fire' : 'midasSword');
        assert.equal(r.evaluate('db.equippedWeapon'), occupied ? 'fire' : 'midasSword');
        assert.equal(r.evaluate('db.has("midasSword")'), true);
        assert.equal(r.evaluate('inventory.getStoredCount()'), 1);
        const restored = equipmentRuntime(Object.fromEntries(r.store));
        assert.equal(
            restored.evaluate('JSON.stringify(db.equipped)'),
            r.evaluate('JSON.stringify(db.equipped)')
        );
        assert.equal(restored.evaluate('db.equippedWeapon'), r.evaluate('db.equippedWeapon'));
    }
});

test('이전 이펙트 무기와 잘못된 손 위치를 복원하고 같은 무기의 중복 장착을 제거한다', () => {
    const r = equipmentRuntime({
        v7_owned: '["basic","midasSword","void"]',
        v7_equipped: '{"hand-2":"midasSword"}',
        v7_equip: 'void',
    });
    assert.equal(r.evaluate('db.equipped["hand-1"]'), 'midasSword');
    assert.equal(r.evaluate('db.equipped["hand-2"]'), 'void');
    assert.equal(r.evaluate('db.equippedWeapon'), 'midasSword');
    const duplicate = equipmentRuntime({
        v7_equipped: '{"hand-1":"fire","hand-2":"fire"}',
        v7_equip: 'fire',
    });
    assert.equal(duplicate.evaluate('db.equipped["hand-1"]'), 'fire');
    assert.equal(duplicate.evaluate('db.equipped["hand-2"]'), undefined);
    assert.equal(duplicate.evaluate('db.equippedWeapon'), 'fire');
});
