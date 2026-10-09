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
    gold: nonnegativeInteger(gameStorage.get('v7_gold')),

    // 보유 아이템 ID 목록
    owned: storedIds('v7_owned', ['basic']),

    // 장착된 무기 (하위 호환성)
    equippedWeapon: gameStorage.get('v7_equip') || 'basic',

    // 아이템 내구도 { itemId: durability }
    durability: storedRecord('v7_dura'),

    // 통계 데이터 (단어장별). 형태: { books: { 'book-N': BookStats } }
    stats: (() => {
        const saved = storedRecord('v7_stats');

        // [마이그레이션 1] 단어장 구분 없던 시절의 전역 누적치 → 1번 단어장으로 이관
        if (!isRecord(saved.books)) saved.books = {};
        if (
            (saved.solved > 0 ||
                saved.correct > 0 ||
                saved.bossMode ||
                saved.subjective ||
                saved.objective) &&
            !saved.books[makeBookKey('1')]
        ) {
            saved.books[makeBookKey('1')] = {
                solved: saved.solved || 0,
                correct: saved.correct || 0,
                objective: saved.objective || { solved: 0, correct: 0 },
                subjective: saved.subjective || { solved: 0, correct: 0, perfectDays: [] },
                bossMode: saved.bossMode || { bestWave: 0, bestWaveDate: null },
            };
        }

        // [마이그레이션 2] 단어장 "이름" 키 → 데이터셋 ID 키
        saved.books = Object.fromEntries(
            Object.entries(saved.books).map(([key, value]) => [key, normalizeBookStats(value)])
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
    practiceMemorized: migrateBookKeys(
        Object.fromEntries(
            Object.entries(storedRecord('v7_practice_memorized')).map(([key, value]) => [
                key,
                Array.isArray(value) ? value.filter((word) => typeof word === 'string') : [],
            ])
        ),
        // 같은 데이터셋으로 합쳐지면 중복 제거 후 병합
        (a, b) => Array.from(new Set([...(a || []), ...(b || [])]))
    ),

    revengeQuests: revengeRules.normalize(storedRecord('v7_revenge_quests')),

    // 설정: 음악 재생, 단어 바로 읽기 (연습 모드 단어 바뀔 때 TTS) - 기본 true
    settings: (() => {
        const o = storedRecord('v7_settings');
        return {
            musicPlay: o.musicPlay !== false,
            wordRead: o.wordRead !== false,
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
        db.gold = Math.max(0, Math.floor(db.gold) + Math.floor(delta));
        db.save('gold');
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
        const bookStats = db.getBookStats();

        bookStats.solved++;
        if (isCorrect) bookStats.correct++;

        if (!bookStats[questionType]) {
            bookStats[questionType] = { solved: 0, correct: 0 };
        }
        bookStats[questionType].solved++;
        if (isCorrect) bookStats[questionType].correct++;

        db.save('stats');
    },

    /**
     * 보스 모드 최고 wave 기록을 갱신합니다 (기존 기록보다 높을 때만).
     * @param {number} wave - 이번 판에서 도달한 wave
     * @returns {boolean} 갱신 여부
     */
    recordBossWave: (wave) => {
        if (!(wave > 0)) return false;
        const bossMode = db.getBookStats().bossMode;
        if (wave <= bossMode.bestWave) return false;

        const today = new Date();
        bossMode.bestWave = wave;
        bossMode.bestWaveDate = {
            date: db._todayISO(today),
            displayDate: db._todayDisplay(today),
        };
        db.save('stats');
        return true;
    },

    /**
     * 주관식을 전부 맞힌 Day를 기록합니다 (같은 Day는 최신 날짜로 갱신).
     * @param {string|number} day - Day 값 ('all' | 'boss' | 숫자)
     * @param {string} dayLabel - 표시용 라벨
     */
    recordPerfectDay: (day, dayLabel) => {
        const subjective = db.getBookStats().subjective;
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
            subjective.perfectDays[existing].date = entry.date;
            subjective.perfectDays[existing].displayDate = entry.displayDate;
        }

        // 날짜순 정렬 (최신이 마지막)
        subjective.perfectDays.sort((a, b) => a.date.localeCompare(b.date));
        db.save('stats');
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
        if (db.durability[id]) {
            db.durability[id]--;
            if (db.durability[id] <= 0) {
                delete db.durability[id];
                db.owned = db.owned.filter((x) => x !== id);
                db.inventory = db.inventory.filter((x) => x !== id);
                for (const slot of Object.keys(db.equipped)) {
                    if (db.equipped[slot] === id) delete db.equipped[slot];
                }
                showToast(
                    `[${id === 'goldGlove' ? '미다스의 건틀릿' : '아이템'}]이 소모되었습니다!`,
                    'warn'
                );
            }
            db.save('dura', 'owned', 'inventory', 'equipped');
            ui.updateSkills(); // 황금장갑이 skill bar에 표시되므로
            ui.updateVisuals();
        }
    },
};

// 이전 단일 무기 슬롯을 실제 손 슬롯으로 옮기고, 오른손과 골드 보너스의 무기를 맞춘다.
if (!db.owned.includes('basic')) db.owned.unshift('basic');
const previousEquipment = JSON.stringify(db.equipped);
// 이전 자동 활성 유물은 장갑 슬롯으로 옮겨 효과와 남은 사용 횟수를 보존한다.
if (db.owned.includes('goldGlove')) {
    db.owned = db.owned.filter((id) => id !== 'goldGlove');
    db.durability.goldGlove ??= 30;
    if (!db.equipped.gloves) {
        db.equipped.gloves = 'goldGlove';
        db.inventory = db.inventory.filter((id) => id !== 'goldGlove');
    } else if (db.equipped.gloves !== 'goldGlove' && !db.inventory.includes('goldGlove')) {
        db.inventory.push('goldGlove');
    }
    db._writers.owned();
    db._writers.inventory();
    db._writers.dura();
}
const previousPrimaryWeapon = db.equippedWeapon;
function restoreWeaponToHand(id) {
    const weapon = weapons.find((entry) => entry.id === id && db.has(id));
    if (!weapon || Object.values(db.equipped).includes(id)) return;
    const slot = weaponEquipSlots(weapon)[0];
    if (slot && !db.equipped[slot]) db.equipped[slot] = id;
    // 대상 손이 차 있으면 owned에 보존되어 보관함에 표시된다.
}
const oldWeaponSlot = db.equipped.weapon;
delete db.equipped.weapon;
for (const slot of ['hand-1', 'hand-2']) {
    const weapon = weapons.find((entry) => entry.id === db.equipped[slot]);
    if (weapon && !weaponEquipSlots(weapon).includes(slot)) {
        delete db.equipped[slot];
        restoreWeaponToHand(weapon.id);
    }
}
if (
    db.equipped['hand-1'] &&
    db.equipped['hand-1'] === db.equipped['hand-2'] &&
    weapons.some((weapon) => weapon.id === db.equipped['hand-1'])
) {
    delete db.equipped['hand-2'];
}
if (oldWeaponSlot) restoreWeaponToHand(oldWeaponSlot);
if (previousPrimaryWeapon !== 'basic') restoreWeaponToHand(previousPrimaryWeapon);
db.equippedWeapon =
    weapons.find((weapon) => weapon.id === db.equipped['hand-1'] && db.has(weapon.id))?.id ||
    'basic';
if (
    previousEquipment !== JSON.stringify(db.equipped) ||
    previousPrimaryWeapon !== db.equippedWeapon
) {
    // 로드 중에는 UI가 아직 준비되지 않았으므로 저장 필드만 직렬화한다.
    db._writers.equipped();
    db._writers.equip();
}
