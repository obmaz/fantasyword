const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');

function speechRuntime(overrides = {}) {
    const clips = [];
    const utterances = [];
    const notices = [];
    const runtime = browserRuntime(
        { v7_settings: '{"wordRead":false,"musicPlay":false}' },
        {
            Audio: class {
                constructor() {
                    this.paused = false;
                    clips.push(this);
                }
                play() {
                    return Promise.resolve();
                }
                pause() {
                    this.paused = true;
                }
                removeAttribute() {
                    this.src = '';
                }
                load() {}
            },
            SpeechSynthesisUtterance: class {
                constructor(text) {
                    this.text = text;
                }
            },
            speechSynthesis: {
                getVoices: () => [],
                cancel() {},
                speak: (utterance) => utterances.push(utterance),
            },
            ...overrides,
        }
    );
    const speech = runtime.evaluate('createPracticeSpeech')({
        getSynth: () => runtime.sandbox.speechSynthesis,
        createUtterance: (word) => new runtime.sandbox.SpeechSynthesisUtterance(word),
        getVoice: runtime.sandbox.getPreferredTTSVoice,
        playRemote: runtime.sandbox.playGoogleTTS,
        notify: (message) => notices.push(message),
    });
    const practice = runtime.evaluate('createPracticeSession')({
        db: runtime.evaluate('db'),
        getSource: () => runtime.evaluate('rawData'),
        getWrongWords: () => [],
        speech,
        view: new Proxy({}, { get: () => () => {} }),
        notify: (message) => notices.push(message),
        resetResult() {},
        playMusic() {},
    });
    practice.start(1);
    return {
        ...runtime,
        clips,
        utterances,
        notices,
        practice,
    };
}

test('브라우저 음성을 우선 사용하고 재생 오류 시에만 현재 단어의 원격 폴백을 한 번 실행한다', () => {
    const r = speechRuntime();
    r.practice.playTTS();
    assert.equal(r.clips.length, 0);
    assert.equal(r.utterances.length, 1);
    r.utterances[0].onerror({ error: 'synthesis-failed' });
    r.utterances[0].onerror({ error: 'synthesis-failed' });
    assert.equal(r.clips.length, 1);
    assert.equal(new URL(r.clips[0].src).searchParams.get('q'), r.practice.words[0].word);
    assert.equal(r.notices.length, 0);
});

test('취소한 발화나 이전 단어의 늦은 오류는 원격 음성을 시작하지 않는다', () => {
    const r = speechRuntime();
    r.practice.playTTS();
    const old = r.utterances[0];
    old.onerror({ error: 'canceled' });
    old.onerror({ error: 'interrupted' });
    assert.equal(r.clips.length, 0);
    r.practice.next();
    old.onerror({ error: 'synthesis-failed' });
    assert.equal(r.clips.length, 0);
});

test('브라우저 음성 미지원 시 폴백을 재생하고 단어 전환/나가기에서 중지한다', () => {
    const r = speechRuntime({ speechSynthesis: null });
    r.practice.playTTS();
    assert.equal(r.clips.length, 1);
    r.practice.next();
    assert.equal(r.clips[0].paused, true);
    assert.equal(r.clips[0].src, '');
    r.practice.playTTS();
    r.practice.exit();
    assert.equal(r.clips[1].paused, true);
    assert.equal(r.practice.speechAudio, null);
});

test('원격 음성 오류는 수동 발음에 한 번 안내하고 자동 읽기는 조용히 실패한다', () => {
    const r = speechRuntime({ speechSynthesis: null });
    r.practice.playTTS();
    r.clips[0].onerror();
    r.clips[0].onerror();
    assert.equal(r.notices.length, 1);
    r.practice.playTTS(true);
    r.clips[1].onerror();
    assert.equal(r.notices.length, 1);
});

test('나간 뒤 늦게 거부된 재생 Promise는 실패 알림을 띄우지 않는다', async () => {
    let reject;
    const r = speechRuntime({
        speechSynthesis: null,
        Audio: class {
            play() {
                return new Promise((_, rejectPlay) => {
                    reject = rejectPlay;
                });
            }
            pause() {}
        },
    });
    r.practice.playTTS();
    r.practice.exit();
    reject(new Error('play aborted'));
    await Promise.resolve();
    assert.equal(r.notices.length, 0);
});

test('발음이 재생되는 동안 음악을 멈추고 완료 또는 취소 시 이전 재생 상태를 복구한다', () => {
    const r = speechRuntime();
    const music = {
        paused: false,
        pause() {
            this.paused = true;
        },
        play() {
            this.paused = false;
            return Promise.resolve();
        },
    };
    const speech = r.evaluate('createPracticeSpeech')({
        getSynth: () => r.sandbox.speechSynthesis,
        createUtterance: (word) => new r.sandbox.SpeechSynthesisUtterance(word),
        getVoice: r.sandbox.getPreferredTTSVoice,
        playRemote: r.sandbox.playGoogleTTS,
        notify() {},
        getMusic: () => music,
    });
    speech.play('apple');
    assert.equal(music.paused, true);
    assert.equal(r.utterances.at(-1).volume, 1);
    r.utterances.at(-1).onend();
    assert.equal(music.paused, false);
    speech.play('banana');
    assert.equal(music.paused, true);
    speech.stop();
    assert.equal(music.paused, false);
    music.pause();
    speech.play('cat');
    assert.equal(music.paused, true);
    speech.stop();
    assert.equal(music.paused, true);
});
