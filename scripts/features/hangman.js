/** 총공세 옆 시험용 행맨. 외부 상태를 바꾸지 않는 단어 연습 모드다. */
const hangman = {
    active: false,
    word: '',
    meaning: '',
    guessed: new Set(),
    lives: 6,
    start() {
        const source = window.rawDataData || rawData || [];
        const pool = source.filter((item) => item?.word && /^[a-z ]+$/i.test(item.word));
        const item = pool[Math.floor(Math.random() * pool.length)];
        if (!item) return;
        this.active = true;
        this.word = item.word.toLowerCase();
        this.meaning = item.meaning;
        this.guessed = new Set();
        this.lives = 6;
        document.getElementById('title-screen').style.display = 'none';
        document.getElementById('hangman-game').style.display = 'flex';
        this.render();
    },
    exit() {
        this.active = false;
        document.getElementById('hangman-game').style.display = 'none';
        document.getElementById('title-screen').style.display = 'flex';
    },
    choose(letter) {
        if (!this.active || this.guessed.has(letter) || this.lives <= 0) return;
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
        document.getElementById('hangman-meaning').textContent = this.meaning;
        document.getElementById('hangman-lives').textContent = this.lives;
        document.getElementById('hangman-drawing').textContent = '☠'.repeat(6 - this.lives);
        const letters = document.getElementById('hangman-letters');
        letters.replaceChildren();
        for (let code = 97; code <= 122; code += 1) {
            const letter = String.fromCharCode(code);
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = letter;
            button.disabled = this.guessed.has(letter) || this.lives <= 0;
            button.addEventListener('click', () => this.choose(letter));
            letters.append(button);
        }
        const won = [...this.word].every((letter) => letter === ' ' || this.guessed.has(letter));
        const status = document.getElementById('hangman-status');
        status.textContent = won
            ? '정답입니다!'
            : this.lives
              ? '알파벳을 골라 단어를 완성하세요.'
              : `정답: ${this.word}`;
        document.getElementById('hangman-next-btn').hidden = !(won || this.lives === 0);
    },
};
