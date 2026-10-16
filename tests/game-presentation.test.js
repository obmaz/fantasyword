const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');
const { loadScripts } = require('./helpers/load-module');

function audioRuntime() {
    const loaded = loadScripts(['scripts/config.js', 'scripts/features/sound-effects.js']);
    const sources = [];
    const settings = { soundEffects: true };
    const parameter = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
    const context = {
        state: 'running',
        currentTime: 10,
        destination: {},
        resume: async () => {},
        createGain: () => ({ gain: parameter(), connect() {}, disconnect() {} }),
        createOscillator() {
            const source = {
                frequency: parameter(),
                connect() {},
                disconnect() {},
                start(time) {
                    this.startTime = time;
                },
                stop(time) {
                    this.stopTime = time;
                    this.stopped = time === undefined;
                },
            };
            sources.push(source);
            return source;
        },
    };
    let visible = true;
    const sound = loaded.evaluate('createGameSound')({
        getSettings: () => settings,
        createContext: () => context,
        isVisible: () => visible,
    });
    return {
        sound,
        context,
        sources,
        settings,
        hide: () => {
            visible = false;
        },
    };
}

test('효과음은 사용자 입력으로 열기 전·OFF·백그라운드에서 재생하거나 예약하지 않는다', () => {
    const r = audioRuntime();
    assert.equal(r.sound.play('victory'), false);
    r.sound.unlock();
    assert.equal(r.sound.play('victory'), true);
    assert.equal(r.sources.length, 4);
    r.settings.soundEffects = false;
    assert.equal(r.sound.play('impact'), false);
    r.settings.soundEffects = true;
    r.hide();
    assert.equal(r.sound.play('impact'), false);
    assert.equal(r.sources.length, 4);
});

test('빠른 효과음 입력은 동시 음원 수를 제한하고 화면별 취소는 다른 음원을 보존한다', () => {
    const r = audioRuntime();
    r.sound.unlock();
    r.sound.play('impact', {}, 'battle');
    r.sound.play('reward', {}, 'reward');
    r.sound.stop('battle');
    assert.ok(r.sources.slice(0, 2).every((source) => source.stopped));
    assert.ok(r.sources.slice(2).every((source) => !source.stopped && source.stopTime > 10));
    // Natural ends release the voice budget without canceling the reward channel.
    for (const source of r.sources.slice(2)) source.onended();
    for (let i = 0; i < 100; i++) r.sound.play('impact');
    assert.ok(r.sources.length <= 25);
    const before = r.sources.length;
    r.sound.stop();
    assert.equal(r.sound.play('impact'), true);
    assert.equal(r.sources.length, before + 2);
});

test('음향 API가 없거나 재개를 거부해도 게임 호출에 오류를 전파하지 않는다', async () => {
    const create = loadScripts(['scripts/config.js', 'scripts/features/sound-effects.js']).evaluate(
        'createGameSound'
    );
    const sound = create({
        getSettings: () => ({}),
        createContext: () => {
            throw Error('unavailable');
        },
    });
    assert.doesNotThrow(() => sound.unlock());
    assert.equal(sound.play('impact'), false);
    const r = audioRuntime();
    r.context.state = 'suspended';
    r.context.resume = () => Promise.reject(Error('denied'));
    r.sound.unlock();
    await Promise.resolve();
    assert.equal(r.sound.play('impact'), false);
    assert.equal(r.sources.length, 0);
});

function battleRuntime() {
    const r = browserRuntime({ v7_settings: '{"musicPlay":false,"wordRead":false}' });
    const sounds = [];
    r.evaluate('gameSound').play = (cue) => sounds.push(cue);
    r.evaluate('game.battleQuestionType="objective";game.init("battle",1)');
    r.advance(0);
    sounds.length = 0;
    return { ...r, sounds, view: r.evaluate('game.view') };
}

test('무기 타격·콤보 음향은 타격 시점에 발생하고 나가면 늦은 소리를 취소한다', () => {
    const r = battleRuntime();
    r.view.attack({ weaponId: 'tycoonAxe', effect: 'fire', combo: true });
    assert.deepEqual(r.sounds, ['swing']);
    r.advance(299);
    assert.deepEqual(r.sounds, ['swing']);
    r.advance(1);
    assert.deepEqual(r.sounds, ['swing', 'impact', 'combo']);
    r.sounds.length = 0;
    r.view.attack({ weaponId: 'fire', effect: 'fire' });
    r.evaluate('game.exit()');
    r.advance(1000);
    assert.deepEqual(r.sounds, ['swing']);
});

test('몬스터는 준비 동작 뒤 캐릭터 전체를 피격시키고 이전 반격이 새 공격을 지우지 않는다', () => {
    const r = battleRuntime();
    r.view.hit();
    assert.equal(r.getElement('hero-wrapper').classList.contains('hero-recoil'), false);
    r.advance(160);
    assert.equal(r.getElement('hero-wrapper').classList.contains('hero-recoil'), true);
    assert.deepEqual(r.sounds, ['hurt']);
    r.view.attack({ weaponId: 'fire', effect: 'fire' });
    r.advance(490);
    assert.equal(r.getElement('combat-effects').classList.contains('is-attacking'), true);
});

test('효과음 설정은 저장·재로드·저장 실패에서도 실제 설정과 일치한다', () => {
    const r = browserRuntime();
    r.sandbox.onload();
    const control = r.getElement('setting-sound-effects');
    assert.equal(r.evaluate('db.settings.soundEffects'), true);
    control.checked = false;
    control.dispatch('change');
    assert.equal(r.evaluate('db.settings.soundEffects'), false);
    assert.equal(
        browserRuntime(Object.fromEntries(r.store)).evaluate('db.settings.soundEffects'),
        false
    );
    r.sandbox.localStorage.setItem = () => {
        throw Error('quota');
    };
    control.checked = true;
    control.dispatch('change');
    assert.equal(control.checked, false);
});

test('구매 저장 실패는 획득 연출을 만들지 않고 성공한 구매에만 표시한다', () => {
    const r = browserRuntime({ v7_gold: '1000' });
    let rewards = 0;
    r.evaluate('gamePresentation').notify = () => rewards++;
    const write = r.sandbox.localStorage.setItem;
    r.sandbox.localStorage.setItem = () => {
        throw Error('quota');
    };
    r.evaluate('shop.buy("backpack","backpack")');
    assert.equal(rewards, 0);
    r.sandbox.localStorage.setItem = write;
    r.evaluate('shop.buy("backpack","backpack")');
    assert.equal(rewards, 1);
});

test('같은 장비의 새 연출은 이전 정리 예약으로 사라지지 않으며 화면 전환 때 취소한다', () => {
    const r = browserRuntime();
    const view = r.evaluate('gamePresentation');
    const avatar = r.getElement('inventory-avatar');
    view.highlight(avatar);
    r.advance(400);
    view.highlight(avatar);
    r.advance(310);
    assert.equal(avatar.classList.contains('equipment-reveal'), true);
    view.clear();
    r.advance(1000);
    assert.equal(avatar.classList.contains('equipment-reveal'), false);
});

test('스토리 진행 연출은 진행 저장이 성공한 뒤 해당 단어장에서 한 번만 소비한다', () => {
    const r = browserRuntime();
    r.evaluate('storyJourney.enter(0,0);game.stop()');
    const write = r.sandbox.localStorage.setItem;
    r.sandbox.localStorage.setItem = () => {
        throw Error('quota');
    };
    r.evaluate('storyJourney.completeBattle({mistakes:0})');
    assert.equal(r.evaluate('gamePresentation.takeProgress(db.getBookKey(),1)'), null);
    r.sandbox.localStorage.setItem = write;
    r.evaluate('storyJourney.completeBattle({mistakes:0})');
    const event = r.evaluate('gamePresentation.takeProgress(db.getBookKey(),1)');
    assert.equal(event.stage, 1);
    assert.equal(event.index, 0);
    assert.equal(r.evaluate('gamePresentation.takeProgress(db.getBookKey(),1)'), null);
});

test('보스 오답도 준비 동작 뒤 피격 음향을 내고 화면을 나가면 정리한다', () => {
    const r = battleRuntime();
    r.evaluate('game.mode="boss";game.handleAnswer(false,null)');
    r.advance(159);
    assert.equal(r.sounds.includes('hurt'), false);
    r.advance(1);
    assert.equal(r.sounds.includes('hurt'), true);
    assert.equal(r.getElement('hero-wrapper').classList.contains('hero-recoil'), true);
    r.evaluate('game.exit()');
    r.advance(3000);
    assert.equal(r.getElement('hero-wrapper').classList.contains('hero-recoil'), false);
    assert.equal(r.getElement('result-modal').style.display, 'none');
});
