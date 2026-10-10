const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load-module');
const createSession = loadScripts(['scripts/game/shell-session.js']).evaluate('createShellSession');

function runtime(options = null) {
    let clock = 0;
    let serial = 0;
    const jobs = new Map();
    const seen = { swaps: [], rewards: [] };
    const view = {
        init() {},
        open(die, target, begin) {
            Object.assign(seen, { die, target, begin });
        },
        hideDie() {},
        swap(...args) {
            seen.swaps.push(args);
        },
        ready(pick) {
            seen.pick = pick;
        },
        offer(cash, double) {
            Object.assign(seen, { cash, double });
        },
        doubleChoice(color, number, submit) {
            Object.assign(seen, { color, number, submit });
        },
        selection() {},
        reveal() {
            seen.revealed = true;
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
        random: () => 0.25,
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

test('야바위는 입력을 잠그고 일곱 번 실제 이동 모델을 보낸 뒤 컵 선택을 받는다', () => {
    const r = runtime();
    r.seen.begin();
    r.session.pick(r.seen.target);
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
    r.seen.pick(r.seen.target);
    assert.equal(r.session.phase, 'offer');
    assert.equal(r.seen.revealed, undefined);
    r.seen.cash();
    r.seen.cash();
    assert.deepEqual(r.seen.rewards, [10]);
});

test('2배 도전은 색상과 숫자 모두 맞혀야 20점이며 하나라도 틀리면 0점이다', () => {
    for (const correct of [true, false]) {
        const r = runtime();
        r.seen.begin();
        r.advance(6000);
        r.seen.pick(r.seen.target);
        r.seen.double();
        r.seen.submit();
        assert.equal(r.session.phase, 'double');
        r.seen.color(r.seen.die.color);
        r.seen.number(correct ? r.seen.die.number : (r.seen.die.number % 6) + 1);
        r.seen.submit();
        r.seen.submit();
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
    r.seen.pick((r.seen.target + 1) % 3);
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
    oldPick(r.seen.target);
    assert.equal(r.session.phase, 'preview');
    r.seen.begin();
    r.advance(500);
    r.session.exit();
    r.advance(6000);
    assert.equal(r.session.phase, 'idle');
    assert.equal(r.session.active, false);
});
