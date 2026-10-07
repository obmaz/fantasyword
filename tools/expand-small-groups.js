/**
 * 그룹 단어가 3개 이하인 그룹만 찾아서 4개로 확장
 * 실행: node tools/expand-small-groups.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { readWords, readGroups } = require('./read-data');

const gameDataPath = path.join(__dirname, '../data/game-data-1.js');
const decoyPath = path.join(__dirname, '../data/decoy-words-set.js');

// Levenshtein distance
function editDistance(a, b) {
    const m = a.length,
        n = b.length;
    const dp = Array(m + 1)
        .fill(null)
        .map(() => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[m][n];
}

function norm(w) {
    return String(w || '')
        .trim()
        .toLowerCase();
}

// 유사도: 길이 차이 3 이하 + 편집 거리 3~5 (완화)
function isSimilar(a, b) {
    const x = norm(a),
        y = norm(b);
    if (x === y) return true;
    const lenA = x.length,
        lenB = y.length;
    if (Math.abs(lenA - lenB) > 3) return false;
    const dist = editDistance(x, y);
    if (Math.max(lenA, lenB) <= 6) return dist <= 3;
    if (Math.max(lenA, lenB) <= 10) return dist <= 4;
    return dist <= 5;
}

const allRawWords = [...readWords(gameDataPath, 1)];
const existingGroups = readGroups(decoyPath);
// 3개 이하인 그룹 찾기
const smallGroups = existingGroups.filter((g) => g.length <= 3);
console.error('Small groups (<=3 words):', smallGroups.length);

// 각 작은 그룹에 비슷한 단어 추가
const allWordsInGroups = new Map(); // word -> group index
for (let i = 0; i < existingGroups.length; i++) {
    for (const w of existingGroups[i]) {
        allWordsInGroups.set(norm(w), i);
    }
}

const updatedGroups = existingGroups.map((group) => [...group]);
updatedGroups.forEach((group, groupIdx) => {
    if (group.length > 3) return; // 이미 4개 이상이면 그대로

    const candidates = [];

    // 1) rawData에서 아직 그룹에 없는 단어 찾기
    for (const word of allRawWords) {
        if (allWordsInGroups.has(norm(word))) continue;
        for (const g of group) {
            if (isSimilar(word, g)) {
                candidates.push({ word, dist: editDistance(norm(word), norm(g)), source: 'raw' });
                break;
            }
        }
    }

    // 2) 다른 그룹(4개 이상)에서 가져올 수 있는 단어 찾기
    for (let i = 0; i < existingGroups.length; i++) {
        if (i === groupIdx) continue;
        const otherGroup = updatedGroups[i];
        if (otherGroup.length <= 4) continue; // 4개 이상인 그룹에서만 가져오기

        for (const word of otherGroup) {
            for (const g of group) {
                if (isSimilar(word, g)) {
                    candidates.push({
                        word,
                        dist: editDistance(norm(word), norm(g)),
                        source: 'other',
                        fromGroup: i,
                    });
                    break;
                }
            }
        }
    }

    // 가장 유사한 순으로 정렬하고, 4개가 될 때까지 추가
    candidates.sort((a, b) => a.dist - b.dist);
    const needed = 4 - group.length;
    const toAdd = [];
    const usedWords = new Set();

    for (const c of candidates) {
        if (toAdd.length >= needed) break;
        const nw = norm(c.word);
        if (usedWords.has(nw)) continue;
        if (c.source === 'other' && updatedGroups[c.fromGroup].length <= 4) continue; // 가져온 후 4개 미만이 되면 안 됨

        toAdd.push(c.word);
        usedWords.add(nw);
        allWordsInGroups.set(nw, groupIdx);

        // 다른 그룹에서 가져온 경우 그 그룹에서 제거
        if (c.source === 'other') {
            const idx = updatedGroups[c.fromGroup].indexOf(c.word);
            if (idx >= 0) {
                updatedGroups[c.fromGroup].splice(idx, 1);
            }
        }
    }

    if (toAdd.length > 0) {
        group.push(...toAdd);
        group.sort((a, b) => a.localeCompare(b));
    }
});

// 출력
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
${updatedGroups.map(formatGroup).join(',\n')}
    ];
})();
`;

fs.writeFileSync(decoyPath, out, 'utf8');
const expanded = updatedGroups.filter(
    (g, i) => existingGroups[i].length <= 3 && g.length >= 4
).length;
console.error('Done. Expanded', expanded, 'groups to 4+ words.');
