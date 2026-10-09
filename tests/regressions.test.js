const test = require('node:test');
const assert = require('node:assert/strict');
const { browserRuntime } = require('./helpers/browser-runtime');

test('손상된 저장 데이터와 잘못된 타입이 초기 로딩을 막지 않고 유효한 골드를 보존한다', () => {
    const { evaluate } = browserRuntime({
        v7_gold: '1234',
        v7_owned: '{broken',
        v7_inventory: '{}',
        v7_equipped: '[]',
        v7_skills: '{"hint":-2,"ultimate":"3"}',
        v7_settings: 'null',
        v7_stats:
            '{"books":{"book-1":null,"book-2":{"solved":5,"correct":9,"subjective":{"perfectDays":{}}}}}',
        v7_practice_memorized: '{"book-1":false}',
    });
    assert.equal(evaluate('db.gold'), 1234);
    assert.deepEqual([...evaluate('db.owned')], ['basic']);
    assert.equal(evaluate('db.inventory.length'), 0);
    assert.equal(evaluate('db.skills.hint'), 0);
    assert.equal(evaluate('db.skills.ultimate'), 3);
    assert.equal(evaluate('db.settings.wordRead'), true);
    assert.equal(evaluate('db.getBookStats("book-1").solved'), 0);
    assert.equal(evaluate('db.getBookStats("book-2").correct'), 5);
    assert.equal(evaluate('db.getBookStats("book-2").subjective.perfectDays.length'), 0);
});

test('저장소 접근 거부/용량 초과 중에도 게임 진행과 UI 업데이트를 계속한다', () => {
    const { evaluate, store } = browserRuntime(
        {},
        {
            localStorage: {
                getItem() {
                    throw new Error('SecurityError');
                },
                setItem() {
                    throw new Error('QuotaExceededError');
                },
            },
        }
    );
    assert.equal(evaluate('db.gold'), 0);
    assert.equal(evaluate('db.addGold(40)'), 40);
    assert.equal(evaluate('gameStorage.warned'), true);
    assert.equal(store.size, 0);
    evaluate('db.addStats(true, "objective")');
    assert.equal(evaluate('db.getBookStats().correct'), 1);
});

test('알 수 없는 단어장 이름 기록을 1번 단어장에 잘못 합산하지 않는다', () => {
    const { evaluate } = browserRuntime({
        v7_stats: JSON.stringify({ books: { '이름이 바뀐 단어장': { solved: 8, correct: 6 } } }),
        v7_practice_memorized: JSON.stringify({ '이름이 바뀐 단어장': ['apple|사과'] }),
    });
    assert.equal(evaluate('db.stats.books["이름이 바뀐 단어장"].solved'), 8);
    assert.equal(evaluate('db.getBookStats("book-1").solved'), 0);
    assert.equal(evaluate('db.practiceMemorized["이름이 바뀐 단어장"].length'), 1);
});

test('누적 정답 수가 없어도 레거시 보스/퍼펙트 기록을 보존한다', () => {
    const { evaluate } = browserRuntime({
        v7_stats: JSON.stringify({ bossMode: { bestWave: 12 } }),
    });
    assert.equal(evaluate('db.getBookStats("book-1").bossMode.bestWave'), 12);
});

test('정답/오답 처리 직후 나가면 예약된 다음 문제와 엔딩이 실행되지 않는다', () => {
    for (const mode of ['battle', 'boss']) {
        for (const correct of [true, false]) {
            const r = browserRuntime();
            r.evaluate(`game.init('${mode}', '${mode === 'boss' ? 'boss' : 'all'}')`);
            r.advance(400);
            const game = r.evaluate('game');
            game.handleAnswer(correct, null, mode === 'boss' ? 'subjective' : 'objective');
            const solved = r.evaluate('db.getBookStats().solved');
            game.exit();
            r.advance(4000);
            assert.equal(game.idx, 0);
            assert.equal(game.active, false);
            assert.equal(r.getElement('result-modal').style.display, 'none');
            assert.equal(r.intervals.size, 0);
            game.checkBossAnswer();
            assert.equal(r.evaluate('db.getBookStats().solved'), solved);
        }
    }
});

test('빠른 재시작 시 이전 판 콜백이 새 판의 문제 번호를 바꾸지 않는다', () => {
    const r = browserRuntime();
    const game = r.evaluate('game');
    game.init('boss', 'boss');
    r.advance(400);
    game.handleAnswer(true, null, 'subjective');
    game.exit();
    game.init('boss', 'boss');
    r.advance(4000);
    assert.equal(game.idx, 0);
    assert.equal(game.active, true);
    assert.equal(game.isProcessing, false);
});

test('전체 단어 도전은 선택한 문제 유형으로 단어장 전체를 중복 없이 출제한다', () => {
    for (const type of ['objective', 'subjective', 'mixed', 'monsters']) {
        const r = browserRuntime();
        r.evaluate(`game.init('boss', '1', '${type}')`);
        const game = r.evaluate('game');
        const size = r.evaluate('rawData.length');
        assert.equal(game.deck.length, size);
        const key = (q) => JSON.stringify([q.day, q.word, q.meaning]);
        assert.deepEqual(
            Array.from(game.deck, key).sort(),
            Array.from(r.evaluate('rawData'), key).sort()
        );
        if (type === 'objective') assert.ok(game.deck.every((q) => !q.isBoss));
        if (type === 'subjective') assert.ok(game.deck.every((q) => q.isBoss));
        if (type === 'mixed')
            assert.ok(game.deck.some((q) => q.isBoss) && game.deck.some((q) => !q.isBoss));
        if (type === 'monsters') assert.ok(game.deck.every((q) => q.questionKind));
    }
});

test('전체 단어 도전의 객관식은 정답 진행 후 첫 오답에 방패 재시도 없이 종료한다', () => {
    const r = browserRuntime();
    r.evaluate("game.init('boss', 'all', 'objective')");
    r.advance(400);
    const game = r.evaluate('game');
    const correct = game.options.findIndex((q) => q.correct);
    game.answerOption(correct);
    r.advance(800);
    assert.equal(game.idx, 1);
    assert.equal(game.sessionCorrectObjective, 1);
    assert.ok(game.deadline !== null);
    game.gear = { shield: 1, combo: 0 };
    game.answerOption(game.options.findIndex((q) => !q.correct));
    assert.equal(game.hadRetry, false);
    assert.equal(game.gear.shield, 1);
    r.advance(2500);
    assert.equal(game.active, false);
    assert.equal(r.getElement('result-modal').open, true);
});

test('전체 단어 도전의 객관식 제한 시간이 끝나도 첫 실패로 종료한다', () => {
    const r = browserRuntime();
    r.evaluate("game.init('boss', 'all', 'objective')");
    r.advance(400);
    const game = r.evaluate('game');
    r.advance(game.maxTime * 1000);
    for (const callback of r.intervals.values()) callback();
    r.advance(2600);
    assert.equal(game.active, false);
    assert.equal(game.idx, 0);
});

test('시작 애니메이션 도중 뒤로 가면 게임 진입이 취소된다', () => {
    const r = browserRuntime();
    r.evaluate('navigation.init()');
    r.evaluate('game.init("boss", "boss")');
    r.events.popstate({});
    r.advance(1000);
    assert.equal(r.evaluate('game.active'), false);
    assert.equal(r.getElement('battle-mode-game').style.display, 'none');
});

test('모달을 닫자마자 다시 열어도 이전 닫기 타이머가 새 모달을 숨기지 않는다', () => {
    const r = browserRuntime();
    r.getElement('shop-modal').classList.add('screen-overlay');
    r.evaluate(
        'openScreenOverlay("shop-modal"); closeScreenOverlay("shop-modal"); openScreenOverlay("shop-modal")'
    );
    r.advance(500);
    assert.equal(r.getElement('shop-modal').style.display, 'flex');
});

test('단어가 적은 Day에서 많은 문제를 골라도 혼합형이 번갈아 출제된다', () => {
    const { evaluate } = browserRuntime();
    const list = evaluate('game._buildBattleList(rawData.slice(0, 7), 20, "mixed")');
    assert.equal(list.length, 7);
    assert.equal(list.filter((q) => q.isBoss).length, 3);
    for (let i = 1; i < list.length; i++) assert.notEqual(list[i].isBoss, list[i - 1].isBoss);
});

test('전체 문제 선택값을 배틀 모달 재열기 시 복원한다', () => {
    const r = browserRuntime({ v7_last_count: 'all', v7_last_question_type: '"broken[' });
    r.getElement('battle-mode-modal-count-select').options = [
        { value: '10' },
        { value: '20' },
        { value: 'all' },
    ];
    r.evaluate('openBattleModeModal()');
    assert.equal(r.getElement('battle-mode-modal-count-select').value, 'all');
});

test('구매는 카탈로그 가격을 사용하고 중복/없는 상품을 결제하지 않는다', () => {
    const r = browserRuntime({ v7_gold: '5000' });
    r.evaluate('inventory.render = () => {}; shop.render = () => {}');
    const shop = r.evaluate('shop');
    shop.buy('fire', 'weapon');
    assert.equal(r.evaluate('db.gold'), 4700);
    shop.buy('fire', 'weapon');
    shop.buy('missing', 'skill');
    assert.equal(r.evaluate('db.gold'), 4700);
    assert.equal(r.evaluate('db.owned.filter((id) => id === "fire").length'), 1);
});

test('유물/무기 포함 보관함이 가득 찼으면 장비 해제를 거부한다', () => {
    const r = browserRuntime({
        v7_owned: '["basic","fire","ice","hourglass"]',
        v7_inventory: '["helmet"]',
        v7_equipped: '{"hand-1":"fire"}',
        v7_equip: 'fire',
    });
    r.evaluate('inventory.render = () => {}; shop.render = () => {}');
    assert.equal(r.evaluate('inventory.getStoredCount()'), 3);
    r.evaluate('inventory.unequip("hand-1")');
    assert.equal(r.evaluate('db.equippedWeapon'), 'fire');
    assert.equal(r.evaluate('inventory.getStoredCount()'), 3);
});

test('가득 찬 보관함에서도 무기를 교체하고 같은 무기의 손 이동 시 복제하지 않는다', () => {
    const r = browserRuntime({
        v7_owned: '["basic","fire","ice","hourglass"]',
        v7_inventory: '["helmet"]',
        v7_equipped: '{"hand-1":"fire"}',
        v7_equip: 'fire',
    });
    r.evaluate('inventory.render = () => {}; shop.render = () => {}');
    r.evaluate('inventory.equip("ice", "weapon", "hand-1")');
    assert.equal(r.evaluate('db.equippedWeapon'), 'ice');
    assert.equal(r.evaluate('inventory.getStoredCount()'), 3);
    r.evaluate('inventory.equip("ice", "weapon", "hand-2")');
    assert.equal(r.evaluate('db.equipped["hand-1"]'), undefined);
    assert.equal(r.evaluate('db.equipped["hand-2"]'), 'ice');
    r.evaluate('inventory.equip("void", "weapon")');
    assert.equal(r.evaluate('db.has("void")'), false);
});

test('연습 자동 읽기는 설정을 따르고 빈 필터/나가기는 발화를 취소한다', () => {
    const r = browserRuntime();
    r.evaluate('practiceMemorization.fullPool = rawData.slice(0, 2)');
    let reads = 0,
        stops = 0;
    const practice = r.evaluate('practiceMemorization');
    practice.playTTS = () => reads++;
    practice.stopSpeech = () => stops++;
    practice.applyFilter('all');
    assert.equal(reads, 1);
    practice.next();
    assert.equal(reads, 2);
    practice.toggleExplanationLang();
    assert.equal(reads, 2);
    r.evaluate('db.settings.wordRead = false');
    practice.prev();
    assert.equal(reads, 2);
    const stopsBeforeEmpty = stops;
    practice.applyFilter('memorized');
    assert.equal(stops, stopsBeforeEmpty + 1);
    assert.equal(r.getElement('practice-memorized-btn').disabled, true);
    const stopsBeforeExit = stops;
    practice.exit();
    assert.equal(stops, stopsBeforeExit + 1);
});

test('동일한 질문에 대응하는 다른 정답을 오답으로 출제하지 않는다', () => {
    const r = browserRuntime();
    r.evaluate(`window.rawDataData = [
        { word: 'big', meaning: '큰' }, { word: 'large', meaning: '큰' },
        { word: 'small', meaning: '작은' }, { word: 'cold', meaning: '차가운' }, { word: 'hot', meaning: '뜨거운' }
    ]; window.getDecoyWordCandidates = () => ['large', 'small', 'cold', 'hot'];`);
    const options = r.evaluate('game.getDistractors("big", "word", window.rawDataData[0])');
    assert.equal(options.length, 3);
    assert.ok(!options.includes('large'));
});

test('인쇄 시 보기가 부족하면 중복 정답 객관식 대신 주관식으로 출력하고 HTML을 이스케이프한다', () => {
    let output;
    const r = browserRuntime(
        {},
        {
            Blob: class {
                constructor(parts) {
                    output = parts.join('');
                }
            },
            URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
            open() {},
        }
    );
    r.getElement('print-day-select').value = '1';
    const radio = { value: 'objective' };
    r.sandbox.document.querySelector = (selector) =>
        selector.includes('print-question-type') ? radio : null;
    r.evaluate(`window.rawDataData = [{ day: 1, word: '<b>word&</b>', meaning: '<i>뜻&</i>' }];
        window.getDecoyWordCandidates = () => []; secret.closePrintDaySelect = () => {}; secret.generatePrintHTML();`);
    assert.ok(output.includes('&lt;b&gt;word&amp;&lt;/b&gt;'));
    assert.ok(output.includes('&lt;i&gt;뜻&amp;&lt;/i&gt;'));
    assert.ok(!output.includes('undefined'));
    assert.ok(!output.includes('<b>word&</b>'));
    assert.ok(output.includes('subjective-answer'));
});

test('통계 기록의 텍스트를 HTML로 실행하지 않고 그대로 표시한다', () => {
    const r = browserRuntime({
        v7_stats: JSON.stringify({
            books: {
                'book-1': {
                    subjective: {
                        perfectDays: [
                            {
                                day: 1,
                                date: '2026-10-06',
                                dayLabel: '<img src=x onerror=alert(1)>',
                                displayDate: 'A&B',
                            },
                        ],
                    },
                },
            },
        }),
    });
    r.evaluate('statistics.render()');
    const html = r.getElement('statistics-container').innerHTML;
    assert.ok(html.includes('&lt;img'));
    assert.ok(html.includes('A&amp;B'));
    assert.ok(!html.includes('<img'));
});

test('음악 재생 실패 시 토글 버튼이 일시정지 아이콘에 머물지 않는다', async () => {
    const r = browserRuntime();
    const button = r.getElement('music-toggle');
    r.sandbox.document.querySelectorAll = (selector) =>
        selector === '.music-toggle-btn' ? [button] : [];
    r.getElement('background-music').play = () => Promise.reject(new Error('NotAllowedError'));
    r.evaluate('playMusic("battle")');
    await Promise.resolve();
    assert.equal(button.innerText, '▶️');
    assert.equal(button.dataset.musicState, 'off');
    assert.equal(button['aria-pressed'], 'false');
    assert.match(button['aria-label'], /OFF/);
    assert.ok(!r.html.includes('id="background-music" loop'));
});

test('음악의 재생·정지·오류 상태가 두 게임의 ON/OFF 표시에 함께 반영된다', () => {
    const r = browserRuntime();
    const buttons = ['battle-music-toggle-btn', 'practice-music-toggle-btn'].map(r.getElement);
    r.sandbox.document.querySelectorAll = (selector) =>
        selector === '.music-toggle-btn' ? buttons : [];
    r.evaluate('setupMusicSelectListeners()');
    const audio = r.getElement('background-music');
    assert.ok(buttons.every((button) => button.dataset.musicState === 'off'));
    audio.onplay();
    assert.ok(buttons.every((button) => button.dataset.musicState === 'on'));
    assert.ok(buttons.every((button) => button['aria-pressed'] === 'true'));
    audio.onpause();
    assert.ok(buttons.every((button) => button.dataset.musicState === 'off'));
    audio.onplay();
    audio.onerror();
    assert.ok(buttons.every((button) => button.dataset.musicState === 'off'));
    assert.ok(buttons.every((button) => button.title.includes('OFF')));
});

test('마지막 곡 선택 후 재생이 거부되면 곡은 선택하되 OFF 상태를 유지한다', async () => {
    const r = browserRuntime();
    const button = r.getElement('battle-music-toggle-btn');
    r.sandbox.document.querySelectorAll = (selector) =>
        selector === '.music-toggle-btn' ? [button] : [];
    r.getElement('background-music').play = () => Promise.reject(new Error('NotAllowedError'));
    r.evaluate('setupMusicSelectListeners()');
    const select = r.getElement('music-select');
    select.value = '20';
    select.dispatch('change');
    await Promise.resolve();
    assert.equal(r.getElement('background-music').src, 'data/background_music_20.mp3');
    assert.equal(r.evaluate('currentMusicIndices.battle'), 20);
    assert.equal(button.dataset.musicState, 'off');
    assert.equal(button['aria-pressed'], 'false');
    select.value = '999';
    select.dispatch('change');
    assert.equal(r.getElement('background-music').src, 'data/background_music_20.mp3');
});

test('초기 진입 시 저장된 골드를 타이틀에 표시한다', () => {
    const r = browserRuntime({ v7_gold: '300', v7_last_day: 'all' });
    for (const id of [
        'day-select',
        'practice-mode-modal-day-select',
        'battle-mode-modal-day-select',
    ]) {
        r.getElement(id).options = [{ value: 'all' }];
    }
    r.sandbox.onload();
    assert.equal(r.getElement('title-ui-gold').innerText, 300);
});

test('레거시 장착 무기를 손 슬롯에 복원하고 해제할 수 있다', () => {
    const r = browserRuntime({ v7_owned: '["fire"]', v7_equip: 'fire' });
    assert.equal(r.evaluate('db.equipped["hand-1"]'), 'fire');
    assert.equal(r.evaluate('db.has("basic")'), true);
    r.evaluate('inventory.render = () => {}; inventory.unequipWeapon()');
    assert.equal(r.evaluate('db.equippedWeapon'), 'basic');
    assert.equal(r.evaluate('db.equipped["hand-1"]'), undefined);
});

test('객관식 대신 주관식으로 대체된 문제도 결과 성적에 포함한다', () => {
    const r = browserRuntime();
    r.evaluate(
        'game.active = true; game.mode = "battle"; game.battleQuestionType = "objective"; game.list = [{ isBoss: true }]; game.subjectiveCorrect = 1; game.end(true)'
    );
    assert.ok(r.getElement('res-record').innerHTML.includes('1/1'));
    assert.ok(r.getElement('res-record').innerHTML.includes('주관식'));
});
