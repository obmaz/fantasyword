// 배포 파일의 문법, 로컬 에셋 경로, 인라인 동작 재유입을 검사한다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function files(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? files(target) : [target];
    });
}
for (const directory of ['scripts', 'data', 'tools', 'tests']) {
    for (const file of files(path.join(root, directory)).filter((f) => f.endsWith('.js'))) {
        new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
    }
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
// 빌드 없는 구성에서는 런타임 파일의 등록과 책임 경계를 명시적으로 검사한다.
for (const directory of ['scripts', 'styles']) {
    for (const file of files(path.join(root, directory))) {
        const relative = path.relative(root, file).split(path.sep).join('/');
        if (!html.includes(`"${relative}"`))
            throw new Error(`등록되지 않은 런타임 파일: ${relative}`);
    }
}
for (const file of files(path.join(root, 'scripts/domain'))) {
    if (/\b(?:document|window|localStorage|game|db)\s*\./.test(fs.readFileSync(file, 'utf8'))) {
        throw new Error(`도메인 규칙에 브라우저/세션 접근이 있습니다: ${file}`);
    }
}
for (const file of files(path.join(root, 'scripts/game'))) {
    const source = fs.readFileSync(file, 'utf8');
    if (/\b(?:document|window|navigator|performance)\s*\./.test(source)) {
        throw new Error(`세션의 환경 의존성은 구성 루트에서 주입해야 합니다: ${file}`);
    }
    if (
        /\.(?:getElementById|querySelector(?:All)?|createElement|getBoundingClientRect)\s*\(/.test(
            source
        )
    ) {
        throw new Error(`세션의 DOM 표현은 렌더러가 소유해야 합니다: ${file}`);
    }
}
for (const name of ['battle-view', 'practice-view', 'skyfall-view']) {
    if (
        /\b(?:game|db|practiceMemorization)\s*\./.test(
            fs.readFileSync(path.join(root, `scripts/ui/${name}.js`), 'utf8')
        )
    ) {
        throw new Error(`렌더러는 모델과 콜백을 받아야 합니다: ${name}`);
    }
}
if (/<script\s*>|\son\w+\s*=/i.test(html)) throw new Error('HTML에 인라인 동작이 있습니다.');
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^(?:https?:|#|data:)/.test(match[1])) continue;
    if (!fs.existsSync(path.join(root, match[1]))) throw new Error(`에셋 누락: ${match[1]}`);
}
for (const file of files(path.join(root, 'styles')).filter((f) => f.endsWith('.css'))) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)) {
        if (/^(?:https?:|data:)/.test(match[1])) continue;
        if (!fs.existsSync(path.resolve(path.dirname(file), match[1]))) {
            throw new Error(`CSS 에셋 누락: ${match[1]}`);
        }
    }
}
console.log('JavaScript 문법, 배포 에셋/로드 등록, HTML 동작 분리, 게임 모듈 책임 경계 검사 통과');
