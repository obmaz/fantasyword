/** 지도에서 선택한 지점만 진행하고, 완료한 단계는 단어장별로 기억한다. */
const storyJourney = {
    returnAfterResult: false,
    pendingStage: null,
    pendingIndex: null,
    pendingBook: null,
    pendingKind: null,
    mysterySelection: null,
    mysteryRevealCost: 100,
    cancelBattleReturn() {
        storyJourney.returnAfterResult = false;
        storyJourney.pendingStage = null;
        storyJourney.pendingIndex = null;
        storyJourney.pendingBook = null;
        storyJourney.pendingKind = null;
    },
    purchaseSuccessRate: 0.75,
    random: () => Math.random(),
    get key() {
        return `v7_story_stage_${db.getBookKey()}`;
    },
    get stage() {
        return Math.max(
            0,
            Math.min(
                storyJourney.nodes().length,
                Math.floor(Number(gameStorage.get(storyJourney.key, '0')) || 0)
            )
        );
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
    get eventsKey() {
        return `v7_story_events_${db.getBookKey()}`;
    },
    get events() {
        const value = gameStorage.readJSON(storyJourney.eventsKey, {});
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    },
    nodes() {
        const events = storyJourney.events;
        return storyMapRules.rows.map((row, stage) =>
            row.map((kind, index) => {
                const saved = events[`${stage}:${index}`]?.kind;
                const resolved =
                    kind === 'mystery' &&
                    ['battle', 'market', 'treasure', 'assault'].includes(saved) &&
                    events[`${stage}:${index}`]?.revealed !== false
                        ? saved
                        : kind;
                return { kind: resolved, ...storyMapRules.encounters[resolved] };
            })
        );
    },
    position(index, count) {
        return storyMapRules.position(index, count);
    },
    connections(row, index, nodes = storyJourney.nodes()) {
        return storyMapRules.connections(row, index, nodes);
    },
    canSelect(row, index, nodes = storyJourney.nodes()) {
        if (row !== storyJourney.stage || !nodes[row]?.[index]) return false;
        const previous = storyJourney.path[row - 1];
        // 기존 진행도와 경로를 그대로 이어간다. 경로 기록이 없으면 현재 행에서 선택할 수 있다.
        return (
            row === 0 ||
            !nodes[row - 1]?.[previous] ||
            storyJourney.connections(row - 1, previous, nodes).includes(index)
        );
    },
    open() {
        storyJourney.render();
        openScreenOverlay('story-map-modal', false);
        const card = document.getElementById('story-map-content');
        const map = document.getElementById('story-map-path');
        const current = map.querySelector(
            '.story-map-row[data-state="current"] .story-map-node:not(:disabled)'
        );
        if (current)
            card.scrollTop =
                map.offsetTop + current.offsetTop - (card.clientHeight - current.offsetHeight) / 2;
        else if (storyJourney.stage >= storyJourney.nodes().length) card.scrollTop = 0;
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
        const nodes = storyJourney.nodes();
        const events = storyJourney.events;
        const height = nodes.length * 112 + 112;
        const y = (row) => (nodes.length - row - 1) * 112 + 80;
        container.style.height = `${height}px`;
        const edges = document.createElement('div');
        edges.className = 'story-map-edges';
        const lines = [];
        nodes.forEach((row, rowIndex) =>
            row.forEach((_, index) => {
                storyJourney.connections(rowIndex, index, nodes).forEach((target) => {
                    const visited =
                        rowIndex < stage &&
                        path[rowIndex] === index &&
                        path[rowIndex + 1] === target;
                    const available = rowIndex === stage - 1 && path[rowIndex] === index;
                    lines.push(
                        `<path class="${visited ? 'visited' : available ? 'available' : ''}" d="M ${storyJourney.position(index, row.length)} ${y(rowIndex)} L ${storyJourney.position(target, nodes[rowIndex + 1].length)} ${y(rowIndex + 1)}" />`
                    );
                });
            })
        );
        edges.innerHTML = `<svg viewBox="0 0 100 ${height}" preserveAspectRatio="none" aria-hidden="true">${lines.join('')}</svg>`;
        container.appendChild(edges);
        nodes.forEach((row, rowIndex) => {
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
                button.disabled = !storyJourney.canSelect(rowIndex, index, nodes);
                button.style.left = `${storyJourney.position(index, row.length)}%`;
                button.style.top = `${y(rowIndex)}px`;
                const cleared = rowIndex < stage && path[rowIndex] === index;
                if (rowIndex < stage) button.dataset.visited = String(cleared);
                if (cleared) button.dataset.cleared = 'true';
                const label = node.label;
                button.setAttribute('aria-label', label);
                button.title = label;
                const caption = document.createElement('span');
                caption.className = 'story-map-node-label';
                caption.textContent = label;
                button.appendChild(caption);
                const mistakes = events[`${rowIndex}:${index}`]?.mistakes;
                const crown = cleared ? storyMapRules.crown(mistakes) : null;
                if (crown) {
                    button.dataset.crown = crown;
                    const badge = document.createElement('span');
                    badge.className = 'story-map-crown';
                    badge.setAttribute('aria-hidden', 'true');
                    badge.innerHTML =
                        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6l5 4 4-7 4 7 5-4-2 13H5zM5 21h14" /></svg>';
                    button.appendChild(badge);
                    const grade = { gold: '금', silver: '은', bronze: '동' }[crown];
                    button.title = `${label} 클리어 · ${grade} 왕관 · ${mistakes}개 틀림`;
                    button.setAttribute('aria-label', button.title);
                } else if (cleared) {
                    button.title = `${label} 클리어`;
                    button.setAttribute('aria-label', button.title);
                }
                button.addEventListener('click', () => storyJourney.select(rowIndex, index));
                group.appendChild(button);
            });
            container.appendChild(group);
        });
        if (stage >= nodes.length) {
            const restart = document.createElement('button');
            restart.className = 'btn-main story-map-restart';
            restart.textContent = '새 모험 시작';
            restart.addEventListener('click', () => {
                if (
                    !gameStorage.setBatch({
                        [storyJourney.key]: '0',
                        [storyJourney.pathKey]: '[]',
                        [storyJourney.eventsKey]: '{}',
                    })
                )
                    return;
                storyJourney.cancelBattleReturn();
                storyJourney.mysterySelection = null;
                storyJourney.render();
                const card = document.getElementById('story-map-content');
                card.scrollTop = card.scrollHeight;
            });
            container.appendChild(restart);
        }
    },
    select(row, index) {
        if (!storyJourney.canSelect(row, index)) return;
        if (storyJourney.nodes()[row]?.[index]?.kind === 'mystery') {
            storyJourney.mysterySelection = { row, index, book: db.getBookKey() };
            document.getElementById('story-mystery-status').textContent =
                `정체를 미리 확인하려면 ${storyJourney.mysteryRevealCost} G가 필요합니다. 보유 골드 ${db.gold} G`;
            document.getElementById('story-mystery-reveal').disabled = false;
            resetScreenOverlay('story-map-modal');
            openScreenOverlay('story-mystery-modal', false);
            return;
        }
        storyJourney.enter(row, index);
    },
    mysteryIsCurrent() {
        const selected = storyJourney.mysterySelection;
        return (
            selected &&
            selected.book === db.getBookKey() &&
            storyMapRules.rows[selected.row]?.[selected.index] === 'mystery' &&
            storyJourney.canSelect(selected.row, selected.index)
        );
    },
    mysteryKind(row, index) {
        const kind = storyJourney.events[`${row}:${index}`]?.kind;
        return ['battle', 'market', 'treasure', 'assault'].includes(kind)
            ? kind
            : storyMapRules.resolveMystery(storyJourney.random());
    },
    revealMystery() {
        if (!storyJourney.mysteryIsCurrent()) return;
        const { row, index } = storyJourney.mysterySelection;
        const events = storyJourney.events;
        const key = `${row}:${index}`;
        if (events[key]?.revealed === true) return;
        if (db.gold < storyJourney.mysteryRevealCost) {
            document.getElementById('story-mystery-status').textContent =
                `골드가 부족합니다. 확인 비용 ${storyJourney.mysteryRevealCost} G · 보유 골드 ${db.gold} G`;
            return;
        }
        const kind = storyJourney.mysteryKind(row, index);
        events[key] = { ...events[key], kind, revealed: true };
        if (
            !db.commitChanges(
                { gold: db.gold - storyJourney.mysteryRevealCost },
                {
                    [storyJourney.eventsKey]: JSON.stringify(events),
                }
            )
        )
            return;
        document.getElementById('story-mystery-status').textContent =
            `${storyMapRules.encounters[kind].label} 지점입니다. 남은 골드 ${db.gold} G`;
        document.getElementById('story-mystery-reveal').disabled = true;
    },
    leaveMystery() {
        storyJourney.mysterySelection = null;
        resetScreenOverlay('story-mystery-modal');
        storyJourney.open();
    },
    enterMystery() {
        if (!storyJourney.mysteryIsCurrent()) return;
        const { row, index } = storyJourney.mysterySelection;
        storyJourney.mysterySelection = null;
        resetScreenOverlay('story-mystery-modal');
        storyJourney.enter(row, index);
    },
    enter(row, index) {
        if (!storyJourney.canSelect(row, index)) return;
        let node = storyJourney.nodes()[row]?.[index];
        if (!node) return;
        if (node.kind === 'mystery') {
            const events = storyJourney.events;
            const kind = storyJourney.mysteryKind(row, index);
            events[`${row}:${index}`] = { ...events[`${row}:${index}`], kind, revealed: false };
            if (!gameStorage.set(storyJourney.eventsKey, JSON.stringify(events))) return;
            node = { kind, ...storyMapRules.encounters[kind] };
        }
        storyJourney.pendingStage = row;
        storyJourney.pendingIndex = index;
        storyJourney.pendingBook = db.getBookKey();
        storyJourney.pendingKind = node.kind;
        resetScreenOverlay('story-map-modal');
        if (node.kind === 'market') {
            storyJourney.renderMarket();
            openScreenOverlay('story-market-modal', false);
            return;
        }
        if (node.kind === 'treasure') {
            const claimed = storyJourney.events[`${row}:${index}`]?.claimed;
            if (claimed) storyJourney.completeBattle();
            document.getElementById('story-treasure-status').textContent = claimed
                ? '이미 연 상자입니다.'
                : `상자를 열면 ${storyJourney.treasureGold(row)} G를 얻습니다.`;
            document.getElementById('story-treasure-open').disabled = !!claimed;
            openScreenOverlay('story-treasure-modal', false);
            return;
        }
        if (node.kind === 'assault') {
            const book = db.getBookKey();
            const isCurrent = () =>
                storyJourney.isPending() &&
                storyJourney.pendingStage === row &&
                storyJourney.pendingIndex === index &&
                storyJourney.pendingKind === 'assault';
            skyfall.start('all', {
                count: node.count,
                onFinish: (won, result = { mistakes: 0 }) => {
                    if (won && book === db.getBookKey() && isCurrent())
                        storyJourney.completeBattle(result);
                },
                onExit: () => {
                    if (book !== db.getBookKey()) return;
                    if (storyJourney.pendingStage !== null && !isCurrent()) return;
                    storyJourney.cancelBattleReturn();
                    storyJourney.open();
                },
            });
            return;
        }
        storyJourney.returnAfterResult = true;
        game.battleQuestionType = node.type;
        story.startIntro('story', 'all');
        const detail = node.minimumCorrectShare
            ? ` · ${Math.ceil(node.count * node.minimumCorrectShare)}문제 이상 정답이면 통과`
            : '';
        document.getElementById('battle-mode-day-info').textContent = node.label;
        document.getElementById('battle-mode-text').textContent =
            `${node.label} · 단어장 전체에서 ${node.count}문제${detail}`;
    },
    isPending() {
        return (
            storyJourney.pendingStage === storyJourney.stage &&
            storyJourney.pendingBook === db.getBookKey()
        );
    },
    battleCount() {
        return storyJourney.isPending()
            ? storyMapRules.encounters[storyJourney.pendingKind]?.count
            : null;
    },
    canComplete(correct, total) {
        const share = storyMapRules.encounters[storyJourney.pendingKind]?.minimumCorrectShare || 0;
        return !share || correct >= Math.ceil(total * share);
    },
    treasureGold(row) {
        return 50 + Math.floor(row / 3) * 10;
    },
    claimTreasure() {
        if (!storyJourney.isPending() || storyJourney.pendingKind !== 'treasure') return;
        const row = storyJourney.pendingStage;
        const key = `${row}:${storyJourney.pendingIndex}`;
        const events = storyJourney.events;
        if (events[key]?.claimed) return;
        events[key] = { ...events[key], kind: 'treasure', claimed: true };
        const gold = storyJourney.treasureGold(row);
        if (
            !db.commitChanges(
                { gold: db.gold + gold },
                {
                    [storyJourney.eventsKey]: JSON.stringify(events),
                }
            )
        )
            return;
        storyJourney.completeBattle();
        document.getElementById('story-treasure-status').textContent = `${gold} G를 얻었습니다.`;
        document.getElementById('story-treasure-open').disabled = true;
    },
    leaveTreasure() {
        resetScreenOverlay('story-treasure-modal');
        storyJourney.cancelBattleReturn();
        storyJourney.open();
    },
    completeBattle(result = null) {
        if (storyJourney.isPending()) {
            const key = `${storyJourney.pendingStage}:${storyJourney.pendingIndex}`;
            const events = storyJourney.events;
            events[key] = { ...events[key], cleared: true };
            if (Number.isInteger(result?.mistakes) && result.mistakes >= 0)
                events[key].mistakes = result.mistakes;
            const path = storyJourney.path;
            path[storyJourney.pendingStage] = storyJourney.pendingIndex;
            if (
                !gameStorage.setBatch({
                    [storyJourney.eventsKey]: JSON.stringify(events),
                    [storyJourney.pathKey]: JSON.stringify(path),
                    [storyJourney.key]: String(storyJourney.stage + 1),
                })
            )
                return;
        }
        storyJourney.pendingStage = null;
        storyJourney.pendingIndex = null;
        storyJourney.pendingBook = null;
        storyJourney.pendingKind = null;
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
        const success = storyJourney.random() < storyJourney.purchaseSuccessRate;
        if (
            !db.commitChanges({
                gold: db.gold - relic.cost,
                ...(success ? { owned: [...db.owned, relic.id] } : {}),
            })
        )
            return;
        if (!success) {
            storyJourney.renderMarket(
                `거래 실패 · ${relic.cost} G를 잃었습니다. 남은 골드 ${db.gold} G`
            );
            return;
        }
        inventory.render();
        storyJourney.renderMarket();
    },
    leaveMarket() {
        resetScreenOverlay('story-market-modal');
        storyJourney.cancelBattleReturn();
        storyJourney.open();
    },
    advanceMarket() {
        storyJourney.completeBattle();
        storyJourney.leaveMarket();
    },
};
