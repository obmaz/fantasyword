const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');
const { assembleAnswer } = require('./helpers/assemble-answer');

function rejectWrites(runtime, rejectedKey) {
    const original = runtime.sandbox.localStorage.setItem;
    runtime.sandbox.localStorage.setItem = (key, value) => {
        if (key === rejectedKey) throw new Error('QuotaExceededError');
        return original(key, value);
    };
    return () => {
        runtime.sandbox.localStorage.setItem = original;
    };
}
const quiet = { v7_settings: '{"musicPlay":false,"wordRead":false}' };
const pool = [
    { day: 1, word: 'apple', meaning: '사과' },
    { day: 1, word: 'banana', meaning: '바나나' },
    { day: 1, word: 'cat', meaning: '고양이' },
    { day: 1, word: 'dog', meaning: '개' },
];

test('기존 Day 배지가 없는 실제 화면 구조에서도 도전·스토리·사자성어를 시작하고 다음 문제로 진행한다', () => {
    for (const mode of ['battle', 'story', 'idiom-test']) {
        const r = browserRuntime(quiet);
        r.sandbox.rawDataData = pool;
        assert.doesNotMatch(r.html, /id="game-info-badge"/);
        const getElementById = r.sandbox.document.getElementById;
        r.sandbox.document.getElementById = (id) =>
            id === 'game-info-badge' ? null : getElementById(id);
        const day = mode === 'idiom-test' ? 'all' : 1;
        r.evaluate(
            `game.battleQuestionType = 'objective'; game.init('${mode}', '${day}', 'objective')`
        );
        r.advance(400);
        assert.equal(r.evaluate('game.active'), true, mode);
        assert.notEqual(r.getElement('q-text').innerText, '', mode);
        assert.ok(r.getElement('options-box').children.length > 0, mode);
        r.evaluate('game.answerOption(game.options.findIndex(option => option.correct))');
        assert.equal(r.evaluate('game.currentQ.wasCorrect'), true, mode);
        r.advance(800);
        assert.equal(r.evaluate('game.idx'), 1, mode);
        r.evaluate('game.exit()');
        assert.equal(r.evaluate('game.active'), false, mode);
    }
});

test('일반 문제 문구는 동적 변경을 보조기기에 공지한다', () => {
    const r = browserRuntime();
    assert.match(
        r.html,
        /class="q-text"\s+id="q-text"\s+role="status"\s+aria-live="polite"\s+aria-atomic="true"/
    );
});

test('음악·자동 발음·진동 설정은 저장 실패 시 체크와 실행 상태를 보존한다', () => {
    const r = browserRuntime();
    r.sandbox.onload();
    r.getElement('background-music').paused = false;
    rejectWrites(r, 'v7_settings');
    for (const [id, property] of [
        ['setting-music-play', 'musicPlay'],
        ['setting-word-read', 'wordRead'],
        ['setting-vibration', 'vibration'],
    ]) {
        const toggle = r.getElement(id);
        toggle.checked = false;
        toggle.dispatch('change');
        assert.equal(toggle.checked, true, id);
        assert.equal(r.evaluate(`db.settings.${property}`), true);
    }
    assert.equal(r.getElement('background-music').paused, false);
    assert.equal(r.evaluate('settingsManager.musicTogglePairs'), 0);
});

test('장비 해제의 중간 저장 실패는 양발·보관함·디스크를 모두 이전 상태로 되돌린다', () => {
    const r = browserRuntime({
        v7_equipped: '{"foot-1":"boots","foot-2":"boots"}',
        v7_inventory: '[]',
    });
    const before = r.evaluate(
        'JSON.stringify({inventory: db.inventory, equipped: db.equipped, weapon: db.equippedWeapon})'
    );
    const disk = Object.fromEntries(r.store);
    const restore = rejectWrites(r, 'v7_inventory');
    r.evaluate('inventory.unequip("foot-1")');
    assert.equal(
        r.evaluate(
            'JSON.stringify({inventory: db.inventory, equipped: db.equipped, weapon: db.equippedWeapon})'
        ),
        before
    );
    assert.deepEqual(Object.fromEntries(r.store), disk);
    restore();
    r.evaluate('inventory.unequip("foot-1")');
    assert.equal(r.evaluate('db.equipped["foot-1"]'), undefined);
    assert.equal(r.evaluate('db.equipped["foot-2"]'), undefined);
    assert.equal(r.evaluate('db.inventory.filter(id => id === "boots").length'), 1);
});

test('미암기 필터에서 외움 저장이 실패해도 단어·위치·버튼은 바뀌지 않는다', () => {
    const r = browserRuntime(quiet);
    r.sandbox.rawDataData = pool;
    r.evaluate('practiceMemorization.start(1); practiceMemorization.applyFilter("not-memorized")');
    rejectWrites(r, 'v7_practice_memorized');
    r.evaluate('practiceMemorization.toggleMemorized()');
    assert.equal(r.evaluate('practiceMemorization.words[0].word'), 'apple');
    assert.equal(r.evaluate('practiceMemorization.words.length'), pool.length);
    assert.equal(r.evaluate('practiceMemorization.getMemorizedSet().size'), 0);
    assert.equal(r.getElement('practice-memorized-btn')['aria-pressed'], 'false');
});

test('장비 상세에서 저장 실패는 창을 유지하고 같은 버튼으로 장착을 재시도한다', () => {
    const r = browserRuntime({ ...quiet, v7_inventory: '["boots"]' });
    r.evaluate('inventory.open(); inventory.showDetails("boots","item")');
    const button = r.getElement('detail-actions').children[0];
    const restore = rejectWrites(r, 'v7_equipped');
    button.click();
    assert.equal(r.getElement('inventory-modal').dataset.detailOpen, 'true');
    assert.equal(r.evaluate('db.equipped["foot-1"]'), undefined);
    restore();
    button.click();
    assert.equal(r.getElement('inventory-modal').dataset.detailOpen, 'false');
    assert.equal(r.evaluate('db.equipped["foot-1"]'), 'boots');
    assert.equal(r.evaluate('db.equipped["foot-2"]'), 'boots');
});

test('스킬 저장 실패는 수량·보기·통계를 바꾸거나 무료 정답을 실행하지 않는다', () => {
    const r = browserRuntime({ ...quiet, v7_skills: '{"hint":1,"ultimate":1}' });
    r.sandbox.rawDataData = pool;
    r.evaluate('game.battleQuestionType="objective"; game.init("battle",1)');
    r.advance(400);
    rejectWrites(r, 'v7_skills');
    r.evaluate('game.useHint(); game.useUltimate()');
    assert.equal(r.evaluate('db.skills.hint'), 1);
    assert.equal(r.evaluate('db.skills.ultimate'), 1);
    assert.equal(r.evaluate('game.options.some(option => option.disabled)'), false);
    assert.equal(r.evaluate('game.isProcessing'), false);
    assert.equal(r.evaluate('db.getBookStats().solved'), 0);
});

test('건틀릿 마지막 사용의 중간 실패는 골드·소모 횟수·장착·보관함을 함께 보존한다', () => {
    const r = browserRuntime({
        ...quiet,
        v7_equipped: '{"gloves":"goldGlove"}',
        v7_dura: '{"goldGlove":1}',
    });
    const before = r.evaluate(
        'JSON.stringify({gold:db.gold, dura:db.durability, equipped:db.equipped, owned:db.owned, inventory:db.inventory})'
    );
    const disk = Object.fromEntries(r.store);
    const restore = rejectWrites(r, 'v7_inventory');
    assert.equal(r.evaluate('db.grantGold(15, {}, "goldGlove")'), false);
    assert.equal(
        r.evaluate(
            'JSON.stringify({gold:db.gold, dura:db.durability, equipped:db.equipped, owned:db.owned, inventory:db.inventory})'
        ),
        before
    );
    assert.deepEqual(Object.fromEntries(r.store), disk);
    restore();
    assert.equal(r.evaluate('db.grantGold(15, {}, "goldGlove")'), true);
    assert.equal(r.evaluate('db.gold'), 114);
    assert.equal(r.evaluate('db.durability.goldGlove'), undefined);
    assert.equal(r.evaluate('db.equipped.gloves'), undefined);
});

test('복수 보상 저장 실패는 지급 완료 표식을 남기지 않고 재시도에서 한 번만 지급한다', () => {
    const r = browserRuntime(quiet);
    r.sandbox.rawDataData = pool;
    const word = { ...pool[0], monsterId: 'goblin' };
    r.evaluate('revengeQuests').fail(word);
    const game = r.evaluate('game');
    game.init('revenge', 'all');
    r.advance(400);
    const restore = rejectWrites(r, 'v7_gold');
    assembleAnswer(game);
    game.checkBossAnswer();
    assert.equal(r.evaluate('db.gold'), 99);
    assert.equal(game.stats.gain, 0);
    assert.equal(r.evaluate('revengeQuests.ready().length'), 1);
    restore();
    game.exit();
    game.init('revenge', 'all');
    r.advance(400);
    assembleAnswer(game);
    game.checkBossAnswer();
    assert.equal(r.evaluate('db.gold'), 115);
    assert.equal(r.evaluate('revengeQuests.ready().length'), 0);
});

test('통계·최고 기록·전부 맞춘 날은 저장 실패 시 원본을 변경하지 않는다', () => {
    const r = browserRuntime();
    const before = r.evaluate('JSON.stringify(db.stats)');
    rejectWrites(r, 'v7_stats');
    assert.equal(r.evaluate('db.addStats(true)'), false);
    assert.equal(r.evaluate('db.recordBossWave(10)'), false);
    assert.equal(r.evaluate('db.recordPerfectDay(1,"Day 1")'), false);
    assert.equal(r.evaluate('JSON.stringify(db.stats)'), before);
});

test('관리 골드 저장 실패는 성공 안내나 화면 종료 없이 재시도할 수 있다', () => {
    const r = browserRuntime();
    r.evaluate('settingsManager.open(); secret.updateGoldEdit(500); secret.applyGoldEdit()');
    const restore = rejectWrites(r, 'v7_gold');
    r.evaluate('secret.pendingAction()');
    assert.equal(r.evaluate('db.gold'), 99);
    assert.equal(r.getElement('password-modal').style.display, 'flex');
    assert.equal(r.evaluate('typeof secret.pendingAction'), 'function');
    restore();
    r.evaluate('secret.pendingAction()');
    assert.equal(r.evaluate('db.gold'), 599);
});

test('골드는 안전한 정수 범위를 넘거나 저장이 실패해도 기존 값을 잃지 않는다', () => {
    const r = browserRuntime({ v7_gold: String(Number.MAX_SAFE_INTEGER) });
    assert.equal(r.evaluate('db.addGold(1)'), Number.MAX_SAFE_INTEGER);
    assert.equal(r.store.get('v7_gold'), String(Number.MAX_SAFE_INTEGER));
    rejectWrites(r, 'v7_gold');
    assert.equal(r.evaluate('db.subGold(100)'), Number.MAX_SAFE_INTEGER);
});

test('행맨·속담·대장간은 히스토리를 예약하고 뒤의 로비를 비활성화한 뒤 복구한다', () => {
    for (const [start, exit] of [
        ['hangman.start()', 'hangman.exit()'],
        ['storyPuzzle.start("proverb")', 'storyPuzzle.exit()'],
        ['storyPuzzle.start("forge")', 'storyPuzzle.exit()'],
    ]) {
        let pushes = 0;
        const r = browserRuntime(quiet, {
            history: {
                pushState() {
                    pushes++;
                },
                replaceState() {},
            },
        });
        r.evaluate('navigation.init()');
        r.evaluate(start);
        assert.equal(pushes, 1, start);
        assert.equal(r.getElement('title-screen').inert, true, start);
        assert.equal(r.getElement('title-screen').style.display, 'none', start);
        r.evaluate(exit);
        assert.equal(r.getElement('title-screen').inert, false, exit);
        assert.equal(r.getElement('title-screen').style.display, 'flex', exit);
    }
});

test('닫는 중인 팝업은 연속 뒤로 가기를 가로채지 않는다', () => {
    const r = browserRuntime(quiet);
    r.getElement('shop-modal').classList.add('screen-overlay');
    r.evaluate('shop.open(); navigation.back()');
    assert.equal(r.getElement('shop-modal').classList.contains('closing'), true);
    r.evaluate('hangman.start(); navigation.back()');
    assert.equal(r.evaluate('hangman.active'), false);
});
