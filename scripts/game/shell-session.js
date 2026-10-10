/** 세 컵 야바위. 애니메이션 완료와 결과 지급은 세션 세대로 보호한다. */
function createShellSession({ view, random, timers, onOpen, onExit }) {
    const { setTimeout, clearTimeout } = timers;
    let active = false;
    let phase = 'idle';
    let version = 0;
    let timer = null;
    let cups = [0, 1, 2];
    let target = 0;
    let die = null;
    let options = null;
    let selectedColor = null;
    let selectedNumber = null;
    let payout = 0;
    const colors = ['red', 'blue', 'yellow', 'green'];
    const integer = (max) => Math.min(max - 1, Math.max(0, Math.floor(random() * max)));
    const guard = (callback) => {
        const generation = version;
        return (...args) => {
            if (active && generation === version) callback(...args);
        };
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
            target = integer(3);
            die = { color: colors[integer(4)], number: integer(6) + 1 };
            selectedColor = null;
            selectedNumber = null;
            payout = 0;
            options = settings;
            onOpen();
            view.open(
                die,
                target,
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
                    view.ready(guard((cup) => session.pick(cup)));
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
            if (!active || phase !== 'pick' || !cups.includes(cup)) return;
            if (cup !== target) {
                phase = 'settle';
                view.reveal(die, target, cups.indexOf(target));
                session.settle(0);
                return;
            }
            phase = 'offer';
            // 컵을 찾은 뒤에는 주사위를 다시 보여주지 않아 색상·숫자 기억을 묻는다.
            view.offer(
                guard(() => session.cashOut()),
                guard(() => session.double())
            );
        },
        cashOut() {
            if (!active || phase !== 'offer') return;
            phase = 'settle';
            view.reveal(die, target, cups.indexOf(target));
            session.settle(10);
        },
        double() {
            if (!active || phase !== 'offer') return;
            phase = 'double';
            view.doubleChoice(
                guard((color) => session.chooseColor(color)),
                guard((number) => session.chooseNumber(number)),
                guard(() => session.submitDouble())
            );
        },
        chooseColor(color) {
            if (!active || phase !== 'double' || !colors.includes(color)) return;
            selectedColor = color;
            view.selection(selectedColor, selectedNumber);
        },
        chooseNumber(number) {
            if (
                !active ||
                phase !== 'double' ||
                !Number.isInteger(number) ||
                number < 1 ||
                number > 6
            )
                return;
            selectedNumber = number;
            view.selection(selectedColor, selectedNumber);
        },
        submitDouble() {
            if (!active || phase !== 'double' || !selectedColor || !selectedNumber) return;
            phase = 'settle';
            view.reveal(die, target, cups.indexOf(target));
            session.settle(selectedColor === die.color && selectedNumber === die.number ? 20 : 0);
        },
        settle(points) {
            if (!active || phase !== 'settle') return;
            payout = points;
            // 지급 저장이 실패해도 다시 게임을 하지 않고 같은 결과의 저장만 재시도한다.
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
