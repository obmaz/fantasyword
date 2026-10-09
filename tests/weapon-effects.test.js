const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');
const { loadScripts } = require('./helpers/load-module');
const profiles = loadScripts(['scripts/domain/attack-profiles.js']).evaluate(
    'battleAttackProfiles'
);

function runtime(equipped = {}, saved = {}) {
    const r = browserRuntime({
        v7_settings: '{"musicPlay":false,"wordRead":false}',
        v7_gold: '1000',
        v7_owned:
            '["basic","fire","ice","lightning","void","midasSword","tycoonAxe","goldDagger","sword","shield_item"]',
        v7_equipped: JSON.stringify(equipped),
        ...saved,
    });
    const game = r.evaluate('game');
    game.shuffle = (v) => [...v];
    r.getElement('count-select').value = '4';
    game.init('battle', 'all');
    r.advance(400);
    game.list = game.list.map((q) => r.evaluate('monsterEncounters').prepare(q, 'slime'));
    game.nextLevel();
    const choose = (correct) =>
        game.answerOption(game.options.findIndex((q) => q.correct === correct));
    return { ...r, game, choose };
}

test('경제 무기도 색상과 무기 모션을 분리해 단검·왕가 검·도끼가 다른 공격을 한다', () => {
    const distinct = new Set();
    for (const [weaponId, motion] of [
        ['goldDagger', 'dagger'],
        ['midasSword', 'royal'],
        ['tycoonAxe', 'axe'],
    ]) {
        const p = profiles.resolve({ weaponId, effect: 'gold' });
        assert.equal(p.motion, motion);
        assert.equal(p.element, 'gold');
        assert(p.impactMs < p.durationMs);
        assert(p.durationMs < 800);
        distinct.add(p.motion);
    }
    assert.equal(distinct.size, 3);
    assert.equal(profiles.resolve({ weaponId: 'unknown', effect: 'unknown' }).weaponId, 'basic');
});

test('오른손 무기 모션을 유지한 채 왼손 속성과 콤보 잔상을 함께 표현한다', () => {
    const p = profiles.resolve({
        weaponId: 'tycoonAxe',
        effect: 'gold',
        secondaryEffect: 'void',
        combo: true,
    });
    assert.equal(p.motion, 'axe');
    assert.equal(p.element, 'gold');
    assert.equal(p.secondary, 'void');
    assert.equal(p.echo, true);
    assert.equal(
        profiles.resolve({ weaponId: 'fire', effect: 'fire', secondaryEffect: 'fire' }).secondary,
        null
    );
    assert.equal(
        profiles.resolve({ weaponId: 'basic', secondaryEffect: 'unknown' }).secondary,
        null
    );
});

test('실제 정답의 공격은 오른손 모션과 왼손 이펙트를 보존하며 골드 보너스가 주 속성을 덮지 않는다', () => {
    const r = runtime({ 'hand-1': 'midasSword', 'hand-2': 'ice' });
    r.choose(true);
    const layer = r.getElement('combat-effects');
    assert.equal(layer.dataset.strike, 'royal');
    assert.equal(layer.dataset.element, 'gold');
    assert.equal(layer.dataset.secondary, 'ice');
    r.advance(220);
    assert(layer.classList.contains('has-secondary'));
    assert(r.getElement('effect-slash').classList.contains('eff-gold'));
    assert.equal(r.getElement('attack-secondary-art').src, 'images/theme/parts/combat-ice.webp');
    const fire = runtime({ 'hand-1': 'fire' });
    fire.game.view.attack({ weaponId: 'fire', effect: 'fire' });
    fire.game.view.goldAttack();
    fire.advance(300);
    assert.equal(fire.getElement('combat-effects').dataset.element, 'fire');
    assert(fire.getElement('combat-effects').classList.contains('has-gold'));
    assert(fire.getElement('effect-slash').classList.contains('eff-fire'));
});

test('재생 도중 새 공격을 시작하면 이전 타격·정리 콜백이 새 공격을 지우지 않는다', () => {
    const r = runtime();
    r.game.view.attack({ weaponId: 'tycoonAxe', effect: 'gold' });
    r.advance(100);
    r.game.view.attack({ weaponId: 'fire', effect: 'fire' });
    r.advance(200);
    assert.equal(r.getElement('effect-slash').classList.contains('eff-gold'), false);
    r.advance(40);
    assert(r.getElement('effect-slash').classList.contains('eff-fire'));
    r.advance(380);
    assert(r.getElement('combat-effects').classList.contains('is-attacking'));
    r.advance(100);
    assert.equal(r.getElement('combat-effects').classList.contains('is-attacking'), false);
    assert.equal(r.getElement('hero-wrapper').classList.contains('hero-active'), false);
});

test('문제 전환과 전투 종료는 타격·잔상·보조 속성 콜백을 모두 취소한다', () => {
    for (const stop of [false, true]) {
        const r = runtime();
        r.game.view.attack({
            weaponId: 'lightning',
            effect: 'lightning',
            secondaryEffect: 'void',
            combo: true,
        });
        r.game.view.hit();
        assert(r.getElement('hero-img').classList.contains('hero-hit-anim'));
        assert(r.getElement('hero-head').classList.contains('hero-hit-anim'));
        if (stop) r.game.exit();
        else r.game.nextLevel();
        r.advance(1000);
        const layer = r.getElement('combat-effects');
        assert.equal(layer.classList.contains('is-attacking'), false);
        assert.equal(layer.classList.contains('has-secondary'), false);
        assert.equal(r.getElement('monster-img').classList.contains('mob-active'), false);
        assert.equal(r.getElement('hero-img').classList.contains('hero-hit-anim'), false);
        assert.equal(r.getElement('hero-head').classList.contains('hero-hit-anim'), false);
    }
});

test('방패 재도전은 방어 이미지와 별도 모션을 재생하고 공격이나 보상을 잘못 발생시키지 않는다', () => {
    const r = runtime({ 'hand-2': 'shield_item' });
    r.choose(false);
    const layer = r.getElement('combat-effects');
    assert(layer.classList.contains('is-blocking'));
    assert.equal(layer.classList.contains('is-attacking'), false);
    assert.equal(r.evaluate('db.gold'), 1000);
    assert.equal(r.evaluate('db.getBookStats().solved'), 0);
    r.advance(800);
    assert.equal(layer.classList.contains('is-blocking'), false);
    r.choose(true);
    assert.equal(layer.dataset.strike, 'slash');
    assert.equal(layer.dataset.secondary, '');
});
