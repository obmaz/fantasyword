const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load-module');
const rowCounts = loadScripts(['scripts/ui/gameplay-controls.js']).evaluate(
    'spellingTileRowCounts'
);

test('철자 타일 두 줄은 같거나 아랫줄에 하나 더 배분한다', () => {
    assert.deepEqual([...rowCounts(9, 9)], [9]);
    assert.deepEqual([...rowCounts(10, 9)], [5, 5]);
    assert.deepEqual([...rowCounts(11, 9)], [5, 6]);
    assert.deepEqual([...rowCounts(12, 9)], [6, 6]);
    assert.deepEqual([...rowCounts(17, 9)], [8, 9]);
    assert.deepEqual([...rowCounts(18, 9)], [9, 9]);
});

test('화면 너비와 긴 단어가 달라도 타일을 누락하지 않고 각 줄을 균등 배분한다', () => {
    for (let capacity = 1; capacity <= 20; capacity++) {
        for (let count = 1; count <= 80; count++) {
            const rows = [...rowCounts(count, capacity)];
            assert.equal(rows.length, Math.ceil(count / capacity));
            assert.equal(
                rows.reduce((sum, value) => sum + value, 0),
                count
            );
            assert.ok(rows.every((value) => value > 0 && value <= capacity));
            assert.ok(rows.every((value, index) => !index || value >= rows[index - 1]));
            assert.ok(rows.at(-1) - rows[0] <= 1);
        }
    }
    assert.deepEqual([...rowCounts(0, 9)], []);
});
