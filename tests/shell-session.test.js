const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load-module');
const createSession = loadScripts(['scripts/game/shell-session.js']).evaluate('createShellSession');

function runtime(options = null, random = () => 0.25) {
    let clock = 0;
    let serial = 0;
    const jobs = new Map();
    const seen = { swaps: [], rewards: [] };
    const view = {
        init() {},
        open(dice, begin) {
            Object.assign(seen, { dice, begin });
        },
        hideDie() {},
        swap(...args) {
            seen.swaps.push(args);
        },
        ready(query, pick) {
            Object.assign(seen, { query, pick });
        },
        offer(cash, double) {
            Object.assign(seen, { cash, double });
        },
        reveal(dice, cups) {
            seen.revealed = true;
            seen.revealedDice = dice;
            seen.cupOrder = cups;
        },
        saveFailed(retry) {
            seen.retry = retry;
        },
        done(points) {
            seen.rewards.push(points);
        },
        exit() {},
    };
    const session = createSession({
        view,
        random,
        timers: {
            clearTimeout: (id) => jobs.delete(id),
            setTimeout: (fn, delay) => {
                const id = ++serial;
                jobs.set(id, { fn, at: clock + delay });
                return id;
            },
        },
        onOpen() {},
        onExit() {},
    });
    function advance(ms) {
        const end = clock + ms;
        while (true) {
            const next = [...jobs]
                .filter(([, job]) => job.at <= end)
                .sort((a, b) => a[1].at - b[1].at)[0];
            if (!next) break;
            jobs.delete(next[0]);
            clock = next[1].at;
            next[1].fn();
        }
        clock = end;
    }
    session.start(options);
    return { session, seen, advance };
}

function target(r) {
    return r.seen.dice.findIndex((die) => die[r.seen.query?.attribute] === r.seen.query?.value);
}

test('야바위는 입력을 잠그고 일곱 번 실제 이동 모델을 보낸 뒤 컵 선택을 받는다', () => {
    const r = runtime();
    assert.equal(r.seen.dice.length, 3);
    assert.equal(new Set(r.seen.dice.map((die) => die.color)).size, 3);
    assert.equal(new Set(r.seen.dice.map((die) => die.number)).size, 3);
    r.seen.begin();
    assert.equal(r.seen.query, undefined);
    r.session.pick(target(r));
    assert.equal(r.session.phase, 'mixing');
    r.advance(1000);
    assert.ok(r.seen.swaps.length > 0 && r.seen.swaps.length < 7);
    assert.ok(
        r.seen.swaps.every(
            ([first, second, left, right, duration]) =>
                first !== second && left !== right && duration === 540
        )
    );
    r.advance(5000);
    assert.equal(r.seen.swaps.length, 7);
    assert.equal(r.session.phase, 'pick');
    r.seen.pick(target(r));
    assert.equal(r.session.phase, 'offer');
    assert.equal(r.seen.revealed, undefined);
    r.seen.cash();
    r.seen.cash();
    assert.deepEqual(r.seen.rewards, [10]);
});

test('2배 도전은 다른 주사위와 속성의 컵을 찾고 정답 공개 없이 20 또는 0을 지급한다', () => {
    for (const correct of [true, false]) {
        const r = runtime();
        r.seen.begin();
        r.advance(6000);
        const first = target(r);
        const attribute = r.seen.query.attribute;
        const oldPick = r.seen.pick;
        r.seen.pick(first);
        r.seen.double();
        assert.notEqual(target(r), first);
        assert.notEqual(r.seen.query.attribute, attribute);
        assert.equal(r.seen.revealed, undefined);
        oldPick(first);
        assert.equal(r.session.phase, 'double');
        r.seen.pick(correct ? target(r) : first);
        r.seen.pick(target(r));
        assert.deepEqual(r.seen.rewards, [correct ? 20 : 0]);
    }
});

test('틀린 컵은 0점이며 저장 실패는 같은 보상만 재시도한다', () => {
    let writes = 0;
    const r = runtime({
        onSettle(points) {
            assert.equal(points, 0);
            return ++writes > 1;
        },
    });
    r.seen.begin();
    r.advance(6000);
    r.seen.pick((target(r) + 1) % 3);
    assert.equal(r.session.phase, 'settle');
    r.seen.retry();
    r.seen.retry();
    assert.equal(writes, 2);
    assert.deepEqual(r.seen.rewards, [0]);
});

test('이전 판의 시작·선택 콜백과 타이머는 나가기·새 판 이후에 영향을 주지 않는다', () => {
    const r = runtime();
    const oldBegin = r.seen.begin;
    r.seen.begin();
    r.advance(6000);
    const oldPick = r.seen.pick;
    r.session.exit();
    r.session.start();
    oldBegin();
    oldPick(target(r));
    assert.equal(r.session.phase, 'preview');
    r.seen.begin();
    r.advance(500);
    r.session.exit();
    r.advance(6000);
    assert.equal(r.session.phase, 'idle');
    assert.equal(r.session.active, false);
});

test('무작위 색상·숫자 질문은 정답 컵 하나이며 공개 주사위는 이동한 자리에 남는다', () => {
    const attributes = new Set();
    for (let sample = 1; sample <= 30; sample++) {
        let seed = sample * 8191;
        const r = runtime(null, () => {
            seed = (seed * 16807) % 2147483647;
            return seed / 2147483647;
        });
        r.seen.begin();
        r.advance(6000);
        const { attribute, value } = r.seen.query;
        attributes.add(attribute);
        assert.equal(r.seen.dice.filter((die) => die[attribute] === value).length, 1);
        const cups = [0, 1, 2];
        for (const [first, second, left, right] of r.seen.swaps) {
            assert.equal(cups[left], first);
            assert.equal(cups[right], second);
            [cups[left], cups[right]] = [second, first];
        }
        r.seen.pick(target(r));
        r.seen.cash();
        assert.deepEqual(Array.from(r.seen.cupOrder), cups);
        assert.equal(r.seen.revealedDice, r.seen.dice);
    }
    assert.deepEqual([...attributes].sort(), ['color', 'number']);
});
