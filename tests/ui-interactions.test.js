const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');

const pool = [
    { day: 1, word: 'apple', meaning: '사과' },
    { day: 1, word: 'banana', meaning: '바나나' },
    { day: 1, word: 'cat', meaning: '고양이' },
    { day: 1, word: 'dog', meaning: '개' },
];

const quiet = { v7_settings: '{"musicPlay":false,"wordRead":false}' };

test('야바위의 동작 줄이기는 이동 애니메이션을 생략하고 같은 최종 컵 위치를 유지한다', () => {
    for (const reduce of [false, true]) {
        const r = browserRuntime(quiet);
        r.sandbox.document.defaultView = {
            matchMedia: () => ({ matches: reduce }),
        };
        const animations = [];
        const createElement = r.sandbox.document.createElement;
        r.sandbox.document.createElement = () => {
            const element = createElement();
            element.animate = (...args) => {
                animations.push(args);
                return { cancel() {} };
            };
            return element;
        };
        const view = r.evaluate('createShellView')({
            document: r.sandbox.document,
            openScreen() {},
            resetScreen() {},
        });
        view.open(
            [
                { color: 'red', number: 1 },
                { color: 'blue', number: 2 },
                { color: 'green', number: 3 },
            ],
            () => {}
        );
        const cups = r.getElement('shell-table').children.slice(1);
        view.swap(0, 2, 0, 2, 540);
        assert.equal(animations.length, reduce ? 0 : 2);
        assert.equal(cups[0].style.left, '66.666%');
        assert.equal(cups[2].style.left, '0%');
        assert.equal(cups[0]['aria-label'], '3번째 컵 선택');
        assert.equal(cups[2]['aria-label'], '1번째 컵 선택');
    }
});

test('동작 줄이기에서는 팝업 닫기 대기 없이 즉시 조작을 돌려준다', () => {
    const r = browserRuntime(quiet, { matchMedia: () => ({ matches: true }) });
    r.getElement('shop-modal').classList.add('screen-overlay');
    r.evaluate('shop.open(); shop.close()');
    assert.equal(r.getElement('shop-modal').open, false);
    assert.equal(r.getElement('shop-modal').style.display, 'none');
});

test('DOM 준비만으로 조작을 초기화하며 뒤따르는 load는 리스너를 중복 등록하지 않는다', () => {
    const r = browserRuntime(quiet);
    for (const listener of r.documentEvents.DOMContentLoaded) listener();
    const clicks = r.documentEvents.click.length;
    const header = r.getElement('battle-header-host').children[0];
    r.sandbox.onload();
    r.sandbox.onload();
    assert.equal(r.documentEvents.click.length, clicks);
    assert.equal(r.getElement('battle-header-host').children[0], header);
    assert.ok(header);
});

test('도전 시작은 닫기 애니메이션을 기다리지 않고 첫 문제를 준비한다', () => {
    const r = browserRuntime(quiet);
    r.sandbox.onload();
    r.getElement('battle-mode-modal-count-select').value = '10';
    r.getElement('battle-mode-modal-day-select').value = '1';
    r.evaluate('openBattleModeModal()');
    r.getElement('battle-mode-modal-start-btn').dispatch('click');
    r.advance(0);
    assert.equal(r.getElement('battle-mode-modal').open, false);
    assert.equal(r.getElement('battle-mode-game').style.display, 'flex');
    assert.ok(r.evaluate('game.currentQ'));
});

test('스토리 지도는 저장 데이터를 각 한 번 읽고 새로 열면 최신 진행을 반영한다', () => {
    const r = browserRuntime(quiet);
    const reads = new Map();
    const original = r.sandbox.localStorage.getItem;
    r.sandbox.localStorage.getItem = (key) => {
        reads.set(key, (reads.get(key) || 0) + 1);
        return original(key);
    };
    r.evaluate('storyJourney.render()');
    for (const suffix of ['stage', 'layout', 'path', 'events']) {
        assert.equal(reads.get(`v7_story_${suffix}_book-1`), 1, suffix);
    }
    r.evaluate('storyJourney.stage = 2; storyJourney.remember(1, 0)');
    const snapshot = r.evaluate('storyJourney.render()');
    assert.equal(snapshot.stage, 2);
    assert.equal(snapshot.path[1], 0);
});

test('게임 보상은 숨겨진 상점·장비 목록을 재생성하지 않고 열 때 최신 내용을 표시한다', () => {
    const r = browserRuntime({ ...quiet, v7_gold: '1000' });
    let shopRenders = 0;
    let inventoryRenders = 0;
    const shop = r.evaluate('shop');
    const inventory = r.evaluate('inventory');
    const renderShop = shop.render;
    const renderInventory = inventory.render;
    shop.render = () => {
        shopRenders++;
        renderShop();
    };
    inventory.render = () => {
        inventoryRenders++;
        renderInventory();
    };
    inventory.grantReward('backpack');
    assert.equal(shopRenders, 0);
    assert.equal(inventoryRenders, 0);
    inventory.open();
    assert.equal(inventoryRenders, 1);
    assert.match(r.getElement('inventory-capacity-summary').textContent, /4칸/);
    shop.open();
    assert.equal(shopRenders, 1);
    assert.match(r.getElement('shop-container').innerHTML, /최대 4칸 → 5칸/);
});

test('스킬 상점은 보유 횟수와 구매 추가 횟수를 구별하고 구매·재실행 후 갱신한다', () => {
    const r = browserRuntime({
        ...quiet,
        v7_gold: '200',
        v7_skills: '{"hint":4,"ultimate":2}',
    });
    const card = () =>
        r.evaluate('shop.createItemHtml(relics.find(item => item.id === "hint"), "skill")');
    assert.match(card(), /보유 4회/);
    assert.match(card(), /구매 시 \+4회/);
    assert.doesNotMatch(card(), /통찰의 포션 \(현재/);
    r.evaluate('shop.open(); shop.buy("hint", "skill")');
    assert.equal(r.evaluate('db.gold'), 176);
    assert.equal(r.evaluate('db.skills.hint'), 8);
    assert.match(r.getElement('shop-container').innerHTML, /보유 8회/);
    assert.match(r.getElement('shop-container').innerHTML, /구매 시 \+4회/);
    const restored = browserRuntime(Object.fromEntries(r.store));
    restored.evaluate('shop.open()');
    assert.match(restored.getElement('shop-container').innerHTML, /보유 8회/);
});

test('건틀릿 잔여 횟수는 아이템 수명과 같은 분모를 표시한다', () => {
    const r = browserRuntime({
        ...quiet,
        v7_equipped: '{"gloves":"goldGlove"}',
        v7_dura: '{"goldGlove":8}',
    });
    r.evaluate('ui.updateSkills()');
    const glove = r.getElement('skill-display').children.find((el) => el.title.includes('건틀릿'));
    assert.match(glove.innerHTML, /8\/10/);
    assert.equal(r.evaluate('items.find(item => item.id === "goldGlove").durability'), 10);
});

test('콤보가 없는 장비 모델에서도 재도전·힌트 항목을 잃지 않는다', () => {
    const r = browserRuntime({
        ...quiet,
        v7_owned: '["basic","shield_item"]',
        v7_equipped: '{"hand-2":"shield_item","head":"helmet"}',
    });
    r.evaluate('game.gear = equipmentRules.load(db.equipped, weapons, null); ui.updateSkills()');
    assert.equal(r.evaluate('game.gear.weapon'), false);
    assert.equal(r.getElement('battle-mode-game').dataset.combo, '');
    assert.ok(
        r.getElement('equipment-display').children.some((el) => el.innerHTML.includes('힌트'))
    );
    assert.ok(
        r.getElement('equipment-display').children.some((el) => el.innerHTML.includes('재도전'))
    );
});

test('변하지 않은 무기 레이어는 골드·장비 UI 갱신에서 같은 이미지 DOM을 유지한다', () => {
    const r = browserRuntime(quiet);
    const root = r.getElement('avatar-cache-test');
    const weapon = r.getElement('avatar-cache-weapon');
    let writes = 0;
    Object.defineProperty(weapon, 'innerHTML', {
        get: () => '',
        set: () => {
            writes++;
        },
    });
    root.querySelectorAll = (selector) =>
        selector === '[data-avatar-part="weapon"]' ? [weapon] : [];
    const render = (id) =>
        r.evaluate('renderEquipmentAvatar')(root, {
            equipped: { 'hand-1': id },
            durability: {},
            weapons: r.evaluate('weapons'),
            items: r.evaluate('items'),
            fallback: null,
        });
    render('basic');
    render('basic');
    assert.equal(writes, 1);
    render('fire');
    assert.equal(writes, 2);
    render(null);
    assert.equal(writes, 3);
    assert.equal(weapon.hidden, true);
});

test('전체 철자 입력은 첫 글자가 빠진 답을 오답으로 처리하고 골드를 주지 않는다', () => {
    const r = browserRuntime();
    r.evaluate('game.battleQuestionType = "subjective"; game.init("battle", 1)');
    r.advance(500);
    const answer = r.evaluate('game.currentQ.word');
    r.getElement('boss-input').value = answer.slice(1);
    r.evaluate('game.checkBossAnswer()');
    assert.equal(r.evaluate('game.subjectiveCorrect'), 0);
    assert.equal(r.evaluate('game.stats.gain'), 0);
    assert.equal(r.evaluate('game.sessionMistakes'), 1);
});

test('연습 필터 선택은 보조기술에도 전달되고 빈 목록의 암기 상태를 초기화한다', () => {
    const r = browserRuntime();
    const chips = ['all', 'memorized', 'not-memorized'].map((value) => {
        const chip = r.getElement(`filter-${value}`);
        chip.getAttribute = (name) => (name === 'data-filter' ? value : null);
        return chip;
    });
    r.sandbox.document.querySelectorAll = (selector) =>
        selector === '#practice-filter-chips .practice-chip' ? chips : [];
    r.evaluate('practiceMemorization.start(1); practiceMemorization.applyFilter("memorized")');
    assert.deepEqual(
        chips.map((chip) => chip['aria-pressed']),
        ['false', 'true', 'false']
    );
    r.getElement('practice-memorized-btn').textContent = '외움 취소';
    r.evaluate('practiceMemorization.applyFilter("memorized")');
    assert.equal(r.getElement('practice-memorized-btn').textContent, '외웠어요');
    assert.equal(r.getElement('practice-memorized-btn')['aria-pressed'], 'false');
});

test('아이템 상세를 닫으면 호출 버튼으로, 렌더 뒤 버튼이 없으면 장비 닫기로 포커스를 복원한다', () => {
    for (const connected of [true, false]) {
        const r = browserRuntime({ v7_inventory: '["helmet"]' });
        const trigger = r.getElement('item-trigger');
        let focused;
        trigger.focus = () => {
            focused = trigger;
        };
        const close = r.getElement('inventory-close');
        close.focus = () => {
            focused = close;
        };
        trigger.isConnected = connected;
        r.sandbox.document.activeElement = trigger;
        r.getElement('inventory-modal').contains = () => true;
        r.getElement('inv-item-detail').contains = () => false;
        r.sandbox.document.querySelector = (selector) =>
            selector === '#inventory-modal .modal-header .modal-close-x' ? close : null;
        r.evaluate('inventory.showDetails("helmet", "item"); inventory.hideDetails()');
        assert.equal(focused, connected ? trigger : close);
    }
});

test('기존 Day 배지가 없는 실제 화면 구조에서도 도전·스토리·사자성어를 시작하고 다음 문제로 진행한다', () => {
    for (const mode of ['battle', 'story', 'idiom-test']) {
        const r = browserRuntime(quiet);
        r.sandbox.rawDataData = pool;
        assert.doesNotMatch(r.html, /id="game-info-badge"/);
        const getElementById = r.sandbox.document.getElementById;
        r.sandbox.document.getElementById = (id) =>
            id === 'game-info-badge' ? null : getElementById(id);
        const day = mode === 'idiom-test' ? 'all' : 1;
        r.evaluate(
            `game.battleQuestionType = 'objective'; game.init('${mode}', '${day}', 'objective')`
        );
        r.advance(400);
        assert.equal(r.evaluate('game.active'), true, mode);
        assert.notEqual(r.getElement('q-text').innerText, '', mode);
        assert.ok(r.getElement('options-box').children.length > 0, mode);
        r.evaluate('game.answerOption(game.options.findIndex(option => option.correct))');
        assert.equal(r.evaluate('game.currentQ.wasCorrect'), true, mode);
        r.advance(800);
        assert.equal(r.evaluate('game.idx'), 1, mode);
        r.evaluate('game.exit()');
        assert.equal(r.evaluate('game.active'), false, mode);
    }
});

test('일반 문제 문구는 동적 변경을 보조기기에 공지한다', () => {
    const r = browserRuntime();
    assert.match(
        r.html,
        /class="q-text"\s+id="q-text"\s+role="status"\s+aria-live="polite"\s+aria-atomic="true"/
    );
});

test('행맨·속담·대장간은 히스토리를 예약하고 뒤의 로비를 비활성화한 뒤 복구한다', () => {
    for (const [start, exit] of [
        ['hangman.start()', 'hangman.exit()'],
        ['storyPuzzle.start("proverb")', 'storyPuzzle.exit()'],
        ['storyPuzzle.start("forge")', 'storyPuzzle.exit()'],
    ]) {
        let pushes = 0;
        const r = browserRuntime(quiet, {
            history: {
                pushState() {
                    pushes++;
                },
                replaceState() {},
            },
        });
        r.evaluate('navigation.init()');
        r.evaluate(start);
        assert.equal(pushes, 1, start);
        assert.equal(r.getElement('title-screen').inert, true, start);
        assert.equal(r.getElement('title-screen').style.display, 'none', start);
        r.evaluate(exit);
        assert.equal(r.getElement('title-screen').inert, false, exit);
        assert.equal(r.getElement('title-screen').style.display, 'flex', exit);
    }
});

test('닫는 중인 팝업은 연속 뒤로 가기를 가로채지 않는다', () => {
    const r = browserRuntime(quiet);
    r.getElement('shop-modal').classList.add('screen-overlay');
    r.evaluate('shop.open(); navigation.back()');
    assert.equal(r.getElement('shop-modal').classList.contains('closing'), true);
    r.evaluate('hangman.start(); navigation.back()');
    assert.equal(r.evaluate('hangman.active'), false);
});
