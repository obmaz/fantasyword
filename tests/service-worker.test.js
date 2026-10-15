const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function runtime({ cacheFails = '', offline = false } = {}) {
    const events = {};
    const writes = [];
    const lookups = [];
    const cache = {
        async match(key, options) {
            if (cacheFails === 'match') throw new Error('cache unavailable');
            lookups.push({ key, options });
            return key === 'index.html' ? new Response('offline shell') : undefined;
        },
        async put(key, value) {
            if (cacheFails === 'put') throw new Error('quota exceeded');
            writes.push([key, await value.text()]);
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8'), {
        URL,
        Response,
        self: {
            location: { origin: 'https://example.test' },
            registration: { scope: 'https://example.test/app/' },
            addEventListener(name, handler) {
                events[name] = handler;
            },
        },
        caches: {
            async open() {
                if (cacheFails === 'open') throw new Error('cache unavailable');
                return cache;
            },
        },
        async fetch() {
            if (offline) throw new Error('offline');
            return new Response('network content');
        },
    });
    return {
        writes,
        lookups,
        request(relative, mode = 'navigate') {
            let response;
            events.fetch({
                request: {
                    url: new URL(relative, 'https://example.test/app/').href,
                    mode,
                    method: 'GET',
                    headers: new Headers(),
                },
                respondWith(value) {
                    response = value;
                },
            });
            return response;
        },
    };
}

test('PWA 캐시 열기·쓰기 실패는 정상 온라인 화면·스크립트를 폐기하지 않는다', async () => {
    for (const cacheFails of ['open', 'put', 'match']) {
        for (const [url, mode] of [
            ['./', 'navigate'],
            ['scripts/app.js?v=new', 'cors'],
        ]) {
            const r = runtime({ cacheFails });
            const response = await r.request(url, mode);
            assert.equal(await response.text(), 'network content', `${cacheFails} ${url}`);
        }
    }
});

test('다른 HTML·데이터 파일을 열어도 오프라인 시작 화면을 덮어쓰지 않는다', () => {
    const r = runtime();
    assert.equal(r.request('data/game-data-1.js'), undefined);
    assert.equal(r.request('another-page.html'), undefined);
    assert.equal(r.request('../outside/'), undefined);
    assert.equal(r.writes.length, 0);
});

test('오프라인 시작은 캐시된 앱을 사용하고 캐시도 실패하면 응답 오류로 종료한다', async () => {
    const r = runtime({ offline: true });
    assert.equal(await (await r.request('./?home=1')).text(), 'offline shell');
    const missing = runtime({ offline: true, cacheFails: 'open' });
    assert.equal((await missing.request('index.html')).type, 'error');
});

test('버전이 있는 스크립트는 이전 버전과 매칭하지 않고 동적 이미지만 쿼리 없이 찾는다', async () => {
    const r = runtime();
    await r.request('scripts/app.js?v=new', 'cors');
    assert.equal(r.lookups[0].options.ignoreSearch, false);
    await r.request('images/monster.webp', 'cors');
    assert.equal(r.lookups[1].options.ignoreSearch, true);
});
