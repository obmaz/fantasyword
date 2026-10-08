const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');
const { loadScripts } = require('./helpers/load-module');

test('타이틀은 여섯 순열을 표시하고 직전 제목을 반복하지 않는다', () => {
    const variants = ['킹왕짱', '왕짱킹', '킹짱왕', '왕킹짱', '짱킹왕', '짱왕킹'];
    for (let index = 0; index < variants.length; index++) {
        const title = { textContent: '' };
        const logo = { dataset: {} };
        const document = { getElementById: (id) => (id === 'title-logo' ? logo : title) };
        const runtime = loadScripts(['scripts/ui/layout-manager.js'], { document });
        runtime.evaluate(`Math.random = () => ${(index + 0.5) / variants.length}`);
        runtime.sandbox.rotateGameTitle();
        assert.equal(title.textContent, variants[index]);
        assert.equal(document.title, `${variants[index]} RPG`);
        assert.equal(logo.dataset.variant, String(index));
        runtime.sandbox.rotateGameTitle();
        assert.notEqual(title.textContent, variants[index]);
        assert.equal(variants[Number(logo.dataset.variant)], title.textContent);
    }
});

test('학습에서 제목으로 돌아오면 타이틀을 바꾸고 메뉴를 열고 닫을 때는 유지한다', () => {
    const runtime = browserRuntime();
    runtime.sandbox.onload();
    const title = runtime.getElement('title-header-text');
    const first = title.textContent;
    const firstBackground = runtime.getElement('title-background').src;
    runtime.evaluate("openScreenOverlay('practice-mode-game', false)");
    runtime.evaluate("openScreenOverlay('title-screen', false)");
    assert.notEqual(title.textContent, first);
    assert.notEqual(runtime.getElement('title-background').src, firstBackground);
    assert.equal(
        ['킹왕짱', '왕짱킹', '킹짱왕', '왕킹짱', '짱킹왕', '짱왕킹'][
            Number(runtime.getElement('title-logo').dataset.variant)
        ],
        title.textContent
    );
    const returned = title.textContent;
    const returnedBackground = runtime.getElement('title-background').src;
    runtime.evaluate("openScreenOverlay('shop-modal', false)");
    runtime.evaluate("closeScreenOverlay('shop-modal', false)");
    assert.equal(title.textContent, returned);
    assert.equal(runtime.getElement('title-background').src, returnedBackground);
});

test('너비 변경 시 게임 높이를 새 뷰포트로 갱신하고 높이만 변하면 키보드 크기에 맞춰 축소하지 않는다', () => {
    const r = browserRuntime();
    r.sandbox.onload();
    r.sandbox.innerHeight = 400;
    r.events.resize();
    r.advance(100);
    assert.equal(r.evaluate('getLockedAppHeight()'), 667);
    r.sandbox.innerWidth = 667;
    r.sandbox.innerHeight = 375;
    r.events.resize();
    r.advance(100);
    assert.equal(r.evaluate('getLockedAppHeight()'), 375);
    assert.equal(r.getElement('practice-mode-game').style.height, '375px');
    assert.equal(r.getElement('practice-mode-game').style.width, '281.25px');
    assert.equal(r.getElement('battle-mode-game').style.width, '281.25px');
    let titleWidth;
    r.sandbox.document.documentElement.style.setProperty = (name, value) => {
        if (name === '--title-container-width') titleWidth = value;
    };
    r.sandbox.syncScreenLayout();
    assert.equal(titleWidth, '281.25px');
    r.sandbox.innerHeight = 250;
    r.events.resize();
    r.advance(100);
    assert.equal(r.getElement('battle-mode-game').style.height, '375px');
    r.sandbox.innerWidth = 375;
    r.sandbox.innerHeight = 667;
    r.events.resize();
    r.advance(100);
    assert.equal(r.getElement('battle-mode-game').style.width, '375px');
});

test('전체화면 전환은 높이만 바뀌어도 로비와 플레이 크기를 함께 갱신한다', async () => {
    const r = browserRuntime();
    const document = r.sandbox.document;
    const events = {};
    document.addEventListener = (name, callback) => (events[name] = callback);
    document.fullscreenEnabled = true;
    document.documentElement.requestFullscreen = async () => {
        document.fullscreenElement = document.documentElement;
        r.sandbox.innerHeight = 800;
        events.fullscreenchange();
    };
    document.exitFullscreen = async () => {
        document.fullscreenElement = null;
        r.sandbox.innerHeight = 667;
        events.fullscreenchange();
    };
    r.sandbox.onload();
    await r.sandbox.toggleFullscreen();
    assert.equal(r.evaluate('getLockedAppHeight()'), 800);
    assert.equal(r.getElement('battle-mode-game').style.height, '800px');
    await r.sandbox.toggleFullscreen();
    assert.equal(r.evaluate('getLockedAppHeight()'), 667);
    assert.equal(r.getElement('practice-mode-game').style.height, '667px');
});

test('로비와 플레이는 세로가 더 긴 최대 3:4 비율을 유지한다', () => {
    const r = browserRuntime();
    for (const [width, height] of [
        [1024, 768],
        [768, 1024],
        [1280, 800],
        [1600, 900],
        [844, 390],
        [390, 844],
    ]) {
        r.sandbox.innerWidth = width;
        r.sandbox.innerHeight = height;
        r.sandbox.initAppHeight(true);
        r.sandbox.syncScreenLayout();
        const expectedWidth = Math.min(width, (height * 3) / 4);
        assert.equal(r.getElement('battle-mode-game').style.width, `${expectedWidth}px`);
        assert.equal(r.getElement('practice-mode-game').style.height, `${height}px`);
        assert.equal(r.sandbox.document.documentElement.dataset.layout, 'portrait');
    }
});

test('데스크톱에서는 높이만 변경해도 창 크기에 맞추고 입력 중에는 유지한다', () => {
    const r = browserRuntime({}, { matchMedia: () => ({ matches: true }) });
    r.sandbox.onload();
    r.sandbox.innerHeight = 800;
    r.events.resize();
    r.advance(100);
    assert.equal(r.getElement('battle-mode-game').style.height, '800px');
    r.sandbox.document.activeElement = { matches: () => true };
    r.sandbox.innerHeight = 400;
    r.events.resize();
    r.advance(100);
    assert.equal(r.getElement('battle-mode-game').style.height, '800px');
});

test('전체화면 진입·종료·거부 뒤에도 팝업 순서와 입력 상태를 유지한다', async () => {
    const stack = [];
    const dialogs = ['shop', 'detail'].map((id) => ({
        id,
        open: true,
        style: { display: 'flex' },
        classList: { contains: () => false },
        value: '입력 유지',
        close() {
            this.open = false;
            stack.push('close:' + id);
        },
        showModal() {
            this.open = true;
            stack.push('show:' + id);
        },
    }));
    let restoredFocus = 0;
    const document = {
        fullscreenEnabled: true,
        activeElement: { focus: () => restoredFocus++ },
        getElementById: () => null,
        querySelectorAll: (selector) =>
            selector.startsWith('dialog[open]') ? dialogs.filter((dialog) => dialog.open) : [],
        documentElement: {
            requestFullscreen: async () => {
                assert.ok(dialogs.every((dialog) => !dialog.open));
                stack.push('fullscreen');
                document.fullscreenElement = document.documentElement;
            },
        },
        exitFullscreen: async () => {
            stack.push('exit');
            document.fullscreenElement = null;
        },
    };
    const runtime = loadScripts(['scripts/ui/layout-manager.js'], { document, showToast() {} });
    await runtime.sandbox.toggleFullscreen();
    assert.deepEqual(stack, [
        'close:shop',
        'close:detail',
        'fullscreen',
        'show:shop',
        'show:detail',
    ]);
    stack.length = 0;
    await runtime.sandbox.toggleFullscreen();
    assert.deepEqual(stack, ['close:shop', 'close:detail', 'exit', 'show:shop', 'show:detail']);
    document.documentElement.requestFullscreen = async () => {
        throw new Error('Denied');
    };
    await runtime.sandbox.toggleFullscreen();
    assert.ok(dialogs.every((dialog) => dialog.open && dialog.value === '입력 유지'));
    assert.equal(restoredFocus, 3);
});

test('거부된 전체화면 요청은 재시도를 막지 않고 지원하지 않는 브라우저에서는 요청하지 않는다', async () => {
    const r = browserRuntime();
    const document = r.sandbox.document;
    let requests = 0;
    document.fullscreenEnabled = true;
    document.documentElement.requestFullscreen = async () => {
        requests++;
        throw new Error('Permission denied');
    };
    await r.sandbox.toggleFullscreen();
    await r.sandbox.toggleFullscreen();
    assert.equal(requests, 2);
    document.fullscreenEnabled = false;
    await r.sandbox.toggleFullscreen();
    assert.equal(requests, 2);
});

function objectiveGame() {
    const runtime = browserRuntime({ v7_settings: '{"musicPlay":false,"wordRead":false}' });
    const game = runtime.evaluate('game');
    runtime.getElement('count-select').value = '10';
    game.battleQuestionType = 'objective';
    game.init('battle', 'all');
    runtime.advance(400);
    return { ...runtime, game };
}

test('전투 진행은 DOM 없는 렌더러를 주입해 시작·채점·종료할 수 있다', () => {
    const pool = Array.from({ length: 4 }, (_, index) => ({
        word: `word${index}`,
        meaning: `뜻${index}`,
        day: 1,
    }));
    const scheduled = [];
    const commands = [];
    const db = {
        gold: 0,
        equipped: {},
        equippedWeapon: 'basic',
        has: () => false,
        addStats() {},
        recordPerfectDay() {},
        addGold(value) {
            this.gold += value;
        },
    };
    const globals = {
        document: new Proxy(
            {},
            {
                get() {
                    throw new Error('엔진에서 DOM 조회');
                },
            }
        ),
        rawData: pool,
        rawDataData: pool,
        db,
        weapons: [{ id: 'basic', multiplier: 1, effect: 'basic' }],
        APP_CONFIG: { objectiveSeconds: 10, hourglassSeconds: 15, overlayCloseMs: 400 },
        setTimeout: (callback) => {
            scheduled.push(callback);
            return scheduled.length;
        },
        clearTimeout() {},
        setInterval: () => 1,
        clearInterval() {},
        performance: { now: () => 0 },
        navigator: {},
        navigation: { track() {} },
        closeScreenOverlay() {},
        openScreenOverlay() {},
        resetScreenOverlays() {},
        GAME_ENTRY_OVERLAYS: [],
        playMusic() {},
        syncGameScreenSizeToTitle() {},
        pickMonsterSprite: () => 'monster.webp',
        ui: { updateGold() {}, updateVisuals() {}, updateSkills() {}, updateGameInfo() {} },
        story: {},
    };
    const { evaluate } = loadScripts(
        [
            'scripts/domain/questions.js',
            'scripts/domain/battle-rules.js',
            'scripts/game/game-engine.js',
        ],
        globals
    );
    const game = evaluate('createBattleSession')({
        ...globals,
        config: globals.APP_CONFIG,
        questions: evaluate('questionTools'),
        rules: evaluate('battleRules'),
        getSource: () => pool,
        getWeapons: () => globals.weapons,
        getDayLabel: () => null,
        screens: {
            open: globals.openScreenOverlay,
            close: globals.closeScreenOverlay,
            reset: globals.resetScreenOverlays,
            entry: [],
        },
        timers: globals,
        now: () => 0,
        syncLayout() {},
        vibrate() {},
        notify() {},
    });
    game.view = new Proxy(
        {},
        {
            get: (_, name) =>
                name === 'readCount' ? () => '4' : (...args) => commands.push([name, ...args]),
        }
    );
    game.battleQuestionType = 'subjective';
    game.init('battle', 1);
    scheduled.shift()();
    assert.equal(game.currentQ.isBoss, true);
    game.handleAnswer(true, null);
    assert.equal(db.gold, 30);
    game.end(true);
    assert.equal(game.active, false);
    assert.ok(commands.some(([name]) => name === 'subjective'));
    assert.ok(commands.some(([name]) => name === 'results'));
});

test('타이머 콜백이 지연되어도 실제 남은 시간으로 보상을 계산한다', () => {
    const r = objectiveGame();
    r.advance(3000);
    r.game.answerOption(r.game.options.findIndex((option) => option.correct));
    assert.equal(r.game.timeLeft, 7);
    assert.equal(r.game.stats.gain, 15);
});

test('마감 후 늦은 정답 클릭은 시간 초과 오답으로 한 번만 기록한다', () => {
    const r = objectiveGame();
    const correct = r.game.options.findIndex((option) => option.correct);
    const tick = [...r.intervals.values()][0];
    r.advance(11000);
    r.game.answerOption(correct);
    tick();
    r.game.answerOption(correct);
    assert.equal(r.game.timeLeft, 0);
    assert.equal(r.game.stats.gain, 0);
    assert.equal(r.game.sessionWrongWords.length, 1);
    assert.equal(r.evaluate('db.getBookStats().solved'), 1);
});

test('지연된 타이머 갱신은 실제 마감 시각을 넘으면 오답 처리한다', () => {
    const r = objectiveGame();
    const tick = [...r.intervals.values()][0];
    r.advance(10001);
    tick();
    assert.equal(r.game.isProcessing, true);
    assert.equal(r.game.sessionWrongWords.length, 1);
    assert.equal(r.getElement('overlay-timer').style.width, '0%');
});

test('스킬은 버튼 텍스트/표시 상태 대신 문제와 보기 모델로 판단한다', () => {
    const r = objectiveGame();
    r.evaluate('db.skills.hint = 3; db.skills.ultimate = 1');
    r.getElement('options-box').style.display = 'none';
    r.game.useHint();
    r.game.useHint();
    r.game.useHint();
    assert.equal(r.evaluate('db.skills.hint'), 2);
    assert.equal(r.game.options.filter((option) => option.disabled).length, 2);
    assert.equal(r.game.options.filter((option) => !option.disabled).length, 2);
    r.game.useUltimate();
    assert.equal(r.evaluate('db.skills.ultimate'), 0);
    assert.equal(r.game.sessionCorrectObjective, 1);
});

test('주관식·마감된 문제에서는 스킬을 소모하지 않는다', () => {
    const r = objectiveGame();
    r.evaluate('db.skills.hint = 2; db.skills.ultimate = 2');
    r.game.currentQ.isBoss = true;
    r.game.useHint();
    r.game.useUltimate();
    r.game.currentQ.isBoss = false;
    r.advance(11000);
    r.game.useUltimate();
    r.game.useHint();
    assert.equal(r.evaluate('db.skills.hint'), 2);
    assert.equal(r.evaluate('db.skills.ultimate'), 2);
    assert.equal(r.game.stats.gain, 0);
});

test('이전 문제의 버튼과 시각 효과 예약은 다음 문제를 변경하지 않는다', () => {
    const r = objectiveGame();
    const oldButton = r
        .getElement('options-box')
        .children.find((button) => button.innerText === r.game.currentAns);
    r.game.answerOption(r.game.options.findIndex((option) => option.correct));
    r.advance(800);
    const solved = r.evaluate('db.getBookStats().solved');
    oldButton.click();
    assert.equal(r.evaluate('db.getBookStats().solved'), solved);
    r.game.answerOption(r.game.options.findIndex((option) => option.correct));
    r.advance(300);
    assert.equal(r.getElement('hero-wrapper').classList.contains('hero-active'), true);
    assert.equal(r.getElement('monster-img').classList.contains('mob-active'), true);
});

test('철자 힌트/채점은 한 글자·구문·빈 입력을 일관되게 처리한다', () => {
    const r = browserRuntime();
    const rules = r.evaluate('battleRules');
    assert.equal(rules.spellingHint('get up'), 'g__ u_');
    assert.equal(rules.spellingHint('a'), '_');
    assert.equal(rules.checkSpelling(' GET UP ', 'get up'), true);
    assert.equal(rules.checkSpelling('et up', 'get up'), true);
    assert.equal(rules.checkSpelling('', 'a'), false);
    assert.equal(rules.checkSpelling('a', 'a'), true);
    assert.equal(rules.checkSpelling('et p', 'get up'), false);
});

test('이전 골드 표시의 제거 예약은 다음 정답의 표시를 지우지 않는다', () => {
    const r = objectiveGame();
    r.game.answerOption(r.game.options.findIndex((option) => option.correct));
    r.advance(800);
    r.game.answerOption(r.game.options.findIndex((option) => option.correct));
    r.advance(200);
    assert.equal(r.getElement('dmg-txt').classList.contains('float-up'), true);
    r.game.exit();
    r.advance(1500);
    assert.equal(r.getElement('dmg-txt').classList.contains('float-up'), false);
});

test('오답 복습은 중복을 제거하고 원본 설명과 뜻 가리기를 유지한다', () => {
    const r = browserRuntime({ v7_settings: '{"musicPlay":false,"wordRead":false}' });
    const word = r.evaluate('rawData[0]');
    r.evaluate(
        'game.sessionWrongWords = [rawData[0], rawData[0], rawData[1]]; openScreenOverlay("result-modal"); practiceMemorization.reviewWrongWords()'
    );
    assert.equal(r.getElement('result-modal').open, false);
    assert.equal(r.getElement('practice-mode-game').style.display, 'flex');
    assert.equal(r.evaluate('practiceMemorization.words.length'), 2);
    assert.equal(
        r.evaluate('practiceMemorization.words[0].englishExplanation'),
        word.englishExplanation
    );
    assert.equal(r.getElement('practice-memorization-day-info').textContent, '이번 판 오답 복습');
    r.evaluate('practiceMemorization.start(1)');
    assert.ok(r.evaluate('practiceMemorization.words.length') > 2);
});

test('미암기 필터에서 외움 표시 후 처음으로 돌아가지 않고 다음 단어를 보여준다', () => {
    const r = browserRuntime({ v7_settings: '{"musicPlay":false,"wordRead":false}' });
    r.evaluate(
        'practiceMemorization.start(1); practiceMemorization.applyFilter("not-memorized"); practiceMemorization.showWord(2)'
    );
    const next = r.evaluate('practiceMemorization.words[3].word');
    r.evaluate('practiceMemorization.toggleMemorized()');
    assert.equal(r.evaluate('practiceMemorization.currentIndex'), 2);
    assert.equal(r.getElement('practice-word-text').textContent, next);
});

test('연습 시작은 배틀 문제 수 선택값을 덮어쓰지 않는다', () => {
    const r = browserRuntime({ v7_last_count: '20' });
    r.evaluate('window.onload()');
    r.getElement('practice-mode-modal-day-select').value = '1';
    r.getElement('practice-mode-modal-start-btn').dispatch('click');
    assert.equal(r.store.get('v7_last_count'), '20');
});

test('브라우저 발음 미지원 시 원격 폴백을 실행하고 자동 읽기는 알림을 반복하지 않는다', () => {
    let remoteRequests = 0;
    const r = browserRuntime(
        {},
        {
            Audio: class {
                constructor() {
                    remoteRequests++;
                }
                play() {
                    return Promise.resolve();
                }
                pause() {}
            },
        }
    );
    r.evaluate('practiceMemorization.start(1); practiceMemorization.playTTS(true)');
    assert.equal(r.getElement('practice-mode-game').style.display, 'flex');
    assert.equal(remoteRequests, 2);
    const container = r.evaluate(
        'document.body.children.find(node => node.className === "app-toast-container")'
    );
    assert.equal(container, undefined);
});

test('취소된 통계 초기화 확인창의 늦은 응답은 새 관리 요청을 덮어쓰지 않는다', async () => {
    const r = browserRuntime();
    let answer;
    r.sandbox.showConfirm = () =>
        new Promise((resolve) => {
            answer = resolve;
        });
    r.evaluate('secret.resetStatistics(); secret.pendingAction()');
    const replacement = () => {};
    r.evaluate('secret').pendingAction = replacement;
    answer(false);
    await Promise.resolve();
    assert.equal(r.evaluate('secret.pendingAction'), replacement);
});

test('Day 선택 목록은 60일 제한 대신 실제 데이터의 유효한 Day를 사용한다', () => {
    const r = browserRuntime();
    r.evaluate(
        'dayCatalog[61] = { label: "Day 61" }; dayCatalog["Infinity"] = { label: "invalid" }; initSelections()'
    );
    const html = r.getElement('battle-mode-modal-day-select').innerHTML;
    assert.ok(html.includes('value="61"'));
    assert.ok(!html.includes('value="Infinity"'));
});
