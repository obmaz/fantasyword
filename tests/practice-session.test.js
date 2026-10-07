const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load-module');

const createSession = loadScripts(['scripts/game/practice-session.js']).evaluate(
    'createPracticeSession'
);
function session(db, getSource) {
    const events = [];
    const result = createSession({
        db,
        getSource,
        getWrongWords: () => [],
        view: new Proxy(
            {},
            {
                get:
                    (_, name) =>
                    (...args) =>
                        events.push([name, ...args]),
            }
        ),
        speech: { stop: () => events.push(['stop']), play: (word) => events.push(['speak', word]) },
        notify() {},
        resetResult() {},
        playMusic() {},
    });
    return { result, events };
}
function store() {
    return { settings: { wordRead: false }, getBookKey: () => 'book-1', save() {} };
}

test('연습 세션은 브라우저 전역 없이 생성되고 두 세션의 진행 상태를 격리한다', () => {
    const words = [
        { day: 1, word: 'apple', meaning: '사과' },
        { day: 1, word: 'banana', meaning: '바나나' },
    ];
    const a = session(store(), () => words);
    const b = session(store(), () => words);
    a.result.start(1);
    b.result.start(1);
    a.result.next();
    a.result.toggleAnswer();
    a.result.toggleMemorized();
    assert.equal(a.result.currentIndex, 1);
    assert.equal(b.result.currentIndex, 0);
    assert.equal(a.result.answerVisible, true);
    assert.equal(b.result.answerVisible, false);
    assert.equal(b.result.getMemorizedSet().size, 0);
});

test('연습 시작은 주입된 데이터 공급자를 다시 읽고 빈 필터에서는 발음을 중지한다', () => {
    let source = [{ day: 1, word: 'apple', meaning: '사과' }];
    const { result, events } = session(store(), () => source);
    result.start('all');
    source = [{ day: 2, word: 'banana', meaning: '바나나' }];
    result.start('all');
    assert.equal(result.words[0].word, 'banana');
    result.applyFilter('memorized');
    assert.equal(result.words.length, 0);
    assert.deepEqual(
        events.slice(-3).map(([name]) => name),
        ['stop', 'answer', 'empty']
    );
});
