/** 구성 루트. 런타임 서비스와 세션의 연결은 이 파일 한 곳에서 수행한다. */
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
    speech: createPracticeSpeech({
        getSynth: () => window.speechSynthesis,
        createUtterance: (text) =>
            typeof window.SpeechSynthesisUtterance === 'function'
                ? new window.SpeechSynthesisUtterance(text)
                : null,
        getVoice: getPreferredTTSVoice,
        playRemote: playGoogleTTS,
        notify: showToast,
        getMusic: () => document.getElementById('background-music'),
    }),
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
    vibrate: (duration) => navigator.vibrate?.(duration),
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
    speech: createPracticeSpeech({
        getSynth: () => window.speechSynthesis,
        createUtterance: (text) =>
            typeof window.SpeechSynthesisUtterance === 'function'
                ? new window.SpeechSynthesisUtterance(text)
                : null,
        getVoice: getPreferredTTSVoice,
        playRemote: playGoogleTTS,
        notify: showToast,
        getMusic: () => document.getElementById('background-music'),
    }),
    notify: showToast,
    resetResult: () => resetScreenOverlay('result-modal'),
    playMusic,
});
