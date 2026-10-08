const fs = require('node:fs');
const path = require('node:path');
const { loadScripts, ROOT } = require('./load-module');

function browserRuntime(saved = {}, overrides = {}) {
    const store = new Map(Object.entries(saved));
    const elements = new Map();
    const events = {};
    const timeouts = new Map();
    const intervals = new Map();
    let clock = 0;
    let sequence = 0;
    function element() {
        const classes = new Set();
        const listeners = {};
        return {
            style: { display: 'none', setProperty() {} },
            dataset: {},
            options: [],
            children: [],
            value: '',
            innerText: '',
            textContent: '',
            innerHTML: '',
            get className() {
                return [...classes].join(' ');
            },
            set className(value) {
                classes.clear();
                String(value)
                    .split(/\s+/)
                    .filter(Boolean)
                    .forEach((name) => classes.add(name));
            },
            classList: {
                add: (...names) => names.forEach((n) => classes.add(n)),
                remove: (...names) => names.forEach((n) => classes.delete(n)),
                contains: (n) => classes.has(n),
                toggle: (n, on) => (on ? classes.add(n) : classes.delete(n)),
            },
            open: false,
            showModal() {
                this.open = true;
            },
            close() {
                this.open = false;
            },
            append(...children) {
                this.children.push(...children);
            },
            appendChild(child) {
                this.children.push(child);
            },
            replaceChildren(...children) {
                this.children = children;
            },
            remove() {},
            setAttribute(name, value) {
                this[name] = value;
            },
            focus() {},
            scrollIntoView() {},
            load() {},
            pause() {
                this.paused = true;
            },
            play() {
                this.paused = false;
                return Promise.resolve();
            },
            paused: true,
            querySelector: () => null,
            querySelectorAll: () => [],
            contains: () => true,
            addEventListener: (name, callback) => {
                listeners[name] = callback;
            },
            dispatch(name, event = {}) {
                listeners[name]?.({ target: this, ...event });
            },
            click() {
                if (!this.disabled) this.onclick?.();
            },
        };
    }
    const getElement = (id) => {
        if (!elements.has(id)) {
            const el = element();
            el.id = id;
            el.tagName = [
                'shop-modal',
                'inventory-modal',
                'statistics-modal',
                'setting-modal',
                'result-modal',
                'practice-mode-modal',
                'battle-mode-modal',
                'battle-mode-story-modal',
                'boss-mode-story-modal',
            ].includes(id)
                ? 'DIALOG'
                : 'DIV';
            elements.set(id, el);
        }
        return elements.get(id);
    };
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1]);
    const globals = {
        localStorage: {
            get length() {
                return store.size;
            },
            key(index) {
                return [...store.keys()][index] ?? null;
            },
            getItem: (key) => store.get(key) ?? null,
            setItem: (key, value) => store.set(key, String(value)),
            removeItem: (key) => store.delete(key),
        },
        document: {
            readyState: 'loading',
            head: element(),
            body: element(),
            documentElement: element(),
            createElement: element,
            getElementById: getElement,
            querySelector: (selector) =>
                ['.battle-arena', '.inv-items', '.inv-relics'].includes(selector)
                    ? getElement(selector)
                    : null,
            querySelectorAll: () => [],
            addEventListener() {},
        },
        history: { pushState() {}, replaceState() {} },
        location: { href: 'http://localhost/', reload() {} },
        navigator: { userAgent: 'node' },
        performance: { now: () => clock },
        speechSynthesis: null,
        innerWidth: 375,
        innerHeight: 667,
        Storage: function () {},
        addEventListener: (name, callback) => {
            events[name] = callback;
        },
        MutationObserver: class {
            observe() {}
        },
        requestAnimationFrame: (fn) => fn(),
        setTimeout: (fn, delay = 0) => {
            const id = ++sequence;
            timeouts.set(id, { fn, at: clock + delay });
            return id;
        },
        clearTimeout: (id) => timeouts.delete(id),
        setInterval: (fn) => {
            const id = ++sequence;
            intervals.set(id, fn);
            return id;
        },
        clearInterval: (id) => intervals.delete(id),
        ...overrides,
    };
    const loaded = loadScripts(scripts, globals);
    function advance(ms) {
        const end = clock + ms;
        for (;;) {
            const next = [...timeouts]
                .filter(([, task]) => task.at <= end)
                .sort((a, b) => a[1].at - b[1].at)[0];
            if (!next) break;
            const [id, task] = next;
            clock = task.at;
            timeouts.delete(id);
            task.fn();
        }
        clock = end;
    }
    return { ...loaded, store, getElement, events, advance, timeouts, intervals, html };
}

module.exports = { browserRuntime };
