const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');

function setup() {
    const r = browserRuntime();
    r.sandbox.onload();
    r.evaluate(
        "hangman.start(); hangman.word = 'cat'; hangman.meaning = '고양이'; hangman.render()"
    );
    return r;
}

test('행맨은 26글자를 제공하고 마지막 기회와 패배 후에 뜻을 공개한다', () => {
    const r = setup();
    const keys = r.getElement('hangman-letters').children.flatMap((row) => row.children);
    assert.equal(keys.length, 26);
    assert.ok(keys.every((key) => key.className === 'english-key'));
    assert.equal(r.getElement('hangman-meaning').hidden, true);
    r.evaluate("hangman.choose('b'); hangman.choose('b')");
    assert.equal(r.evaluate('hangman.lives'), 6);
    for (const letter of ['d', 'e', 'f', 'g']) r.evaluate(`hangman.choose('${letter}')`);
    assert.equal(r.getElement('hangman-meaning').hidden, true);
    r.evaluate("hangman.choose('h')");
    assert.equal(r.getElement('hangman-lives').textContent, 1);
    assert.equal(r.getElement('hangman-meaning').hidden, false);
    assert.equal(r.getElement('hangman-meaning').textContent, '뜻: 고양이');
    r.evaluate("hangman.choose('i'); hangman.choose('j')");
    assert.equal(r.evaluate('hangman.lives'), 0);
    assert.equal(r.getElement('hangman-drawing').dataset.mistakes, '7');
    assert.equal(r.getElement('hangman-status').textContent, '정답: cat');
    assert.equal(r.getElement('hangman-game').dataset.finished, 'true');
    assert.equal(r.getElement('hangman-meaning').hidden, false);
    assert.equal(r.getElement('hangman-meaning').textContent, '뜻: 고양이');
});

test('행맨 정답 뒤 추가 오답과 새 단어·나가기 뒤의 이전 키 클릭을 무시한다', () => {
    const r = setup();
    r.evaluate("['c', 'a', 't', 'z'].forEach((letter) => hangman.choose(letter))");
    assert.equal(r.evaluate('hangman.lives'), 7);
    assert.equal(r.getElement('hangman-status').textContent, '정답입니다!');
    assert.equal(r.getElement('hangman-game').dataset.finished, 'true');
    assert.equal(r.getElement('hangman-meaning').hidden, false);
    assert.equal(r.getElement('hangman-meaning').textContent, '뜻: 고양이');
    r.evaluate('hangman.next()');
    assert.equal(r.getElement('hangman-game').dataset.finished, 'false');
    assert.equal(r.getElement('hangman-meaning').hidden, true);
    assert.equal(r.getElement('hangman-meaning').textContent, '');
    const old = r.getElement('hangman-letters').children[0].children[0];
    r.evaluate('hangman.next()');
    old.click();
    assert.equal(r.evaluate('hangman.guessed.size'), 0);
    const exited = r.getElement('hangman-letters').children[0].children[0];
    r.evaluate('hangman.exit()');
    exited.click();
    assert.equal(r.evaluate('hangman.guessed.size'), 0);
});
