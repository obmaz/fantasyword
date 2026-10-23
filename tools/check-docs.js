/** 개발 문서의 로컬 파일과 Markdown 제목 앵커를 검증한다. 외부 URL은 조회하지 않는다. */
const fs = require('node:fs');
const path = require('node:path');

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

/** 코드 예시의 셸 주석·링크를 문서 제목이나 실제 링크로 해석하지 않는다. */
function prose(content) {
    let fence = null;
    return content
        .split('\n')
        .map((line) => {
            const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
            if (!fence && marker) {
                fence = marker[1];
                return '';
            }
            if (fence) {
                if (
                    marker &&
                    marker[1][0] === fence[0] &&
                    marker[1].length >= fence.length &&
                    line.slice(marker[0].length).trim() === ''
                )
                    fence = null;
                return '';
            }
            return line;
        })
        .join('\n');
}

/** 저장소 문서의 ATX 제목과 명시적 HTML id를 GitHub 방식의 앵커로 수집한다. */
function markdownAnchors(content) {
    const anchors = new Set();
    for (const match of content.matchAll(/<[a-z][^>]*\s+id=["']([^"']+)["'][^>]*>/gi))
        anchors.add(match[1]);
    for (const match of content.matchAll(/^ {0,3}#{1,6}[ \t]+(.+?)\s*$/gm)) {
        const base = match[1]
            .replace(/[ \t]+#+$/, '')
            .replace(/<[^>]*>/g, '')
            .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
            .trim()
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
            .replace(/\s/g, '-');
        let anchor = base;
        for (let suffix = 1; anchors.has(anchor); suffix++) anchor = `${base}-${suffix}`;
        anchors.add(anchor);
    }
    return anchors;
}

function checkDocs(root = path.resolve(__dirname, '..')) {
    const documents = [
        path.join(root, 'README.md'),
        path.join(root, 'AGENTS.md'),
        ...markdownFiles(path.join(root, 'docs')),
    ];
    const contents = new Map();
    const read = (file) => {
        if (!contents.has(file)) contents.set(file, prose(fs.readFileSync(file, 'utf8')));
        return contents.get(file);
    };
    for (const file of documents) {
        for (const match of read(file).matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
            const reference = match[1];
            if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) continue;
            const [pathname, fragment] = reference.split('#');
            const target = pathname
                ? path.resolve(path.dirname(file), decodeURIComponent(pathname))
                : file;
            if (!fs.existsSync(target))
                throw new Error(`문서 링크 누락: ${path.relative(root, file)} → ${reference}`);
            if (
                fragment &&
                path.extname(target).toLowerCase() === '.md' &&
                !markdownAnchors(read(target)).has(decodeURIComponent(fragment))
            )
                throw new Error(`문서 앵커 누락: ${path.relative(root, file)} → ${reference}`);
        }
    }
    return documents.length;
}

if (require.main === module) {
    console.log(`개발 문서 ${checkDocs()}개의 로컬 링크·앵커 검사 통과`);
}
module.exports = { checkDocs };
