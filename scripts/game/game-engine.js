// 전투 세션 진행과 부수 효과를 조율한다. 출제 규칙과 DOM은 별도 모듈이 소유한다.
function createBattleSession({
    db,
    ui,
    story,
    journey,
    config: APP_CONFIG,
    questions: questionTools,
    rules: battleRules,
    encounters = null,
    speech = null,
    quests = null,
    equipment = null,
    idioms = null,
    getIdiomTestPool = () => [],
    getSource,
    getDecoys,
    getWeapons,
    getDayLabel,
    screens,
    navigation,
    playMusic,
    pickMonsterSprite,
    syncLayout,
    timers,
    now,
    random = Math.random,
    vibrate,
    notify,
}) {
    const { setTimeout, clearTimeout, setInterval, clearInterval } = timers;
    const {
        open: openScreenOverlay,
        close: closeScreenOverlay,
        reset: resetScreenOverlays,
        entry: GAME_ENTRY_OVERLAYS,
    } = screens;
    const game = {
        list: [],
        idx: 0,
        timer: null,
        timeLeft: 0,
        maxTime: 10,
        deadline: null,
        rewardStartedAt: 0,
        stats: { gain: 0, lost: 0 },
        currentQ: null,
        currentAns: '',
        options: [],
        isProcessing: false,
        mode: 'battle',
        deck: [],
        currentDay: null,
        battleQuestionType: 'monsters',
        encounterHistory: [],
        spellingTiles: [],
        spellingChosen: [],
        listeningReady: false,
        listenRequest: 0,
        subjectiveTotal: 0,
        subjectiveCorrect: 0,
        sessionCorrectObjective: 0,
        sessionWrongWords: [],
        sessionMistakes: 0,
        bossTotalWaves: 0,
        active: false,
        gear: null,
        awaitingRoute: false,
        hadRetry: false,
        sessionId: 0,
        pendingTimeouts: new Set(),
        /** @type {ReturnType<typeof createBattleView> | null} */
        view: null,
        now,

        later(callback, delay) {
            const sessionId = game.sessionId;
            const id = setTimeout(() => {
                game.pendingTimeouts.delete(id);
                if (game.active && game.sessionId === sessionId) callback();
            }, delay);
            game.pendingTimeouts.add(id);
            return id;
        },
        stop() {
            speech?.stop();
            game.listenRequest++;
            game.active = false;
            game.sessionId++;
            clearInterval(game.timer);
            game.timer = null;
            game.deadline = null;
            game.pendingTimeouts.forEach((id) => clearTimeout(id));
            game.pendingTimeouts.clear();
            game.awaitingRoute = false;
            game.currentQ = null;
            game.options = [];
            game.isProcessing = false;
            game.view?.stop();
        },
        exit() {
            const returnToMap = game.mode === 'story';
            if (returnToMap) {
                journey.cancelBattleReturn();
            }
            navigation.track('title-screen');
            game.stop();
            game.view.exit();
            closeScreenOverlay('battle-mode-game', true);
            openScreenOverlay('title-screen', false);
            if (returnToMap) journey.open();
            setTimeout(syncLayout, 100);
        },
        _getRawData: getSource,
        _buildPool: (day, source) => battleRules.buildPool(day, source || game._getRawData()),
        _interleave: (a, b) => battleRules.interleave(a, b),
        _buildBattleList: (pool, count, type, monsterId = null) =>
            ['spelling', 'listening', 'dragon'].includes(type) && encounters
                ? game
                      .shuffle(pool)
                      .slice(0, count)
                      .map((q) =>
                          encounters.prepare(
                              q,
                              monsterId ||
                                  (type === 'spelling'
                                      ? 'goblin'
                                      : type === 'listening'
                                        ? 'bat'
                                        : 'dragon'),
                              type === 'dragon' ? 'riddle' : type
                          )
                      )
                : type === 'monsters' && encounters
                  ? encounters.buildList(pool, count, game.shuffle)
                  : battleRules.buildList(pool, count, type, game.shuffle),
        getDistractors: (correct, key, question = null) =>
            questionTools.getDistractors(correct, key, question, game._getRawData(), getDecoys),
        shuffle: (values) => questionTools.shuffle(values),

        init(mode, day, questionType = 'subjective') {
            if (game.active) return;
            game.stop();
            game.mode = mode;
            if (mode !== 'story') journey?.cancelBattleReturn?.();
            game.currentDay = day;
            closeScreenOverlay('battle-mode-story-modal', true);
            const source =
                mode === 'idiom-test'
                    ? getIdiomTestPool()
                    : mode === 'story'
                      ? journey.battlePool?.() || game._getRawData()
                      : game._getRawData();
            const pool = game._buildPool(day, source);
            const revengeList = mode === 'revenge' ? quests?.ready() || [] : [];
            if (mode === 'revenge' ? !revengeList.length : pool.length < 4) {
                notify('문제 데이터가 부족합니다.', 'error');
                game.exit();
                return;
            }
            const countValue = game.view.readCount();
            const storyCount =
                mode === 'idiom-test' ? 5 : mode === 'story' ? journey.battleCount?.() : null;
            const count =
                Number.isInteger(storyCount) && storyCount > 0
                    ? Math.min(pool.length, storyCount)
                    : countValue === 'all'
                      ? pool.length
                      : parseInt(countValue, 10) || 10;
            game.active = true;
            game.view.lockTitle();
            navigation.track('battle-mode-game');
            game.maxTime = db.has('hourglass')
                ? APP_CONFIG.hourglassSeconds
                : APP_CONFIG.objectiveSeconds;
            if (mode === 'story' && db.has('shadowCompass')) game.maxTime += 3;
            game.hadRetry = false;
            game.gear = equipment?.load(db.equipped, getWeapons(), db.equippedWeapon) || null;
            if (mode === 'story' && game.gear) {
                if (db.has('shadowLantern')) game.gear.hint++;
                if (db.has('wardingSigil')) game.gear.shield++;
            }
            if (game.gear) {
                game.gear.hintMax = game.gear.hint;
                game.gear.shieldMax = game.gear.shield;
            }
            game.stats = { gain: 0, lost: 0 };
            game.idx = 0;
            game.subjectiveCorrect = 0;
            game.sessionCorrectObjective = 0;
            game.sessionMistakes = 0;
            game.sessionWrongWords = [];
            game.encounterHistory = [];
            game.deck =
                mode === 'boss'
                    ? game._buildBattleList(source, source.length, questionType).reverse()
                    : [];
            game.bossTotalWaves = game.deck.length;
            game.list =
                mode === 'revenge'
                    ? revengeList
                    : mode === 'boss'
                      ? []
                      : mode === 'idiom-test' ||
                          (game.battleQuestionType === 'idiom' && mode === 'story')
                        ? idioms.questions(pool, count, game.shuffle)
                        : game._buildBattleList(
                              pool,
                              count,
                              game.battleQuestionType,
                              mode === 'story' ? journey.battleMonsterId?.() : null
                          );
            game.subjectiveTotal = game.list.filter((q) => q.isBoss).length;
            game.later(() => {
                openScreenOverlay('battle-mode-game', false);
                playMusic('battle');
                ui.updateGold();
                ui.updateVisuals();
                syncLayout();
                if (mode === 'story' && game.gear?.boots) {
                    game.awaitingRoute = true;
                    game.view.chooseRoute(game.selectRoute);
                } else game.nextLevel();
            }, APP_CONFIG.overlayCloseMs);
        },
        selectRoute(route) {
            if (!game.active || !game.awaitingRoute || !['safe', 'treasure'].includes(route))
                return;
            game.awaitingRoute = false;
            game.gear.route = route;
            game.maxTime += equipment.routeSeconds(route);
            game.view.closeRoute();
            game.nextLevel();
        },
        recordWrong(question) {
            if (question.questionKind === 'idiom') return;
            quests?.fail(question);
            if (
                !game.sessionWrongWords.some(
                    (q) => q.word === question.word && q.meaning === question.meaning
                )
            )
                game.sessionWrongWords.push({ word: question.word, meaning: question.meaning });
        },
        nextLevel() {
            if (!game.active || game.awaitingRoute) return;
            game.isProcessing = false;
            game.deadline = null;
            clearInterval(game.timer);
            game.timer = null;
            speech?.stop();
            game.listenRequest++;
            game.listeningReady = false;
            if (
                (game.mode !== 'boss' && game.idx >= game.list.length) ||
                (game.mode === 'boss' && !game.deck.length)
            ) {
                story.showEnding(true);
                return;
            }
            game.currentQ = game.mode === 'boss' ? game.deck.pop() : game.list[game.idx];
            game.rewardStartedAt = game.now();
            if (
                game.mode === 'boss' &&
                encounters &&
                game.currentQ.isBoss &&
                !game.currentQ.questionKind
            ) {
                game.currentQ = encounters.prepare(game.currentQ, 'dragon');
            }
            if (game.mode === 'boss') {
                game.encounterHistory.push(game.currentQ);
            }
            const subjective = !!game.currentQ.isBoss;
            ui.updateGameInfo(game.mode, game.currentDay);
            game.beginQuestionView(subjective);
            game.currentAns = game.currentQ.word;
            game.options = [];
            if (game.mode === 'boss' && subjective) game.subjectiveTotal++;
            if (game.currentQ.questionKind) game.renderEncounter(game.currentQ);
            else if (subjective) game.renderBoss(game.currentQ, game.mode === 'boss');
            else game.renderNormal(game.currentQ);
            if (game.currentQ.isBoss) game.view.timer(game.maxTime, game.maxTime, false);
            else if (game.currentQ.questionKind !== 'listening') game.startTimer();
            else game.view.timer(game.maxTime, game.maxTime, false);
            ui.updateSkills();
        },
        beginQuestionView(subjective = false) {
            const data = game.currentQ;
            const monster = encounters?.catalog[data.monsterId];
            const instructions = {
                meaning: '영어 단어의 뜻을 고르세요',
                spelling: '글자 조각을 골라 영어 단어를 완성하세요',
                listening: '발음을 듣고 한국어 뜻을 고르세요',
                cloze: '빈칸에 들어갈 영어 단어를 입력하세요',
                riddle: '설명을 읽고 영어 단어를 입력하세요',
            };
            game.view.beginQuestion(
                monster
                    ? `images/theme/parts/${monster.sprite}.webp`
                    : pickMonsterSprite(data || story.day, subjective),
                game.mode === 'boss'
                    ? `Wave: ${game.idx + 1}`
                    : `${game.idx + 1}/${game.list.length}`,
                monster
                    ? {
                          ...monster,
                          id: data.monsterId,
                          kind: data.questionKind,
                          lesson: data.questionKind === 'cloze' ? '문장 빈칸' : monster.lesson,
                          instruction: instructions[data.questionKind],
                      }
                    : data.questionKind === 'idiom'
                      ? { kind: 'idiom', name: '사자성어' }
                      : null
            );
        },
        renderEncounter(data) {
            if (data.questionKind === 'idiom') {
                game.currentAns = data.word;
                game.options = idioms.options(data, game.list, game.shuffle);
                game.view.objective(data.meaning, game.options, game.answerOption);
                return;
            }
            if (data.questionKind === 'spelling') {
                game.spellingTiles = encounters.spellingTiles(data.word, game.shuffle);
                game.spellingChosen = [];
                game.view.spelling(
                    data.meaning,
                    data.word.replace(/[a-z]/gi, '_'),
                    game.spellingTiles,
                    game.chooseSpellingLetter,
                    game.removeSpellingLetter,
                    game.checkBossAnswer
                );
                game.view.spellingProgress(game.spellingTiles, game.spellingChosen);
                return;
            }
            if (data.questionKind === 'cloze' || data.questionKind === 'riddle') {
                // 영어 예문/수수께끼는 자유 입력보다 철자 조립으로 출제해
                // 모바일 키보드 부담을 줄이고 게임의 기존 철자 타일을 재사용한다.
                game.spellingTiles = encounters.spellingTiles(data.word, game.shuffle);
                game.spellingChosen = [];
                game.view.spelling(
                    data.encounterPrompt || data.englishExplanation || data.meaning,
                    data.word.replace(/[a-z]/gi, '_'),
                    game.spellingTiles,
                    game.chooseSpellingLetter,
                    game.removeSpellingLetter,
                    game.checkBossAnswer
                );
                game.view.spellingProgress(game.spellingTiles, game.spellingChosen);
                return;
            }
            const listening = data.questionKind === 'listening';
            const answer = data.meaning;
            const distractors = game.getDistractors(answer, 'meaning', data);
            // 단어장에 고유한 보기가 적어도 확보한 보기로 풀 수 있게 한다.
            game.currentAns = answer;
            game.options = game
                .shuffle([answer, ...distractors])
                .map((label) => ({ label, correct: label === answer, disabled: listening }));
            if (game.options.length < 2) {
                Object.assign(data, encounters.prepare(data, 'goblin'));
                game.subjectiveTotal++;
                game.beginQuestionView(true);
                game.renderEncounter(data);
                return;
            }
            game.view.objective(
                listening ? '들은 단어의 뜻은 무엇인가요?' : data.word,
                game.options,
                game.answerOption
            );
            if (listening) game.view.listening();
        },
        chooseSpellingLetter(index) {
            if (
                !game.active ||
                game.isProcessing ||
                !encounters?.usesSpelling(game.currentQ?.questionKind) ||
                !Number.isInteger(index) ||
                index < 0 ||
                index >= game.spellingTiles.length ||
                game.spellingChosen.length >=
                    [...game.currentQ.word].filter((letter) => /[a-z]/i.test(letter)).length ||
                game.spellingChosen.includes(index)
            )
                return;
            game.spellingChosen.push(index);
            game.view.spellingProgress(game.spellingTiles, game.spellingChosen);
        },
        removeSpellingLetter() {
            if (
                !game.active ||
                game.isProcessing ||
                !encounters?.usesSpelling(game.currentQ?.questionKind)
            )
                return;
            game.spellingChosen.pop();
            game.view.spellingProgress(game.spellingTiles, game.spellingChosen);
        },
        clearSpelling() {
            if (
                !game.active ||
                game.isProcessing ||
                !encounters?.usesSpelling(game.currentQ?.questionKind)
            )
                return;
            game.spellingChosen = [];
            game.view.spellingProgress(game.spellingTiles, game.spellingChosen);
        },
        listen() {
            if (!game.active || game.isProcessing || game.currentQ?.questionKind !== 'listening')
                return;
            const question = game.currentQ;
            const request = ++game.listenRequest;
            const isCurrent = () =>
                game.active &&
                !game.isProcessing &&
                game.currentQ === question &&
                question.questionKind === 'listening' &&
                request === game.listenRequest;
            const unavailable = () => {
                if (!isCurrent()) return;
                notify('발음 재생이 어려워 슬라임의 뜻 문제로 바꿨습니다.', 'info');
                game.fallbackListening();
            };
            game.view.listeningState('playing', game.options);
            if (!speech) {
                unavailable();
                return;
            }
            speech.play(question.word, true, {
                onReady: () => {
                    if (!isCurrent()) return;
                    game.options.forEach((option) => {
                        if (!game.listeningReady) option.disabled = false;
                    });
                    const firstListen = !game.listeningReady;
                    game.listeningReady = true;
                    game.view.listeningState('ready', game.options);
                    if (firstListen) game.startTimer();
                    ui.updateSkills();
                },
                onUnavailable: unavailable,
            });
            // 음성 엔진이 시작/종료 이벤트 없이 멈춰도 전투가 막히지 않는다.
            game.later(() => {
                if (isCurrent() && !game.listeningReady) unavailable();
            }, 12000);
        },
        fallbackListening() {
            if (!game.active || game.isProcessing || game.currentQ?.questionKind !== 'listening')
                return;
            speech?.stop();
            game.listenRequest++;
            Object.assign(game.currentQ, encounters.prepare(game.currentQ, 'slime'));
            game.beginQuestionView();
            game.renderEncounter(game.currentQ);
            if (game.currentQ.isBoss) game.view.timer(game.maxTime, game.maxTime, false);
            else if (game.deadline === null) game.startTimer();
            ui.updateSkills();
        },
        renderNormal(data) {
            const isKor = random() < 0.5;
            const answer = isKor ? data.word : data.meaning;
            const distractors = game.getDistractors(answer, isKor ? 'word' : 'meaning', data);
            if (distractors.length < 3) {
                if (game.currentQ === data) {
                    data.isBoss = true;
                    game.subjectiveTotal++;
                }
                game.currentAns = data.word;
                game.renderBoss(data, false);
                return;
            }
            game.currentAns = answer;
            game.options = game
                .shuffle([answer, ...distractors])
                .map((label) => ({ label, correct: label === answer, disabled: false }));
            game.view.objective(isKor ? data.meaning : data.word, game.options, game.answerOption);
        },
        renderBoss(data, isBoss) {
            const title = isBoss
                ? `🔥 WAVE ${game.idx + 1}`
                : game.idx === game.list.length - 1
                  ? '⚠️ BOSS BATTLE'
                  : '⚔️ ELITE';
            game.view.subjective(
                data,
                title,
                battleRules.spellingHint(data.word),
                game.checkBossAnswer
            );
        },
        answerOption(index) {
            if (!game.active || game.isProcessing || game.currentQ?.isBoss) return;
            if (game.currentQ?.questionKind === 'listening' && !game.listeningReady) return;
            const option = game.options[index];
            if (option && !option.disabled) game.handleAnswer(option.correct, index);
        },
        checkBossAnswer() {
            if (!game.active || !game.currentQ || game.isProcessing || !game.currentQ.isBoss)
                return;
            const assembling = encounters?.usesSpelling(game.currentQ.questionKind);
            if (
                assembling &&
                game.spellingChosen.length !==
                    [...game.currentQ.word].filter((letter) => /[a-z]/i.test(letter)).length
            )
                return;
            const input = assembling
                ? encounters.spellingAnswer(
                      game.currentQ.word,
                      game.spellingTiles,
                      game.spellingChosen
                  )
                : game.view.readAnswer();
            game.handleAnswer(
                game.currentQ.questionKind
                    ? encounters.checkAnswer(input, game.currentQ.word)
                    : battleRules.checkSpelling(input, game.currentQ.word),
                null
            );
        },
        remainingTime() {
            return game.deadline === null
                ? game.timeLeft
                : Math.max(0, (game.deadline - game.now()) / 1000);
        },
        handleAnswer(isCorrect, selectedIndex) {
            if (!game.active || !game.currentQ || game.isProcessing) return;
            const timed = !game.currentQ.isBoss;
            if (timed) {
                game.timeLeft = game.remainingTime();
                // 늦게 도착한 클릭도 마감 후라면 시간 초과로 처리한다.
                if (game.deadline !== null && game.timeLeft <= 0) {
                    isCorrect = false;
                    selectedIndex = null;
                }
            }
            if (!isCorrect) game.sessionMistakes++;
            if (!isCorrect && game.mode !== 'boss' && game.gear?.shield > 0) {
                game.hadRetry = true;
                game.gear.shield--;
                game.gear.combo = 0;
                game.recordWrong(game.currentQ);
                game.isProcessing = true;
                speech?.stop();
                game.listenRequest++;
                clearInterval(game.timer);
                game.timer = null;
                game.deadline = null;
                if (
                    selectedIndex !== null &&
                    selectedIndex !== undefined &&
                    game.options[selectedIndex]
                )
                    game.options[selectedIndex].disabled = true;
                game.spellingChosen = [];
                if (encounters?.usesSpelling(game.currentQ.questionKind))
                    game.view.spellingProgress(game.spellingTiles, []);
                game.view.shieldBlock(selectedIndex);
                game.view.floatText('방패 방어! 다시 도전', 'gold');
                ui.updateSkills();
                const question = game.currentQ;
                const retryTime = Math.max(5, game.timeLeft);
                game.later(() => {
                    if (game.currentQ !== question) return;
                    game.isProcessing = false;
                    game.rewardStartedAt = game.now();
                    game.view.retry(game.options);
                    if (timed) game.startTimer(retryTime);
                    ui.updateSkills();
                }, 800);
                return;
            }
            if (game.gear) {
                const combo = equipment.combo(game.gear, isCorrect);
                game.gear.combo = combo.combo;
                game.currentQ.comboBonus = combo.bonus;
            }
            game.isProcessing = true;
            speech?.stop();
            game.listenRequest++;
            game.currentQ.wasCorrect = isCorrect;
            clearInterval(game.timer);
            game.timer = null;
            game.deadline = null;
            const questionType = timed ? 'objective' : 'subjective';
            if (game.currentQ.questionKind !== 'idiom') db.addStats(isCorrect, questionType);
            if (isCorrect && questionType === 'objective') game.sessionCorrectObjective++;
            if (isCorrect && questionType === 'subjective') game.subjectiveCorrect++;
            if (!isCorrect) game.recordWrong(game.currentQ);
            game.view.feedback(isCorrect, selectedIndex, !isCorrect && game.mode === 'boss');
            ui.updateSkills();
            if (isCorrect) {
                const weapon =
                    getWeapons().find((w) => w.id === db.equippedWeapon) ||
                    getWeapons().find((w) => w.id === 'basic');
                const secondary = getWeapons().find((w) => w.id === db.equipped['hand-2']);
                game.view.attack({
                    weaponId: weapon.id,
                    effect: weapon.effect || 'basic',
                    secondaryEffect:
                        secondary && secondary.id !== 'shield_item' ? secondary.effect : null,
                    combo: Boolean(game.currentQ.comboBonus),
                });
                const questBonus =
                    game.mode === 'revenge' ? quests?.succeed(game.currentQ) || 0 : 0;
                const baseGain = battleRules.reward({
                    mode: game.mode,
                    subjective: !!game.currentQ.isBoss,
                    timeLeft: game.timeLeft,
                    maxTime: game.maxTime,
                    elapsedSeconds: Math.max(0, (game.now() - game.rewardStartedAt) / 1000),
                    multiplier: weapon.multiplier || 1,
                    glove: db.equipped?.gloves === 'goldGlove' && db.durability.goldGlove > 0,
                });
                const routeBonus = equipment?.routeBonus(baseGain, game.gear?.route) || 0;
                const comboBonus = game.currentQ.comboBonus || 0;
                const gain =
                    game.mode === 'idiom-test'
                        ? 0
                        : baseGain + routeBonus + comboBonus + questBonus;
                if (weapon.multiplier > 1) game.view.goldAttack();
                if (
                    game.mode !== 'idiom-test' &&
                    db.equipped?.gloves === 'goldGlove' &&
                    db.durability.goldGlove > 0
                )
                    db.useItem('goldGlove');
                game.stats.gain += gain;
                db.addGold(gain);
                const rewardDetails = [
                    `정답 +${baseGain}`,
                    ...(routeBonus ? [`보물 +${routeBonus}`] : []),
                    ...(comboBonus ? [`연속 +${comboBonus}`] : []),
                    ...(questBonus ? [`퀘스트 +${questBonus}`] : []),
                ];
                game.view.floatText(
                    game.mode === 'idiom-test' ? '정답!' : `+${gain} G`,
                    'gold',
                    comboBonus || routeBonus || questBonus ? rewardDetails.join(' · ') : ''
                );
                game.later(() => {
                    game.idx++;
                    game.nextLevel();
                }, 800);
            } else {
                game.view.reveal(
                    game.currentAns,
                    questionType === 'subjective',
                    game.options.findIndex((option) => option.correct)
                );
                if (game.mode === 'boss') {
                    game.view.floatText('GAME OVER', 'red');
                    game.later(() => story.showEnding(false), 2500);
                    return;
                }
                game.view.hit();
                vibrate(200);
                const penalty =
                    game.mode === 'idiom-test' ? 0 : battleRules.penalty(db.gold, db.has('shield'));
                game.stats.lost += penalty;
                db.subGold(penalty);
                game.view.floatText(game.mode === 'idiom-test' ? '오답' : `-${penalty} G`, 'red');
                game.later(() => {
                    game.idx++;
                    game.nextLevel();
                }, 2500);
            }
        },
        useEquipmentHint() {
            if (
                !game.active ||
                !game.currentQ ||
                game.isProcessing ||
                !game.gear?.hint ||
                (game.currentQ.questionKind === 'listening' && !game.listeningReady)
            )
                return;
            if (game.deadline !== null && game.remainingTime() <= 0) {
                game.handleAnswer(false, null);
                return;
            }
            if (!game.currentQ.isBoss) {
                const wrong = game.options.flatMap((q, i) =>
                    !q.correct && !q.disabled ? [i] : []
                );
                const count = battleRules.hintRemovalCount(wrong.length);
                if (!count) return;
                const indices = game.shuffle(wrong).slice(0, count);
                indices.forEach((i) => {
                    game.options[i].disabled = true;
                });
                game.view.disableOptions(indices);
            } else game.view.equipmentHint(equipment.hint(game.currentQ.word));
            game.gear.hint--;
            ui.updateSkills();
        },
        useHint() {
            if (
                !game.active ||
                !game.currentQ ||
                game.isProcessing ||
                game.currentQ.isBoss ||
                (game.currentQ.questionKind === 'listening' && !game.listeningReady) ||
                db.skills.hint <= 0
            )
                return;
            if (game.deadline !== null && game.remainingTime() <= 0) {
                game.handleAnswer(false, null);
                return;
            }
            const wrong = game.options.flatMap((option, index) =>
                !option.correct && !option.disabled ? [index] : []
            );
            const count = battleRules.hintRemovalCount(wrong.length);
            if (!count) return;
            const indices = game.shuffle(wrong).slice(0, count);
            indices.forEach((index) => {
                game.options[index].disabled = true;
            });
            db.skills.hint--;
            db.save('skills');
            game.view.disableOptions(indices);
            ui.updateSkills();
        },
        useUltimate() {
            if (
                !game.active ||
                !game.currentQ ||
                game.isProcessing ||
                game.currentQ.isBoss ||
                (game.currentQ.questionKind === 'listening' && !game.listeningReady) ||
                db.skills.ultimate <= 0
            )
                return;
            const index = game.options.findIndex((option) => option.correct && !option.disabled);
            if (index < 0) return;
            // 만료된 문제에서 소모품을 쓰거나 정답 보상을 받지 않는다.
            if (game.deadline !== null && game.remainingTime() <= 0) {
                game.handleAnswer(false, null);
                return;
            }
            db.skills.ultimate--;
            db.save('skills');
            game.answerOption(index);
            ui.updateSkills();
        },
        startTimer(seconds = game.maxTime) {
            clearInterval(game.timer);
            game.timeLeft = seconds;
            game.deadline = game.now() + seconds * 1000;
            game.view.timer(game.timeLeft, game.maxTime);
            const sessionId = game.sessionId;
            const question = game.currentQ;
            game.timer = setInterval(() => {
                if (
                    !game.active ||
                    game.isProcessing ||
                    sessionId !== game.sessionId ||
                    question !== game.currentQ
                )
                    return;
                game.timeLeft = game.remainingTime();
                game.view.timer(game.timeLeft, game.maxTime);
                if (game.timeLeft <= 0) game.handleAnswer(false, null);
            }, 100);
        },
        end(win) {
            if (!game.active) return;
            if (game.mode === 'story' && win)
                win =
                    journey.canComplete?.(
                        game.subjectiveCorrect + game.sessionCorrectObjective,
                        game.list.length,
                        game.sessionMistakes
                    ) ?? win;
            if (game.mode === 'story' && win)
                journey.completeBattle({ mistakes: game.sessionMistakes });
            resetScreenOverlays(GAME_ENTRY_OVERLAYS);
            openScreenOverlay('title-screen', false);
            openScreenOverlay('result-modal', true);
            game.view.results(
                win,
                game.mode,
                game.stats,
                db.gold,
                battleRules.resultRows(game, win),
                game.sessionWrongWords,
                game.hadRetry
            );
            game._saveSessionRecords();
            game.stop();
            game.mode = 'battle';
            game.currentDay = null;
        },
        _saveSessionRecords() {
            if (game.mode === 'boss') db.recordBossWave(game.idx);
            if (
                game.mode !== 'revenge' &&
                !game.hadRetry &&
                game.subjectiveTotal > 0 &&
                game.subjectiveCorrect === game.subjectiveTotal
            ) {
                const day = game.currentDay || 'all';
                db.recordPerfectDay(day, game.dayLabel(day));
            }
        },
        dayLabel(day) {
            if (day === 'all') return '전체';
            if (day === 'boss') return '보스 모드';
            return getDayLabel(day) || `Day ${day}`;
        },
    };
    return game;
}
