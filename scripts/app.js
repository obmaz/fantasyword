/** 구성 루트. 런타임 서비스와 세션의 연결은 이 파일 한 곳에서 수행한다. */
const haptics = createHaptics({
    getSettings: () => db.settings,
    vibrate: (duration) => navigator.vibrate?.(duration) ?? false,
});
/** 설정은 공유하고 재생·취소 상태는 세션마다 분리한다. */
function createGameSpeech() {
    return createPracticeSpeech({
        getSynth: () => window.speechSynthesis,
        createUtterance: (text) =>
            typeof window.SpeechSynthesisUtterance === 'function'
                ? new window.SpeechSynthesisUtterance(text)
                : null,
        getVoice: getPreferredTTSVoice,
        playRemote: playGoogleTTS,
        notify: showToast,
        getMusic: () => document.getElementById('background-music'),
    });
}
const game = createBattleSession({
    db,
    ui,
    story,
    journey: storyJourney,
    config: APP_CONFIG,
    questions: questionTools,
    rules: battleRules,
    encounters: monsterEncounters,
    quests: revengeQuests,
    equipment: equipmentRules,
    idioms: idiomRules,
    getIdiomTestPool: () =>
        idiomRules.pool(
            storyIdioms,
            Number(document.getElementById('idiom-test-level').value) || 1
        ),
    speech: createGameSpeech(),
    getSource: () => window.rawDataData || rawData,
    getDecoys: (...args) => window.getDecoyWordCandidates?.(...args) || [],
    getWeapons: () => weapons,
    getDayLabel: (day) => dayCatalog[day]?.label,
    screens: {
        open: openScreenOverlay,
        close: closeScreenOverlay,
        reset: resetScreenOverlays,
        entry: GAME_ENTRY_OVERLAYS,
    },
    navigation,
    playMusic,
    pickMonsterSprite,
    syncLayout: () => syncScreenLayout(),
    timers: { setTimeout, clearTimeout, setInterval, clearInterval },
    now: () => performance.now(),
    random: () => Math.random(),
    vibrate: () => haptics.error(),
    notify: showToast,
});
game.view = createBattleView({
    document,
    attacks: battleAttackProfiles,
    schedule: game.later,
    escapeHTML,
    openScreen: openScreenOverlay,
    closeScreen: closeScreenOverlay,
});

const practiceMemorization = createPracticeSession({
    db,
    getSource: () => window.rawDataData || rawData,
    getWrongWords: () => game.sessionWrongWords,
    view: createPracticeView({
        document,
        openScreen: openScreenOverlay,
        closeScreen: closeScreenOverlay,
        syncLayout: syncGameScreenSize,
        track: (screen) => navigation.track(screen),
        schedule: setTimeout,
    }),
    speech: createGameSpeech(),
    notify: showToast,
    resetResult: () => {
        storyJourney.cancelBattleReturn();
        resetScreenOverlay('result-modal');
    },
    playMusic,
});

const skyfall = createSkyfallSession({
    onMistake: () => haptics.error(),
    db,
    grantReward: (id) => inventory.grantReward(id),
    getSource: () => window.rawDataData || rawData,
    questions: questionTools,
    rules: battleRules,
    view: createSkyfallView({
        document,
        openScreen: openScreenOverlay,
        closeScreen: closeScreenOverlay,
        syncLayout: syncGameScreenSize,
        timers: { setTimeout, clearTimeout },
    }),
    playMusic,
    pauseMusic: () => {
        const music = document.getElementById('background-music');
        music.pause();
        music.currentTime = 0;
    },
    requestFrame: (callback) =>
        window.requestAnimationFrame
            ? window.requestAnimationFrame(callback)
            : setTimeout(callback, 16),
    cancelFrame: (id) => {
        if (window.cancelAnimationFrame) window.cancelAnimationFrame(id);
        else clearTimeout(id);
    },
    now: () => performance.now(),
    notify: showToast,
});

const shellGame = createShellSession({
    onMistake: () => haptics.error(),
    view: createShellView({
        document,
        openScreen: openScreenOverlay,
        resetScreen: resetScreenOverlay,
    }),
    random: () => Math.random(),
    timers: { setTimeout, clearTimeout },
    onOpen: () => {
        cancelPendingGameStart();
        playMusic('shell');
    },
    onExit: () => document.getElementById('background-music').pause(),
});

const storyPuzzle = createStoryPuzzleSession({
    onMistake: () => haptics.error(),
    view: createStoryPuzzleView({
        document,
        openScreen: openScreenOverlay,
        resetScreen: resetScreenOverlay,
        combat: createBattleView({
            document,
            attacks: battleAttackProfiles,
            schedule: setTimeout,
            escapeHTML,
            elementPrefix: 'puzzle-',
            arenaSelector: '#puzzle-combat-scene',
        }),
        combatants: {
            render() {
                renderEquipmentAvatar(document.getElementById('puzzle-hero-wrapper'), {
                    equipped: db.equipped,
                    durability: db.durability,
                    weapons,
                    items,
                    fallback: null,
                });
                document.getElementById('puzzle-monster-img').src =
                    'images/theme/parts/monster-slime.webp';
                document.getElementById('puzzle-monster-img').alt = '슬라임';
            },
            attack() {
                const weapon = weapons.find((w) => w.id === db.equippedWeapon) || weapons[0];
                const secondary = weapons.find((w) => w.id === db.equipped['hand-2']);
                return {
                    weaponId: weapon.id,
                    effect: weapon.effect || 'basic',
                    secondaryEffect:
                        secondary && secondary.id !== 'shield_item' ? secondary.effect : null,
                };
            },
        },
    }),
    rules: storyPuzzleRules,
    proverbs: storyProverbs,
    paths: wordForgePaths,
    words: wordForgeWords,
    wordMeanings: wordForgeMeanings,
    shuffle: questionTools.shuffle,
    onOpen: () => {
        cancelPendingGameStart();
        playMusic('puzzle');
    },
    onExit: () => document.getElementById('background-music').pause(),
});
