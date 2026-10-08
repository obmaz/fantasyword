/** 탑뷰 단어 낙하전. 화면과 타이머를 이 세션 안에서 정리한다. */
function createSkyfallSession({
    document: dom,
    db,
    getSource,
    questions,
    rules,
    openScreen,
    closeScreen,
    playMusic,
    syncLayout,
    requestFrame,
    cancelFrame,
    later,
    notify,
}) {
    const byId = (id) => dom.getElementById(id);
    const LIMIT = 60;
    const TARGET = 12;
    const REWARD = 6;
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
    let spawnElapsed = 0;
    let lastFrame = 0;
    let frame = 0;
    let nextLane = 0;

    const rates = (seconds) => ({
        interval: Math.max(0.8, 2.4 - seconds * 0.032),
        speed: Math.min(0.28, 0.105 + seconds * 0.0028),
    });
    const setText = (id, value) => {
        const element = byId(id);
        if (element) element.textContent = String(value);
    };
    function updateHud() {
        setText('skyfall-time', Math.max(0, Math.ceil(LIMIT - elapsed)));
        setText('skyfall-score', score + ' / ' + TARGET);
        setText('skyfall-lives', '♥'.repeat(lives) + '♡'.repeat(MAX_LIVES - lives));
        setText('skyfall-gold', earned);
    }
    function clearChoice() {
        selected = null;
        byId('skyfall-prompt').textContent = '내려오는 단어를 누르세요';
        byId('skyfall-choices').replaceChildren();
        items.forEach((item) => item.element.classList.remove('selected'));
    }
    function removeItem(item) {
        items = items.filter((entry) => entry !== item);
        item.element.remove();
        if (selected === item) clearChoice();
    }
    function hit(item, correct) {
        if (!active || !items.includes(item)) return;
        if (correct) {
            score += 1;
            earned += REWARD;
            db.addGold(REWARD);
            const projectile = dom.createElement('span');
            projectile.className = 'skyfall-projectile';
            projectile.style.setProperty('--dest-left', item.element.style.left);
            projectile.style.setProperty('--dest-top', item.element.style.top);
            byId('skyfall-field').append(projectile);
            later(() => projectile.remove(), 360);
            const effect = dom.createElement('span');
            effect.className = 'skyfall-hit';
            effect.style.left = item.element.style.left;
            effect.style.top = item.element.style.top;
            effect.textContent = '✦';
            byId('skyfall-field').append(effect);
            later(() => effect.remove(), 620);
        } else {
            lives -= 1;
            byId('skyfall-field').classList.remove('skyfall-damaged');
            void byId('skyfall-field').offsetWidth;
            byId('skyfall-field').classList.add('skyfall-damaged');
        }
        removeItem(item);
        updateHud();
        if (score >= TARGET || lives <= 0) finish(score >= TARGET);
    }
    function choose(item, answer) {
        hit(item, answer === item.answer);
    }
    function select(item) {
        if (!active || !items.includes(item)) return;
        selected = item;
        items.forEach((entry) => entry.element.classList.toggle('selected', entry === item));
        setText(
            'skyfall-prompt',
            item.prompt + '의 ' + (item.answerKey === 'meaning' ? '뜻은?' : '영어 단어는?')
        );
        const choices = byId('skyfall-choices');
        choices.replaceChildren();
        item.options.forEach((option) => {
            const button = dom.createElement('button');
            button.type = 'button';
            button.className = 'skyfall-choice';
            button.textContent = option;
            button.addEventListener('click', () => choose(item, option));
            choices.append(button);
        });
    }
    function spawn() {
        if (items.length >= 5 || !pool.length) return;
        const row = pool[Math.floor(Math.random() * pool.length)];
        const english = Math.random() < 0.5;
        const answerKey = english ? 'meaning' : 'word';
        const prompt = String(english ? row.word : row.meaning).trim();
        const answer = String(row[answerKey]).trim();
        const distractors = questions.getDistractors(answer, answerKey, row, pool);
        const options = questions.shuffle([answer, ...distractors]);
        if (options.length < 2) return;
        const lane = nextLane++ % 3;
        const x = [16, 50, 84][lane];
        const element = dom.createElement('button');
        element.type = 'button';
        element.className = 'skyfall-word';
        element.textContent = prompt;
        element.style.left = x + '%';
        element.style.top = '7%';
        const item = { id: ++serial, prompt, answer, answerKey, options, element, y: 0.07 };
        element.addEventListener('click', () => select(item));
        items.push(item);
        byId('skyfall-field').append(element);
    }
    function tick(timestamp) {
        if (!active) return;
        if (!lastFrame) lastFrame = timestamp;
        const delta = Math.min(0.1, Math.max(0, (timestamp - lastFrame) / 1000));
        lastFrame = timestamp;
        elapsed += delta;
        spawnElapsed += delta;
        const rate = rates(elapsed);
        if (spawnElapsed >= rate.interval) {
            spawnElapsed = 0;
            spawn();
        }
        for (const item of [...items]) {
            item.y += delta * rate.speed;
            item.element.style.top = Math.min(84, item.y * 100) + '%';
            if (item.y >= 0.84) hit(item, false);
            if (!active) return;
        }
        updateHud();
        if (elapsed >= LIMIT) {
            finish(score >= TARGET);
            return;
        }
        frame = requestFrame(tick);
    }
    function stop() {
        active = false;
        cancelFrame(frame);
        frame = 0;
        lastFrame = 0;
        items.forEach((item) => item.element.remove());
        items = [];
        clearChoice();
    }
    function pauseMusic() {
        const music = byId('background-music');
        if (music && !music.paused) {
            music.pause();
            music.currentTime = 0;
        }
    }
    function exit() {
        stop();
        pauseMusic();
        closeScreen('skyfall-mode-game', false);
        closeScreen('skyfall-result-modal', false);
        openScreen('title-screen', false);
        syncLayout();
    }
    function finish(won) {
        if (!active) return;
        stop();
        pauseMusic();
        setText('skyfall-result-title', won ? '공터를 지켰어요!' : '낙하전 종료');
        setText('skyfall-result-score', score + ' / ' + TARGET);
        setText('skyfall-result-gold', '+' + earned + ' G');
        setText(
            'skyfall-result-detail',
            won ? '내려오는 단어를 모두 막았습니다.' : '다시 도전해서 기록을 높여 보세요.'
        );
        openScreen('skyfall-result-modal', false);
    }
    function start(day) {
        stop();
        pool = rules.buildPool(day, getSource()).filter((row) => row && row.word && row.meaning);
        if (pool.length < 2) {
            notify('선택한 범위에 단어가 부족합니다.');
            return;
        }
        closeScreen('skyfall-mode-modal', false);
        elapsed = 0;
        spawnElapsed = 0;
        score = 0;
        earned = 0;
        lives = MAX_LIVES;
        nextLane = 0;
        active = true;
        byId('skyfall-field').classList.remove('skyfall-damaged');
        updateHud();
        openScreen('skyfall-mode-game', false);
        syncLayout();
        playMusic('battle');
        spawn();
        frame = requestFrame(tick);
    }
    return {
        start,
        exit,
        stop,
        rates,
        get active() {
            return active;
        },
    };
}
