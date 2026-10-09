/** 지도 지점과 연결 규칙. Day·DOM·저장소에 의존하지 않는다. */
const storyMapRules = Object.freeze({
    rows: [
        ['battle', 'mystery'],
        ['objective', 'market', 'mystery'],
        ['assault', 'spelling'],
        ['mystery'],
        ['battle', 'treasure', 'listening'],
        ['market', 'spelling'],
        ['assault', 'mystery', 'battle'],
        ['miniboss'],
        ['treasure', 'market'],
        ['objective', 'assault', 'mystery'],
        ['listening', 'battle'],
        ['miniboss'],
        ['market', 'mystery', 'spelling'],
        ['battle', 'treasure'],
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
        miniboss: { label: '미니보스', type: 'dragon', count: 5, minimumCorrectShare: 0.6 },
        boss: { label: '보스', type: 'dragon', count: 8, minimumCorrectShare: 0.75 },
        mystery: { label: '?' },
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
        const primary = current.map(
            (_, source) => ranked(storyMapRules.position(source, current.length), next.length)[0]
        );
        const targets = new Set([primary[index]]);
        // 다음 행의 지점마다 진입로를 보장하되 모든 지점에 두 갈림길을 만들지는 않는다.
        next.forEach((_, target) => {
            if (
                !primary.includes(target) &&
                ranked(storyMapRules.position(target, next.length), current.length)[0] === index
            )
                targets.add(target);
        });
        if ((row + index) % 4 === 0 && next.length > 1)
            targets.add(ranked(storyMapRules.position(index, current.length), next.length)[1]);
        return [...targets].sort((a, b) => a - b);
    },
    resolveMystery(random) {
        const kinds = ['battle', 'market', 'treasure', 'assault'];
        return kinds[Math.max(0, Math.min(kinds.length - 1, Math.floor(random * kinds.length)))];
    },
});
