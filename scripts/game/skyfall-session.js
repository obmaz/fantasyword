/** 총공세 진행. 시간·화면·음악은 구성 루트에서 주입한다. */
function createSkyfallSession({
    db,
    getSource,
    questions,
    rules,
    view,
    playMusic,
    pauseMusic,
    requestFrame,
    cancelFrame,
    now,
    notify,
    random = Math.random,
}) {
    const BASE_TIME = 5;
    const TIME_PER_WORD = 3;
    const MAX_LIVES = 5;
    let active = false;
    let items = [];
    let selected = null;
    let pool = [];
    let serial = 0;
    let score = 0;
    let lives = MAX_LIVES;
    let earned = 0;
    let elapsed = 0;
    let startedAt = 0;
    let spawnElapsed = 0;
    let lastFrame = 0;
    let frame = 0;
    let generation = 0;
    let nextLane = 0;
    let nextWordIndex = 0;
    let resolved = 0;
    let modifier = 'steady';
    let pausedUntil = 0;
    let pausedFrom = 0;
    let pausedTotal = 0;
    let itemUsed = false;
    let sessionOptions = null;
    const ELITE_CHANCE = 0.18;
    const ELITE_SPEED = 1.45;
    const ELITE_GOLD_BONUS = 8;
    const ELITE_REWARDS = ['hint', 'hourglass', 'shield', 'backpack'];

    const rates = (seconds, item = null) => ({
        interval: Math.max(0.8, 2.4 - seconds * 0.032) * (modifier === 'rush' ? 0.7 : 1),
        speed:
            Math.min(0.28, 0.105 + seconds * 0.0028) *
            (modifier === 'swift' && item?.swift ? 1.7 : 1) *
            (item?.elite ? ELITE_SPEED : 1),
    });
    const limit = () => BASE_TIME + pool.length * TIME_PER_WORD;
    const elapsedNow = () => {
        const current = now();
        const activePause = pausedUntil
            ? Math.max(0, Math.min(current, pausedUntil) - pausedFrom)
            : 0;
        return Math.max(0, (current - startedAt - pausedTotal - activePause) / 1000);
    };
    function updateHud() {
        view.hud({
            remaining: Math.max(0, Math.ceil(limit() - elapsed)),
            score,
            target: pool.length,
            lives,
            maxLives: MAX_LIVES,
            earned,
            itemAvailable: !itemUsed,
            modifier,
        });
    }
    function clearChoice() {
        selected = null;
        view.clearChoice();
    }
    function removeItem(item) {
        items = items.filter((entry) => entry !== item);
        view.removeWord(item.id);
        if (selected === item) clearChoice();
    }
    // 배경 탭에서 rAF가 멈춰도 마감은 연장되지 않는다. 입력 전에도 검사한다.
    function canContinue() {
        if (!active) return false;
        if (pausedUntil && now() >= pausedUntil) {
            pausedTotal += pausedUntil - pausedFrom;
            // 정지 이후 늦게 돌아온 프레임의 초과 시간은 그대로 진행한다.
            lastFrame = Math.max(lastFrame, pausedUntil);
            pausedUntil = 0;
            pausedFrom = 0;
        }
        elapsed = elapsedNow();
        if (elapsed >= limit()) {
            updateHud();
            finish(false);
            return false;
        }
        const timestamp = now();
        const delta = Math.max(0, (timestamp - lastFrame) / 1000);
        // 입력과 프레임이 같은 시계를 사용하고 도착선 처리는 검사한 시각을 재사용한다.
        lastFrame = timestamp;
        if (!pausedUntil && delta > 0) {
            spawnElapsed += delta;
            for (const item of [...items]) {
                item.y += delta * rates(elapsed, item).speed;
                view.moveWord(item.id, Math.min(0.84, item.y));
                if (item.y >= 0.84) hit(item, false, true);
                if (!active) return false;
            }
        }
        return true;
    }
    function hit(item, correct, clockChecked = false) {
        if (!(clockChecked ? active : canContinue()) || !items.includes(item)) return;
        if (correct) {
            score += 1;
            const reward = rules.assaultReward() + (item.elite ? ELITE_GOLD_BONUS : 0);
            earned += reward;
            db.addGold(reward);
            if (item.elite) {
                const rewardId = ELITE_REWARDS[Math.floor(random() * ELITE_REWARDS.length)];
                const canStore =
                    Array.isArray(db.inventory) &&
                    db.inventory.length < Number(db.inventoryCapacity || 3) &&
                    !db.owned?.includes(rewardId);
                if (canStore) {
                    db.owned.push(rewardId);
                    db.inventory.push(rewardId);
                    db.save?.('owned', 'inventory');
                    notify(`엘리트 악당 보상: ${rewardId} 획득!`);
                } else notify('엘리트 악당 보상: 보관함이 가득 차 골드로 지급되었습니다.');
            }
            view.attack(item.id);
        } else {
            lives -= 1;
            view.damage();
        }
        resolved += 1;
        removeItem(item);
        updateHud();
        if (lives <= 0 || (resolved >= pool.length && !items.length))
            finish(lives > 0 && score === pool.length);
    }
    function select(item) {
        if (!canContinue() || !items.includes(item)) return;
        selected = item;
        view.choice(item, (answer) => {
            if (selected === item) hit(item, answer === item.answer);
        });
    }
    function spawn() {
        if (items.length >= 5 || !pool.length) return;
        const row = pool[nextWordIndex++];
        if (!row) return;
        const english = Math.random() < 0.5;
        const answerKey = english ? 'meaning' : 'word';
        const prompt = String(english ? row.word : row.meaning).trim();
        const answer = String(row[answerKey]).trim();
        const options = questions.shuffle([
            answer,
            ...questions.getDistractors(answer, answerKey, row, pool),
        ]);
        if (options.length < 2) return;
        const x = [16, 50, 84][nextLane++ % 3];
        const item = {
            id: ++serial,
            prompt,
            answer,
            answerKey,
            options,
            x,
            y: 0.07,
            swift: modifier === 'swift' && nextWordIndex % 3 === 0,
            elite: random() < ELITE_CHANCE,
        };
        items.push(item);
        view.addWord(item, () => select(item));
    }
    function queueFrame() {
        const current = generation;
        frame = requestFrame(() => {
            if (current === generation) tick();
        });
    }
    function tick() {
        if (!canContinue()) return;
        // 긴 프레임 뒤에도 새로 등장한 단어는 시작 위치에서 출발한다.
        if (
            !pausedUntil &&
            nextWordIndex < pool.length &&
            spawnElapsed >= rates(elapsed).interval
        ) {
            spawnElapsed = 0;
            spawn();
        }
        if (resolved >= pool.length && !items.length) {
            finish(score === pool.length);
            return;
        }
        updateHud();
        queueFrame();
    }
    function stop() {
        active = false;
        generation++;
        cancelFrame(frame);
        frame = 0;
        items = [];
        selected = null;
        pausedUntil = 0;
        pausedFrom = 0;
        pausedTotal = 0;
        view.stop();
    }
    function exit() {
        const onExit = sessionOptions?.onExit;
        sessionOptions = null;
        stop();
        pauseMusic();
        view.exit();
        onExit?.();
    }
    function finish(won) {
        if (!active) return;
        stop();
        pauseMusic();
        view.result({ won, score, target: pool.length, earned });
        sessionOptions?.onFinish?.(won, { mistakes: MAX_LIVES - lives });
    }
    function useItem() {
        if (!canContinue() || itemUsed) return false;
        itemUsed = true;
        pausedFrom = now();
        lastFrame = pausedFrom;
        pausedUntil = pausedFrom + 3000;
        updateHud();
        return true;
    }
    function start(day, options = null) {
        stop();
        sessionOptions = options;
        pool = questions.shuffle(
            rules.buildPool(day, getSource()).filter((row) => row && row.word && row.meaning)
        );
        if (Number.isInteger(options?.count) && options.count >= 2)
            pool = pool.slice(0, options.count);
        if (pool.length < 2) {
            notify('선택한 범위에 단어가 부족합니다.');
            return;
        }
        elapsed = 0;
        spawnElapsed = 0;
        score = 0;
        earned = 0;
        lives = MAX_LIVES;
        nextLane = 0;
        nextWordIndex = 0;
        resolved = 0;
        modifier = ['steady', 'rush', 'swift'][Math.floor(Math.random() * 3)];
        pausedUntil = 0;
        pausedFrom = 0;
        pausedTotal = 0;
        itemUsed = false;
        startedAt = now();
        lastFrame = startedAt;
        active = true;
        view.open();
        updateHud();
        playMusic('battle');
        spawn();
        queueFrame();
    }
    return {
        start,
        exit,
        stop,
        rates,
        useItem,
        get active() {
            return active;
        },
    };
}
