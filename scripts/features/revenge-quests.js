/** 저장된 퀘스트와 독립된 이미지 부품으로 만든 퀘스트 목록을 연결한다. */
const revengeQuests = (() => {
    const entries = () =>
        revengeRules.entries(
            db.revengeQuests[db.getBookKey()] || {},
            window.rawDataData || rawData
        );
    function refresh() {
        const ready = entries().filter((q) => revengeRules.ready(q, Date.now())).length;
        document.querySelectorAll('[data-revenge-count]').forEach((node) => {
            node.textContent = ready > 99 ? '99+' : String(ready);
        });
    }
    function save(key, entry) {
        const book = db.getBookKey();
        if (!db.revengeQuests[book]) db.revengeQuests[book] = {};
        db.revengeQuests[book][key] = entry;
        db.save('revenge');
        refresh();
    }
    function fail(question) {
        const key = revengeRules.key(question);
        save(key, revengeRules.failed(db.revengeQuests[db.getBookKey()]?.[key], question));
    }
    function succeed(question) {
        const key = revengeRules.key(question);
        const result = revengeRules.succeeded(db.revengeQuests[db.getBookKey()]?.[key], Date.now());
        if (result.entry) save(key, result.entry);
        return result.bonus;
    }
    function ready() {
        return entries()
            .filter((q) => revengeRules.ready(q, Date.now()))
            .sort((a, b) => (a.phase === 'recall' ? 0 : 1) - (b.phase === 'recall' ? 0 : 1))
            .slice(0, 10)
            .map((q) => ({
                ...monsterEncounters.prepare(q.source, q.monsterId),
                revengeKey: revengeRules.key(q),
            }));
    }
    let refreshTimer = null;
    function render() {
        refresh();
        const all = entries();
        const counts = { revenge: 0, recall: 0, complete: 0 };
        all.forEach((q) => counts[q.phase]++);
        document.getElementById('revenge-summary').textContent =
            `재도전 ${counts.revenge} · 회상 대기 ${counts.recall} · 완료 ${counts.complete}`;
        const list = document.getElementById('revenge-list');
        list.replaceChildren();
        if (!all.length) {
            const empty = document.createElement('p');
            empty.className = 'revenge-empty';
            empty.textContent =
                '아직 복수할 몬스터가 없어요. 전투에서 틀린 단어가 생기면 이곳에 저장됩니다.';
            list.appendChild(empty);
        }
        all.sort(
            (a, b) => (a.phase === 'complete' ? 1 : 0) - (b.phase === 'complete' ? 1 : 0)
        ).forEach((q) => {
            const card = document.createElement('article');
            card.className = 'revenge-card';
            const image = document.createElement('img');
            image.src = `images/theme/parts/monster-${q.monsterId}.webp`;
            image.alt = monsterEncounters.catalog[q.monsterId].name;
            const details = document.createElement('div');
            const title = document.createElement('strong');
            title.textContent = q.phase === 'complete' ? q.word : q.meaning;
            const status = document.createElement('p');
            const wait = Math.max(0, Math.ceil((q.dueAt - Date.now()) / 60000));
            status.textContent =
                q.phase === 'complete'
                    ? '기억 확인 완료'
                    : q.phase === 'revenge'
                      ? `재도전 · ${q.revengeRewarded ? '보상 수령 완료' : `첫 성공 +${revengeRules.revengeBonus} G`}`
                      : wait
                        ? `다음 회상까지 ${Math.floor(wait / 60)}시간 ${wait % 60}분`
                        : `오늘의 회상 · ${q.recallRewarded ? '보상 수령 완료' : `첫 성공 +${revengeRules.recallBonus} G`}`;
            details.append(title, status);
            card.append(image, details);
            list.appendChild(card);
        });
        const button = document.getElementById('revenge-start-btn');
        const count = ready().length;
        button.disabled = count === 0;
        button.querySelector('span').textContent = count
            ? `${count}개 단어 재도전`
            : '지금 도전할 단어가 없어요';
    }
    function close() {
        clearInterval(refreshTimer);
        refreshTimer = null;
        closeScreenOverlay('revenge-modal', false);
    }
    function open() {
        cancelPendingGameStart();
        storyJourney.cancelBattleReturn();
        closeScreenOverlay('result-modal', false);
        resetScreenOverlays();
        openScreenOverlay('title-screen', false);
        render();
        openScreenOverlay('revenge-modal', true);
        clearInterval(refreshTimer);
        refreshTimer = setInterval(render, 30000);
    }
    function start() {
        if (!ready().length || game.active) return;
        close();
        game.init('revenge', 'all');
    }
    return { fail, succeed, ready, refresh, open, close, start };
})();
