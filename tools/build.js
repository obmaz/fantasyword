/** 런타임만 dist/에 복사하는 재현 가능한 정적 빌드. 소스 HTML의 로드 순서를 유지한다. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const RUNTIME_DIRECTORIES = Object.freeze({
    scripts: new Set(['.js']),
    styles: new Set(['.css']),
    data: new Set(['.js', '.mp3']),
    images: new Set(['.webp', '.png']),
});
function build(root = path.resolve(__dirname, '..')) {
    root = fs.realpathSync(root);
    const output = path.resolve(root, 'dist');
    if (path.dirname(output) !== root || path.basename(output) !== 'dist')
        throw new Error('잘못된 빌드 경로');
    if (
        fs.existsSync(output) &&
        (fs.lstatSync(output).isSymbolicLink() || fs.realpathSync(output) !== output)
    ) {
        throw new Error('dist 링크/외부 경로에는 빌드할 수 없습니다.');
    }
    // 검증된 저장소 바로 아래 dist만 재생성한다.
    fs.rmSync(output, { recursive: true, force: true });
    fs.mkdirSync(output);
    const manifest = {};
    function write(relative, content) {
        const target = path.join(output, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content);
        manifest[relative.split(path.sep).join('/')] = crypto
            .createHash('sha256')
            .update(content)
            .digest('hex');
    }
    function copy(relative) {
        const source = path.join(root, relative);
        if (fs.lstatSync(source).isSymbolicLink()) throw new Error(`배포 링크 금지: ${relative}`);
        write(relative, fs.readFileSync(source));
    }
    for (const file of ['index.html', 'CNAME', 'favicon.ico']) copy(file);
    for (const [directory, extensions] of Object.entries(RUNTIME_DIRECTORIES)) {
        function walk(relative) {
            if (fs.lstatSync(path.join(root, relative)).isSymbolicLink())
                throw new Error(`배포 링크 금지: ${relative}`);
            for (const entry of fs
                .readdirSync(path.join(root, relative), { withFileTypes: true })
                .sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
                const next = path.join(relative, entry.name);
                if (entry.isSymbolicLink()) throw new Error(`배포 링크 금지: ${next}`);
                if (entry.isDirectory()) walk(next);
                else if (extensions.has(path.extname(next))) copy(next);
            }
        }
        walk(directory);
    }
    function versioned(reference, owner) {
        if (/^(?:[a-z]+:|\/\/|#)/i.test(reference)) return reference;
        const [pathname, fragment] = reference.split('#');
        const [file, query] = pathname.split('?');
        const asset = path.posix.normalize(path.posix.join(path.posix.dirname(owner), file));
        if (!manifest[asset]) throw new Error(`빌드 에셋 누락: ${reference}`);
        return `${file}?${query ? query + '&' : ''}v=${manifest[asset].slice(0, 12)}${fragment ? '#' + fragment : ''}`;
    }
    // 이미지 버전을 먼저 CSS에 반영하고, 변경된 CSS 해시를 HTML에 반영한다.
    // 원본 파일과 classic script 순서는 유지하며 배포물만 변환한다.
    for (const relative of Object.keys(manifest).filter((file) => file.endsWith('.css'))) {
        const css = fs.readFileSync(path.join(output, relative), 'utf8');
        const versionedCss = css.replace(
            /url\((['"]?)([^'"\)]+)\1\)/g,
            (_, quote, reference) => `url(${quote}${versioned(reference, relative)}${quote})`
        );
        write(relative, versionedCss);
    }
    const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
    write(
        'index.html',
        html.replace(
            /((?:src|href)=")([^"]+)(")/g,
            (_, before, reference, after) =>
                `${before}${versioned(reference, 'index.html')}${after}`
        )
    );
    fs.writeFileSync(path.join(output, '.nojekyll'), '');
    fs.writeFileSync(
        path.join(output, 'build-manifest.json'),
        JSON.stringify(manifest, null, 2) + '\n'
    );
    return { output, manifest };
}
if (require.main === module) {
    const { output, manifest } = build();
    console.log(`정적 빌드 완료: ${output} (${Object.keys(manifest).length}개 런타임 파일)`);
}
module.exports = { build };
