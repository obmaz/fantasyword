/** 인쇄 전용 출제 정책. 원본 단어장과 게임의 출제 규칙을 변경하지 않는다. */
const worksheetRules = {
    normalize: (value) =>
        String(value ?? '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' '),
    meanings: (value) =>
        String(value ?? '')
            .split(/[;,；，/]/)
            .map((part) => worksheetRules.normalize(part))
            .filter(Boolean),
    overlaps: (left, right) => {
        const meanings = new Set(worksheetRules.meanings(left));
        return worksheetRules.meanings(right).some((meaning) => meanings.has(meaning));
    },
    build: (source, { day, type = 'mixed', limit = 30 }, shuffle) => {
        const rows = source
            .filter(
                (row) =>
                    row &&
                    worksheetRules.normalize(row.word) &&
                    worksheetRules.normalize(row.meaning)
            )
            .map((row) => ({
                ...row,
                word: String(row.word).trim(),
                meaning: String(row.meaning).trim(),
            }));
        const words = new Set();
        const meanings = new Set();
        const selected = shuffle(rows.filter((row) => Number(row.day) === Number(day)))
            .filter((row) => {
                const word = worksheetRules.normalize(row.word);
                const meaning = worksheetRules.normalize(row.meaning);
                if (words.has(word) || meanings.has(meaning)) return false;
                words.add(word);
                meanings.add(meaning);
                return true;
            })
            .slice(0, Math.max(0, Math.floor(limit)));
        const questions = selected.map((item, index) => {
            const key = index % 2 === 0 ? 'word' : 'meaning';
            const objective =
                type === 'objective' ||
                (type === 'mixed' && index < Math.floor(selected.length / 2));
            const prompt = item[key === 'word' ? 'meaning' : 'word'];
            const question = { num: index + 1, prompt, answer: item[key], key, options: null };
            if (!objective) return question;
            // 부분 동의어와 같은 영단어의 다른 풀이도 정답이 될 수 있으므로 제외한다.
            const sameWord = rows.filter(
                (row) => worksheetRules.normalize(row.word) === worksheetRules.normalize(item.word)
            );
            const equivalent = rows.filter((row) =>
                sameWord.some((other) => worksheetRules.overlaps(row.meaning, other.meaning))
            );
            const accepted = new Set(equivalent.map((row) => worksheetRules.normalize(row[key])));
            const candidates = shuffle(rows).sort(
                (a, b) =>
                    Number(Number(b.day) === Number(day)) - Number(Number(a.day) === Number(day))
            );
            const seen = new Set(accepted);
            const distractors = [];
            for (const row of candidates) {
                const value = worksheetRules.normalize(row[key]);
                if (seen.has(value)) continue;
                if (
                    key === 'meaning' &&
                    equivalent.some((other) => worksheetRules.overlaps(other.meaning, row.meaning))
                )
                    continue;
                seen.add(value);
                distractors.push(row[key]);
                if (distractors.length === 3) break;
            }
            // 안전한 4지선다를 만들 수 없으면 임의 오답 대신 답란을 제공한다.
            if (distractors.length === 3) question.options = shuffle(distractors);
            return question;
        });
        const objectiveCount = questions.filter((question) => question.options).length;
        const order = shuffle([0, 1, 2, 3]);
        const positions = shuffle(
            Array.from({ length: objectiveCount }, (_, index) => order[index % 4])
        );
        let position = 0;
        questions.forEach((question) => {
            if (!question.options) return;
            question.correctIndex = positions[position++];
            question.options.splice(question.correctIndex, 0, question.answer);
        });
        return { questions, objectiveCount, subjectiveCount: questions.length - objectiveCount };
    },
};
