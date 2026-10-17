const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function runtime(
    userAgent = 'Chrome',
    readyState = 'complete',
    displayMode = 'browser',
    apiFullscreen = false
) {
    const events = {};
    const elements = new Map();
    const registrations = [];
    const context = vm.createContext({
        document: {
            readyState,
            fullscreenElement: apiFullscreen ? {} : null,
            getElementById: (id) => {
                if (!elements.has(id)) elements.set(id, {});
                return elements.get(id);
            },
        },
        window: {
            isSecureContext: true,
            matchMedia: (query) => ({ matches: query === `(display-mode: ${displayMode})` }),
            addEventListener: (name, fn) => {
                events[name] = fn;
            },
        },
        navigator: {
            userAgent,
            serviceWorker: {
                register: async (...args) => {
                    registrations.push(args);
                },
            },
        },
    });
    vm.runInContext(
        fs.readFileSync(path.join(__dirname, '../scripts/features/app-install.js'), 'utf8') +
            '\nglobalThis.api=appInstall;',
        context
    );
    context.api.init();
    return { api: context.api, events, elements, registrations };
}

test('설치 이벤트는 먼저 연결하고 오프라인 사전 저장 등록은 첫 화면 로드 뒤에 한다', () => {
    const r = runtime('Chrome', 'interactive');
    assert.equal(typeof r.events.beforeinstallprompt, 'function');
    assert.equal(r.registrations.length, 0);
    r.events.load();
    assert.equal(r.registrations[0][0], 'sw.js');
});

test('설치 창을 제공하지 않는 iPhone은 공유 메뉴 설치 방법을 안내한다', async () => {
    const r = runtime('iPhone');
    await r.api.install();
    assert.match(r.elements.get('app-install-help').textContent, /Safari.*홈 화면에 추가/);
    assert.equal(r.registrations[0][0], 'sw.js');
});

test('설치 요청을 수락하면 네이티브 창을 한 번 열고 설치 버튼을 잠근다', async () => {
    const r = runtime();
    let opened = 0;
    let prevented = false;
    r.events.beforeinstallprompt({
        preventDefault() {
            prevented = true;
        },
        prompt: async () => {
            opened++;
        },
        userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    await r.api.install();
    await r.api.install();
    assert.ok(prevented);
    assert.equal(opened, 1);
    assert.equal(r.elements.get('app-install-btn').disabled, true);
    assert.equal(r.elements.get('app-install-btn').textContent, '설치됨');
});

test('설치 취소 후 새 설치 이벤트로 다시 시도할 수 있다', async () => {
    const r = runtime();
    let opened = 0;
    for (const outcome of ['dismissed', 'accepted']) {
        r.events.beforeinstallprompt({
            preventDefault() {},
            prompt: async () => {
                opened++;
            },
            userChoice: Promise.resolve({ outcome }),
        });
        await r.api.install();
        assert.equal(r.elements.get('app-install-btn').disabled, outcome === 'accepted');
    }
    assert.equal(opened, 2);
});

test('전체화면으로 설치 실행한 앱은 설치됨으로 인식하되 일반 브라우저의 API 전체화면과 구분한다', () => {
    const app = runtime('Chrome', 'complete', 'fullscreen');
    assert.equal(app.elements.get('app-install-btn').textContent, '설치됨');
    const browser = runtime('Chrome', 'complete', 'fullscreen', true);
    assert.equal(browser.elements.get('app-install-btn').textContent, '앱 설치');
});
