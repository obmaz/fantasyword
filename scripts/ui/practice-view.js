/**
 * 연습 카드의 DOM만 소유한다. 데이터 조회와 진행 규칙은 세션이 담당한다.
 * @param {import('../../types/practice').PracticeViewDependencies} dependencies
 * @returns {import('../../types/practice').PracticeView}
 */
function createPracticeView({ document, openScreen, closeScreen, syncLayout, track, schedule }) {
    /** @param {string} id */
    const element = (id) => document.getElementById(id);
    /** @param {string} id @param {boolean} value */
    const disabled = (id, value) => {
        const button = /** @type {HTMLButtonElement | null} */ (element(id));
        if (button) button.disabled = value;
    };
    /** @param {string} id @param {string} value */
    const text = (id, value) => {
        const target = element(id);
        if (target) target.textContent = value;
    };
    /** @type {import('../../types/practice').PracticeView} */
    const view = {
        filter(value) {
            document.querySelectorAll('#practice-filter-chips .practice-chip').forEach((chip) => {
                const selected = chip.getAttribute('data-filter') === value;
                chip.classList.toggle('practice-chip-active', selected);
                chip.setAttribute('aria-pressed', String(selected));
            });
        },
        answer(hasWord) {
            for (const id of ['practice-meaning-text', 'practice-explanation-section']) {
                const target = element(id);
                if (target) target.hidden = !hasWord;
            }
        },
        memorized(known) {
            const button = /** @type {HTMLButtonElement | null} */ (
                element('practice-memorized-btn')
            );
            if (!button) return;
            button.disabled = false;
            button.classList.toggle('practice-memorized-active', known);
            button.setAttribute('aria-pressed', String(known));
            button.textContent = known ? '외움 취소' : '외웠어요';
        },
        explanation(word, korean) {
            text(
                'practice-explanation-text',
                (korean ? word.koreanExplanation : word.englishExplanation) || 'N/A'
            );
        },
        word(word, index, count, korean) {
            text('practice-word-counter', `${index + 1} / ${count}`);
            text('practice-word-text', word.word || 'N/A');
            text('practice-meaning-text', word.meaning || 'N/A');
            view.explanation(word, korean);
            disabled('practice-prev-btn', index === 0);
            disabled('practice-next-btn', index === count - 1);
            disabled('practice-speak-btn', false);
        },
        empty() {
            text('practice-word-counter', '0 / 0');
            for (const id of [
                'practice-word-text',
                'practice-meaning-text',
                'practice-explanation-text',
            ])
                text(id, '없음');
            for (const id of [
                'practice-prev-btn',
                'practice-next-btn',
                'practice-memorized-btn',
                'practice-speak-btn',
            ]) {
                disabled(id, true);
            }
            const button = element('practice-memorized-btn');
            if (button) {
                button.classList.remove('practice-memorized-active');
                button.setAttribute('aria-pressed', 'false');
                button.textContent = '외웠어요';
            }
        },
        open(label) {
            openScreen('practice-mode-game', false);
            syncLayout();
            text('practice-memorization-day-info', label);
        },
        exit() {
            track('title-screen');
            const music = /** @type {HTMLAudioElement | null} */ (element('background-music'));
            if (music && !music.paused) {
                music.pause();
                music.currentTime = 0;
            }
            const musicInfo = element('practice-music-info-overlay');
            if (musicInfo) musicInfo.style.display = 'none';
            closeScreen('practice-mode-game', true);
            closeScreen('practice-mode-modal', true);
            openScreen('title-screen', false);
            schedule(syncLayout, 100);
        },
    };
    return view;
}
