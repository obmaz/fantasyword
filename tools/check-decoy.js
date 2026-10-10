/** 단어장별 decoy 미등록 단어 확인: node tools/check-decoy.js [단어장 ID] */
const fs = require('node:fs');
const path = require('node:path');
const { readWords, readGroups } = require('./read-data');
const id = process.argv[2] || '3';
const dataPath = path.join(__dirname, '../data/game-data-' + id + '.js');
if (!/^[1-9]\d*$/.test(id) || !fs.existsSync(dataPath)) {
    console.error('사용법: node tools/check-decoy.js [존재하는 단어장 ID]');
    process.exit(1);
}
const norm = (word) => word.trim().toLowerCase();
const rawWords = [...readWords(dataPath, id)].map(norm);
const decoyWords = new Set(
    readGroups(path.join(__dirname, '../data/decoy-words-set.js')).flat().map(norm)
);
const notInDecoy = rawWords.filter((word) => !decoyWords.has(word)).sort();
console.log('rawData_' + id + ' 단어 수: ' + rawWords.length);
console.log('decoy 고유 단어 수: ' + decoyWords.size);
console.log('미등록 단어 수: ' + notInDecoy.length);
notInDecoy.forEach((word) => console.log(word));
