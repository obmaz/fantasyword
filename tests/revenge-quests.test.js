const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');
const { loadScripts } = require('./helpers/load-module');
const rules = loadScripts(['scripts/domain/revenge-rules.js']).evaluate('revengeRules');
const word = { day: 1, word: 'apple', meaning: '사과', monsterId: 'goblin' };

test('복수 성공과 24시간 뒤 회상 성공의 보상은 재실패·재로딩 뒤에도 한 번씩만 지급한다', () => {
    let entry = rules.failed(null, word);
    let result = rules.succeeded(entry, 1000);
    assert.equal(result.bonus, 4);
    entry = result.entry;
    assert.equal(rules.ready(entry, entry.dueAt - 1), false);
    assert.equal(rules.succeeded(entry, entry.dueAt - 1).bonus, 0);
    assert.equal(rules.ready(entry, entry.dueAt), true);
    result = rules.succeeded(entry, entry.dueAt);
    assert.equal(result.bonus, 8);
    assert.equal(result.entry.phase, 'complete');
    assert.equal(rules.succeeded(result.entry, 999999999).bonus, 0);
    entry = rules.failed(result.entry, word);
    const normalized = rules.normalize(
        JSON.parse(JSON.stringify({ 'book-1': { [rules.key(word)]: entry } }))
    );
    result = rules.succeeded(normalized['book-1'][rules.key(word)], 2000);
    assert.equal(result.bonus, 0);
    assert.equal(rules.succeeded(result.entry, result.entry.dueAt).bonus, 0);
});

test('저장 손상·단어장 변경·삭제된 단어·중복 데이터는 잘못된 퀘스트를 만들지 않는다', () => {
    const saved = rules.normalize({
        'book-1': {
            a: { word: 'apple', meaning: '사과', monsterId: 'bad', phase: 'bad', dueAt: -1 },
            b: null,
            c: { word: 5 },
        },
        'book-2': { a: rules.failed(null, word) },
        invalid: { a: word },
    });
    assert.equal(Object.keys(saved['book-1']).length, 1);
    const entry = saved['book-1'][rules.key(word)];
    assert.equal(entry.monsterId, 'slime');
    assert.equal(entry.phase, 'revenge');
    assert.equal(entry.dueAt, 0);
    assert.equal(rules.entries(saved['book-1'], [word, word]).length, 1);
    assert.equal(rules.entries(saved['book-1'], [{ word: 'banana', meaning: '바나나' }]).length, 0);
    assert.notEqual(saved['book-1'], saved['book-2']);
});

test('실제 오답은 새로고침 후에도 저장되며 단어장별로 분리되고 일반 정답은 보상을 지급하지 않는다', () => {
    const r = browserRuntime({ v7_settings: '{"musicPlay":false,"wordRead":false}' });
    r.sandbox.rawDataData = [word];
    const quests = r.evaluate('revengeQuests');
    quests.fail(word);
    assert.equal(quests.ready()[0].monsterId, 'goblin');
    const gold = r.evaluate('db.gold');
    const saved = Object.fromEntries(r.store);
    const reloaded = browserRuntime(saved);
    reloaded.sandbox.rawDataData = [word];
    assert.equal(reloaded.evaluate('revengeQuests.ready().length'), 1);
    r.sandbox.currentGameDataSetId = '2';
    assert.equal(quests.ready().length, 0);
    quests.fail({ ...word, monsterId: 'slime' });
    r.sandbox.currentGameDataSetId = '1';
    assert.equal(quests.ready()[0].monsterId, 'goblin');
    assert.equal(r.evaluate('db.gold'), gold);
});

test('틀린 단어 하나도 복수 전투로 실행하고 원래 몬스터·실제 채점·추가 보상을 유지한다', () => {
    const r = browserRuntime({ v7_settings: '{"musicPlay":false,"wordRead":false}' });
    r.sandbox.rawDataData = [{ day: 1, word: 'apple', meaning: '사과' }];
    const game = r.evaluate('game');
    const quests = r.evaluate('revengeQuests');
    quests.fail(word);
    game.init('revenge', 'all');
    r.advance(400);
    assert.equal(game.list.length, 1);
    assert.equal(game.currentQ.monsterId, 'goblin');
    for (const letter of word.word) {
        const i = game.spellingTiles.findIndex(
            (v, i) => v === letter && !game.spellingChosen.includes(i)
        );
        game.chooseSpellingLetter(i);
    }
    game.checkBossAnswer();
    game.checkBossAnswer();
    assert.equal(r.evaluate('db.gold'), 116);
    assert.equal(r.evaluate('db.getBookStats().solved'), 1);
    assert.equal(quests.ready().length, 0);
    const persisted = JSON.parse(r.store.get('v7_revenge_quests'));
    assert.equal(persisted['book-1'][rules.key(word)].phase, 'recall');
    r.advance(1000);
    assert.equal(game.active, false);
});

test('회상 오답은 같은 몬스터의 복수로 돌아가며 이미 받은 복수 보상은 다시 지급하지 않는다', () => {
    const entry = rules.succeeded(rules.failed(null, word), 1000).entry;
    const failed = rules.failed(entry, { ...word, monsterId: 'dragon' });
    assert.equal(failed.phase, 'revenge');
    assert.equal(failed.failures, 2);
    assert.equal(failed.monsterId, 'dragon');
    assert.equal(rules.succeeded(failed, 5000).bonus, 0);
});
