const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');
const { assembleAnswer, assembleWrongAnswer } = require('./helpers/assemble-answer');

function economyRuntime(saved = {}) {
    return browserRuntime({
        v7_gold: '200',
        v7_settings: '{"musicPlay":false,"wordRead":false}',
        ...saved,
    });
}

test('실제 10문제 전투: 4초 풀이·정답률 80%에서 선택 50 G, 철자 74 G를 순수입으로 얻는다', () => {
    for (const [monster, expectedNet] of [
        ['slime', 50],
        ['dragon', 74],
    ]) {
        const r = economyRuntime();
        const pool = Array.from({ length: 10 }, (_, i) => ({
            day: 1,
            word: `word${i}`,
            meaning: `뜻${i}`,
        }));
        r.sandbox.rawDataData = pool;
        const game = r.evaluate('game');
        game.shuffle = (values) => [...values];
        r.getElement('count-select').value = '10';
        game.init('battle', 1);
        r.advance(400);
        game.list = pool.map((q) => r.evaluate('monsterEncounters').prepare(q, monster));
        game.idx = 0;
        game.nextLevel();
        for (let i = 0; i < 10; i++) {
            r.advance(4000);
            const correct = i !== 4 && i !== 9;
            if (monster === 'slime') {
                game.answerOption(game.options.findIndex((q) => q.correct === correct));
            } else {
                if (correct) assembleAnswer(game);
                else assembleWrongAnswer(game);
                game.checkBossAnswer();
            }
            r.advance(correct ? 800 : 2500);
        }
        assert.equal(r.evaluate('db.gold'), 200 + expectedNet);
        assert.equal(game.stats.gain - game.stats.lost, expectedNet);
        assert.equal(r.evaluate('db.getBookStats().correct'), 8);
        assert.equal(r.store.get('v7_gold'), String(200 + expectedNet));
    }
});

test('오답은 잔액 이상을 빼지 않고 수호 부적은 손실을 절반으로 줄인다', () => {
    const rules = economyRuntime().evaluate('battleRules');
    assert.equal(rules.penalty(100), 6);
    assert.equal(rules.penalty(100, true), 3);
    assert.equal(rules.penalty(2), 2);
    assert.equal(rules.penalty(0), 0);
});

test('작아진 보상에서도 보물 길은 7 G에 1 G를 추가하며 다른 경로에는 더하지 않는다', () => {
    const rules = economyRuntime().evaluate('equipmentRules');
    assert.equal(rules.routeBonus(7, 'treasure'), 1);
    assert.equal(rules.routeBonus(7, 'safe'), 0);
    assert.equal(rules.routeBonus(0, 'treasure'), 0);
});

test('자동 해결 스크롤은 최고 배율·보물 길·콤보까지 받아도 재구매로 골드를 복제하지 못한다', () => {
    const r = economyRuntime();
    const rules = r.evaluate('battleRules');
    const equipment = r.evaluate('equipmentRules');
    const skill = r.evaluate('relics.find(r => r.id === "ultimate")');
    for (const mode of ['battle', 'story', 'revenge', 'boss']) {
        const base = rules.reward({
            mode,
            subjective: false,
            timeLeft: 10,
            maxTime: 10,
            multiplier: 2,
            glove: true,
        });
        const total = base + equipment.routeBonus(base, 'treasure') + equipment.comboBonus;
        assert.ok(skill.cost / skill.uses > total, `${mode}: ${total}`);
    }
});

test('기존 골드·장비 ID는 보존하고 건틀릿의 남은 횟수는 4회 상한을 적용한다', () => {
    const r = economyRuntime({
        v7_gold: '123456',
        v7_owned: '["basic","midasSword"]',
        v7_equip: 'midasSword',
        v7_equipped: '{"hand-1":"midasSword","gloves":"goldGlove"}',
        v7_dura: '{"goldGlove":7}',
    });
    assert.equal(r.evaluate('db.gold'), 123456);
    assert.equal(r.evaluate('db.equippedWeapon'), 'midasSword');
    assert.equal(r.evaluate('db.durability.goldGlove'), 4);
    assert.match(r.evaluate('weapons.find(w => w.id === "midasSword").name'), /롱소드/);
});

test('착용 외형은 실제 슬롯에 맞추며 소모된 장갑과 한쪽만 장착한 부츠는 표시하지 않는다', () => {
    const rules = economyRuntime().evaluate('equipmentRules');
    const plain = (value) => JSON.parse(JSON.stringify(value));
    assert.deepEqual(plain(rules.appearance({}, {})), {
        weapon: 'basic',
        secondary: null,
        helmet: false,
        gloves: false,
        boots: false,
    });
    const equipped = {
        'hand-1': 'fire',
        'hand-2': 'shield_item',
        head: 'helmet',
        gloves: 'goldGlove',
        'foot-1': 'boots',
        'foot-2': 'boots',
    };
    assert.deepEqual(plain(rules.appearance(equipped, { goldGlove: 1 })), {
        weapon: 'fire',
        secondary: 'shield_item',
        helmet: true,
        gloves: true,
        boots: true,
    });
    assert.equal(rules.appearance(equipped, { goldGlove: 0 }).gloves, false);
    delete equipped['foot-2'];
    assert.equal(rules.appearance(equipped, { goldGlove: 1 }).boots, false);
});

test('무기 이름과 ID가 다르면 아바타 레이어도 서로 다른 무기 아트를 사용한다', () => {
    const r = economyRuntime();
    const names = r.evaluate(
        '["basic","sword","goldDagger","midasSword","tycoonAxe","fire","ice","lightning","void","shield_item"].map(id => itemIconMarkup({ id }))'
    );
    for (const id of [
        'basic',
        'sword',
        'goldDagger',
        'midasSword',
        'tycoonAxe',
        'fire',
        'ice',
        'lightning',
        'void',
        'shield_item',
    ]) {
        assert.ok(
            names.find((markup) => markup.includes(`item-art-${id}`)),
            id
        );
    }
    const sources = names.map((markup) => markup.match(/src="([^"]+)"/)[1]);
    assert.equal(new Set(sources).size, 10);
    assert.ok(sources.every((src) => src.startsWith('images/theme/parts/weapon-')));
    for (const id of [
        'basic',
        'sword',
        'goldDagger',
        'midasSword',
        'tycoonAxe',
        'fire',
        'ice',
        'lightning',
    ]) {
        const source = names
            .find((markup) => markup.includes(`item-art-${id}"`))
            .match(/src="([^"]+)"/)[1];
        const icon = r.evaluate(`battleAttackProfiles.resolve({ weaponId: '${id}' }).icon`);
        assert.equal(`images/theme/parts/${icon}.webp`, source);
    }
});

test('무기별 손잡이는 회전 중심에서도 양손에 고정되고 해제한 부품은 즉시 숨는다', () => {
    const r = economyRuntime();
    const layers = Object.fromEntries(
        ['weapon', 'secondary', 'helmet', 'gloves', 'boots'].map((part) => {
            const el = r.getElement(`avatar-test-${part}`);
            el.style.setProperty = (name, value) => (el.style[name] = value);
            return [part, [el]];
        })
    );
    const root = r.getElement('avatar-test');
    root.querySelectorAll = (selector) => layers[selector.match(/"([^"]+)"/)[1]];
    const render = (equipped) =>
        r.evaluate('renderEquipmentAvatar')(root, {
            equipped,
            durability: { goldGlove: 30 },
            weapons: r.evaluate('weapons'),
            items: r.evaluate('items'),
            fallback: 'basic',
        });
    const percentage = (layer, name) => parseFloat(layer.style[`--held-${name}`]) / 100;
    for (const weapon of r.evaluate('weapons')) {
        render({ 'hand-1': weapon.id, 'hand-2': weapon.id, head: 'helmet', gloves: 'goldGlove' });
        for (const [part, handX, handY] of [
            ['weapon', 0.405, 0.6],
            ['secondary', 0.87, 0.57],
        ]) {
            const layer = layers[part][0];
            const size = percentage(layer, 'size');
            assert.ok(
                Math.abs(percentage(layer, 'left') + percentage(layer, 'grip-x') * size - handX) <
                    1e-10
            );
            assert.ok(
                Math.abs(percentage(layer, 'top') + percentage(layer, 'grip-y') * size - handY) <
                    1e-10
            );
            assert.equal(layer.hidden, false);
            assert.equal(layer.dataset.weapon, weapon.id);
        }
        assert.equal(root.dataset.helmet, 'true');
        assert.equal(layers.helmet[0].hidden, false);
    }
    render({});
    assert.equal(root.dataset.helmet, 'false');
    for (const part of ['secondary', 'helmet', 'gloves', 'boots'])
        assert.equal(layers[part][0].hidden, true);
    assert.equal(layers.secondary[0].innerHTML, '');
    assert.equal(layers.weapon[0].dataset.weapon, 'basic');
});
