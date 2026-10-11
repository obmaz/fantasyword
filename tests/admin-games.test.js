const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');

test('설정 게임 바로가기는 잠금 상태에서 실행하지 않고 해금 후 설정을 닫고 진입한다', () => {
    for (const [mode, screen] of [
        ['hangman', 'hangman-game'],
        ['assault', 'skyfall-mode-modal'],
        ['idiom', 'idiom-test-modal'],
        ['shell', 'shell-game'],
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
