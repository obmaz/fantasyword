// 런타임 정책. 저장 키는 기존 사용자 데이터 호환성을 위해 유지한다.
const APP_CONFIG = Object.freeze({
    overlayCloseMs: 160,
    gameStartDelayMs: 0,
    musicTrackCount: 20,
    musicVolume: 0.4,
    objectiveSeconds: 10,
    hourglassSeconds: 15,
    gameScreenIds: Object.freeze([
        'battle-mode-game',
        'practice-mode-game',
        'skyfall-mode-game',
        'hangman-game',
        'shell-game',
        'story-puzzle-game',
    ]),
});

/** 장비의 표시·데이터·보상에서 공유하는 수치. */
const EQUIPMENT_CONFIG = Object.freeze({
    gloveUses: 10,
    gloveMultiplier: 1.5,
    comboEvery: 3,
    safeRouteSeconds: 5,
    treasureRate: 0.1,
});

const HAPTICS_CONFIG = Object.freeze({
    defaultDuration: 200,
    durations: Object.freeze([80, 200, 350]),
});

const PRESENTATION_CONFIG = Object.freeze({
    encounterMs: 650,
    monsterWindupMs: 160,
    reactionMs: 460,
    rewardMs: 1800,
    equipMs: 700,
    maxVoices: 20,
    soundVolume: 0.12,
    particleCount: 9,
});
