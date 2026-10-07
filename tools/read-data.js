const fs = require('node:fs');
const vm = require('node:vm');

// 저장소의 데이터 스크립트를 평가해 실제 배열을 읽는다.
// 정규식으로 문자열 리터럴을 잘라 읽으면 one's 같은 단어가 잘린다.
function readData(filePath, key) {
    const context = { window: {} };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(filePath, 'utf8'), context, {
        filename: filePath,
        timeout: 1000,
    });
    const data = context.window[key];
    if (!Array.isArray(data)) throw new Error(`${filePath}: ${key} 배열이 없습니다.`);
    return data;
}

function readWords(filePath, id) {
    return new Set(readData(filePath, `rawData_${id}`).map((item) => item.word.trim()));
}

function readGroups(filePath) {
    return readData(filePath, 'decoyWordsSet').map((group) => [...group]);
}

module.exports = { readData, readWords, readGroups };
