/** 낙하전 DOM과 짧은 공격 효과의 수명만 소유한다. */
function createSkyfallView({ document, openScreen, closeScreen, syncLayout, timers }) {
    const { setTimeout: schedule, clearTimeout: cancel } = timers;
    const byId = (id) => document.getElementById(id);
    const words = new Map();
    const effects = new Set();
    const pending = new Set();
    const setText = (id, value) => {
        const element = byId(id);
        if (element) element.textContent = String(value);
    };
    function effect(className, word, duration) {
        const element = document.createElement('span');
        element.className = className;
        element.style.setProperty('--dest-left', word.style.left);
        element.style.setProperty('--dest-top', word.style.top);
        if (className === 'skyfall-hit') {
            element.style.left = word.style.left;
            element.style.top = word.style.top;
            element.textContent = '✦';
        }
        byId('skyfall-field').append(element);
        effects.add(element);
        const id = schedule(() => {
            pending.delete(id);
            effects.delete(element);
            element.remove();
        }, duration);
        pending.add(id);
    }
    const view = {
        hud({ remaining, score, target, lives, maxLives, earned }) {
            setText('skyfall-time', remaining);
            setText('skyfall-score', score + ' / ' + target);
            setText('skyfall-lives', '♥'.repeat(lives) + '♡'.repeat(maxLives - lives));
            setText('skyfall-gold', earned);
        },
        clearChoice() {
            setText('skyfall-prompt', '내려오는 단어를 누르세요');
            byId('skyfall-choices').replaceChildren();
            words.forEach((word) => word.classList.remove('selected'));
        },
        removeWord(id) {
            words.get(id)?.remove();
            words.delete(id);
        },
        addWord(item, select) {
            const element = document.createElement('button');
            element.type = 'button';
            element.className = 'skyfall-word';
            element.textContent = item.prompt;
            element.style.left = item.x + '%';
            element.style.top = item.y * 100 + '%';
            element.addEventListener('click', select);
            words.set(item.id, element);
            byId('skyfall-field').append(element);
        },
        moveWord(id, y) {
            const word = words.get(id);
            if (word) word.style.top = y * 100 + '%';
        },
        choice(item, choose) {
            words.forEach((word, id) => word.classList.toggle('selected', id === item.id));
            setText(
                'skyfall-prompt',
                item.prompt + '의 ' + (item.answerKey === 'meaning' ? '뜻은?' : '영어 단어는?')
            );
            const choices = byId('skyfall-choices');
            choices.replaceChildren();
            item.options.forEach((option) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'skyfall-choice';
                button.textContent = option;
                button.addEventListener('click', () => choose(option));
                choices.append(button);
            });
        },
        attack(id) {
            const word = words.get(id);
            if (!word) return;
            effect('skyfall-projectile', word, 360);
            effect('skyfall-hit', word, 620);
        },
        damage() {
            const field = byId('skyfall-field');
            field.classList.remove('skyfall-damaged');
            void field.offsetWidth;
            field.classList.add('skyfall-damaged');
        },
        stop() {
            pending.forEach(cancel);
            pending.clear();
            effects.forEach((element) => element.remove());
            effects.clear();
            words.forEach((word) => word.remove());
            words.clear();
            byId('skyfall-field').classList.remove('skyfall-damaged');
            view.clearChoice();
        },
        open() {
            closeScreen('skyfall-mode-modal', false);
            closeScreen('skyfall-result-modal', false);
            openScreen('skyfall-mode-game', false);
            syncLayout();
        },
        exit() {
            closeScreen('skyfall-mode-game', false);
            closeScreen('skyfall-result-modal', false);
            openScreen('title-screen', false);
            syncLayout();
        },
        result({ won, score, target, earned }) {
            setText('skyfall-result-title', won ? '공터를 지켰어요!' : '낙하전 종료');
            setText('skyfall-result-score', score + ' / ' + target);
            setText('skyfall-result-gold', '+' + earned + ' G');
            setText(
                'skyfall-result-detail',
                won ? '내려오는 단어를 모두 막았습니다.' : '다시 도전해서 기록을 높여 보세요.'
            );
            openScreen('skyfall-result-modal', false);
        },
    };
    return view;
}
