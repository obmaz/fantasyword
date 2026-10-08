/** 지도에서 선택한 지점만 진행하고, 완료한 단계는 단어장별로 기억한다. */
const storyJourney = {
    returnAfterResult: false,
    pendingStage: null,
    pendingIndex: null,
    cancelBattleReturn() {
        storyJourney.returnAfterResult = false;
        storyJourney.pendingStage = null;
        storyJourney.pendingIndex = null;
    },
    purchaseSuccessRate: 0.75,
    random: () => Math.random(),
    get key() {
        return `v7_story_stage_${db.getBookKey()}`;
    },
    get stage() {
        return Math.max(0, Math.min(5, Number(gameStorage.get(storyJourney.key, '0')) || 0));
    },
    set stage(value) {
        gameStorage.set(storyJourney.key, String(value));
    },
    get pathKey() {
        return `v7_story_path_${db.getBookKey()}`;
    },
    get path() {
        const saved = gameStorage.readJSON(storyJourney.pathKey, []);
        return Array.isArray(saved) ? saved : [];
    },
    remember(stage, index) {
        const path = storyJourney.path;
        path[stage] = index;
        gameStorage.set(storyJourney.pathKey, JSON.stringify(path));
    },
    nodes() {
        const source = window.rawDataData || rawData;
        const days = Object.keys(dayCatalog)
            .filter((day) => /^\d+$/.test(day) && source.some((word) => String(word.day) === day))
            .sort((a, b) => Number(a) - Number(b));
        const day = (index) => days[Math.min(index, days.length - 1)] || 'all';
        return [
            [
                { kind: 'battle', day: day(0) },
                { kind: 'battle', day: day(1) },
            ],
            [{ kind: 'battle', day: day(2) }, { kind: 'market' }],
            [
                { kind: 'battle', day: day(3) },
                { kind: 'battle', day: day(4) },
            ],
            [{ kind: 'market' }, { kind: 'battle', day: day(5) }],
            [{ kind: 'boss', day: day(6) }],
        ];
    },
    open() {
        storyJourney.render();
        openScreenOverlay('story-map-modal', false);
        const card = document.getElementById('story-map-content');
        const map = document.getElementById('story-map-path');
        const current = map.querySelector('.story-map-row[data-state="current"] .story-map-node');
        if (current)
            card.scrollTop =
                map.offsetTop + current.offsetTop - (card.clientHeight - current.offsetHeight) / 2;
        else if (storyJourney.stage >= 5) card.scrollTop = card.scrollHeight;
    },
    close() {
        resetScreenOverlay('story-map-modal');
        navigation.track('title-screen');
    },
    render() {
        const container = document.getElementById('story-map-path');
        container.replaceChildren();
        const stage = storyJourney.stage;
        const path = storyJourney.path;
        document.getElementById('story-map-status').textContent =
            stage >= 5
                ? '이야기를 마쳤습니다. 새 모험을 시작할 수 있습니다.'
                : `현재 지점 ${stage + 1} / 5`;
        storyJourney.nodes().forEach((row, rowIndex) => {
            const group = document.createElement('div');
            group.className = 'story-map-row';
            group.dataset.stage = String(rowIndex);
            group.dataset.state =
                rowIndex < stage ? 'passed' : rowIndex === stage ? 'current' : 'locked';
            row.forEach((node, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = `story-map-node story-map-node-${node.kind}`;
                button.dataset.index = String(index);
                button.disabled = rowIndex !== stage;
                if (rowIndex < stage) button.dataset.visited = String(path[rowIndex] === index);
                const label =
                    node.kind === 'market'
                        ? '암시장'
                        : node.kind === 'boss'
                          ? `마지막 관문 · Day ${node.day}`
                          : dayCatalog[node.day]?.label || `Day ${node.day}`;
                button.setAttribute('aria-label', label);
                button.title = label;
                const caption = document.createElement('span');
                caption.className = 'story-map-node-label';
                caption.textContent = label;
                button.appendChild(caption);
                button.addEventListener('click', () => storyJourney.select(rowIndex, index));
                group.appendChild(button);
            });
            container.appendChild(group);
        });
        if (stage >= 5) {
            const restart = document.createElement('button');
            restart.className = 'btn-main story-map-restart';
            restart.textContent = '새 모험 시작';
            restart.addEventListener('click', () => {
                storyJourney.stage = 0;
                gameStorage.set(storyJourney.pathKey, '[]');
                storyJourney.render();
            });
            container.appendChild(restart);
        }
    },
    select(row, index) {
        if (row !== storyJourney.stage) return;
        const node = storyJourney.nodes()[row]?.[index];
        if (!node) return;
        storyJourney.pendingStage = row;
        storyJourney.pendingIndex = index;
        resetScreenOverlay('story-map-modal');
        if (node.kind === 'market') {
            storyJourney.renderMarket();
            openScreenOverlay('story-market-modal', false);
            return;
        }
        storyJourney.returnAfterResult = true;
        game.battleQuestionType = 'monsters';
        document.getElementById('count-select').value = '10';
        story.startIntro('story', node.day);
    },
    completeBattle() {
        if (storyJourney.pendingStage === storyJourney.stage) {
            storyJourney.remember(storyJourney.stage, storyJourney.pendingIndex);
            storyJourney.stage++;
        }
        storyJourney.pendingStage = null;
        storyJourney.pendingIndex = null;
    },
    renderMarket(message = '') {
        const owned = db.has('shadowCompass');
        document.getElementById('story-market-status').textContent = owned
            ? '그림자 나침반을 가지고 있습니다.'
            : message || `보유 골드 ${db.gold} G`;
        const buyButton = document.querySelector('[data-action="story-market-buy"]');
        if (buyButton) buyButton.disabled = owned;
    },
    buy() {
        const relic = relics.find((item) => item.id === 'shadowCompass');
        if (!relic || db.has(relic.id)) return;
        if (db.gold < relic.cost) {
            showToast('골드가 부족합니다.', 'error');
            return;
        }
        db.subGold(relic.cost);
        if (storyJourney.random() >= storyJourney.purchaseSuccessRate) {
            storyJourney.renderMarket(
                `거래 실패 · ${relic.cost} G를 잃었습니다. 남은 골드 ${db.gold} G`
            );
            return;
        }
        db.owned.push(relic.id);
        db.save('owned');
        inventory.render();
        storyJourney.renderMarket();
    },
    leaveMarket() {
        resetScreenOverlay('story-market-modal');
        storyJourney.pendingStage = null;
        storyJourney.pendingIndex = null;
        storyJourney.open();
    },
    advanceMarket() {
        if (storyJourney.pendingStage === storyJourney.stage) {
            storyJourney.remember(storyJourney.stage, storyJourney.pendingIndex);
            storyJourney.stage++;
        }
        storyJourney.leaveMarket();
    },
};
