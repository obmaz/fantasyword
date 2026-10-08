const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load-module');

for (const type of ['mixed', 'objective', 'subjective']) {
    test(`출력 ${type} 문제지는 같은 단어·뜻을 한 번만 쓰고 번호를 연속으로 부여한다`, () => {
        let html;
        const source = [
            { day: 1, word: 'apple', meaning: '사과' },
            { day: 1, word: 'apple', meaning: '사과' },
            { day: 1, word: 'APPLE ', meaning: '다른 풀이' },
            { day: 1, word: 'banana', meaning: '바나나' },
            { day: 1, word: 'orange', meaning: '오렌지' },
            { day: 2, word: 'pear', meaning: '배' },
        ];
        const r = loadScripts(['scripts/features/worksheet.js'], {
            document: {
                getElementById: () => ({ value: '1' }),
                querySelector: () => ({ value: type }),
                createElement: () => ({ style: {}, click() {} }),
                body: { appendChild() {}, removeChild() {} },
            },
            rawDataData: source,
            APP_CONFIG: { printMaxQuestions: 30 },
            questionTools: {
                shuffle: (values) => [...values],
                getDistractors: () => ['다른 답1', '다른 답2', '다른 답3'],
            },
            escapeHTML: (value) =>
                String(value)
                    .replaceAll('&', '&amp;')
                    .replaceAll('<', '&lt;')
                    .replaceAll('>', '&gt;'),
            secret: { closePrintDaySelect() {} },
            showToast() {},
            setTimeout() {},
            open() {},
            Blob: class {
                constructor(parts) {
                    html = parts.join('');
                }
            },
            URL: { createObjectURL: () => 'blob:test' },
        });
        r.evaluate('worksheet.generate()');
        const questions = html
            .split('<!-- 문제만 페이지 -->')[1]
            .split('<div class="print-page">')[1];
        const numbers = [...questions.matchAll(/class="question-number">(\d+)\./g)].map((match) =>
            Number(match[1])
        );
        assert.deepEqual(numbers, [1, 2, 3]);
        assert.doesNotMatch(questions, />pear</);
        assert.equal((questions.match(/class="question-text">(?:apple|사과)</g) || []).length, 1);
    });
}
