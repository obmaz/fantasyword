const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');

test('사자성어 테스트는 소모품 스킬 호출로 저장 횟수나 문제 상태를 바꾸지 않는다', () => {
    const r = browserRuntime({
        v7_settings: '{"musicPlay":false,"wordRead":false}',
        v7_skills: '{"hint":2,"ultimate":2}',
    });
    r.getElement('idiom-test-level').value = '1';
    r.evaluate('game.init("idiom-test", "all")');
    r.advance(0);
    const snapshot = () =>
        r.evaluate('JSON.stringify({ skills: db.skills, options: game.options, gold: db.gold })');
    const before = snapshot();
    const saved = Object.fromEntries(r.store);
    r.evaluate('game.useHint(); game.useUltimate()');
    assert.equal(snapshot(), before);
    assert.equal(r.evaluate('game.isProcessing'), false);
    assert.deepEqual(Object.fromEntries(r.store), saved);

    // 테스트를 나간 뒤 일반 전투에서는 보유 스킬을 정상적으로 쓴다.
    r.evaluate('game.stop(); game.battleQuestionType = "objective"; game.init("battle", 1)');
    r.advance(0);
    r.evaluate('game.useHint(); game.useUltimate()');
    assert.equal(r.evaluate('db.skills.hint'), 1);
    assert.equal(r.evaluate('db.skills.ultimate'), 1);
    assert.equal(r.evaluate('game.isProcessing'), true);
});

test('설정 게임 바로가기는 잠금 상태에서 실행하지 않고 해금 후 설정을 닫고 진입한다', () => {
    for (const [mode, screen] of [
        ['hangman', 'hangman-game'],
        ['assault', 'skyfall-mode-modal'],
        ['idiom', 'idiom-test-modal'],
        ['shell', 'shell-game'],
        ['proverb', 'story-puzzle-game'],
        ['forge', 'story-puzzle-game'],
    ]) {
        const r = browserRuntime();
        r.sandbox.onload();
        r.evaluate('settingsManager.open()');
        r.evaluate(`settingsManager.openAdminGame('${mode}')`);
        assert.notEqual(r.getElement(screen).style.display, 'flex');
        assert.equal(r.getElement('setting-modal').style.display, 'flex');
        r.evaluate('settingsManager.adminUnlocked = true');
        r.evaluate(`settingsManager.openAdminGame('${mode}')`);
        assert.equal(r.getElement(screen).style.display, 'flex');
        assert.equal(r.getElement('setting-modal').style.display, 'none');
        assert.equal(r.evaluate('settingsManager.adminUnlocked'), false);
        assert.equal(r.getElement('settings-admin-games').hidden, true);
        if (mode === 'shell') assert.equal(r.getElement('shell-status').textContent, '');
    }
    const r = browserRuntime();
    r.evaluate(
        'settingsManager.open(); settingsManager.adminUnlocked = true; settingsManager.openAdminGame("constructor")'
    );
    assert.equal(r.getElement('setting-modal').style.display, 'flex');
    for (const id of [
        'title-skyfall-btn',
        'title-hangman-btn',
        'title-idiom-btn',
        'title-shell-btn',
    ])
        assert.equal(r.html.includes(`id="${id}"`), false);
});
