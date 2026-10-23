/**
 * 데이터베이스 관리 시스템
 * localStorage를 사용한 게임 데이터 저장 및 관리
 * - 골드, 아이템, 장비, 통계, 스킬 등 모든 게임 데이터 관리
 */

/**
 * 단어장별 기록의 저장 키를 만든다.
 *
 * 표시 이름(gameDataName_N)이 아니라 **데이터셋 ID**를 키로 쓴다.
 * 이름을 키로 쓰면 `data/game-data-N.js`에서 제목을 한 글자만 고쳐도
 * 그 단어장의 누적 통계와 암기 기록이 통째로 유실된다.
 */
function makeBookKey(dataSetId) {
    return `book-${dataSetId || '1'}`;
}

/** 현재 활성 데이터셋의 저장 키 */
function currentBookKey() {
    const id = typeof window !== 'undefined' ? window.currentGameDataSetId : null;
    return makeBookKey(id);
}

/**
 * 레거시 키(단어장 "이름")를 데이터셋 ID 키로 바꾼다.
 * 이름 → ID 매핑은 로드된 `gameDataName_N` 전역에서 찾고, 실패하면 원래 이름 키를 보존한다.
 * @param {Object} byName - { '단어장 이름': value } 형태의 기존 저장 객체
 * @param {(a:any,b:any)=>any} merge - 같은 키로 합쳐질 때 값을 병합하는 함수
 * @returns {Object} { 'book-N': value }
 */
function migrateBookKeys(byName, merge) {
    const out = Object.create(null);
    if (!isRecord(byName)) return out;

    const nameToId = Object.create(null);
    if (typeof window !== 'undefined') {
        for (let i = 1; i <= 10; i++) {
            const name = window[`gameDataName_${i}`];
            if (typeof name === 'string') nameToId[name] = String(i);
        }
    }

    Object.keys(byName).forEach((key) => {
        // 이미 새 형식이면 그대로 통과
        // 이름이 바뀐 알 수 없는 단어장 기록은 원래 키로 보존한다.
        // 1번 단어장으로 임의 합산하면 서로 다른 단어장의 기록이 섞인다.
        const newKey = nameToId[key] ? makeBookKey(nameToId[key]) : key;
        out[newKey] = newKey in out ? merge(out[newKey], byName[key]) : byName[key];
    });
    return out;
}

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function storedRecord(key) {
    const value = gameStorage.readJSON(key, {});
    return isRecord(value) ? value : {};
}

function storedIds(key, fallback = []) {
    const value = gameStorage.readJSON(key, fallback);
    return Array.isArray(value)
        ? [...new Set(value.filter((id) => typeof id === 'string'))]
        : fallback;
}

function nonnegativeInteger(value, fallback = 0) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= 0 ? n : fallback;
}

function normalizeBookStats(value) {
    const s = isRecord(value) ? value : {};
    const counts = (v) => {
        const solved = nonnegativeInteger(v?.solved);
        return { solved, correct: Math.min(solved, nonnegativeInteger(v?.correct)) };
    };
    const perfectDays = Array.isArray(s.subjective?.perfectDays)
        ? s.subjective.perfectDays.filter((d) => isRecord(d) && typeof d.date === 'string')
        : [];
    return {
        ...counts(s),
        objective: counts(s.objective),
        subjective: { ...counts(s.subjective), perfectDays },
        bossMode: {
            bestWave: nonnegativeInteger(s.bossMode?.bestWave),
            bestWaveDate: isRecord(s.bossMode?.bestWaveDate) ? s.bossMode.bestWaveDate : null,
        },
    };
}

/** 기존 저장 키·필드·직렬화를 save와 묶음 저장에서 공유한다. */
const DB_STORAGE_FIELDS = Object.freeze({
    revenge: ['v7_revenge_quests', 'revengeQuests', JSON.stringify],
    gold: ['v7_gold', 'gold', String],
    owned: ['v7_owned', 'owned', JSON.stringify],
    equip: ['v7_equip', 'equippedWeapon', String],
    dura: ['v7_dura', 'durability', JSON.stringify],
    stats: ['v7_stats', 'stats', JSON.stringify],
    inventory: ['v7_inventory', 'inventory', JSON.stringify],
    equipped: ['v7_equipped', 'equipped', JSON.stringify],
    capacity: ['v7_inventory_capacity', 'inventoryCapacity', String],
    skills: ['v7_skills', 'skills', JSON.stringify],
    lastDay: ['v7_last_day', 'lastSelectedDay', String],
    memorized: ['v7_practice_memorized', 'practiceMemorized', JSON.stringify],
    settings: ['v7_settings', 'settings', JSON.stringify],
});

const db = {
    // 골드
    gold: nonnegativeInteger(gameStorage.get('v7_gold', '99'), 99),

    // 보유 아이템 ID 목록
    owned: storedIds('v7_owned', ['basic']),

    // 장착된 무기 (하위 호환성)
    equippedWeapon: gameStorage.get('v7_equip') || 'basic',

    // 아이템 내구도 { itemId: durability }
    durability: storedRecord('v7_dura'),

    // 통계 데이터 (단어장별). 형태: { books: { 'book-N': BookStats } }
    stats: (() => {
        const saved = storedRecord('v7_stats');

        // 단어장 이름을 먼저 ID로 바꿔 기존 1번 기록을 확인한다.
        if (!isRecord(saved.books)) saved.books = {};
        saved.books = Object.fromEntries(
            Object.entries(saved.books)
                // 손상된 값이 빈 통계로 바뀌어 전역 합계의 복원을 막지 않게 한다.
                .filter(([, value]) => isRecord(value))
                .map(([key, value]) => [key, normalizeBookStats(value)])
        );
        saved.books = migrateBookKeys(saved.books, (a, b) => ({
            solved: (a.solved || 0) + (b.solved || 0),
            correct: (a.correct || 0) + (b.correct || 0),
            objective: {
                solved: (a.objective?.solved || 0) + (b.objective?.solved || 0),
                correct: (a.objective?.correct || 0) + (b.objective?.correct || 0),
            },
            subjective: {
                solved: (a.subjective?.solved || 0) + (b.subjective?.solved || 0),
                correct: (a.subjective?.correct || 0) + (b.subjective?.correct || 0),
                perfectDays: [
                    ...(a.subjective?.perfectDays || []),
                    ...(b.subjective?.perfectDays || []),
                ],
            },
            bossMode:
                (a.bossMode?.bestWave || 0) >= (b.bossMode?.bestWave || 0)
                    ? a.bossMode
                    : b.bossMode,
        }));

        // 단어장 구분 없던 전역 합계는 1번 기록이 없을 때만 이관한다.
        // 이름 키 기록과 전역 합계가 함께 저장된 버전의 통계를 중복 합산하지 않는다.
        if (
            (saved.solved > 0 ||
                saved.correct > 0 ||
                saved.bossMode ||
                saved.subjective ||
                saved.objective) &&
            !saved.books[makeBookKey('1')]
        ) {
            saved.books[makeBookKey('1')] = normalizeBookStats(saved);
        }

        // [정리] 레거시 최상위 누적 필드 제거.
        // books[]에 같은 값을 이중으로 쓰면서 읽는 곳은 없었다(표시는 전부 books 기준).
        // 전체 합계가 필요해지면 books를 집계하면 된다.
        delete saved.solved;
        delete saved.correct;
        delete saved.objective;
        delete saved.subjective;
        delete saved.bossMode;

        return saved;
    })(),

    // 인벤토리 아이템 목록
    inventory: storedIds('v7_inventory'),

    // 장착된 장비 { slot: itemId }
    equipped: storedRecord('v7_equipped'),

    // 인벤토리 용량
    inventoryCapacity: Math.max(3, nonnegativeInteger(gameStorage.get('v7_inventory_capacity'), 3)),

    // 스킬 보유 개수 { hint: count, ultimate: count }
    skills: (() => {
        const saved = storedRecord('v7_skills');
        return {
            hint: nonnegativeInteger(saved.hint),
            ultimate: nonnegativeInteger(saved.ultimate),
        };
    })(),

    // 마지막 선택한 Day
    lastSelectedDay: gameStorage.get('v7_last_day') || 'all',

    // 연습 모드 외운 단어 (단어장별) { 'book-N': ['word|meaning', ...] }
    practiceMemorized: (() => {
        const records = migrateBookKeys(
            Object.fromEntries(
                Object.entries(storedRecord('v7_practice_memorized')).map(([key, value]) => [
                    key,
                    Array.isArray(value) ? value.filter((word) => typeof word === 'string') : [],
                ])
            ),
            // 같은 데이터셋으로 합쳐지면 중복 제거 후 병합
            (a, b) => Array.from(new Set([...(a || []), ...(b || [])]))
        );
        // 1번 단어장 Day 13의 철자 정정 전 외움 기록을 보존한다.
        if (records['book-1'])
            records['book-1'] = [
                ...new Set(
                    records['book-1'].map((key) => (key === 'succcess|성공' ? 'success|성공' : key))
                ),
            ];
        return records;
    })(),

    revengeQuests: (() => {
        const records = revengeRules.normalize(storedRecord('v7_revenge_quests'));
        const book = records['book-1'];
        const oldKey = revengeRules.key({ word: 'succcess', meaning: '성공' });
        const correctedKey = revengeRules.key({ word: 'success', meaning: '성공' });
        const previous = book?.[oldKey];
        if (previous) {
            const current = book[correctedKey];
            book[correctedKey] = {
                ...previous,
                word: 'success',
                ...current,
                failures: Math.max(previous.failures, current?.failures || 0),
                revengeRewarded: previous.revengeRewarded || current?.revengeRewarded === true,
                recallRewarded: previous.recallRewarded || current?.recallRewarded === true,
            };
            delete book[oldKey];
        }
        return records;
    })(),

    // 음악·자동 발음·오답 진동은 기존 저장에도 기본 ON을 적용한다.
    settings: (() => {
        const o = storedRecord('v7_settings');
        return {
            musicPlay: o.musicPlay !== false,
            wordRead: o.wordRead !== false,
            soundEffects: o.soundEffects !== false,
            vibration: o.vibration !== false,
            vibrationDuration: HAPTICS_CONFIG.durations.includes(o.vibrationDuration)
                ? o.vibrationDuration
                : HAPTICS_CONFIG.defaultDuration,
        };
    })(),

    // 필드별 localStorage 직렬화 함수 (save에서 선택적으로 호출)
    _writers: Object.fromEntries(
        Object.entries(DB_STORAGE_FIELDS).map(([field, [key, property, serialize]]) => [
            field,
            () => db[property] === undefined || gameStorage.set(key, serialize(db[property])),
        ])
    ),

    /**
     * 데이터를 localStorage에 저장합니다.
     * @param {...string} fields - 저장할 필드명(_writers 키). 생략 시 전체 저장.
     *   핫패스(골드/통계 가산 등)에서는 변경된 키만 넘겨 불필요한 직렬화를 줄입니다.
     */
    save: (...fields) => {
        const keys = fields.length ? fields : Object.keys(db._writers);
        keys.forEach((k) => {
            if (db._writers[k]) db._writers[k]();
        });
        ui.updateGold();
    },

    /**
     * 골드를 추가합니다 (음수 가능)
     * @param {number} n - 추가할 골드 양
     * @returns {number} 업데이트된 총 골드
     */
    addGold: (n) => {
        // 호출자가 음수/양수를 전달할 수 있음; 정수로 강제하고 0 이상으로 제한
        const delta = Number(n);
        if (!Number.isFinite(delta)) return db.gold;
        db.commitChanges({ gold: Math.max(0, db.gold + Math.floor(delta)) });
        return db.gold;
    },

    /**
     * 골드를 차감합니다
     * @param {number} n - 차감할 골드 양
     * @returns {number} 업데이트된 총 골드
     */
    subGold: (n) => {
        // addGold와 동일한 동작 유지
        return db.addGold(-(Number(n) || 0));
    },

    /** 구매 상태·비용·연결된 스토리 기록을 저장한 뒤에만 메모리 상태를 변경한다. */
    commitChanges: (changes, relatedWrites = {}) => {
        if ('gold' in changes && (!Number.isSafeInteger(changes.gold) || changes.gold < 0))
            return false;
        const writes = { ...relatedWrites };
        const fields = Object.values(DB_STORAGE_FIELDS);
        for (const [property, value] of Object.entries(changes)) {
            const field = fields.find(([, name]) => name === property);
            if (!field || value === undefined) return false;
            const [key, , serialize] = field;
            writes[key] = serialize(value);
        }
        if (!gameStorage.setBatch(writes)) return false;
        Object.assign(db, changes);
        ui.updateGold();
        return true;
    },

    /**
     * 아이템을 보유하고 있는지 확인합니다
     * @param {string} id - 아이템 ID
     * @returns {boolean} 보유 여부
     */
    has: (id) => db.owned.includes(id),

    /**
     * 아이템을 장착합니다
     * @param {string} id - 아이템 ID
     */
    equip: (id) => inventory.equip(id, 'weapon'),

    /** 현재 활성 데이터셋의 단어장 저장 키 ('book-N') */
    getBookKey: () => currentBookKey(),

    /** 빈 단어장 통계 한 벌 */
    _emptyBookStats: () => ({
        solved: 0,
        correct: 0,
        objective: { solved: 0, correct: 0 },
        subjective: { solved: 0, correct: 0, perfectDays: [] },
        bossMode: { bestWave: 0, bestWaveDate: null },
    }),

    /**
     * 단어장별 통계를 가져옵니다 (없으면 생성). 누락된 하위 필드도 함께 보강합니다.
     * 통계 구조를 아는 유일한 지점이므로, 필드가 늘어나면 여기만 고치면 됩니다.
     * @param {string} [bookKey] - 저장 키. 생략 시 현재 활성 데이터셋.
     * @returns {Object} 단어장 통계 객체 (db.stats.books에 연결된 실제 객체)
     */
    getBookStats: (bookKey) => {
        if (!db.stats.books) db.stats.books = {};
        const key = bookKey || currentBookKey();
        if (!db.stats.books[key]) db.stats.books[key] = db._emptyBookStats();

        const s = db.stats.books[key];
        if (!s.objective) s.objective = { solved: 0, correct: 0 };
        if (!s.subjective) s.subjective = { solved: 0, correct: 0, perfectDays: [] };
        if (!s.subjective.perfectDays) s.subjective.perfectDays = [];
        if (!s.bossMode) s.bossMode = { bestWave: 0, bestWaveDate: null };
        return s;
    },

    /**
     * 통계를 추가합니다
     * @param {boolean} isCorrect - 정답 여부
     * @param {string} questionType - 문제 타입 ('objective' 또는 'subjective')
     */
    addStats: (isCorrect, questionType = 'objective') => {
        if (!['objective', 'subjective'].includes(questionType)) return false;
        const stats = db.copyStats();
        const bookStats = stats.books[db.getBookKey()];

        bookStats.solved++;
        if (isCorrect) bookStats.correct++;

        if (!bookStats[questionType]) {
            bookStats[questionType] = { solved: 0, correct: 0 };
        }
        bookStats[questionType].solved++;
        if (isCorrect) bookStats[questionType].correct++;

        return db.commitChanges({ stats });
    },

    /** 변경 전 원본과 하위 기록을 공유하지 않는 통계 사본. */
    copyStats: () => {
        const book = db.getBookKey();
        const current = db.stats.books?.[book] || db._emptyBookStats();
        return {
            ...db.stats,
            books: {
                ...db.stats.books,
                [book]: {
                    ...current,
                    objective: { ...current.objective },
                    subjective: {
                        ...current.subjective,
                        perfectDays: current.subjective.perfectDays.map((entry) => ({ ...entry })),
                    },
                    bossMode: { ...current.bossMode },
                },
            },
        };
    },

    /**
     * 보스 모드 최고 wave 기록을 갱신합니다 (기존 기록보다 높을 때만).
     * @param {number} wave - 이번 판에서 도달한 wave
     * @returns {boolean} 갱신 여부
     */
    recordBossWave: (wave) => {
        if (!Number.isSafeInteger(wave) || wave <= 0) return false;
        const stats = db.copyStats();
        const bossMode = stats.books[db.getBookKey()].bossMode;
        if (wave <= bossMode.bestWave) return false;

        const today = new Date();
        bossMode.bestWave = wave;
        bossMode.bestWaveDate = {
            date: db._todayISO(today),
            displayDate: db._todayDisplay(today),
        };
        return db.commitChanges({ stats });
    },

    /**
     * 주관식을 전부 맞힌 Day를 기록합니다 (같은 Day는 최신 날짜로 갱신).
     * @param {string|number} day - Day 값 ('all' | 'boss' | 숫자)
     * @param {string} dayLabel - 표시용 라벨
     */
    recordPerfectDay: (day, dayLabel) => {
        const stats = db.copyStats();
        const subjective = stats.books[db.getBookKey()].subjective;
        const today = new Date();
        const entry = {
            date: db._todayISO(today),
            displayDate: db._todayDisplay(today),
            day: day,
            dayLabel: dayLabel,
        };

        const existing = subjective.perfectDays.findIndex((d) => d.day === day);
        if (existing === -1) {
            subjective.perfectDays.push(entry);
        } else {
            subjective.perfectDays[existing] = entry;
        }

        // 날짜순 정렬 (최신이 마지막)
        subjective.perfectDays.sort((a, b) => a.date.localeCompare(b.date));
        return db.commitChanges({ stats });
    },

    /** 저장용 날짜 문자열 (YYYY-MM-DD, 로컬 기준) */
    _todayISO: (d = new Date()) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    },

    /** 표시용 날짜 문자열 */
    _todayDisplay: (d = new Date()) =>
        d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }),

    /**
     * 아이템을 사용합니다 (내구도 감소)
     * @param {string} id - 아이템 ID
     */
    useItem: (id) => {
        if (!(db.durability[id] > 0)) return false;
        return db.grantGold(0, {}, id);
    },

    /** 보상·퀘스트·소모 횟수는 한 번에 저장해 일부만 적용되지 않게 한다. */
    grantGold: (amount, relatedChanges = {}, itemId = null) => {
        if (!Number.isSafeInteger(amount) || amount < 0) return false;
        const changes = { ...relatedChanges, gold: db.gold + amount };
        let consumed = false;
        if (itemId && db.durability[itemId] > 0) {
            const durability = { ...db.durability, [itemId]: db.durability[itemId] - 1 };
            changes.durability = durability;
            if (durability[itemId] === 0) {
                consumed = true;
                delete durability[itemId];
                changes.owned = db.owned.filter((id) => id !== itemId);
                changes.inventory = db.inventory.filter((id) => id !== itemId);
                changes.equipped = Object.fromEntries(
                    Object.entries(db.equipped).filter(([, id]) => id !== itemId)
                );
            }
        }
        if (!db.commitChanges(changes)) return false;
        if (consumed)
            showToast(
                `[${itemId === 'goldGlove' ? '미다스의 건틀릿' : '아이템'}]이 소모되었습니다!`,
                'warn'
            );
        if (itemId) {
            ui.updateSkills();
            ui.updateVisuals();
        }
        return true;
    },
};

// 이전 장비의 소유·보관·내구도·손 슬롯은 함께 이전한다.
// 일부 키만 저장되면 재시작에서 아이템이 사라지거나 소모 횟수가 복원될 수 있다.
(function migrateEquipment() {
    const changes = {
        owned: [...db.owned],
        inventory: [...db.inventory],
        durability: { ...db.durability },
        equipped: { ...db.equipped },
        equippedWeapon: db.equippedWeapon,
    };
    if (!changes.owned.includes('basic')) changes.owned.unshift('basic');

    // 이전 자동 활성 유물은 장갑 슬롯으로 옮겨 남은 사용 횟수를 보존한다.
    if (changes.owned.includes('goldGlove')) {
        changes.owned = changes.owned.filter((id) => id !== 'goldGlove');
        changes.durability.goldGlove ??= EQUIPMENT_CONFIG.gloveUses;
        if (!changes.equipped.gloves) {
            changes.equipped.gloves = 'goldGlove';
            changes.inventory = changes.inventory.filter((id) => id !== 'goldGlove');
        } else if (
            changes.equipped.gloves !== 'goldGlove' &&
            !changes.inventory.includes('goldGlove')
        ) {
            changes.inventory.push('goldGlove');
        }
    }
    // 이미 사용한 더 적은 횟수는 보존한다.
    if (changes.durability.goldGlove > EQUIPMENT_CONFIG.gloveUses)
        changes.durability.goldGlove = EQUIPMENT_CONFIG.gloveUses;

    function restoreWeaponToHand(id) {
        const weapon = weapons.find((entry) => entry.id === id && changes.owned.includes(id));
        if (!weapon || Object.values(changes.equipped).includes(id)) return;
        const slot = weaponEquipSlots(weapon)[0];
        if (slot && !changes.equipped[slot]) changes.equipped[slot] = id;
        // 대상 손이 차 있으면 owned에 보존되어 보관함에 표시된다.
    }
    const oldWeaponSlot = changes.equipped.weapon;
    delete changes.equipped.weapon;
    for (const slot of ['hand-1', 'hand-2']) {
        const weapon = weapons.find((entry) => entry.id === changes.equipped[slot]);
        if (weapon && !weaponEquipSlots(weapon).includes(slot)) {
            delete changes.equipped[slot];
            restoreWeaponToHand(weapon.id);
        }
    }
    if (
        changes.equipped['hand-1'] &&
        changes.equipped['hand-1'] === changes.equipped['hand-2'] &&
        weapons.some((weapon) => weapon.id === changes.equipped['hand-1'])
    ) {
        delete changes.equipped['hand-2'];
    }
    if (oldWeaponSlot) restoreWeaponToHand(oldWeaponSlot);
    if (db.equippedWeapon !== 'basic') restoreWeaponToHand(db.equippedWeapon);
    changes.equippedWeapon =
        weapons.find(
            (weapon) =>
                weapon.id === changes.equipped['hand-1'] && changes.owned.includes(weapon.id)
        )?.id || 'basic';

    const writes = {};
    const updates = {};
    for (const [key, property, serialize] of Object.values(DB_STORAGE_FIELDS)) {
        if (property in changes && serialize(changes[property]) !== serialize(db[property])) {
            writes[key] = serialize(changes[property]);
            updates[property] = changes[property];
        }
    }
    // 로드 중에는 UI를 갱신하지 않고, 저장 실패 시 원본으로 다시 시도할 수 있게 한다.
    if (Object.keys(writes).length && gameStorage.setBatch(writes)) Object.assign(db, updates);
})();

// 이전 총공세 보상은 owned와 inventory에 동시에 저장되었다.
// 포션·배낭은 실제 효과로 한 번만 복구하고 유물은 owned에 보존한다.
const legacyRewardIds = new Set([...db.owned, ...db.inventory]);
const legacyRewards = relics.filter(
    (relic) =>
        legacyRewardIds.has(relic.id) &&
        (['skill', 'backpack'].includes(relic.type) ||
            (relic.type === 'passive' && db.inventory.includes(relic.id)))
);
if (legacyRewards.length) {
    const changes = {
        inventory: db.inventory.filter((id) => !legacyRewards.some((relic) => relic.id === id)),
        owned: db.owned.filter(
            (id) => !legacyRewards.some((relic) => relic.id === id && relic.type !== 'passive')
        ),
        skills: { ...db.skills },
        inventoryCapacity: db.inventoryCapacity,
    };
    for (const relic of legacyRewards) {
        if (relic.type === 'skill')
            changes.skills[relic.id] = (changes.skills[relic.id] || 0) + (relic.uses || 1);
        else if (relic.type === 'backpack') changes.inventoryCapacity++;
        else if (!changes.owned.includes(relic.id)) changes.owned.push(relic.id);
    }
    const writes = {};
    for (const [key, property, serialize] of Object.values(DB_STORAGE_FIELDS)) {
        if (property in changes) writes[key] = serialize(changes[property]);
    }
    // 로드 중에는 UI를 갱신하지 않고 저장 성공 후에만 메모리에도 적용한다.
    if (gameStorage.setBatch(writes)) Object.assign(db, changes);
}
