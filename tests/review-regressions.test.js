const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');
const { loadScripts } = require('./helpers/load-module');

test('첫 연습 단어도 발음 중 음악을 멈추고 완료 후 재개한다', async () => {
    let utterance;
    const r = browserRuntime(
        {},
        {
            speechSynthesis: {
                cancel() {},
                speak(value) {
                    utterance = value;
                },
                getVoices: () => [],
            },
            SpeechSynthesisUtterance: function (text) {
                this.text = text;
            },
        }
    );
    const music = r.getElement('background-music');
    r.evaluate('practiceMemorization.start(1)');
    assert.ok(utterance.text);
    assert.equal(music.paused, true);
    utterance.onend();
    await Promise.resolve();
    assert.equal(music.paused, false);
    r.evaluate('practiceMemorization.exit()');
    assert.equal(music.paused, true);
});

test('첫 연습 발음이 실패하거나 음악 설정이 OFF여도 이전 음악 상태를 유지한다', () => {
    for (const musicPlay of [true, false]) {
        const r = browserRuntime({ v7_settings: JSON.stringify({ musicPlay, wordRead: true }) });
        r.sandbox.playGoogleTTS = (_word, _lang, _current, unavailable) => {
            unavailable();
            return null;
        };
        r.evaluate('practiceMemorization.start(1)');
        assert.equal(r.getElement('background-music').paused, !musicPlay);
    }
});

test('발음 중 음악 ON·곡 선택은 발음 완료까지 재생을 미루고 늦은 콜백은 무시한다', () => {
    const events = new Map();
    const utterances = [];
    let remoteCalls = 0;
    const music = {
        paused: false,
        addEventListener(name, callback) {
            events.set(name, callback);
        },
        removeEventListener(name) {
            events.delete(name);
        },
        play() {
            this.paused = false;
            events.get('play')?.();
            return Promise.resolve();
        },
        pause() {
            this.paused = true;
        },
    };
    const createSpeech = loadScripts(['scripts/features/speech.js']).evaluate(
        'createPracticeSpeech'
    );
    const speech = createSpeech({
        getMusic: () => music,
        getSynth: () => ({ cancel() {}, speak: (utterance) => utterances.push(utterance) }),
        createUtterance: (text) => ({ text }),
        getVoice: () => null,
        playRemote() {
            remoteCalls++;
        },
        notify() {},
    });
    speech.play('apple');
    assert.equal(music.paused, true);
    music.play();
    assert.equal(music.paused, true);
    utterances[0].onend();
    assert.equal(music.paused, false);
    assert.equal(events.size, 0);
    utterances[0].onerror({ error: 'synthesis-failed' });
    assert.equal(remoteCalls, 0, '완료 뒤 늦은 오류가 원격 음성을 시작하지 않는다');
    speech.play('banana');
    speech.stop();
    music.pause();
    utterances[1].onend();
    assert.equal(music.paused, true);
    assert.equal(events.size, 0);
});

test('스토리 오답 복습과 복수 목록은 이전 결과의 지도 복귀 상태를 소비한다', () => {
    for (const action of ['practiceMemorization.reviewWrongWords()', 'revengeQuests.open()']) {
        const r = browserRuntime({ v7_settings: '{"musicPlay":false,"wordRead":false}' });
        r.getElement('revenge-start-btn').querySelector = () => ({ textContent: '' });
        r.evaluate(
            'storyJourney.returnAfterResult = true; storyJourney.pendingStage = 0; storyJourney.pendingIndex = 1; game.sessionWrongWords = [{word:"apple", meaning:"사과"}]'
        );
        r.evaluate(action);
        assert.equal(r.evaluate('storyJourney.returnAfterResult'), false);
        assert.equal(r.evaluate('storyJourney.pendingStage'), null);
        assert.equal(r.evaluate('storyJourney.pendingIndex'), null);
        r.evaluate('game.init("battle", 1)');
        assert.equal(r.evaluate('storyJourney.returnAfterResult'), false);
    }
});

test('다른 로비 행동은 아직 실행되지 않은 시작 예약을 취소한다', () => {
    const r = browserRuntime();
    r.sandbox.onload();
    r.evaluate('scheduleGameStart(() => game.init("battle", 1))');
    r.getElement('title-shop-btn').dispatch('click');
    r.advance(1000);
    assert.equal(r.getElement('shop-modal').open, true);
    assert.equal(r.evaluate('game.active'), false);
});

function fullscreenRuntime() {
    let resolve;
    let requests = 0;
    const dialog = {
        open: true,
        isConnected: true,
        style: { display: 'flex' },
        closing: false,
        classList: { contains: () => dialog.closing },
        close() {
            this.open = false;
        },
        showModal() {
            assert.ok(this.isConnected);
            this.open = true;
        },
    };
    const document = {
        fullscreenEnabled: true,
        getElementById: () => null,
        querySelectorAll: (selector) =>
            selector.startsWith('dialog[open]') && dialog.open ? [dialog] : [],
        documentElement: {
            requestFullscreen: () => {
                requests++;
                return new Promise((done) => {
                    resolve = done;
                });
            },
        },
    };
    const r = loadScripts(['scripts/ui/layout-manager.js'], { document, showToast() {} });
    return {
        ...r,
        dialog,
        finish: () => resolve(),
        get requests() {
            return requests;
        },
    };
}

test('전체화면 대기 중 제거·취소·닫기 시작한 창은 복원하지 않고 다음 전환도 가능하다', async () => {
    for (const dismiss of [
        (d) => {
            d.isConnected = false;
        },
        (d) => {
            d.style.display = 'none';
        },
        (d) => {
            d.closing = true;
        },
    ]) {
        const r = fullscreenRuntime();
        const switching = r.sandbox.toggleFullscreen();
        dismiss(r.dialog);
        r.finish();
        await switching;
        assert.equal(r.dialog.open, false);
        const retry = r.sandbox.toggleFullscreen();
        r.finish();
        await retry;
        assert.equal(r.requests, 2);
    }
});

test('확인창 취소는 전체화면 복원 대상에서도 제거한다', async () => {
    const r = browserRuntime();
    const answer = r.evaluate('showConfirm("취소할 확인창")');
    const dialog = r.sandbox.document.body.children.at(-1);
    r.evaluate('dismissConfirm()');
    assert.equal(await answer, false);
    assert.equal(dialog.style.display, 'none');
    assert.equal(dialog.open, false);
});
