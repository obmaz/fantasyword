const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');

test('완전 초기화는 취소 시 보존하고 확정 시 모든 게임 진행만 지운 뒤 기본 상태로 다시 시작한다', async () => {
    const r = browserRuntime({
        v7_gold: '321',
        v7_owned: '["basic","fire"]',
        v7_stats: '{"books":{"book-1":{"solved":3}}}',
        v7_practice_memorized: '{"book-1":["apple|사과"]}',
        v7_revenge_quests: '{"book-1":{}}',
        'v7_story_stage_book-1': '3',
        'v7_story_path_book-2': '[1,0]',
        selectedGameDataSet: '2',
        unrelatedPreference: 'keep',
    });
    let reloads = 0;
    r.sandbox.location.reload = () => reloads++;
    r.sandbox.showConfirm = async () => false;
    await r.evaluate('settingsManager.resetGame()');
    assert.equal(r.store.get('v7_gold'), '321');
    assert.equal(reloads, 0);

    r.sandbox.showConfirm = async () => true;
    await r.evaluate('settingsManager.resetGame()');
    assert.equal(reloads, 1);
    assert.deepEqual([...r.store], [['unrelatedPreference', 'keep']]);

    const fresh = browserRuntime(Object.fromEntries(r.store));
    assert.equal(fresh.evaluate('db.gold'), 100);
    assert.deepEqual([...fresh.evaluate('db.owned')], ['basic']);
    assert.equal(fresh.evaluate('storyJourney.stage'), 0);
    assert.equal(fresh.evaluate('db.getBookStats().solved'), 0);
    assert.equal(fresh.evaluate('db.settings.musicPlay'), true);
    assert.equal(fresh.evaluate('db.practiceMemorized[db.getBookKey()]'), undefined);
});
