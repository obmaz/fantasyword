const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load-module');

const createSession = loadScripts(['scripts/game/skyfall-session.js']).evaluate(
    'createSkyfallSession'
);
function runtime({
    shuffle = (values) => values,
    nowStep = 0,
    source = [
        { word: 'apple', meaning: '사과' },
        { word: 'banana', meaning: '바나나' },
    ],
} = {}) {
    let clock = 0;
    let serial = 0;
    let gold = 0;
    let choice;
    let hud;
    const words = new Map();
    const frames = new Map();
    const results = [];
    const events = [];
    const moves = [];
    const session = createSession({
        db: { addGold: (value) => (gold += value) },
        getSource: () => source,
        questions: { getDistractors: () => ['다른 보기'], shuffle },
        rules: {
            buildPool: (_day, source) => source,
            assaultReward: loadScripts(['scripts/domain/battle-rules.js']).evaluate('battleRules')
                .assaultReward,
        },
        view: {
            hud(value) {
                hud = value;
            },
            clearChoice() {
                choice = null;
            },
            addWord(item, select) {
                words.set(item.id, { item, select });
            },
            removeWord(id) {
                words.delete(id);
            },
            moveWord(id, y) {
                moves.push([id, y]);
            },
            choice(item, choose) {
                choice = { item, choose };
            },
            attack() {
                events.push('attack');
            },
            damage() {
                events.push('damage');
            },
            stop() {
                words.clear();
                choice = null;
            },
            open() {
                events.push('open');
            },
            exit() {
                events.push('exit');
            },
            result(value) {
                results.push(value);
            },
        },
        playMusic() {},
        pauseMusic() {},
        notify() {},
        requestFrame(callback) {
            const id = ++serial;
            frames.set(id, callback);
            return id;
        },
        cancelFrame(id) {
            frames.delete(id);
        },
        now: () => (clock += nowStep),
    });
    return {
        session,
        words,
        frames,
        results,
        events,
        moves,
        get hud() {
            return hud;
        },
        get choice() {
            return choice;
        },
        get gold() {
            return gold;
        },
        advance(ms, render = true) {
            clock += ms;
            if (!render) return;
            const [id, callback] = frames.entries().next().value || [];
            if (callback) {
                frames.delete(id);
                callback();
            }
        },
        answer(correct) {
            words.values().next().value.select();
            choice.choose(correct ? choice.item.answer : '오답');
        },
    };
}

test('스토리 총공세는 8문제로 줄이고 승리·복귀 콜백을 한 번씩 실행한다', () => {
    const source = Array.from({ length: 12 }, (_, index) => ({
        word: `word${index}`,
        meaning: `뜻${index}`,
    }));
    const r = runtime({ source });
    const finished = [];
    const mistakes = [];
    let exits = 0;
    r.session.start('all', {
        count: 8,
        onFinish: (won, result) => {
            finished.push(won);
            mistakes.push(result.mistakes);
        },
        onExit: () => exits++,
    });
    assert.equal(r.hud.target, 8);
    assert.equal(r.hud.remaining, 29);
    for (let index = 0; index < 8; index++) {
        r.answer(true);
        if (index < 7) r.advance(2500);
    }
    assert.deepEqual(finished, [true]);
    assert.deepEqual(mistakes, [0]);
    r.advance(10000);
    assert.deepEqual(finished, [true]);
    r.session.exit();
    r.session.exit();
    assert.equal(exits, 1);
    assert.equal(source.length, 12);
    r.session.start('all');
    assert.equal(r.hud.target, 12);
    r.session.exit();
    assert.equal(exits, 1);
});

test('프레임이 멈춘 61초도 실제 제한 시간에 포함하고 결과를 한 번만 연다', () => {
    const r = runtime();
    r.session.start(1);
    r.advance(61000);
    assert.equal(r.session.active, false);
    assert.equal(r.hud.remaining, 0);
    assert.equal(r.results.length, 1);
    assert.equal(r.results[0].won, false);
    assert.equal(r.frames.size, 0);
    r.advance(1000);
    assert.equal(r.results.length, 1);
});

test('느린 프레임에서도 낙하와 등장 간격은 실제 시간을 따르고 새 단어는 위에서 시작한다', () => {
    const r = runtime();
    r.session.start(1);
    r.advance(4000);
    assert.equal(r.hud.remaining, 7);
    assert.ok(r.moves[0][1] > 0.45);
    assert.equal(r.words.size, 2);
    assert.equal([...r.words.values()].at(-1).item.y, 0.07);
    r.advance(3200);
    assert.equal(r.hud.lives, 4);
    assert.ok(r.events.includes('damage'));
});

test('프레임 재개 전 마감 직후 클릭하거나 정답을 제출해도 골드를 지급하지 않는다', () => {
    for (const selectFirst of [false, true]) {
        const r = runtime();
        r.session.start(1);
        const select = r.words.values().next().value.select;
        if (selectFirst) select();
        const answer = r.choice;
        r.advance(60000, false);
        if (answer) answer.choose(answer.item.answer);
        else select();
        assert.equal(r.gold, 0);
        assert.equal(r.session.active, false);
        assert.equal(r.results.length, 1);
    }
});

test('Day의 모든 단어는 한 번씩 출제하고 중복 정답 입력은 보상을 늘리지 않는다', () => {
    const r = runtime();
    r.session.start(1);
    for (let count = 0; count < 2; count++) {
        while (!r.words.size && r.session.active) r.advance(100);
        r.words.values().next().value.select();
        const choice = r.choice;
        choice.choose(choice.item.answer);
        choice.choose(choice.item.answer);
    }
    assert.equal(r.gold, 8);
    assert.equal(r.results[0].won, true);
    assert.equal(r.results[0].score, 2);
    assert.equal(r.session.active, false);
});

test('오답은 생명을 차감하며 시간이 지나면 낙하 속도가 빨라진다', () => {
    const r = runtime();
    r.session.start(1);
    for (let count = 0; count < 2; count++) {
        while (!r.words.size && r.session.active) r.advance(100);
        r.answer(false);
    }
    assert.equal(r.hud.lives, 3);
    assert.equal(r.gold, 0);
    assert.equal(r.results[0].won, false);
    assert.ok(r.session.rates(30).speed > r.session.rates(0).speed);
    assert.ok(r.session.rates(30).interval < r.session.rates(0).interval);
});

test('출제 덱을 섞은 순서로 모든 Day 단어를 중복 없이 내보낸다', () => {
    const r = runtime({ shuffle: (values) => [...values].reverse() });
    r.session.start(1);
    const appeared = [];
    for (let count = 0; count < 2; count++) {
        while (!r.words.size && r.session.active) r.advance(100);
        const item = r.words.values().next().value.item;
        appeared.push(item.answerKey === 'meaning' ? item.prompt : item.answer);
        r.answer(true);
    }
    assert.deepEqual(appeared, ['banana', 'apple']);
    assert.equal(r.results[0].target, 2);
    assert.equal(r.frames.size, 0);
});

test('바닥에 닿은 단어 5개는 생명을 모두 차감하고 결과를 한 번만 연다', () => {
    const r = runtime({
        source: Array.from({ length: 10 }, (_, index) => ({
            word: `word-${index}`,
            meaning: `뜻-${index}`,
        })),
    });
    r.session.start(1);
    for (let index = 0; index < 310 && r.session.active; index++) r.advance(100);
    assert.equal(r.hud.lives, 0);
    assert.equal(r.moves.filter(([, y]) => y === 0.84).length, 5);
    assert.equal(r.results.length, 1);
    assert.equal(r.results[0].won, false);
    assert.equal(r.gold, 0);
    assert.equal(r.frames.size, 0);
});

test('종료 후 늦은 입력·프레임은 다시 시작한 세션을 갱신하지 않는다', () => {
    const r = runtime();
    r.session.start(1);
    const oldFrame = r.frames.values().next().value;
    r.words.values().next().value.select();
    const oldChoice = r.choice;
    r.session.exit();
    r.session.start(1);
    r.advance(61000, false);
    oldFrame();
    oldChoice.choose(oldChoice.item.answer);
    assert.equal(r.session.active, true);
    assert.equal(r.gold, 0);
    assert.equal(r.hud.remaining, 11);
    assert.equal(r.results.length, 0);
});

test('총공세 정지 장치는 한 번만 사용하고 3초 동안 낙하를 멈춘다', () => {
    const r = runtime();
    r.session.start(1);
    const before = r.moves.length;
    assert.equal(r.session.useItem(), true);
    assert.equal(r.session.useItem(), false);
    r.advance(2500);
    assert.equal(r.moves.length, before);
    r.advance(600);
    assert.ok(r.moves.length > before);
    assert.equal(r.hud.itemAvailable, false);
    assert.equal(r.session.useItem(), false);
    r.session.start(1);
    assert.equal(r.hud.itemAvailable, true);
    assert.equal(r.session.useItem(), true);
});

test('정지 장치 사용 중 긴 프레임도 3초만 제외하고 실제 마감 뒤 입력을 막는다', () => {
    for (const input of ['frame', 'answer', 'item']) {
        const r = runtime();
        r.session.start(1);
        r.words.values().next().value.select();
        const choice = r.choice;
        r.session.useItem();
        r.advance(14000, input === 'frame');
        if (input === 'answer') choice.choose(choice.item.answer);
        if (input === 'item') assert.equal(r.session.useItem(), false);
        assert.equal(r.session.active, false);
        assert.equal(r.gold, 0);
        assert.equal(r.results.length, 1);
    }
});

test('정지가 끝난 프레임은 초과한 시간만큼 낙하와 등장 시간을 진행한다', () => {
    const r = runtime();
    r.session.start(1);
    r.session.useItem();
    r.advance(4000);
    assert.equal(r.hud.remaining, 10);
    assert.ok(r.moves[0][1] > 0.17);
    assert.ok(r.moves[0][1] < 0.2);
    assert.equal(r.words.size, 1);
});

test('프레임 재개 전 입력도 도착선에 닿은 단어를 제거하고 생명을 차감한다', () => {
    for (const input of ['select', 'answer', 'item']) {
        const r = runtime();
        r.session.start(1);
        const select = r.words.values().next().value.select;
        select();
        const choice = r.choice;
        r.advance(9000, false);
        if (input === 'select') select();
        else if (input === 'answer') choice.choose(choice.item.answer);
        else r.session.useItem();
        assert.equal(r.hud.lives, 4);
        assert.equal(r.words.size, 0);
        assert.equal(r.choice, null);
        assert.equal(r.gold, 0);
    }
});

test('실제 시계처럼 매 호출 시간이 증가해도 도착선 판정은 재귀 없이 한 번 차감한다', () => {
    const r = runtime({ nowStep: 0.1 });
    r.session.start(1);
    r.advance(9000);
    assert.equal(r.session.active, true);
    assert.equal(r.hud.lives, 4);
    assert.equal(r.events.filter((event) => event === 'damage').length, 1);
    assert.equal(r.frames.size, 1);
});

test('렌더러는 종료 즉시 공격 효과와 예약된 정리를 제거한다', () => {
    const nodes = new Map();
    const pending = new Map();
    const makeNode = () => ({
        children: [],
        style: { setProperty() {} },
        classList: { add() {}, remove() {}, toggle() {} },
        addEventListener() {},
        append(child) {
            this.children.push(child);
            child.parent = this;
        },
        replaceChildren() {
            this.children = [];
        },
        remove() {
            if (this.parent)
                this.parent.children = this.parent.children.filter((node) => node !== this);
        },
    });
    const document = {
        createElement: makeNode,
        getElementById(id) {
            if (!nodes.has(id)) nodes.set(id, makeNode());
            return nodes.get(id);
        },
    };
    let serial = 0;
    const createView = loadScripts(['scripts/ui/skyfall-view.js']).evaluate('createSkyfallView');
    const view = createView({
        document,
        openScreen() {},
        closeScreen() {},
        syncLayout() {},
        timers: {
            setTimeout(fn) {
                const id = ++serial;
                pending.set(id, fn);
                return id;
            },
            clearTimeout(id) {
                pending.delete(id);
            },
        },
    });
    view.addWord({ id: 1, prompt: 'apple', x: 50, y: 0.1 }, () => {});
    view.attack(1);
    const field = document.getElementById('skyfall-field');
    assert.equal(field.children.length, 3);
    assert.equal(pending.size, 2);
    const projectile = field.children.find((node) => node.className === 'skyfall-projectile');
    assert.equal(projectile.style.left, undefined, '발사점은 CSS의 플레이어 위치를 유지한다');
    view.stop();
    assert.equal(field.children.length, 0);
    assert.equal(pending.size, 0);
    view.addWord({ id: 2, prompt: 'banana', x: 16, y: 0.07 }, () => {});
    assert.equal(field.children.length, 1);
});
