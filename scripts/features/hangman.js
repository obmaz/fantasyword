/** 총공세 옆 시험용 행맨. 오답마다 단두대와 졸라맨이 단계적으로 그려진다. */
const HANGMAN_MAX_LIVES = 7;
const HANGMAN_DRAWING = `<svg viewBox="0 0 180 150" role="img" aria-label="오답 단계별 단두대 그림">
    <path class="hangman-part part-gallows" d="M20 140H160M45 140V15H125M45 15H125M125 15V35" />
    <circle class="hangman-part part-head" cx="125" cy="50" r="15" />
    <path class="hangman-part part-body" d="M125 65V100" />
    <path class="hangman-part part-arm-left" d="M125 75L103 88" />
    <path class="hangman-part part-arm-right" d="M125 75L147 88" />
    <path class="hangman-part part-leg-left" d="M125 100L105 125" />
    <path class="hangman-part part-leg-right" d="M125 100L145 125" />
</svg>`;
const hangman = {
    active: false,
    word: '',
    meaning: '',
    guessed: new Set(),
    roundVersion: 0,
    lives: HANGMAN_MAX_LIVES,
    init() {
        document
            .getElementById('hangman-header-host')
            .replaceChildren(
                createGameplayHeader({ mode: 'hangman', title: '행맨', onExit: () => this.exit() })
            );
    },
    start() {
        const source = window.rawDataData || rawData || [];
        const pool = source.filter((item) => item?.word && /^[a-z ]+$/i.test(item.word));
        const item = pool[Math.floor(Math.random() * pool.length)];
        if (!item) return;
        if (!this.active) {
            cancelPendingGameStart();
            playMusic('hangman');
        }
        this.active = true;
        this.roundVersion += 1;
        this.word = item.word.toLowerCase();
        this.meaning = item.meaning;
        this.guessed = new Set();
        this.lives = HANGMAN_MAX_LIVES;
        document.getElementById('title-screen').style.display = 'none';
        document.getElementById('hangman-game').style.display = 'flex';
        this.render();
    },
    exit() {
        this.active = false;
        this.roundVersion += 1;
        document.getElementById('background-music')?.pause();
        document.getElementById('hangman-game').style.display = 'none';
        document.getElementById('title-screen').style.display = 'flex';
    },
    choose(letter) {
        const won = [...this.word].every((key) => key === ' ' || this.guessed.has(key));
        if (
            !this.active ||
            !/^[a-z]$/.test(letter) ||
            this.guessed.has(letter) ||
            this.lives <= 0 ||
            won
        )
            return;
        this.guessed.add(letter);
        if (!this.word.includes(letter)) this.lives -= 1;
        this.render();
    },
    next() {
        if (this.active) this.start();
    },
    render() {
        const word = document.getElementById('hangman-word');
        word.textContent = [...this.word]
            .map((letter) => (letter === ' ' ? ' ' : this.guessed.has(letter) ? letter : '_'))
            .join(' ');
        const mistakes = HANGMAN_MAX_LIVES - this.lives;
        const won = [...this.word].every((letter) => letter === ' ' || this.guessed.has(letter));
        document.getElementById('hangman-game').dataset.finished = String(won || this.lives === 0);
        const meaning = document.getElementById('hangman-meaning');
        const showMeaning = won || this.lives <= 1;
        meaning.textContent = showMeaning ? `뜻: ${this.meaning}` : '';
        meaning.hidden = !showMeaning;
        document.getElementById('hangman-lives').textContent = this.lives;
        const drawing = document.getElementById('hangman-drawing');
        drawing.dataset.mistakes = String(mistakes);
        drawing.innerHTML = HANGMAN_DRAWING;
        const letters = document.getElementById('hangman-letters');
        const version = this.roundVersion;
        const buttons = renderEnglishKeyboard(letters, {
            withDelete: false,
            onKey: (key) => {
                if (version === this.roundVersion) this.choose(key.toLowerCase());
            },
        });
        buttons.forEach((button) => {
            const letter = button.textContent.toLowerCase();
            button.disabled = this.guessed.has(letter) || this.lives <= 0 || won;
            button.dataset.guess = this.guessed.has(letter)
                ? this.word.includes(letter)
                    ? 'correct'
                    : 'wrong'
                : '';
        });
        const status = document.getElementById('hangman-status');
        status.textContent = won
            ? '정답입니다!'
            : this.lives
              ? '알파벳을 골라 단어를 완성하세요.'
              : `정답: ${this.word}`;
        document.getElementById('hangman-next-btn').hidden = !(won || this.lives === 0);
    },
};
