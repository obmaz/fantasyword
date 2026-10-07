/** 개발 문서의 상대 링크를 검증한다. 외부 URL과 문서 내 앵커는 제외한다. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function markdownFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory()
            ? markdownFiles(target)
            : entry.name.endsWith('.md')
              ? [target]
              : [];
    });
}

const documents = [
    path.join(root, 'README.md'),
    path.join(root, 'AGENTS.md'),
    ...markdownFiles(path.join(root, 'docs')),
];
for (const file of documents) {
    const content = fs.readFileSync(file, 'utf8');
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const reference = match[1];
        if (/^(?:[a-z]+:|#|\/\/)/i.test(reference)) continue;
        const target = decodeURIComponent(reference.split('#')[0]);
        if (!fs.existsSync(path.resolve(path.dirname(file), target))) {
            throw new Error(`문서 링크 누락: ${path.relative(root, file)} → ${reference}`);
        }
    }
}
console.log(`개발 문서 ${documents.length}개의 로컬 링크 검사 통과`);
