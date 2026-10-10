const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');
const { assembleAnswer, assembleWrongAnswer } = require('./helpers/assemble-answer');
const POOL = [
    { day: 1, word: 'apple', meaning: '사과' },
    { day: 1, word: 'banana', meaning: '바나나' },
    { day: 1, word: 'cat', meaning: '고양이' },
    { day: 1, word: 'dog', meaning: '개' },
];
function runtime(equipped = {}, saved = {}) {
    const r = browserRuntime({
        v7_settings: '{"musicPlay":false,"wordRead":false}',
        v7_gold: '1000',
        v7_owned: '["basic","shield_item","goldDagger","midasSword","hourglass"]',
        v7_equipped: JSON.stringify(equipped),
        ...saved,
    });
    r.sandbox.rawDataData = POOL;
    const game = r.evaluate('game');
    game.shuffle = (values) => [...values];
    r.getElement('count-select').value = '4';
    game.init('battle', 1);
    r.advance(400);
    function start(id = 'slime') {
        game.list = POOL.map((q) => r.evaluate('monsterEncounters').prepare(q, id));
        game.idx = 0;
        game.nextLevel();
    }
    function choose(correct) {
        game.answerOption(game.options.findIndex((q) => q.correct === correct && !q.disabled));
    }
    return { ...r, game, start, choose };
}

test('오른손 무기는 3연속 정답에만 추가 3 G를 주며 오답은 연속 기록을 초기화한다', () => {
    const r = runtime({}, { v7_owned: '["basic"]' });
    r.start();
    for (let i = 0; i < 3; i++) {
        r.choose(true);
        if (i < 2) r.advance(800);
    }
    assert.equal(r.game.stats.gain, 33);
    assert.equal(r.evaluate('db.gold'), 1033);
    assert.equal(r.getElement('dmg-txt').innerText, '+13 G');
    assert.equal(r.getElement('dmg-txt').children.at(-1).innerText, '정답 +10 · 연속 +3');
    assert.equal(r.game.gear.combo, 0);
    r.advance(800);
    r.choose(false);
    assert.equal(r.game.gear.combo, 0);
    const rules = r.evaluate('equipmentRules');
    assert.equal(rules.combo({ combo: 2, weapon: false }, true).bonus, 0);
    assert.equal(rules.combo({ combo: 2, weapon: true }, false).combo, 0);
});

test('황금장갑은 장착할 때만 보상이 늘고 정답에서만 사용 횟수가 차감된다', () => {
    for (const equipped of [false, true]) {
        const r = runtime(equipped ? { gloves: 'goldGlove' } : {}, {
            v7_owned: '["basic"]',
            v7_inventory: equipped ? '[]' : '["goldGlove"]',
            v7_dura: '{"goldGlove":2}',
        });
        r.start();
        r.choose(true);
        assert.equal(r.game.stats.gain, equipped ? 15 : 10);
        assert.equal(r.evaluate('db.durability.goldGlove'), equipped ? 1 : 2);
        r.advance(800);
        r.choose(false);
        assert.equal(r.evaluate('db.durability.goldGlove'), equipped ? 1 : 2);
    }
});

test('황금장갑의 마지막 정답에는 배율이 적용되고 소모 후 슬롯과 저장에서 제거된다', () => {
    const r = runtime(
        { gloves: 'goldGlove' },
        { v7_owned: '["basic"]', v7_dura: '{"goldGlove":1}' }
    );
    r.start();
    r.choose(true);
    assert.equal(r.game.stats.gain, 15);
    assert.equal(r.evaluate('db.equipped.gloves'), undefined);
    assert.equal(r.evaluate('db.durability.goldGlove'), undefined);
    assert.equal(JSON.parse(r.store.get('v7_equipped')).gloves, undefined);
    r.advance(800);
    r.choose(true);
    assert.equal(r.game.stats.gain, 25);
});

test('새 건틀릿은 정답 10회에 배율을 적용하고 11번째 정답부터 기본 보상을 준다', () => {
    const r = runtime(
        { gloves: 'goldGlove' },
        {
            v7_owned: '["basic"]',
            v7_dura: '{"goldGlove":10}',
        }
    );
    r.start();
    r.game.list = [...r.game.list, ...r.game.list, ...r.game.list];
    for (let i = 1; i <= 11; i++) {
        const previousGain = r.game.stats.gain;
        r.choose(true);
        assert.equal(r.game.stats.gain - previousGain, (i <= 10 ? 15 : 10) + (i % 3 === 0 ? 3 : 0));
        assert.equal(r.evaluate('db.durability.goldGlove'), i < 10 ? 10 - i : undefined);
        if (i >= 10) assert.equal(r.evaluate('db.equipped.gloves'), undefined);
        r.advance(800);
    }
});

test('장비는 장착해야 능력이 켜지고 방패의 이전 오른손 저장은 왼손으로 복원된다', () => {
    const r = runtime({}, { v7_inventory: '["helmet","boots"]' });
    assert.equal(r.game.gear.shield, 0);
    assert.equal(r.game.gear.hint, 0);
    assert.equal(r.game.gear.boots, false);
    const migrated = runtime({ 'hand-1': 'shield_item' }, { v7_equip: 'shield_item' });
    assert.equal(migrated.evaluate('db.equipped["hand-1"]'), undefined);
    assert.equal(migrated.evaluate('db.equipped["hand-2"]'), 'shield_item');
    assert.equal(migrated.game.gear.shield, 1);
    const occupied = runtime({ 'hand-1': 'shield_item', 'hand-2': 'goldDagger' });
    assert.equal(occupied.game.gear.shield, 0);
    assert.equal(occupied.evaluate('db.has("shield_item")'), true);
});

test('방패는 오답 1회 재도전을 주고 골드·통계를 중복 처리하지 않으며 오답 퀘스트는 남긴다', () => {
    const r = runtime({ 'hand-2': 'shield_item' }, { v7_owned: '["basic","shield_item"]' });
    r.start();
    r.choose(false);
    r.choose(true);
    assert.equal(r.game.gear.shield, 0);
    assert.equal(r.evaluate('db.gold'), 1000);
    assert.equal(r.evaluate('db.getBookStats().solved'), 0);
    assert.equal(r.evaluate('revengeQuests.ready().length'), 1);
    r.advance(800);
    assert.equal(r.game.currentQ.word, 'apple');
    assert.equal(r.game.remainingTime(), 10);
    assert.equal(r.game.options.filter((q) => q.disabled).length, 1);
    r.choose(true);
    assert.equal(r.evaluate('db.getBookStats().solved'), 1);
    assert.equal(r.evaluate('db.getBookStats().correct'), 1);
    assert.equal(r.game.sessionWrongWords.length, 1);
    r.advance(800);
    r.choose(false);
    assert.equal(r.game.stats.lost, 6);
    assert.equal(r.evaluate('db.getBookStats().solved'), 2);
});

test('시간 초과의 방패 재도전은 최소 5초를 주고 종료 후 늦은 콜백은 실행되지 않는다', () => {
    const r = runtime({ 'hand-2': 'shield_item' }, { v7_owned: '["basic","shield_item"]' });
    r.start();
    r.advance(10000);
    [...r.intervals.values()].forEach((callback) => callback());
    assert.equal(r.game.gear.shield, 0);
    r.advance(800);
    assert.equal(r.game.remainingTime(), 5);
    r.choose(true);
    const exiting = runtime({ 'hand-2': 'shield_item' });
    exiting.start();
    exiting.choose(false);
    exiting.game.exit();
    exiting.advance(15000);
    assert.equal(exiting.game.active, false);
    assert.equal(exiting.game.timer, null);
    assert.equal(exiting.evaluate('db.gold'), 1000);
});

test('투구 힌트는 듣기 전 사용되지 않으며 무료 1회로 주관식 철자 힌트와 객관식 보기 제거를 지원한다', () => {
    const r = runtime({ head: 'helmet' });
    r.start('bat');
    r.game.useEquipmentHint();
    assert.equal(r.game.gear.hint, 1);
    r.game.fallbackListening();
    r.game.useEquipmentHint();
    r.game.useEquipmentHint();
    assert.equal(r.game.gear.hint, 0);
    assert.equal(r.game.options.filter((q) => q.disabled).length, 2);
    assert.equal(r.evaluate('db.skills.hint'), 0);
    const typed = runtime({ head: 'helmet' });
    typed.start('goblin');
    typed.game.useEquipmentHint();
    assert.match(typed.getElement('equipment-hint').innerText, /앞 2글자: ap/);
    assert.equal(typed.game.gear.hint, 0);
    assert.equal(typed.game.spellingChosen.length, 0);
    assert.equal(typed.evaluate('equipmentRules.hint("an")'), '앞 1글자: a · 전체 2글자');
    assert.equal(typed.evaluate('equipmentRules.hint("a")'), '전체 1글자');
});

test('남은 오답 보기가 하나면 힌트는 정답만 남기거나 소모되지 않는다', () => {
    const r = runtime({ head: 'helmet' });
    r.start();
    r.game.options
        .filter((q) => !q.correct)
        .slice(0, 2)
        .forEach((q) => (q.disabled = true));
    r.game.useEquipmentHint();
    assert.equal(r.game.gear.hint, 1);
    r.evaluate('db.skills.hint=1');
    r.game.useHint();
    assert.equal(r.evaluate('db.skills.hint'), 1);
    assert.equal(r.game.options.filter((q) => !q.disabled).length, 2);
});

test('시간 제한이 없는 문제도 풀이가 길어지면 기본 보상이 줄어든다', () => {
    const r = runtime();
    r.start('dragon');
    r.advance(15000);
    assembleAnswer(r.game);
    r.game.checkBossAnswer();
    assert.equal(r.game.stats.gain, 7);
    assert.equal(r.evaluate('db.gold'), 1007);
});

test('일반 전투에서는 부츠 경로 선택 없이 출제하고 스토리 전투에서만 경로를 고른다', () => {
    const r = runtime({ 'foot-1': 'boots', 'foot-2': 'boots' });
    assert.equal(r.game.awaitingRoute, false);
    assert.ok(r.game.currentQ);
    assert.equal(r.game.gear.route, 'none');
    r.game.exit();
    r.game.init('story', 1);
    r.advance(400);
    assert.equal(r.game.awaitingRoute, true);
    assert.equal(r.game.currentQ, null);
    assert.equal(r.game.deadline, null);
    r.game.selectRoute('bad');
    assert.equal(r.game.awaitingRoute, true);
    r.game.selectRoute('safe');
    assert.equal(r.game.maxTime, 20);
    assert.equal(r.game.remainingTime(), 20);
    r.game.selectRoute('treasure');
    assert.equal(r.game.gear.route, 'safe');
    r.game.exit();
    r.advance(1000);
    assert.equal(r.game.timer, null);
});

test('보물 길은 전투 골드만 10% 늘리고 고정 복수 보상에는 배율을 적용하지 않는다', () => {
    const r = runtime({ 'foot-1': 'boots', 'foot-2': 'boots' }, { v7_owned: '["basic"]' });
    r.game.exit();
    r.game.init('story', 1);
    r.advance(400);
    r.game.selectRoute('treasure');
    r.start();
    r.choose(true);
    assert.equal(r.game.stats.gain, 11);
    r.game.exit();
    r.evaluate('revengeQuests.fail({...rawDataData[0],monsterId:"slime"})');
    r.game.init('revenge', 'all');
    r.advance(400);
    r.choose(true);
    assert.equal(r.game.stats.gain, 14);
    assert.equal(r.evaluate('Object.values(db.revengeQuests[db.getBookKey()])[0].phase'), 'recall');
});

test('드래곤 오답도 방패로 한 번 재도전하고 실제 재입력으로 해결할 수 있다', () => {
    const r = runtime({ 'hand-2': 'shield_item' });
    r.start('dragon');
    assembleWrongAnswer(r.game);
    r.game.checkBossAnswer();
    assert.equal(r.game.idx, 0);
    assert.equal(r.game.spellingChosen.length, 0);
    r.advance(800);
    assert.equal(r.game.isProcessing, false);
    assembleAnswer(r.game);
    r.game.checkBossAnswer();
    assert.equal(r.game.subjectiveCorrect, 1);
    assert.equal(r.evaluate('db.getBookStats().solved'), 1);
});

test('왼손 방패를 장착해도 오른손 화염 무기의 공격 이펙트를 유지한다', () => {
    const r = runtime(
        { 'hand-1': 'fire', 'hand-2': 'shield_item' },
        { v7_owned: '["basic","fire","shield_item"]' }
    );
    r.start();
    r.choose(true);
    r.advance(300);
    assert.equal(r.getElement('effect-slash').classList.contains('eff-fire'), true);
});
