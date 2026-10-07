/** 단어장별 decoy 미등록 단어 확인: node tools/check-decoy.js [1|2|3] */
const path = require('node:path');
const { readWords, readGroups } = require('./read-data');
const id = process.argv[2] || '3';
if (!['1', '2', '3'].includes(id)) {
    console.error('사용법: node tools/check-decoy.js [1|2|3]');
    process.exit(1);
}
const norm = (word) => word.trim().toLowerCase();
const rawWords = [...readWords(path.join(__dirname, '../data/game-data-' + id + '.js'), id)].map(
    norm
);
const decoyWords = new Set(
    readGroups(path.join(__dirname, '../data/decoy-words-set.js')).flat().map(norm)
);
const notInDecoy = rawWords.filter((word) => !decoyWords.has(word)).sort();
console.log('rawData_' + id + ' 단어 수: ' + rawWords.length);
console.log('decoy 고유 단어 수: ' + decoyWords.size);
console.log('미등록 단어 수: ' + notInDecoy.length);
notInDecoy.forEach((word) => console.log(word));
