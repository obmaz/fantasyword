const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');
const { loadScripts } = require('./helpers/load-module');

const POOL = [
    { day: 1, word: 'apple', meaning: '사과', englishExplanation: 'a round fruit' },
    { day: 1, word: 'balloon', meaning: '풍선', englishExplanation: 'a bag filled with air' },
    { day: 1, word: 'banana', meaning: '바나나', englishExplanation: 'a long yellow fruit' },
    {
        day: 1,
        word: 'put on',
        meaning: '입다',
        englishExplanation: 'to dress yourself in something',
    },
];

test('철자 조립의 방해 글자는 답에 없는 글자이며 흔한 글자가 부족하면 다른 자음을 보충한다', () => {
    const r = loadScripts(['scripts/domain/monster-encounters.js']);
    const encounters = r.evaluate('monsterEncounters');
    for (const word of ['machine', 'turn a silver stone']) {
        const tiles = encounters.spellingTiles(word, (values) => [...values]);
        const letters = [...word].filter((letter) => /[a-z]/i.test(letter));
        const extras = tiles.slice(letters.length);
        assert.equal(extras.length, 3);
        assert.equal(new Set(extras).size, 3);
        assert.ok(extras.every((letter) => !word.includes(letter)));
        assert.deepEqual([...tiles.slice(0, letters.length)], letters);
    }
});

test('드래곤 설명에 정답이 있으면 빈칸으로 가리되 원본 단어와 설명을 보존한다', () => {
    const r = loadScripts(['data/battle-examples.js', 'scripts/domain/monster-encounters.js']);
    const encounters = r.evaluate('monsterEncounters');
    const word = {
        word: 'cotton',
        meaning: '면',
        englishExplanation: 'thread or cloth made from the fibres of the cotton plant',
    };
    const question = encounters.prepare(word, 'dragon');
    assert.equal(question.questionKind, 'riddle');
    assert.equal(
        question.encounterPrompt,
        'thread or cloth made from the fibres of the _____ plant'
    );
    assert.equal(question.word, 'cotton');
    assert.equal(word.englishExplanation.includes('cotton'), true);
});

test('실제 세 단어장의 모든 드래곤 설명 문제는 정답 단어를 그대로 노출하지 않는다', () => {
    const r = loadScripts([
        'data/game-data-1.js',
        'data/game-data-2.js',
        'data/game-data-3.js',
        'data/battle-examples.js',
        'scripts/domain/monster-encounters.js',
    ]);
    const encounters = r.evaluate('monsterEncounters');
    let checked = 0;
    for (let id = 1; id <= 3; id++) {
        for (const word of r.sandbox[`rawData_${id}`]) {
            const question = encounters.prepare(word, 'dragon');
            if (question.questionKind !== 'riddle') continue;
            const prompt =
                question.encounterPrompt || question.englishExplanation || question.meaning;
            assert.equal(
                encounters.cloze({ word: word.word, exampleSentence: prompt }),
                null,
                `${id}/${word.word}: ${prompt}`
            );
            checked++;
        }
    }
    assert.ok(checked > 2000);
});

function runtime() {
    const utterances = [];
    const clips = [];
    const r = browserRuntime(
        { v7_settings: '{"wordRead":false,"musicPlay":false}' },
        {
            SpeechSynthesisUtterance: class {
                constructor(text) {
                    this.text = text;
                }
            },
            speechSynthesis: {
                getVoices: () => [{ lang: 'en-US', localService: true }],
                cancel() {},
                speak: (utterance) => utterances.push(utterance),
            },
            Audio: class {
                constructor() {
                    clips.push(this);
                }
                play() {
                    return Promise.resolve();
                }
                pause() {
                    this.paused = true;
                }
                removeAttribute() {
                    this.src = '';
                }
                load() {}
            },
        }
    );
    r.sandbox.rawDataData = POOL.map((row) => ({ ...row }));
    const game = r.evaluate('game');
    game.shuffle = (values) => [...values];
    r.getElement('count-select').value = '4';
    game.init('battle', 1);
    r.advance(400);
    const encounters = r.evaluate('monsterEncounters');
    function start(monsterId, word = 'apple') {
        const question = POOL.find((row) => row.word === word);
        game.list = [
            encounters.prepare(question, monsterId),
            ...POOL.slice(1).map((row) => encounters.prepare(row, monsterId)),
        ];
        game.idx = 0;
        game.nextLevel();
    }
    function assemble(word) {
        for (const letter of word) {
            if (!/[a-z]/i.test(letter)) continue;
            const index = game.spellingTiles.findIndex(
                (candidate, i) => candidate === letter && !game.spellingChosen.includes(i)
            );
            assert(index >= 0, `missing ${letter}`);
            game.chooseSpellingLetter(index);
        }
    }
    return { ...r, game, encounters, utterances, clips, start, assemble };
}

test('몬스터별 전투는 같은 Day의 단어로 네 학습 방식을 배치하고 마지막은 드래곤이다', () => {
    const r = runtime();
    assert.equal(r.game.battleQuestionType, 'monsters');
    assert.deepEqual(
        r.game.list.map((q) => q.monsterId),
        ['slime', 'goblin', 'bat', 'dragon']
    );
    assert.equal(r.game.list.length, 4);
    assert.equal(r.game.list.at(-1).questionKind, 'cloze');
    assert.equal(JSON.stringify(r.sandbox.rawDataData), JSON.stringify(POOL));
    const selected = r.encounters.buildList(
        [...POOL, { day: 2, word: 'other', meaning: '다른' }].filter((q) => q.day === 1),
        99,
        (v) => [...v]
    );
    assert(selected.every((q) => q.day === 1));
    assert.equal(selected.length, 4);
});

test('슬라임은 영어 단어를 보여주고 한국어 뜻을 채점한다', () => {
    const r = runtime();
    assert.equal(r.getElement('q-text').innerText, 'apple');
    assert.equal(r.game.currentAns, '사과');
    r.game.answerOption(r.game.options.findIndex((q) => q.correct));
    assert.equal(r.game.sessionCorrectObjective, 1);
    assert.equal(r.evaluate('db.getBookStats().objective.correct'), 1);
});

test('고블린은 같은 글자 조각을 재사용하지 않으며 중복 철자·지우기·다시 조립을 지원한다', () => {
    const r = runtime();
    r.start('goblin', 'balloon');
    assert.notEqual(r.game.spellingTiles.join(''), 'balloon');
    assert.equal(r.game.spellingTiles.length, 10);
    r.game.chooseSpellingLetter(0);
    r.game.chooseSpellingLetter(0);
    assert.equal(r.game.spellingChosen.length, 1);
    r.game.checkBossAnswer();
    assert.equal(r.evaluate('db.getBookStats().solved'), 0);
    r.game.removeSpellingLetter();
    assert.equal(r.game.spellingChosen.length, 0);
    r.game.chooseSpellingLetter(0);
    r.game.clearSpelling();
    r.assemble('balloon');
    assert.equal(r.game.spellingChosen.length, 7);
    assert.equal(new Set(r.game.spellingChosen).size, 7);
    assert.equal(r.getElement('spelling-submit').disabled, false);
    r.game.chooseSpellingLetter(7);
    assert.equal(r.game.spellingChosen.length, 7);
    r.game.checkBossAnswer();
    assert.equal(r.game.subjectiveCorrect, 1);
    assert.equal(r.evaluate('db.getBookStats().subjective.correct'), 1);
});

test('고블린은 숙어의 띄어쓰기를 유지하고 틀린 배열에는 정답을 보여준다', () => {
    const r = runtime();
    r.start('goblin', 'put on');
    r.assemble('put on');
    assert.equal(
        r.encounters.spellingAnswer('put on', r.game.spellingTiles, r.game.spellingChosen),
        'put on'
    );
    r.game.checkBossAnswer();
    assert.equal(r.game.subjectiveCorrect, 1);
    const wrong = runtime();
    wrong.start('goblin', 'put on');
    wrong.game.spellingTiles.forEach((_, i) => wrong.game.chooseSpellingLetter(i));
    if (
        wrong.encounters.spellingAnswer(
            'put on',
            wrong.game.spellingTiles,
            wrong.game.spellingChosen
        ) === 'put on'
    ) {
        wrong.game.clearSpelling();
        wrong.game.spellingTiles.forEach((_, i) =>
            wrong.game.chooseSpellingLetter(wrong.game.spellingTiles.length - i - 1)
        );
    }
    wrong.game.checkBossAnswer();
    assert.equal(wrong.game.subjectiveCorrect, 0);
    assert.equal(wrong.getElement('spelling-answer').innerText, 'put on');
    assert.equal(wrong.game.sessionWrongWords[0].word, 'put on');
});

test('듣기 전에는 답·스킬·타이머를 막고 음성 종료 후 시작하며 다시 들어도 시간이 늘지 않는다', () => {
    const r = runtime();
    r.start('bat');
    assert.equal(r.game.currentAns, '사과');
    assert(r.game.options.every((option) => /[가-힣]/.test(option.label)));
    assert.equal(r.getElement('q-text').innerText, '들은 단어의 뜻은 무엇인가요?');
    r.evaluate('db.skills.hint=2; db.skills.ultimate=2');
    r.advance(15000);
    r.game.answerOption(r.game.options.findIndex((q) => q.correct));
    r.game.useHint();
    r.game.useUltimate();
    assert.equal(r.game.deadline, null);
    assert.equal(r.evaluate('db.getBookStats().solved'), 0);
    assert.equal(r.evaluate('db.skills.hint'), 2);
    assert.equal(r.getElement('q-text').innerText.includes('apple'), false);
    r.game.listen();
    assert.equal(r.utterances[0].text, 'apple');
    r.advance(1000);
    assert.equal(r.game.deadline, null);
    r.utterances[0].onend();
    const deadline = r.game.deadline;
    assert.equal(r.game.remainingTime(), 10);
    r.advance(3000);
    r.game.useHint();
    const disabled = r.game.options.filter((q) => q.disabled).length;
    r.game.listen();
    r.utterances[1].onend();
    assert.equal(r.game.deadline, deadline);
    assert.equal(r.game.remainingTime(), 7);
    assert.equal(r.game.options.filter((q) => q.disabled).length, disabled);
    r.game.answerOption(r.game.options.findIndex((q) => q.correct));
    assert.equal(r.game.sessionCorrectObjective, 1);
});

test('브라우저 음성 및 원격 발음 실패는 장비·골드·단어를 보존하고 뜻 문제로 바뀐다', () => {
    const r = runtime();
    r.start('bat');
    const gold = r.evaluate('db.gold');
    r.game.listen();
    r.utterances[0].onerror({ error: 'synthesis-failed' });
    assert.equal(r.clips.length, 1);
    r.clips[0].onerror();
    assert.equal(r.game.currentQ.monsterId, 'slime');
    assert.equal(r.game.currentQ.questionKind, 'meaning');
    assert.equal(r.game.currentQ.word, 'apple');
    assert.equal(r.evaluate('db.gold'), gold);
    assert.equal(r.game.currentAns, '사과');
    const deadline = r.game.deadline;
    r.utterances[0].onend();
    r.clips[0].onended();
    assert.equal(r.game.deadline, deadline);
    r.game.answerOption(r.game.options.findIndex((q) => q.correct));
    assert.equal(r.game.sessionCorrectObjective, 1);
});

test('음성 종료 이벤트가 없어도 12초 후 대체 문제를 제공하고 종료 후 콜백은 무시한다', () => {
    const r = runtime();
    r.start('bat');
    r.game.listen();
    r.advance(12000);
    assert.equal(r.game.currentQ.monsterId, 'slime');
    assert.equal(r.game.remainingTime(), 10);
    const stopped = runtime();
    stopped.start('bat');
    stopped.game.listen();
    stopped.game.stop();
    stopped.utterances[0].onend();
    stopped.utterances[0].onerror({ error: 'synthesis-failed' });
    stopped.advance(12000);
    assert.equal(stopped.game.deadline, null);
    assert.equal(stopped.clips.length, 0);
    assert.equal(stopped.evaluate('db.getBookStats().solved'), 0);
});

test('수동 듣기 대체 후에는 기존 버튼이 채점하지 않고 시작된 제한 시간을 초기화하지 않는다', () => {
    const r = runtime();
    r.start('bat');
    const old = r.getElement('options-box').children.at(-1);
    r.game.listen();
    r.utterances[0].onend();
    const deadline = r.game.deadline;
    r.advance(2000);
    r.game.fallbackListening();
    old.click();
    assert.equal(r.game.deadline, deadline);
    assert.equal(r.game.remainingTime(), 8);
    assert.equal(r.evaluate('db.getBookStats().solved'), 0);
});

test('보스 빈칸은 검토된 예문에서 단어 전체만 가리고 예문이 없는 단어는 설명 문제다', () => {
    const r = runtime();
    assert.equal(r.encounters.cloze({ word: 'at first' }), '_____, the puzzle seemed difficult.');
    assert.equal(r.encounters.cloze({ word: 'cat', exampleSentence: 'We saw a cathedral.' }), null);
    assert.equal(
        r.encounters.prepare(
            { word: 'a+b', meaning: '수식', exampleSentence: 'The a+b formula is useful.' },
            'dragon'
        ).encounterPrompt,
        'The _____ formula is useful.'
    );
    assert.equal(r.encounters.prepare(POOL[1], 'dragon').questionKind, 'riddle');
    r.start('dragon');
    assert.equal(r.game.currentQ.questionKind, 'cloze');
    assert.equal(r.game.deadline, null);
    assert.equal(r.getElement('q-text').innerText, 'I ate an _____ after lunch.');
    assert.equal(r.encounters.checkAnswer('pple', 'apple'), false);
    r.getElement('boss-input').value = '  APPLE  ';
    r.game.checkBossAnswer();
    assert.equal(r.game.subjectiveCorrect, 1);
});

test('등록한 모든 보스 예문은 정확한 목표 단어를 포함하고 빈칸으로 바꿀 수 있다', () => {
    const { evaluate } = loadScripts([
        'data/battle-examples.js',
        'scripts/domain/monster-encounters.js',
    ]);
    const examples = evaluate('battleExamples');
    const encounters = evaluate('monsterEncounters');
    for (const [word, sentence] of Object.entries(examples)) {
        const prompt = encounters.cloze({ word });
        assert(prompt?.includes('_____'), `${word}: ${sentence}`);
        assert.notEqual(prompt, sentence);
    }
});

test('몬스터별 전체 전투는 실제 채점 방식과 유형별 결과 및 기존 누적 통계를 일치시킨다', () => {
    const r = runtime();
    for (let i = 0; i < 4; i++) {
        const kind = r.game.currentQ.questionKind;
        if (kind === 'spelling') {
            r.assemble(r.game.currentQ.word);
            r.game.checkBossAnswer();
        } else if (['cloze', 'riddle'].includes(kind)) {
            r.getElement('boss-input').value = r.game.currentQ.word;
            r.game.checkBossAnswer();
        } else {
            if (kind === 'listening') {
                r.game.listen();
                r.utterances.at(-1).onend();
            }
            r.game.answerOption(r.game.options.findIndex((q) => q.correct));
        }
        if (i < 3) r.advance(800);
    }
    const rows = r.evaluate('battleRules').resultRows(r.game, true);
    assert.deepEqual(
        Array.from(rows, (row) => [row.label, row.correct, row.total]),
        [
            ['뜻 고르기', 1, 1],
            ['철자 조립', 1, 1],
            ['발음 듣기', 1, 1],
            ['보스 문제', 1, 1],
            ['전체', 4, 4],
        ]
    );
    assert.equal(r.evaluate('db.getBookStats().objective.correct'), 2);
    assert.equal(r.evaluate('db.getBookStats().subjective.correct'), 2);
});

test('전체 단어 도전은 드래곤 문제로 출제하고 마지막 오답도 결과와 복습에 포함한다', () => {
    const r = runtime();
    r.game.stop();
    r.game.init('boss', 'boss');
    r.advance(400);
    assert.equal(r.game.currentQ.monsterId, 'dragon');
    r.getElement('boss-input').value = 'wrong';
    r.game.checkBossAnswer();
    const rows = r.evaluate('battleRules').resultRows(r.game, false);
    assert.equal(rows[0].total, 1);
    assert.equal(rows[0].correct, 0);
    assert.equal(r.game.sessionWrongWords.length, 1);
});
