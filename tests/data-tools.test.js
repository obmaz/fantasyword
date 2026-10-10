const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { readData, readWords, readGroups } = require('../tools/read-data');
const { loadScripts, ROOT } = require('./helpers/load-module');
const { browserRuntime } = require('./helpers/browser-runtime');

test('모든 단어장은 Day/단어/뜻이 유효하고 각 Day에 출제 가능한 문제가 있다', () => {
    const books = fs
        .readdirSync(path.join(ROOT, 'data'))
        .filter((name) => /^game-data-\d+\.js$/.test(name));
    for (const book of books) {
        const id = Number(book.match(/\d+/)[0]);
        const rows = readData(path.join(ROOT, `data/game-data-${id}.js`), `rawData_${id}`);
        const days = new Map();
        for (const row of rows) {
            assert.ok(Number.isInteger(row.day) && row.day > 0);
            assert.ok(typeof row.word === 'string' && row.word.trim(), `단어장 ${id}: 영단어 누락`);
            assert.ok(
                typeof row.meaning === 'string' && row.meaning.trim(),
                `단어장 ${id}: ${row.word} 뜻 누락`
            );
            days.set(row.day, (days.get(row.day) || 0) + 1);
        }
        assert.ok([...days.values()].every((count) => count >= 4));
    }
});

test('데이터 도구는 아포스트로피가 있는 단어를 원문 그대로 읽는다', () => {
    const words = readWords(path.join(ROOT, 'data/game-data-1.js'), 1);
    assert.ok(words.has("on one's own"));
    assert.ok(words.has("to one's surprise"));
    assert.ok(!words.has('on one'));
});

test('그룹 확장은 단어를 보존하고 제공 그룹을 4개 미만으로 줄이지 않는다', (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fantasy-decoy-test-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.mkdirSync(path.join(dir, 'tools'));
    fs.mkdirSync(path.join(dir, 'data'));
    for (const name of ['read-data.js', 'expand-small-groups.js']) {
        fs.copyFileSync(path.join(ROOT, 'tools', name), path.join(dir, 'tools', name));
    }
    const groups = [['cat', 'bat', 'hat', 'mat', 'sat'], ['rat']];
    fs.writeFileSync(
        path.join(dir, 'data/decoy-words-set.js'),
        `window.decoyWordsSet = ${JSON.stringify(groups)}`
    );
    fs.writeFileSync(
        path.join(dir, 'data/game-data-1.js'),
        `window.rawData_1 = ${JSON.stringify(groups.flat().map((word) => ({ word })))}`
    );
    execFileSync(process.execPath, [path.join(dir, 'tools/expand-small-groups.js')], {
        stdio: 'pipe',
    });
    const updated = readGroups(path.join(dir, 'data/decoy-words-set.js'));
    assert.ok(updated[0].length >= 4);
    assert.equal(updated.flat().length, groups.flat().length);
    assert.deepEqual([...updated.flat()].sort(), [...groups.flat()].sort());
});

test('4번 단어장은 Day 1·2에 40개씩 있고 모든 풀이에 공식 사전 출처가 있다', () => {
    const rows = readData(path.join(ROOT, 'data/game-data-4.js'), 'rawData_4');
    assert.equal(rows.length, 80);
    assert.deepEqual([...new Set(rows.map((row) => row.day))], [1, 2]);
    for (const day of [1, 2]) {
        const words = rows.filter((row) => row.day === day).map((row) => row.word);
        assert.equal(words.length, 40);
        assert.equal(new Set(words).size, 40);
    }
    for (const row of rows) {
        assert.ok(row.englishExplanation.trim(), row.word);
        assert.ok(row.koreanExplanation.trim(), row.word);
        const { english, korean, koreanHeadword } = row.explanationSources;
        assert.equal(new URL(english).hostname, 'www.oxfordlearnersdictionaries.com');
        assert.equal(new URL(korean).hostname, 'stdict.korean.go.kr');
        assert.ok(new URL(korean).searchParams.get('word_no'));
        assert.ok(koreanHeadword.trim());
    }
    const byWord = new Map(rows.map((row) => [row.word, row]));
    assert.equal(byWord.get('carry out').meaning, '~을 수행하다, ~을 이행하다');
    assert.equal(byWord.get('be supposed to').day, 2);
    assert.equal(byWord.get('come up with').day, 2);
    assert.equal(byWord.get('regularly').day, 1);
    assert.equal(byWord.get('dramatically').day, 2);
    assert.equal(byWord.get('value').explanationSources.koreanHeadword, '가치4');
    assert.equal(byWord.get('reputation').explanationSources.koreanHeadword, '평판3');
});

test('4번 단어장의 80개 항목은 각각 고유한 유사 오답 후보를 세 개 이상 갖는다', () => {
    const r = loadScripts([
        'data/game-data-4.js',
        'data/decoy-words-set.js',
        'scripts/data/words-loader.js',
    ]);
    for (const row of r.sandbox.rawData_4) {
        const candidates = [...r.sandbox.getDecoyWordCandidates(row.word)];
        assert.ok(candidates.length >= 3, row.word);
        assert.equal(new Set(candidates).size, candidates.length, row.word);
        assert.ok(!candidates.includes(row.word), row.word);
    }
    assert.ok(r.sandbox.getDecoyWordCandidates('value').includes('valve'));
    assert.ok(r.sandbox.getDecoyWordCandidates('reputation').includes('repetition'));
});

test('4번 단어장을 선택하면 해당 Day만 로드하고 Day 2의 문제와 학습 풀이를 사용한다', () => {
    const r = browserRuntime({ selectedGameDataSet: '4' });
    assert.equal(r.sandbox.currentGameDataSetId, '4');
    assert.equal(r.sandbox.currentGameDataName, '능률보카 고등 기본 (2025개정)');
    assert.equal(r.sandbox.gameDataLoader.getAvailableDataSets().length, 4);
    assert.equal(r.evaluate('rawData.length'), 80);
    assert.deepEqual(
        Array.from(r.evaluate('Object.keys(dayCatalog).filter((key) => /^\\d+$/.test(key))')),
        ['1', '2']
    );
    const game = r.evaluate('game');
    r.getElement('count-select').value = '10';
    game.init('battle', 2);
    r.advance(400);
    assert.equal(game.list.length, 10);
    assert.ok(game.list.every((word) => word.day === 2 && word.englishExplanation));
    game.stop();
    const practice = r.evaluate('practiceMemorization');
    practice.start('1');
    assert.equal(practice.words.length, 40);
    assert.ok(practice.words.every((word) => word.day === 1 && word.koreanExplanation));
});

test('오답 풀 동기화는 신규 단어장을 발견하고 해당 그룹을 보존한다', (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fantasy-decoy-sync-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.mkdirSync(path.join(dir, 'tools'));
    fs.mkdirSync(path.join(dir, 'data'));
    for (const name of ['read-data.js', 'sync-decoy-with-gamedata.js', 'check-decoy.js']) {
        fs.copyFileSync(path.join(ROOT, 'tools', name), path.join(dir, 'tools', name));
    }
    for (const [id, words] of [
        [1, ['cat']],
        [4, ['value', 'reputation']],
    ]) {
        fs.writeFileSync(
            path.join(dir, `data/game-data-${id}.js`),
            `window.rawData_${id} = ${JSON.stringify(words.map((word) => ({ word })))}`
        );
    }
    fs.writeFileSync(
        path.join(dir, 'data/decoy-words-set.js'),
        `window.decoyWordsSet = ${JSON.stringify([['cat', 'bat'], ['value', 'valve'], ['obsolete']])}`
    );
    execFileSync(process.execPath, [path.join(dir, 'tools/sync-decoy-with-gamedata.js')], {
        stdio: 'pipe',
    });
    const groups = readGroups(path.join(dir, 'data/decoy-words-set.js'));
    assert.deepEqual(Array.from(groups), [['cat', 'bat'], ['value', 'valve'], ['reputation']]);
    const output = execFileSync(process.execPath, [path.join(dir, 'tools/check-decoy.js'), '4'], {
        encoding: 'utf8',
    });
    assert.match(output, /미등록 단어 수: 0/);
});
