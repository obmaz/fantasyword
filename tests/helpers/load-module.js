/**
 * 브라우저용 스크립트를 Node에서 테스트하기 위한 로더.
 *
 * 이 프로젝트는 빌드 도구 없이 <script>로 전역을 정의하는 구조라 import/require가 안 됩니다.
 * 대신 파일을 읽어 vm 샌드박스에서 실행하고, 정의된 전역을 꺼내옵니다.
 * (파일들은 로드 시점에 객체만 정의하고 DOM을 건드리지 않으므로 이 방식이 가능합니다.)
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

/**
 * 스크립트를 샌드박스에서 실행합니다.
 *
 * 주의: 스크립트 최상단의 `const game = {...}`는 전역 객체의 프로퍼티가 아니라
 * 스크립트 렉시컬 스코프에 들어가므로 sandbox에서 바로 꺼낼 수 없습니다.
 * 그래서 이름으로 값을 평가해주는 `evaluate`를 함께 반환합니다.
 *
 * @param {string[]} relativePaths - 저장소 루트 기준 경로 (로드 순서대로)
 * @param {Object} [globals] - 샌드박스에 미리 넣을 전역 (스텁)
 * @returns {{sandbox: Object, evaluate: (expr: string) => any}}
 */
function loadScripts(relativePaths, globals = {}) {
    const sandbox = {
        console,
        dlog: () => {},
        ...globals,
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;

    vm.createContext(sandbox);

    // 여러 파일을 하나의 렉시컬 스코프에서 이어 실행해야
    // 파일 간 const 참조(예: game-engine이 db를 보는 것)가 브라우저와 같게 동작합니다.
    const code = relativePaths
        .map((rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8'))
        .join('\n;\n');

    // 코드는 정확히 한 번만 실행한다.
    // (같은 컨텍스트에서 두 번 실행하면 최상단 const가 재선언되어 SyntaxError)
    // 마지막에 직접 eval을 담은 화살표 함수를 돌려받으면, 그 함수의 스코프 체인을 통해
    // 스크립트 최상단 선언들(game, db, stories...)에 나중에도 접근할 수 있다.
    const evaluate = vm.runInContext(`${code}\n;((__expr) => eval(__expr))`, sandbox);

    return { sandbox, evaluate };
}

module.exports = { loadScripts, ROOT };
