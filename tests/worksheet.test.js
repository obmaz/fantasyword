const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load-module');
const source = Array.from({ length: 12 }, (_, index) => ({
    day: 1,
    word: 'word' + index,
    meaning: '뜻' + index,
}));
const loadRules = () =>
    loadScripts(['scripts/domain/worksheet-rules.js'], {
        source,
        shuffle: (values) => [...values],
    });

for (const type of ['mixed', 'objective', 'subjective']) {
    test(`출력 ${type}: 중복 제거, 연속 번호, 범위/상한과 원본 보존`, () => {
        const r = loadRules();
        r.sandbox.source = [
            ...source,
            { ...source[0] },
            { day: 1, word: ' WORD0 ', meaning: '다른 뜻' },
            { day: 1, word: 'duplicate', meaning: '뜻1' },
            { day: 2, word: 'outside', meaning: '범위 밖' },
            { day: 1, word: '', meaning: '빈 단어' },
        ];
        const original = JSON.stringify(r.sandbox.source);
        const model = r.evaluate(
            `worksheetRules.build(source, {day: 1, type: '${type}', limit: 10}, shuffle)`
        );
        assert.deepEqual(
            Array.from(model.questions, (q) => q.num),
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        );
        assert.equal(new Set(model.questions.map((q) => q.prompt)).size, 10);
        assert.equal(model.objectiveCount, type === 'objective' ? 10 : type === 'mixed' ? 5 : 0);
        assert.equal(JSON.stringify(r.sandbox.source), original);
        assert.ok(model.questions.every((q) => q.prompt !== '범위 밖'));
    });
}

test('객관식 정답 번호는 최대 1개 차이로 균형을 이루고 답안지와 일치한다', () => {
    const r = loadRules();
    const model = r.evaluate(
        "worksheetRules.build(source, {day:1, type:'objective', limit:11}, shuffle)"
    );
    const counts = [0, 0, 0, 0];
    for (const q of model.questions) {
        assert.equal(q.options.length, 4);
        assert.equal(new Set(q.options).size, 4);
        assert.equal(q.options[q.correctIndex], q.answer);
        counts[q.correctIndex]++;
    }
    assert.equal(Math.max(...counts) - Math.min(...counts), 1);
});

test('동의어·동일 단어의 다른 뜻·중복 보기·빈 보기는 오답에서 제외한다', () => {
    const r = loadRules();
    r.sandbox.source = [
        { day: 1, word: 'happy', meaning: '행복한; 기쁜' },
        { day: 2, word: 'glad', meaning: '기쁜' },
        { day: 2, word: 'HAPPY', meaning: '즐거운' },
        { day: 2, word: 'cheerful', meaning: '즐거운' },
        { day: 2, word: 'sad', meaning: '슬픈' },
        { day: 2, word: 'fast', meaning: '빠른' },
        { day: 2, word: 'slow', meaning: '느린' },
        { day: 2, word: 'slow ', meaning: '느린' },
        { day: 2, word: '', meaning: '빈 값' },
    ];
    const q = r.evaluate(
        "worksheetRules.build(source, {day:1, type:'objective', limit:1}, shuffle).questions[0]"
    );
    assert.deepEqual(Array.from(q.options), ['happy', 'sad', 'fast', 'slow']);
    r.sandbox.source.unshift({ day: 1, word: 'first', meaning: '첫 번째' });
    const next = r.evaluate(
        "worksheetRules.build(source, {day:1, type:'objective', limit:2}, shuffle).questions[1]"
    );
    assert.ok(next.options);
    assert.ok(!next.options.includes('기쁜') && !next.options.includes('즐거운'));
});

test('4문항 미만이어도 정답 위치가 앞 번호로 고정되지 않는다', () => {
    const r = loadRules();
    r.sandbox.shuffle = (values) => [...values].reverse();
    const q = r.evaluate(
        "worksheetRules.build(source, {day:1, type:'objective', limit:1}, shuffle).questions[0]"
    );
    assert.equal(q.correctIndex, 3);
    assert.equal(q.options[3], q.answer);
});

test('오답은 같은 Day를 우선하고 부족할 때 다른 Day에서 보충한다', () => {
    const r = loadRules();
    r.sandbox.source = [
        { day: 1, word: 'target', meaning: '대상' },
        ...source.slice(0, 3).map((row) => ({ ...row, day: 2 })),
        ...source.slice(3, 6),
    ];
    const q = r.evaluate(
        "worksheetRules.build(source, {day:1, type:'objective', limit:1}, shuffle).questions[0]"
    );
    assert.deepEqual(Array.from(q.options), ['target', 'word3', 'word4', 'word5']);
});

test('보기가 부족하면 정답 중복 없이 주관식으로 대체한다', () => {
    const r = loadRules();
    r.sandbox.source = source.slice(0, 3);
    const model = r.evaluate("worksheetRules.build(source, {day:1, type:'objective'}, shuffle)");
    assert.equal(model.objectiveCount, 0);
    assert.equal(model.subjectiveCount, 3);
    assert.ok(model.questions.every((q) => q.options === null));
});

test('생성 문서: A4, 답란, 정답 분리, 이스케이프 및 다운로드 흐름', () => {
    let html,
        closed = false,
        removed = false,
        downloaded = false,
        opened = false;
    const r = loadScripts(['scripts/domain/worksheet-rules.js', 'scripts/features/worksheet.js'], {
        document: {
            getElementById: (id) => ({ value: id === 'print-question-count' ? '10' : '1' }),
            querySelector: () => ({ value: 'subjective' }),
            querySelectorAll: () => [{ value: '1' }],
            createElement: () => ({
                click() {
                    downloaded = true;
                },
                remove() {
                    removed = true;
                },
            }),
            body: { appendChild() {} },
        },
        rawDataData: [{ day: 1, word: '<script>bad</script>', meaning: 'A & B' }],
        APP_CONFIG: { printMaxQuestions: 30 },
        questionTools: { shuffle: (values) => [...values] },
        escapeHTML: (value) =>
            String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
        secret: {
            closePrintDaySelect() {
                closed = true;
            },
        },
        showToast() {},
        setTimeout() {},
        open() {
            opened = true;
        },
        Blob: class {
            constructor(parts) {
                html = parts.join('');
            }
        },
        URL: { createObjectURL: () => 'blob:test' },
    });
    r.evaluate('worksheet.generate()');
    assert.ok(closed && removed && downloaded && opened);
    assert.match(html, /size: A4 portrait; margin: 14mm/);
    assert.match(html, /data-print-target="questions"/);
    assert.match(html, /class="answer-line"/);
    assert.match(html, /교사용 정답지/);
    assert.match(html, /&lt;script&gt;bad&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>bad/);
    assert.match(html, /A &amp; B/);
});

test('여러 Day는 번호순으로 묶고 상한과 중복 제거를 Day마다 적용한다', () => {
    const r = loadRules();
    r.sandbox.source = [5, 1, 3, 2].flatMap((day) =>
        Array.from({ length: 40 }, (_, index) => ({
            day,
            word: `word${index}`,
            meaning: `뜻${index}`,
        }))
    );
    r.sandbox.shuffle = (values) => [...values].reverse();
    const original = JSON.stringify(r.sandbox.source);
    const limited = r.evaluate(
        "worksheetRules.build(source, {days:[5,1,3,1], type:'mixed', limit:10}, shuffle)"
    );
    assert.equal(limited.questions.length, 30);
    assert.deepEqual(
        Array.from(limited.questions, (q) => q.day),
        [...Array(10).fill(1), ...Array(10).fill(3), ...Array(10).fill(5)]
    );
    assert.deepEqual(
        Array.from(limited.questions, (q) => q.num),
        [1, 3, 5].flatMap(() => Array.from({ length: 10 }, (_, i) => i + 1))
    );
    assert.equal(limited.objectiveCount, 15);
    const all = r.evaluate('worksheetRules.build(source, {days:[1,3,5]}, shuffle)');
    assert.equal(all.questions.length, 120);
    for (const day of [1, 3, 5]) {
        assert.equal(all.questions.filter((q) => q.day === day).length, 40);
    }
    assert.equal(JSON.stringify(r.sandbox.source), original);
    assert.equal(
        r.evaluate('worksheetRules.build(source, {days:[]}, shuffle).questions.length'),
        0
    );
});

test('Day별 독립 문제지와 답안지는 단일 Day 생성 결과와 같고 인쇄 Day를 고를 수 있다', () => {
    const r = loadScripts(['scripts/domain/worksheet-rules.js', 'scripts/features/worksheet.js'], {
        source: [1, 3, 4].flatMap((day) => source.map((row) => ({ ...row, day }))),
        shuffle: (values) => [...values],
        escapeHTML: (value) => String(value),
    });
    const papers = r.evaluate(`[1,3,4].map(day => ({day, label:'Day '+day,
        model:worksheetRules.build(source, {day, limit:10}, shuffle)}))`);
    r.sandbox.papers = papers;
    const html = r.evaluate('worksheet.createDocuments(papers)');
    assert.equal((html.match(/class="day-worksheet"/g) || []).length, 3);
    assert.equal((html.match(/class="question-number">1\./g) || []).length, 3);
    assert.equal((html.match(/교사용 정답지/g) || []).length, 3);
    assert.match(html, /id="print-day"/);
    assert.match(html, /sheet.hidden = day !== 'all'/);
    assert.match(html, /day-worksheet \+ .day-worksheet \{ break-before: page/);
    for (const paper of papers) {
        r.sandbox.paper = paper;
        const single = r.evaluate('worksheet.createDocument(paper.model, paper.label)');
        const body = single.slice(single.indexOf('<main>') + 6, single.indexOf('</main>'));
        assert.ok(
            html.includes(`<div class="day-worksheet" data-day="${paper.day}">${body}</div>`)
        );
        assert.deepEqual(
            Array.from(paper.model.questions, (q) => q.num),
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        );
    }
});
