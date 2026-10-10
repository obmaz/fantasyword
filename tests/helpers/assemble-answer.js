const assert = require('node:assert/strict');

function answerIndices(game) {
    const indices = [];
    for (const letter of game.currentQ.word) {
        if (!/[a-z]/i.test(letter)) continue;
        const index = game.spellingTiles.findIndex(
            (tile, i) => tile.toLowerCase() === letter.toLowerCase() && !indices.includes(i)
        );
        assert.ok(index >= 0, `missing answer tile: ${letter}`);
        indices.push(index);
    }
    return indices;
}

function assembleAnswer(game) {
    answerIndices(game).forEach((index) => game.chooseSpellingLetter(index));
}

function assembleWrongAnswer(game) {
    const indices = answerIndices(game);
    const extra = game.spellingTiles.findIndex(
        (tile) => !game.currentQ.word.toLowerCase().includes(tile.toLowerCase())
    );
    assert.ok(extra >= 0, 'missing decoy tile');
    [extra, ...indices.slice(1)].forEach((index) => game.chooseSpellingLetter(index));
}

module.exports = { assembleAnswer, assembleWrongAnswer };
