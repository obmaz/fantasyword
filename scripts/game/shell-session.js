/** 세 컵·세 주사위 야바위. 늦은 입력과 지급은 세션 세대로 보호한다. */
function createShellSession({ view, random, timers, onOpen, onExit }) {
    const { setTimeout, clearTimeout } = timers;
    let active = false;
    let phase = 'idle';
    let version = 0;
    let timer = null;
    let cups = [0, 1, 2];
    let dice = [];
    let target = 0;
    let query = null;
    let options = null;
    let payout = 0;
    const integer = (max) => Math.min(max - 1, Math.max(0, Math.floor(random() * max)));
    const shuffle = (values) => {
        const copy = [...values];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = integer(i + 1);
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    };
    const guard = (callback) => {
        const generation = version;
        const step = phase;
        return (...args) => {
            if (active && generation === version && step === phase) callback(...args);
        };
    };
    const ask = (attribute) => {
        query = { attribute, value: dice[target][attribute] };
        view.ready(
            query,
            guard((cup) => session.pick(cup))
        );
    };
    const session = {
        get active() {
            return active;
        },
        get phase() {
            return phase;
        },
        init() {
            view.init(() => session.exit());
        },
        start(settings = null) {
            clearTimeout(timer);
            version++;
            active = true;
            phase = 'preview';
            cups = [0, 1, 2];
            const colors = shuffle(['red', 'blue', 'yellow', 'green']);
            const numbers = shuffle([1, 2, 3, 4, 5, 6]);
            dice = colors.slice(0, 3).map((color, cup) => ({ color, number: numbers[cup] }));
            payout = 0;
            options = settings;
            onOpen();
            view.open(
                dice,
                guard(() => session.begin())
            );
        },
        begin() {
            if (!active || phase !== 'preview') return;
            phase = 'mixing';
            const generation = version;
            view.hideDie();
            let remaining = 7;
            const swap = () => {
                if (!active || version !== generation || phase !== 'mixing') return;
                if (!remaining--) {
                    phase = 'pick';
                    target = integer(3);
                    ask(integer(2) ? 'number' : 'color');
                    return;
                }
                const left = integer(3);
                const right = (left + 1 + integer(2)) % 3;
                const from = cups[left];
                const to = cups[right];
                [cups[left], cups[right]] = [to, from];
                view.swap(from, to, left, right, 540);
                timer = setTimeout(swap, 620);
            };
            timer = setTimeout(swap, 240);
        },
        pick(cup) {
            if (!active || !['pick', 'double'].includes(phase) || !cups.includes(cup)) return;
            if (cup !== target) {
                phase = 'settle';
                view.reveal(dice, cups);
                session.settle(0);
                return;
            }
            if (phase === 'double') {
                phase = 'settle';
                view.reveal(dice, cups);
                session.settle(20);
                return;
            }
            phase = 'offer';
            view.offer(
                guard(() => session.cashOut()),
                guard(() => session.double())
            );
        },
        cashOut() {
            if (!active || phase !== 'offer') return;
            phase = 'settle';
            view.reveal(dice, cups);
            session.settle(10);
        },
        double() {
            if (!active || phase !== 'offer') return;
            phase = 'double';
            target = (target + 1 + integer(2)) % 3;
            // 같은 정답 컵을 반복하지 않고 다른 속성으로 남은 주사위를 찾는다.
            ask(query.attribute === 'color' ? 'number' : 'color');
        },
        settle(points) {
            if (!active || phase !== 'settle') return;
            payout = points;
            if (options?.onSettle && !options.onSettle(points)) {
                view.saveFailed(guard(() => session.settle(payout)));
                return;
            }
            phase = 'done';
            view.done(
                points,
                Boolean(options),
                guard(() => (options ? session.exit() : session.start()))
            );
        },
        exit() {
            if (!active) return;
            active = false;
            phase = 'idle';
            version++;
            clearTimeout(timer);
            timer = null;
            const previous = options;
            options = null;
            view.exit();
            onExit();
            previous?.onExit?.();
        },
    };
    return session;
}
