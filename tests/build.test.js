const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { build } = require('../tools/build');

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fantasy-build-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const folder of ['scripts', 'styles', 'data', 'images', 'docs', 'tests'])
        fs.mkdirSync(path.join(root, folder));
    fs.writeFileSync(path.join(root, 'index.html'), '<script src="scripts/app.js"></script>');
    fs.writeFileSync(path.join(root, 'CNAME'), 'example.test');
    fs.writeFileSync(path.join(root, 'favicon.ico'), 'favicon');
    fs.writeFileSync(path.join(root, 'scripts/app.js'), 'const answer = 42;');
    fs.writeFileSync(path.join(root, 'data/music.mp3'), 'music');
    fs.writeFileSync(path.join(root, 'docs/review.md'), 'private development note');
    fs.writeFileSync(path.join(root, 'package.json'), '{}');
    return root;
}

test('빌드는 런타임 원본과 동적 음악을 보존하고 개발 파일을 제외한다', (t) => {
    const root = fixture(t);
    const { output, manifest } = build(root);
    for (const [relative, hash] of Object.entries(manifest)) {
        const content = fs.readFileSync(path.join(output, relative));
        assert.equal(crypto.createHash('sha256').update(content).digest('hex'), hash);
        if (relative !== 'index.html')
            assert.deepEqual(content, fs.readFileSync(path.join(root, relative)));
    }
    assert.equal(
        fs.readFileSync(path.join(output, 'index.html'), 'utf8'),
        `<script src="scripts/app.js?v=${manifest['scripts/app.js'].slice(0, 12)}"></script>`
    );
    assert.ok(manifest['data/music.mp3']);
    assert.ok(fs.existsSync(path.join(output, '.nojekyll')));
    assert.equal(fs.existsSync(path.join(output, 'docs')), false);
    assert.equal(fs.existsSync(path.join(output, 'package.json')), false);
});

test('재빌드는 삭제된 에셋을 남기지 않으며 같은 소스의 manifest가 동일하다', (t) => {
    const root = fixture(t);
    const first = build(root);
    const before = fs.readFileSync(path.join(first.output, 'build-manifest.json'), 'utf8');
    fs.writeFileSync(path.join(first.output, 'obsolete.js'), 'old');
    build(root);
    assert.equal(fs.existsSync(path.join(first.output, 'obsolete.js')), false);
    assert.equal(fs.readFileSync(path.join(first.output, 'build-manifest.json'), 'utf8'), before);
});

test('HTML 참조가 배포 파일에 없으면 빌드를 실패시킨다', (t) => {
    const root = fixture(t);
    fs.writeFileSync(path.join(root, 'index.html'), '<script src="missing.js"></script>');
    assert.throws(() => build(root), /빌드 에셋 누락/);
});

test('파비콘 ICO와 PNG는 배포되고 HTML 참조에 내용 해시를 붙인다', (t) => {
    const root = fixture(t);
    fs.writeFileSync(path.join(root, 'images/icon.png'), 'png icon');
    fs.writeFileSync(
        path.join(root, 'index.html'),
        '<link rel="icon" href="favicon.ico"><link rel="apple-touch-icon" href="images/icon.png">'
    );
    const { output, manifest } = build(root);
    const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
    for (const asset of ['favicon.ico', 'images/icon.png']) {
        assert.ok(manifest[asset]);
        assert.ok(html.includes(`${asset}?v=${manifest[asset].slice(0, 12)}`));
        assert.deepEqual(
            fs.readFileSync(path.join(output, asset)),
            fs.readFileSync(path.join(root, asset))
        );
    }
});

test('이미지 변경은 CSS와 HTML의 캐시 버전을 갱신하고 원본/외부 URL은 보존한다', (t) => {
    const root = fixture(t);
    const html = '<link href="styles/theme.css"><script src="scripts/app.js"></script>';
    const css = `.logo { background: url('../images/logo.webp'); } .embedded { background: url('data:image/svg+xml,%3Csvg%3E'); }`;
    fs.writeFileSync(path.join(root, 'index.html'), html);
    fs.writeFileSync(path.join(root, 'styles/theme.css'), css);
    fs.writeFileSync(path.join(root, 'images/logo.webp'), 'first image');
    const first = build(root);
    const firstHtml = fs.readFileSync(path.join(first.output, 'index.html'), 'utf8');
    const firstCss = fs.readFileSync(path.join(first.output, 'styles/theme.css'), 'utf8');
    assert.ok(
        firstHtml.includes(`styles/theme.css?v=${first.manifest['styles/theme.css'].slice(0, 12)}`)
    );
    assert.ok(
        firstCss.includes(
            `../images/logo.webp?v=${first.manifest['images/logo.webp'].slice(0, 12)}`
        )
    );
    assert.ok(firstCss.includes("url('data:image/svg+xml,%3Csvg%3E')"));
    fs.writeFileSync(path.join(root, 'images/logo.webp'), 'updated image');
    const second = build(root);
    const secondHtml = fs.readFileSync(path.join(second.output, 'index.html'), 'utf8');
    const secondCss = fs.readFileSync(path.join(second.output, 'styles/theme.css'), 'utf8');
    assert.notEqual(secondHtml, firstHtml);
    assert.notEqual(secondCss, firstCss);
    assert.ok(
        secondHtml.includes(
            `styles/theme.css?v=${second.manifest['styles/theme.css'].slice(0, 12)}`
        )
    );
    assert.equal(second.manifest['scripts/app.js'], first.manifest['scripts/app.js']);
    assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), html);
    assert.equal(fs.readFileSync(path.join(root, 'styles/theme.css'), 'utf8'), css);
});

test('dist가 다른 폴더를 가리키면 삭제 전에 빌드를 거부한다', (t) => {
    const root = fixture(t);
    const external = path.join(root, 'keep');
    fs.mkdirSync(external);
    fs.writeFileSync(path.join(external, 'sentinel.txt'), 'keep');
    fs.symlinkSync(
        external,
        path.join(root, 'dist'),
        process.platform === 'win32' ? 'junction' : 'dir'
    );
    assert.throws(() => build(root), /dist 링크/);
    assert.equal(fs.readFileSync(path.join(external, 'sentinel.txt'), 'utf8'), 'keep');
});
