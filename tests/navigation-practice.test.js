const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');

test('팝업은 native dialog로 열리고 초기화 시 top layer에서 제거된다', () => {
    const r = browserRuntime();
    r.evaluate('shop.open()');
    assert.equal(r.getElement('shop-modal').open, true);
    r.evaluate('resetScreenOverlay("shop-modal")');
    assert.equal(r.getElement('shop-modal').open, false);
    assert.equal(r.getElement('shop-modal').style.display, 'none');
});

test('제목에서 메뉴를 반복해서 열고 닫아도 히스토리가 계속 증가하지 않는다', () => {
    let pushes = 0;
    const r = browserRuntime(
        {},
        {
            history: {
                pushState() {
                    pushes++;
                },
                replaceState() {},
            },
        }
    );
    r.evaluate('navigation.init()');
    for (let i = 0; i < 10; i++) {
        r.evaluate('shop.open(); shop.close()');
        r.advance(400);
    }
    assert.equal(pushes, 1);
    r.events.popstate({});
    assert.equal(pushes, 1, '제목에서 뒤로 가기를 가두지 않는다');
});

test('설정 하위 화면 뒤로 가기는 부모 설정만 남긴다', () => {
    const r = browserRuntime();
    r.evaluate('navigation.init(); settingsManager.open(); secret.openPrintDaySelect()');
    assert.equal(r.getElement('print-day-select-modal').style.display, 'flex');
    r.events.popstate({});
    assert.equal(r.getElement('print-day-select-modal').style.display, 'none');
    assert.equal(r.getElement('setting-modal').open, true);
    assert.equal(r.getElement('gold-adjuster-modal').style.display, 'flex');
});

test('Escape는 열려 있는 상점만 닫고 다시 열면 이전 닫기 타이머가 제거된다', () => {
    const r = browserRuntime();
    r.getElement('shop-modal').classList.add('screen-overlay');
    r.evaluate('shop.open()');
    let prevented = false;
    r.getElement('shop-modal').dispatch('cancel', {
        preventDefault() {
            prevented = true;
        },
    });
    assert.equal(prevented, true);
    r.evaluate('shop.open()');
    r.advance(800);
    assert.equal(r.getElement('shop-modal').open, true);
});

test('단어를 바꾸면 뜻과 설명을 바로 보여준다', () => {
    const r = browserRuntime();
    r.evaluate('db.settings.wordRead = false; practiceMemorization.start("1")');
    assert.equal(r.getElement('practice-meaning-text').hidden, false);
    assert.equal(r.getElement('practice-explanation-section').hidden, false);
    r.evaluate('practiceMemorization.next()');
    assert.equal(r.getElement('practice-meaning-text').hidden, false);
});

test('외움 표시는 확인 상태를 유지하고 같은 단어의 발화를 재시작하지 않는다', () => {
    const r = browserRuntime();
    r.evaluate(
        'practiceMemorization.playTTS = () => { window.reads = (window.reads || 0) + 1; }; practiceMemorization.start("1")'
    );
    const reads = r.sandbox.reads;
    r.evaluate('practiceMemorization.toggleMemorized()');
    assert.equal(r.sandbox.reads, reads);
    assert.equal(r.getElement('practice-meaning-text').hidden, false);
    assert.equal(r.getElement('practice-memorized-btn')['aria-pressed'], 'true');
    r.evaluate('practiceMemorization.applyFilter("not-memorized")');
    assert.equal(r.evaluate('practiceMemorization.currentIndex'), 0);
    assert.equal(r.getElement('practice-meaning-text').hidden, false);
});

test('빈 암기 필터에서도 뜻 확인 조작 없이 빈 상태를 유지한다', () => {
    const r = browserRuntime();
    r.evaluate(
        'db.settings.wordRead = false; practiceMemorization.start("1"); practiceMemorization.applyFilter("memorized")'
    );
    assert.equal(r.getElement('practice-meaning-text').hidden, true);
});

test('확인창 뒤로 가기는 취소로 해석하고 부모 설정을 닫지 않는다', async () => {
    const r = browserRuntime();
    r.evaluate('settingsManager.open()');
    const answer = r.evaluate('showConfirm("확인")');
    r.evaluate('navigation.back()');
    assert.equal(await answer, false);
    assert.equal(r.getElement('setting-modal').open, true);
});

test('암호 확인 예약 직후 닫으면 이전 작업이나 오류 표시가 실행되지 않는다', () => {
    const r = browserRuntime();
    r.evaluate(
        'settingsManager.open(); secret.applyGoldEdit(); window.applied = 0; secret.pendingAction = () => window.applied++;'
    );
    r.evaluate('for (const digit of secret.password) secret.enter(digit); secret.close()');
    r.advance(1000);
    assert.equal(r.sandbox.applied, 0);
    assert.equal(r.getElement('password-error').style.display, 'none');
    assert.equal(r.getElement('gold-adjuster-modal').style.display, 'flex');
});

test('설정의 골드 미리보기는 암호 확인 전 지갑을 바꾸지 않고 취소해도 값을 유지한다', () => {
    const r = browserRuntime();
    r.evaluate('db.gold = 12450; settingsManager.init(); settingsManager.open()');
    r.getElement('settings-gold-up').dispatch('click');
    assert.equal(r.evaluate('secret.editGold'), 12950);
    assert.equal(r.evaluate('db.gold'), 12450);
    assert.equal(r.getElement('settings-edit-gold').innerText, '12,950');
    r.evaluate('secret.applyGoldEdit(); secret.close()');
    assert.equal(r.getElement('gold-adjuster-modal').style.display, 'flex');
    assert.equal(r.evaluate('secret.editGold'), 12950);
    assert.equal(r.evaluate('db.gold'), 12450);
});

test('별도 골드 수정창의 암호 확인을 취소하면 해당 수정창으로 돌아간다', () => {
    const r = browserRuntime();
    r.evaluate(
        'settingsManager.open(); secret.openGoldEditModal(); secret.updateGoldEdit(500); secret.applyGoldEdit(); secret.close()'
    );
    assert.equal(r.getElement('gold-edit-modal').style.display, 'flex');
    assert.equal(r.evaluate('secret.editGold'), 500);
    assert.equal(r.evaluate('db.gold'), 0);
});

test('게임 화면에서는 뒤에 있는 제목 컨트롤을 숨기고 종료 후 다시 활성화한다', () => {
    for (const mode of ['battle', 'practice']) {
        const r = browserRuntime();
        r.evaluate('db.settings.wordRead = false');
        if (mode === 'battle') {
            r.evaluate('game.init("boss", "boss")');
            r.advance(400);
        } else r.evaluate('practiceMemorization.start("1")');
        assert.equal(r.getElement('title-screen').style.display, 'none');
        assert.equal(r.getElement('title-screen').inert, true);
        r.evaluate(mode === 'battle' ? 'game.exit()' : 'practiceMemorization.exit()');
        assert.equal(r.getElement('title-screen').inert, false);
        assert.equal(r.getElement('title-screen').style.display, 'flex');
    }
});
