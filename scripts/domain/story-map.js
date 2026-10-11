/** 지도 지점과 연결 규칙. Day·DOM·저장소에 의존하지 않는다. */
const storyMapRules = Object.freeze({
    rows: [
        ['battle', 'mystery'],
        ['objective', 'market', 'mystery'],
        ['assault', 'spelling'],
        ['mystery'],
        ['battle', 'objective', 'listening'],
        ['casino', 'spelling'],
        ['assault', 'forge', 'proverb'],
        ['miniboss'],
        ['treasure', 'market'],
        ['objective', 'assault', 'spelling'],
        ['listening', 'battle'],
        ['miniboss'],
        ['market', 'mystery', 'spelling'],
        ['battle', 'spelling'],
        ['boss'],
    ],
    encounters: {
        battle: { label: '전투', type: 'monsters', count: 8 },
        objective: { label: '뜻 문제', type: 'objective', count: 6 },
        spelling: { label: '철자 조립', type: 'spelling', count: 6 },
        listening: { label: '듣기', type: 'listening', count: 6 },
        market: { label: '암시장' },
        treasure: { label: '상자' },
        assault: { label: '총공세', count: 8 },
        miniboss: { label: '미니보스', type: 'spelling', monsterId: 'dragon', count: 5 },
        boss: { label: '보스', type: 'dragon', count: 8 },
        mystery: { label: '?' },
        idiom: { label: '사자성어', type: 'idiom', count: 5 },
        casino: { label: '도박장' },
        proverb: { label: '속담', count: 5 },
        forge: { label: '단어 대장간', count: 3 },
    },
    mysteryKinds: ['battle', 'market', 'treasure', 'assault', 'proverb', 'forge', 'idiom'],
    nonCombat(kind) {
        return ['market', 'treasure', 'casino', 'mystery', 'proverb', 'forge'].includes(kind);
    },
    validLayout(rows) {
        return (
            Array.isArray(rows) &&
            rows.length === storyMapRules.rows.length &&
            rows.every(
                (row, stage) =>
                    Array.isArray(row) &&
                    row.length === storyMapRules.rows[stage].length &&
                    row.every(
                        (kind) => Object.hasOwn(storyMapRules.encounters, kind) && kind !== 'idiom'
                    )
            ) &&
            rows.at(-1)[0] === 'boss' &&
            rows.slice(0, -1).every((row) => !row.includes('boss')) &&
            rows.slice(0, -1).every((row, stage) => {
                const routes = row.map((_, index) => storyMapRules.connections(stage, index, rows));
                return (
                    routes.every((targets) => targets.length > 0) &&
                    new Set(routes.flat()).size === rows[stage + 1].length
                );
            })
        );
    },
    regenerate(shuffle) {
        // 전투 행을 사이에 둬 숨겨진 ? 결과도 비전투 지점과 연속되지 않게 한다.
        const rows = storyMapRules.rows.map((row) => [...row]);
        const combat = shuffle(['battle', 'objective', 'spelling', 'listening', 'assault']);
        let combatIndex = 0;
        const events = ['market', 'treasure', 'casino', 'mystery', 'proverb', 'forge'];
        let eventIndex = 0;
        const order = shuffle(events);
        rows.forEach((row, stage) => {
            row.forEach((_, index) => {
                row[index] =
                    stage % 2 === 1 && stage !== rows.length - 1
                        ? order[eventIndex++ % order.length]
                        : combat[combatIndex++ % combat.length];
            });
        });
        rows[7] = ['miniboss'];
        rows[11] = ['miniboss'];
        rows[14] = ['boss'];
        return rows;
    },
    assignDay(source, events, shuffle) {
        const used = new Set(Object.values(events).map((event) => Number(event?.day)));
        const days = [...new Set(source.map((row) => Number(row.day)))].filter(
            (day) =>
                Number.isInteger(day) &&
                day > 0 &&
                !used.has(day) &&
                source.filter((row) => Number(row.day) === day).length >= 4
        );
        return shuffle(days)[0] ?? 'all';
    },
    position(index, count) {
        return ((index + 0.5) / count) * 100;
    },
    crown(mistakes) {
        return Number.isInteger(mistakes) && mistakes >= 0 && mistakes <= 2
            ? ['gold', 'silver', 'bronze'][mistakes]
            : null;
    },
    connections(row, index, rows = storyMapRules.rows) {
        const current = rows[row];
        const next = rows[row + 1];
        if (!current?.[index] || !next) return [];
        const ranked = (x, count) =>
            Array.from({ length: count }, (_, target) => ({
                target,
                distance: Math.abs(storyMapRules.position(target, count) - x),
            }))
                .sort((a, b) => a.distance - b.distance || a.target - b.target)
                .map(({ target }) => target);
        const allowed = (source, target) =>
            !storyMapRules.nonCombat(current[source]?.kind || current[source]) ||
            !storyMapRules.nonCombat(next[target]?.kind || next[target]);
        const primary = current.map((_, source) =>
            ranked(storyMapRules.position(source, current.length), next.length).find((target) =>
                allowed(source, target)
            )
        );
        const targets = new Set([primary[index]]);
        // 다음 행의 지점마다 진입로를 보장하되 모든 지점에 두 갈림길을 만들지는 않는다.
        next.forEach((_, target) => {
            if (
                !primary.includes(target) &&
                ranked(storyMapRules.position(target, next.length), current.length).find((source) =>
                    allowed(source, target)
                ) === index
            )
                targets.add(target);
        });
        if ((row + index) % 4 === 0 && next.length > 1)
            targets.add(ranked(storyMapRules.position(index, current.length), next.length)[1]);
        return [...targets]
            .filter((target) => target !== undefined && allowed(index, target))
            .sort((a, b) => a - b);
    },
    resolveMystery(random) {
        const kinds = storyMapRules.mysteryKinds;
        return kinds[Math.max(0, Math.min(kinds.length - 1, Math.floor(random * kinds.length)))];
    },
});
