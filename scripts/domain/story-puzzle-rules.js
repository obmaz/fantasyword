/** 빈칸과 한 글자 변환 판정. 화면·저장소와 독립된 규칙이다. */
const storyPuzzleRules = Object.freeze({
    differsByOne(first, second) {
        return (
            first.length === second.length &&
            [...first].filter((letter, i) => letter !== second[i]).length === 1
        );
    },
    neighbors(word, words) {
        return words.filter((candidate) => storyPuzzleRules.differsByOne(word, candidate)).sort();
    },
    path(start, goal, words) {
        if (!words.includes(start) || !words.includes(goal)) return null;
        const queue = [[start]];
        const visited = new Set([start]);
        for (let i = 0; i < queue.length; i++) {
            const route = queue[i];
            const last = route.at(-1);
            if (last === goal) return route;
            for (const next of storyPuzzleRules.neighbors(last, words)) {
                if (visited.has(next)) continue;
                visited.add(next);
                queue.push([...route, next]);
            }
        }
        return null;
    },
    proverbs(rows, shuffle) {
        return shuffle(rows)
            .slice(0, 5)
            .map((row) => ({
                ...row,
                choices: shuffle([row.answer, ...row.decoys]),
            }));
    },
    forge(paths, words, shuffle) {
        return shuffle(paths)
            .slice(0, 3)
            .map((route) => {
                const start = route[0];
                const goal = route.at(-1);
                const shortest = storyPuzzleRules.path(start, goal, words);
                return { start, goal, minimum: shortest.length - 1 };
            });
    },
});
