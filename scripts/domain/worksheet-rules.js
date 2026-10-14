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
    // Porter 어간 규칙으로 활용형·접미 파생형을 묶는다. 숙어는 서로 합치지 않는다.
    familyKey: (value) => {
        let word = worksheetRules.normalize(value);
        if (!/^[a-z]{3,}$/.test(word)) return word;
        const isConsonant = (text, index) => {
            const letter = text[index];
            if ('aeiou'.includes(letter)) return false;
            if (letter === 'y') return index === 0 || !isConsonant(text, index - 1);
            return true;
        };
        const measure = (text) => {
            let count = 0;
            for (let index = 1; index < text.length; index++) {
                if (!isConsonant(text, index - 1) && isConsonant(text, index)) count++;
            }
            return count;
        };
        const hasVowel = (text) => Array.from(text).some((_, index) => !isConsonant(text, index));
        const shortSyllable = (text) => {
            const last = text.length - 1;
            return (
                last >= 2 &&
                isConsonant(text, last) &&
                !isConsonant(text, last - 1) &&
                isConsonant(text, last - 2) &&
                !'wxy'.includes(text[last])
            );
        };
        const replaceSuffix = (rules, minimumMeasure) => {
            for (const [suffix, replacement] of rules) {
                if (!word.endsWith(suffix)) continue;
                const stem = word.slice(0, -suffix.length);
                if (measure(stem) >= minimumMeasure) word = stem + replacement;
                break;
            }
        };
        if (word.endsWith('sses')) word = word.slice(0, -2);
        else if (word.endsWith('ies')) word = word.slice(0, -2);
        else if (!word.endsWith('ss') && word.endsWith('s')) word = word.slice(0, -1);
        if (word.endsWith('eed')) {
            if (measure(word.slice(0, -3)) > 0) word = word.slice(0, -1);
        } else {
            const suffix = word.endsWith('ing') ? 'ing' : word.endsWith('ed') ? 'ed' : '';
            const stem = suffix ? word.slice(0, -suffix.length) : '';
            if (suffix && hasVowel(stem)) {
                word = stem;
                if (/(at|bl|iz)$/.test(word)) word += 'e';
                else if (
                    /(\w)\1$/.test(word) &&
                    isConsonant(word, word.length - 1) &&
                    !'lsz'.includes(word.at(-1))
                )
                    word = word.slice(0, -1);
                else if (measure(word) === 1 && shortSyllable(word)) word += 'e';
            }
        }
        if (word.endsWith('y') && hasVowel(word.slice(0, -1))) word = word.slice(0, -1) + 'i';
        replaceSuffix(
            [
                ['ational', 'ate'],
                ['tional', 'tion'],
                ['enci', 'ence'],
                ['anci', 'ance'],
                ['izer', 'ize'],
                ['bli', 'ble'],
                ['alli', 'al'],
                ['entli', 'ent'],
                ['eli', 'e'],
                ['ousli', 'ous'],
                ['ization', 'ize'],
                ['ation', 'ate'],
                ['ator', 'ate'],
                ['alism', 'al'],
                ['iveness', 'ive'],
                ['fulness', 'ful'],
                ['ousness', 'ous'],
                ['aliti', 'al'],
                ['iviti', 'ive'],
                ['biliti', 'ble'],
                ['logi', 'log'],
            ],
            1
        );
        replaceSuffix(
            [
                ['icate', 'ic'],
                ['ative', ''],
                ['alize', 'al'],
                ['iciti', 'ic'],
                ['ical', 'ic'],
                ['ful', ''],
                ['ness', ''],
            ],
            1
        );
        const suffix = word.match(
            /(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ion|ou|ism|ate|iti|ous|ive|ize)$/
        )?.[0];
        if (suffix) {
            const stem = word.slice(0, -suffix.length);
            if (measure(stem) > 1 && (suffix !== 'ion' || /[st]$/.test(stem))) word = stem;
        }
        if (word.endsWith('e')) {
            const stem = word.slice(0, -1);
            if (measure(stem) > 1 || (measure(stem) === 1 && !shortSyllable(stem))) word = stem;
        }
        if (word.endsWith('ll') && measure(word) > 1) word = word.slice(0, -1);
        return word;
    },
    build: (source, { day, days, type = 'mixed', limit = 'all' }, shuffle) => {
        if (days) {
            const selectedDays = [...new Set(days.map(Number))]
                .filter((value) => Number.isFinite(value) && value > 0)
                .sort((a, b) => a - b);
            const models = selectedDays.map((value) =>
                worksheetRules.build(source, { day: value, type, limit }, shuffle)
            );
            const questions = models.flatMap((model) => model.questions);
            const objectiveCount = models.reduce((total, model) => total + model.objectiveCount, 0);
            return {
                questions,
                objectiveCount,
                subjectiveCount: questions.length - objectiveCount,
            };
        }
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
        const families = new Set();
        const selected = shuffle(rows.filter((row) => Number(row.day) === Number(day)))
            .filter((row) => {
                const word = worksheetRules.normalize(row.word);
                const meaning = worksheetRules.normalize(row.meaning);
                const family = limit === 'all' ? null : worksheetRules.familyKey(word);
                if (words.has(word) || meanings.has(meaning) || (family && families.has(family)))
                    return false;
                words.add(word);
                meanings.add(meaning);
                if (family) families.add(family);
                return true;
            })
            .slice(0, limit === 'all' ? Infinity : Math.max(0, Math.floor(Number(limit))));
        const questions = selected.map((item, index) => {
            const key = index % 2 === 0 ? 'word' : 'meaning';
            const objective =
                type === 'objective' ||
                (type === 'mixed' && index < Math.floor(selected.length / 2));
            const prompt = item[key === 'word' ? 'meaning' : 'word'];
            const question = {
                num: index + 1,
                day: Number(day),
                prompt,
                answer: item[key],
                key,
                options: null,
            };
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
