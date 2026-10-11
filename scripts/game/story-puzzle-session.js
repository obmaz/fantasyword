/** 속담·단어 대장간의 진행을 공유하고 도메인 판정과 DOM 표현을 분리한다. */
function createStoryPuzzleSession({
    view,
    rules,
    proverbs,
    paths,
    words,
    wordMeanings,
    shuffle,
    onOpen,
    onExit,
}) {
    let active = false;
    let phase = 'idle';
    let version = 0;
    let roundVersion = 0;
    let kind = null;
    let rounds = [];
    let index = 0;
    let mistakes = 0;
    let trail = [];
    let options = null;
    let result = null;
    const guard = (callback) => {
        const generation = version;
        const round = roundVersion;
        return (...args) => {
            if (active && generation === version && round === roundVersion) callback(...args);
        };
    };
    const session = {
        get active() {
            return active;
        },
        init() {
            view.init(() => session.exit());
        },
        start(mode, settings = null) {
            if (!['proverb', 'forge'].includes(mode)) return;
            version++;
            active = true;
            kind = mode;
            options = settings;
            index = 0;
            mistakes = 0;
            result = null;
            rounds =
                kind === 'proverb'
                    ? rules.proverbs(proverbs, shuffle)
                    : rules.forge(paths, words, shuffle);
            onOpen();
            view.open(kind);
            session.next();
        },
        next() {
            if (!active) return;
            if (index >= rounds.length || mistakes > 2) {
                session.finish();
                return;
            }
            roundVersion++;
            phase = 'answer';
            trail = kind === 'forge' ? [rounds[index].start] : [];
            session.render();
        },
        render() {
            const question = rounds[index];
            const current = trail.at(-1);
            view.question(
                {
                    kind,
                    round: index + 1,
                    total: rounds.length,
                    mistakes,
                    prompt:
                        kind === 'proverb'
                            ? `${question.before}____${question.after}`
                            : question.goal,
                    current,
                    wordMeanings: kind === 'forge' ? wordMeanings : null,
                    trail: [...trail],
                    remaining: kind === 'forge' ? question.minimum + 2 - (trail.length - 1) : null,
                    choices:
                        kind === 'proverb' ? question.choices : rules.neighbors(current, words),
                },
                guard((choice) => session.choose(choice))
            );
        },
        choose(choice) {
            if (!active || phase !== 'answer') return;
            const question = rounds[index];
            if (kind === 'proverb') {
                if (!question.choices.includes(choice)) return;
                const correct = choice === question.answer;
                if (!correct) mistakes++;
                phase = 'review';
                roundVersion++;
                view.review(
                    {
                        correct,
                        mistakes,
                        answer: `${question.before}${question.answer}${question.after}`,
                        meaning: question.meaning,
                    },
                    guard(() => session.continue())
                );
                return;
            }
            const current = trail.at(-1);
            if (!words.includes(choice) || !rules.differsByOne(current, choice)) return;
            trail.push(choice);
            roundVersion++;
            if (choice === question.goal) {
                mistakes += Math.max(0, trail.length - 1 - question.minimum);
                phase = 'review';
                view.review(
                    {
                        correct: true,
                        mistakes,
                        answer: trail.join(' → '),
                        words: [...trail],
                        wordMeanings,
                        meaning: `최단 ${question.minimum}회 · 사용 ${trail.length - 1}회`,
                    },
                    guard(() => session.continue())
                );
            } else if (trail.length - 1 >= question.minimum + 2) {
                mistakes = 3;
                phase = 'review';
                view.review(
                    {
                        correct: false,
                        mistakes,
                        answer: rules.path(question.start, question.goal, words).join(' → '),
                        words: rules.path(question.start, question.goal, words),
                        wordMeanings,
                        meaning: '변환 횟수를 모두 사용했습니다.',
                    },
                    guard(() => session.continue())
                );
            } else session.render();
        },
        continue() {
            if (!active || phase !== 'review') return;
            index++;
            session.next();
        },
        finish() {
            if (!active || ['settle', 'done'].includes(phase)) return;
            roundVersion++;
            phase = 'settle';
            const won = index >= rounds.length && mistakes <= 2;
            result = { won, mistakes, kind, points: won ? rounds.length * 6 : 0 };
            session.settle();
        },
        settle() {
            if (!active || phase !== 'settle') return;
            if (options?.onSettle && !options.onSettle(result)) {
                view.saveFailed(guard(() => session.settle()));
                return;
            }
            phase = 'done';
            view.done(
                result,
                Boolean(options),
                guard(() => (options ? session.exit() : session.start(kind)))
            );
        },
        exit() {
            if (!active) return;
            active = false;
            version++;
            phase = 'idle';
            const previous = options;
            options = null;
            view.exit();
            onExit();
            previous?.onExit?.();
        },
    };
    return session;
}
