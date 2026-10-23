/**
 * 로드 스모크 테스트.
 *
 * index.html에 적힌 순서 그대로 모든 스크립트를 최소 DOM 스텁 위에서 실행합니다.
 * 빌드 도구 없이 <script> 순서에 의존하는 구조라서, 이 테스트가
 * "순서가 어긋나 조용히 깨지는" 회귀(정의 전 참조, 오타난 전역 등)를 잡아줍니다.
 *
 * 로드 중 의존성 조립과 초기 스타일 설정에 필요한 브라우저 API를 스텁으로 제공합니다.
 * 실제 DOM 준비 후 화면 렌더링은 별도 브라우저 검증이 담당합니다.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadScripts, ROOT } = require('./helpers/load-module');

/** index.html의 <script src="..."> 순서를 그대로 읽어온다 */
function scriptOrderFromIndexHtml() {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    return [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1]);
}

/** 로드 시점에 필요한 최소한의 브라우저 API 스텁 */
function makeDomStubs() {
    const store = new Map();
    const makeElement = () => ({
        style: { setProperty() {} },
        classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
        dataset: {},
        textContent: '',
        innerHTML: '',
        innerText: '',
        appendChild() {},
        addEventListener() {},
        querySelector: () => null,
        querySelectorAll: () => [],
    });

    return {
        localStorage: {
            getItem: (k) => (store.has(k) ? store.get(k) : null),
            setItem: (k, v) => store.set(k, String(v)),
            removeItem: (k) => store.delete(k),
        },
        document: {
            readyState: 'loading',
            head: { appendChild() {} },
            body: { appendChild() {}, contains: () => false },
            documentElement: { style: { setProperty() {} }, clientWidth: 375, clientHeight: 667 },
            createElement: makeElement,
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener() {},
        },
        navigator: { userAgent: 'node', vibrate: () => {} },
        history: { pushState() {}, replaceState() {} },
        location: { href: 'http://localhost/', reload() {} },
        innerWidth: 375,
        innerHeight: 667,
        addEventListener() {},
        requestAnimationFrame: (fn) => fn(),
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        speechSynthesis: null,
        Storage: function () {},
    };
}

test('index.html의 모든 스크립트가 순서대로 오류 없이 로드된다', () => {
    const scripts = scriptOrderFromIndexHtml();
    assert.ok(scripts.length > 10, `스크립트를 못 찾음 (${scripts.length}개)`);

    // 던지면 그대로 실패 — 어떤 파일에서 깨졌는지 스택에 파일명이 찍힌다
    const { evaluate } = loadScripts(scripts, makeDomStubs());

    // 다른 모듈이 전역 이름으로 참조하는 핵심 심볼이 실제로 정의됐는지 확인
    for (const name of ['db', 'game', 'ui', 'shop', 'inventory', 'statistics', 'story', 'secret']) {
        assert.strictEqual(typeof evaluate(name), 'object', `전역 ${name}이(가) 없음`);
    }
    for (const name of [
        'openScreenOverlay',
        'closeScreenOverlay',
        'resetScreenOverlays',
        'showToast',
        'showConfirm',
        'playMusic',
        'pickMonsterSprite',
    ]) {
        assert.strictEqual(
            typeof evaluate(`window.${name}`),
            'function',
            `window.${name}이(가) 없음`
        );
    }
});

test('통계는 데이터셋 ID 키를 사용하고, 이름 키 데이터를 마이그레이션한다', () => {
    const stubs = makeDomStubs();
    // 레거시 저장 형태: 단어장 "이름"이 키
    stubs.localStorage.setItem(
        'v7_stats',
        JSON.stringify({ books: { '능률 보카 중등 기본': { solved: 10, correct: 7 } } })
    );
    stubs.localStorage.setItem(
        'v7_practice_memorized',
        JSON.stringify({ '능률 보카 중등 기본': ['apple|사과'] })
    );

    const { evaluate } = loadScripts(scriptOrderFromIndexHtml(), stubs);

    const books = evaluate('db.stats.books');
    assert.deepStrictEqual(Object.keys(books), ['book-1'], '이름 키가 ID 키로 바뀌어야 함');
    assert.strictEqual(books['book-1'].solved, 10, '기존 수치가 보존되어야 함');

    assert.deepStrictEqual(
        Object.keys(evaluate('db.practiceMemorized')),
        ['book-1'],
        '암기 기록도 ID 키로 바뀌어야 함'
    );

    // getBookStats는 누락된 하위 필드를 보강해서 돌려준다
    const stats = evaluate("db.getBookStats('book-1')");
    assert.strictEqual(stats.objective.solved, 0);
    assert.deepStrictEqual([...stats.subjective.perfectDays], []);
    assert.strictEqual(stats.bossMode.bestWave, 0);
});

test('레거시 최상위 누적 통계는 1번 단어장으로 이관되고 제거된다', () => {
    const stubs = makeDomStubs();
    // 단어장 구분이 없던 시절의 저장 형태
    stubs.localStorage.setItem('v7_stats', JSON.stringify({ solved: 42, correct: 30 }));

    const { evaluate } = loadScripts(scriptOrderFromIndexHtml(), stubs);

    assert.strictEqual(evaluate('db.stats.books["book-1"].solved'), 42);
    assert.strictEqual(evaluate('db.stats.books["book-1"].correct'), 30);
    assert.strictEqual(evaluate('db.stats.solved'), undefined, '레거시 필드는 남으면 안 됨');
});

test('단어장 이름 기록과 같은 레거시 합계가 함께 있어도 누적 통계를 두 번 더하지 않는다', () => {
    const stubs = makeDomStubs();
    stubs.localStorage.setItem(
        'v7_stats',
        JSON.stringify({
            solved: 10,
            correct: 7,
            objective: { solved: 8, correct: 6 },
            subjective: { solved: 2, correct: 1, perfectDays: [] },
            books: {
                '능률 보카 중등 기본': {
                    solved: 10,
                    correct: 7,
                    objective: { solved: 8, correct: 6 },
                    subjective: { solved: 2, correct: 1, perfectDays: [] },
                },
            },
        })
    );
    const { evaluate } = loadScripts(scriptOrderFromIndexHtml(), stubs);
    assert.strictEqual(evaluate('db.getBookStats("book-1").solved'), 10);
    assert.strictEqual(evaluate('db.getBookStats("book-1").correct'), 7);
    assert.strictEqual(evaluate('db.getBookStats("book-1").objective.solved'), 8);
    assert.strictEqual(evaluate('db.getBookStats("book-1").subjective.solved'), 2);
    assert.strictEqual(evaluate('db.stats.solved'), undefined);
});

test('손상된 ID·이름 통계는 레거시 합계 복원을 막지 않고 유효한 단어장 기록을 우선한다', () => {
    for (const invalid of [null, false, '', 0, [], 8, 'invalid']) {
        for (const books of [
            { 'book-1': invalid },
            { '능률 보카 중등 기본': invalid },
            { 'book-1': invalid, '능률 보카 중등 기본': invalid },
            {
                'book-1': invalid,
                '능률 보카 중등 기본': {
                    solved: 8,
                    correct: 6,
                    objective: { solved: 8, correct: 6 },
                },
            },
        ]) {
            const stubs = makeDomStubs();
            stubs.localStorage.setItem(
                'v7_stats',
                JSON.stringify({
                    solved: 8,
                    correct: 6,
                    objective: { solved: 8, correct: 6 },
                    books,
                })
            );
            const { evaluate } = loadScripts(scriptOrderFromIndexHtml(), stubs);
            assert.strictEqual(evaluate('db.getBookStats("book-1").solved'), 8);
            assert.strictEqual(evaluate('db.getBookStats("book-1").correct'), 6);
            assert.strictEqual(evaluate('db.getBookStats("book-1").objective.solved'), 8);
        }
    }
    for (const solved of [0, 2]) {
        const stubs = makeDomStubs();
        stubs.localStorage.setItem(
            'v7_stats',
            JSON.stringify({
                solved: 8,
                correct: 6,
                books: { 'book-1': { solved, correct: solved }, '능률 보카 중등 기본': null },
            })
        );
        const { evaluate } = loadScripts(scriptOrderFromIndexHtml(), stubs);
        assert.strictEqual(evaluate('db.getBookStats("book-1").solved'), solved);
        assert.strictEqual(evaluate('db.getBookStats("book-1").correct'), solved);
    }
});
