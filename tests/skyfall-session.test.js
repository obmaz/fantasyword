const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load-module');

const createSession = loadScripts(['scripts/game/skyfall-session.js']).evaluate(
    'createSkyfallSession'
);
function runtime() {
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
        getSource: () => [
            { word: 'apple', meaning: '사과' },
            { word: 'banana', meaning: '바나나' },
        ],
        questions: { getDistractors: () => ['다른 보기'], shuffle: (values) => values },
        rules: { buildPool: (_day, source) => source },
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
        now: () => clock,
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
    assert.equal(r.hud.lives, 5);
    assert.ok(!r.events.includes('damage'));
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

test('정답 12개는 기본 보상 72G를 한 번씩 지급하고 중복 입력은 무시한다', () => {
    const r = runtime();
    r.session.start(1);
    for (let count = 0; count < 2; count++) {
        while (!r.words.size && r.session.active) r.advance(100);
        r.words.values().next().value.select();
        const choice = r.choice;
        choice.choose(choice.item.answer);
        choice.choose(choice.item.answer);
    }
    assert.equal(r.gold, 12);
    assert.equal(r.results[0].won, true);
    assert.equal(r.results[0].score, 2);
    assert.equal(r.session.active, false);
});

test('오답은 목숨을 차감하고 5번째에 종료하며 시간이 지나면 낙하 속도가 빨라진다', () => {
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
