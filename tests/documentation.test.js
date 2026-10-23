const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkDocs } = require('../tools/check-docs');

function fixture(t, readme, guide = '') {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fantasy-docs-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'README.md'), readme);
    fs.writeFileSync(path.join(root, 'AGENTS.md'), '# 작업 규칙\n');
    fs.writeFileSync(path.join(root, 'docs/guide.md'), guide);
    return root;
}

test('문서 검사는 한글 제목·인코딩 앵커·같은 문서·중복 제목·명시적 id를 확인한다', (t) => {
    const root = fixture(
        t,
        '# 시작\n[시작](#시작)\n[설치](docs/guide.md#설치와-설정)\n' +
            '[두 번째](docs/guide.md#설치와-설정-1)\n' +
            '[세 번째](docs/guide.md#설치와-설정-2)\n' +
            '[인코딩](docs/guide.md#%EC%84%A4%EC%B9%98%EC%99%80-%EC%84%A4%EC%A0%95)\n' +
            '[수동](docs/guide.md#manual)\n[외부](https://example.invalid/#missing)\n',
        '# 설치와 설정\n## 설치와 설정\n### 설치와 설정\n<a id="manual"></a>\n'
    );
    assert.equal(checkDocs(root), 3);
});

test('문서 검사는 존재하는 파일의 잘못된 제목과 같은 문서의 잘못된 앵커도 거부한다', (t) => {
    for (const reference of ['docs/guide.md#삭제된-제목', '#없는-제목']) {
        const root = fixture(t, `# 시작\n[이동](${reference})\n`, '# 현재 제목\n');
        assert.throws(() => checkDocs(root), /문서 앵커 누락: README\.md/);
    }
    const missing = fixture(t, '[없는 파일](docs/missing.md)\n');
    assert.throws(() => checkDocs(missing), /문서 링크 누락: README\.md/);
});

test('코드 예시의 링크·셸 주석은 검사나 제목 앵커에 포함하지 않는다', (t) => {
    const root = fixture(
        t,
        '# 시작\n```md\n[예시](missing.md)\n```\n' +
            '~~~sh\n# 설치\n~~~\n[진짜 제목](docs/guide.md#실행)\n',
        '# 실행\n```sh\n# 없는 제목\n```\n'
    );
    assert.equal(checkDocs(root), 3);
    fs.appendFileSync(path.join(root, 'README.md'), '[코드 주석](docs/guide.md#없는-제목)\n');
    assert.throws(() => checkDocs(root), /문서 앵커 누락/);
});
