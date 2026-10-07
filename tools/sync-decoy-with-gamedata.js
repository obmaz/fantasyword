/**
 * 1) game-data-1, 2, 3의 word 중 decoyWordsSet에 없으면 새 그룹으로 추가
 * 2) decoyWordsSet 그룹 중 game-data-1·2·3 모두에 없는 단어만 있는 그룹은 제거
 * 실행: node tools/sync-decoy-with-gamedata.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { readWords, readGroups } = require('./read-data');

const dataDir = path.join(__dirname, '../data');
const gameData1Path = path.join(dataDir, 'game-data-1.js');
const gameData2Path = path.join(dataDir, 'game-data-2.js');
const gameData3Path = path.join(dataDir, 'game-data-3.js');
const decoyPath = path.join(dataDir, 'decoy-words-set.js');

function norm(w) {
    return String(w || '')
        .trim()
        .toLowerCase();
}

const words1 = readWords(gameData1Path, 1);
const words2 = readWords(gameData2Path, 2);
const words3 = readWords(gameData3Path, 3);
const gameDataWords = new Set([...words1, ...words2, ...words3]);
const gameDataWordsNorm = new Set([...gameDataWords].map(norm));
console.error(
    'game-data-1 words:',
    words1.size,
    '| game-data-2 words:',
    words2.size,
    '| game-data-3 words:',
    words3.size,
    '| union:',
    gameDataWords.size
);

const existingGroups = readGroups(decoyPath);
console.error('Existing decoy groups:', existingGroups.length);

// decoy에 있는 단어 집합
const decoyWordSet = new Set();
for (const g of existingGroups) for (const w of g) decoyWordSet.add(norm(w));

// 1) game-data에 있지만 decoy에 없는 단어 → 새 그룹(1인 그룹)으로 추가
const notInDecoy = [...gameDataWords].filter((w) => !decoyWordSet.has(norm(w)));
const newGroups = notInDecoy.map((w) => [w]);
console.error('New single-word groups (game-data only, not in decoy):', newGroups.length);

// 2) 그룹 전체가 game-data-1·2·3 모두에 없으면 제거
const keptGroups = existingGroups.filter((group) => {
    const hasAnyInGameData = group.some((w) => gameDataWordsNorm.has(norm(w)));
    if (!hasAnyInGameData) return false;
    return true;
});
console.error(
    'Removed groups (only words not in game-data):',
    existingGroups.length - keptGroups.length
);

const allGroups = [...keptGroups, ...newGroups];

function formatGroup(arr) {
    return (
        '        [' +
        arr
            .map((w) => "'" + String(w).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'")
            .join(', ') +
        ']'
    );
}

const out = `// 유사 단어 집합(decoyWordsSet) 수동 관리 파일
// ============================================================
// - 이 파일만 직접 수정해서 유사 단어 집합을 확장하세요.
// - day 개념 없이 "유사한 단어(철자/발음이 비슷한)"를 같은 집합으로 묶습니다.
// - 게임은 객관식(word 보기) 오답 생성 시, 정답 단어가 집합에 있으면
//   같은 집합의 다른 단어들을 우선적으로 오답 후보로 사용합니다.
// - 집합에 매핑이 없거나 후보가 부족하면 rawData에서 랜덤으로 보충합니다.
// ============================================================

(function () {
    if (typeof window === 'undefined') return;

    window.decoyWordsSet = [
${allGroups.map(formatGroup).join(',\n')}
    ];
})();
`;

fs.writeFileSync(decoyPath, out, 'utf8');
console.error(
    'Done. Total groups:',
    allGroups.length,
    '| Kept:',
    keptGroups.length,
    '| Added:',
    newGroups.length
);
