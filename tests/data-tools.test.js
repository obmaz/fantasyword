const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { readData, readWords, readGroups } = require('../tools/read-data');
const { ROOT } = require('./helpers/load-module');

test('모든 단어장은 Day/단어/뜻이 유효하고 각 Day에 출제 가능한 문제가 있다', () => {
    for (let id = 1; id <= 3; id++) {
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
