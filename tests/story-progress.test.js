const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load-module');

const { evaluate } = loadScripts(['scripts/domain/story-progress.js']);
const keys = { stage: 'stage', path: 'path', events: 'events', layout: 'layout' };
const complete = (input, regenerate) =>
    evaluate(
        `storyProgressRules.completion({...${JSON.stringify(input)}, regenerate: ${regenerate}})`
    );

test('스토리 완료 집합은 기존 기록을 보존하고 저장용 값만 새로 만든다', () => {
    const events = { '0:0': { day: 2 }, '0:1': { cleared: true } };
    const path = [1];
    const result = complete(
        { events, path, stage: 1, index: 0, rowCount: 4, keys, rows: [['battle']], mistakes: 1 },
        "() => [['next']]"
    );
    assert.equal(result.nextStage, 2);
    assert.equal(result.changes.stage, '2');
    assert.deepEqual(JSON.parse(result.changes.events), {
        '0:0': { day: 2 },
        '0:1': { cleared: true },
        '1:0': { cleared: true, mistakes: 1 },
    });
    assert.deepEqual(JSON.parse(result.changes.path), [1, 0]);
    assert.deepEqual(events, { '0:0': { day: 2 }, '0:1': { cleared: true } });
    assert.deepEqual(path, [1]);
});

test('마지막 스테이지 완료는 새 지도를 만들고 진행·경로·이벤트를 초기화한다', () => {
    const result = complete(
        { events: {}, path: [], stage: 2, index: 1, rowCount: 3, keys, rows: [['boss']] },
        "(rows) => [...rows, ['battle']]"
    );
    assert.equal(result.nextStage, 3);
    assert.deepEqual(JSON.parse(JSON.stringify(result.changes)), {
        stage: '0',
        path: '[]',
        events: '{}',
        layout: '[["boss"],["battle"]]',
    });
});
