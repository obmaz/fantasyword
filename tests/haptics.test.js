const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');
const { loadScripts } = require('./helpers/load-module');

test('기존 저장 데이터에도 진동 기본 ON·200ms를 적용하고 선택한 길이·OFF를 복원한다', () => {
    for (const stored of [{ musicPlay: false }, { vibration: false, vibrationDuration: 350 }]) {
        const r = browserRuntime({ v7_settings: JSON.stringify(stored) });
        assert.equal(r.evaluate('db.settings.vibration'), stored.vibration !== false);
        assert.equal(r.evaluate('db.settings.vibrationDuration'), stored.vibrationDuration || 200);
    }
    const invalid = browserRuntime({ v7_settings: '{"vibrationDuration":999999}' });
    assert.equal(invalid.evaluate('db.settings.vibrationDuration'), 200);
});

test('진동 설정 변경은 즉시 공통 피드백에 적용되고 다시 열거나 로드해도 유지한다', () => {
    const r = browserRuntime();
    const calls = [];
    r.sandbox.navigator.vibrate = (duration) => {
        calls.push(duration);
        return true;
    };
    r.sandbox.onload();
    r.evaluate('haptics.error()');
    const check = r.getElement('setting-vibration');
    const duration = r.getElement('setting-vibration-duration');
    check.checked = false;
    check.dispatch('change');
    r.evaluate('haptics.error();settingsManager.open()');
    assert.equal(check.checked, false);
    assert.equal(duration.disabled, true);
    assert.deepEqual(calls, [200]);
    check.checked = true;
    check.dispatch('change');
    duration.value = '80';
    duration.dispatch('change');
    r.evaluate('haptics.error()');
    assert.deepEqual(calls, [200, 80]);
    const restored = browserRuntime(Object.fromEntries(r.store));
    assert.equal(restored.evaluate('db.settings.vibrationDuration'), 80);
    assert.equal(restored.evaluate('db.settings.vibration'), true);
});

test('일반 오답·방패 재시도·보스 실패는 공통 진동을 한 번 호출하고 중복 입력은 무시한다', () => {
    for (const mode of ['ordinary', 'shield', 'boss']) {
        const r = browserRuntime();
        const calls = [];
        r.sandbox.navigator.vibrate = (duration) => {
            calls.push(duration);
            return true;
        };
        r.sandbox.rawDataData = ['cat', 'dog', 'bird', 'fish'].map((word) => ({
            day: 1,
            word,
            meaning: word + ' 뜻',
        }));
        r.sandbox.onload();
        r.evaluate("game.battleQuestionType='objective';game.init('battle',1)");
        r.advance(400);
        if (mode === 'shield') r.evaluate('game.gear.shield=1');
        if (mode === 'boss') r.evaluate("game.mode='boss'");
        r.evaluate('game.handleAnswer(false,0);game.handleAnswer(false,0)');
        assert.deepEqual(calls, [200], mode);
    }
});

test('행맨은 새 오답에만 진동하고 중복 키·정답 키에는 진동하지 않는다', () => {
    const r = browserRuntime();
    const calls = [];
    r.sandbox.navigator.vibrate = (duration) => {
        calls.push(duration);
        return true;
    };
    r.sandbox.onload();
    r.evaluate(
        "hangman.start();hangman.word='cat';hangman.guessed=new Set();hangman.choose('z');hangman.choose('z');hangman.choose('c')"
    );
    assert.deepEqual(calls, [200]);
});

test('진동 설정 저장 실패는 기존 설정과 토글을 함께 유지한다', () => {
    const r = browserRuntime();
    r.sandbox.onload();
    r.sandbox.localStorage.setItem = () => {
        throw Error('quota');
    };
    const check = r.getElement('setting-vibration');
    check.checked = false;
    check.dispatch('change');
    assert.equal(r.evaluate('db.settings.vibration'), true);
    assert.equal(check.checked, true);
    assert.equal(r.getElement('setting-vibration-duration').disabled, false);
});

test('진동을 지원하지 않거나 API가 거부되어도 채점 흐름에 오류를 전파하지 않는다', () => {
    const create = loadScripts(['scripts/config.js', 'scripts/features/haptics.js']).evaluate(
        'createHaptics'
    );
    const feedback = create({
        getSettings: () => ({ vibration: true }),
        vibrate() {
            throw Error('unsupported');
        },
    });
    assert.equal(feedback.error(), false);
});
