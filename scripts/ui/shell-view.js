/** 컵과 주사위 표현. 게임 판정·보상은 주입된 세션이 소유한다. */
function createShellView({ document: doc, openScreen, resetScreen }) {
    const element = (id) => doc.getElementById(id);
    const labels = { red: '빨강', blue: '파랑', yellow: '노랑', green: '초록' };
    let cupButtons = [];
    let animations = [];
    let version = 0;
    const cancelAnimations = () => {
        animations.forEach((animation) => animation.cancel());
        animations = [];
    };
    const controls = (...actions) => {
        const root = element('shell-controls');
        root.replaceChildren();
        const generation = version;
        for (const [label, callback] of actions) {
            const button = doc.createElement('button');
            button.type = 'button';
            button.className = 'image-action-button';
            button.textContent = label;
            button.onclick = () => {
                if (generation === version && !button.disabled) callback();
            };
            root.appendChild(button);
        }
    };
    const drawDice = (dice, cups) => {
        const root = element('shell-die-preview');
        root.replaceChildren();
        root.style.visibility = 'visible';
        dice.forEach((die, cup) => {
            const face = doc.createElement('span');
            face.style.left = `${cups.indexOf(cup) * 33.333 + 16.666}%`;
            face.className = 'shell-die';
            face.dataset.color = die.color;
            face.setAttribute('aria-label', `${labels[die.color]} ${die.number}`);
            const positions = {
                1: [4],
                2: [0, 8],
                3: [0, 4, 8],
                4: [0, 2, 6, 8],
                5: [0, 2, 4, 6, 8],
                6: [0, 2, 3, 5, 6, 8],
            };
            for (let i = 0; i < 9; i++) {
                const pip = doc.createElement('i');
                pip.dataset.visible = String(positions[die.number].includes(i));
                face.appendChild(pip);
            }
            root.appendChild(face);
        });
    };
    return {
        init(onExit) {
            element('shell-header-host').replaceChildren(
                createGameplayHeader({ mode: 'shell', title: '야바위', onExit, document: doc })
            );
        },
        open(dice, begin) {
            version++;
            cancelAnimations();
            openScreen('shell-game', false);
            element('shell-status').textContent = '';
            drawDice(dice, [0, 1, 2]);
            const table = element('shell-table');
            const preview = element('shell-die-preview');
            table.replaceChildren(preview);
            cupButtons = [0, 1, 2].map((cup) => {
                const button = doc.createElement('button');
                button.type = 'button';
                button.className = 'shell-cup';
                button.disabled = true;
                button.style.left = `${cup * 33.333}%`;
                button.dataset.lifted = 'true';
                button.setAttribute('aria-label', `${cup + 1}번째 컵 선택`);
                const image = doc.createElement('img');
                image.src = 'images/theme/parts/shell-cup.webp';
                image.alt = '';
                button.appendChild(image);
                table.appendChild(button);
                return button;
            });
            controls(['섞기 시작', begin]);
        },
        hideDie() {
            element('shell-die-preview').style.visibility = 'hidden';
            cupButtons.forEach((button) => {
                button.dataset.lifted = 'false';
            });
            element('shell-status').textContent = '컵의 움직임을 따라가세요.';
            controls();
        },
        swap(first, second, left, right, duration) {
            cancelAnimations();
            for (const [cup, from, to, arc] of [
                [first, left, right, -18],
                [second, right, left, 18],
            ]) {
                const button = cupButtons[cup];
                button.style.left = `${to * 33.333}%`;
                button.setAttribute('aria-label', `${to + 1}번째 컵 선택`);
                const frame = (position, y) => ({
                    left: `${position * 33.333}%`,
                    transform: `translateY(${y}px)`,
                });
                if (button.animate)
                    animations.push(
                        button.animate(
                            [frame(from, 0), frame((from + to) / 2, arc), frame(to, 0)],
                            { duration, easing: 'ease-in-out' }
                        )
                    );
            }
        },
        ready(query, pick) {
            cancelAnimations();
            const generation = version;
            controls();
            element('shell-status').textContent =
                query.attribute === 'color'
                    ? `${labels[query.value]} 주사위가 든 컵은?`
                    : `숫자 ${query.value}인 주사위가 든 컵은?`;
            cupButtons.forEach((button, cup) => {
                button.disabled = false;
                button.onclick = () => {
                    if (generation === version && !button.disabled) pick(cup);
                };
            });
        },
        offer(cash, double) {
            cupButtons.forEach((button) => {
                button.disabled = true;
            });
            element('shell-status').textContent =
                '정답! 10을 받을까요, 다른 주사위의 컵을 찾아 2배에 도전할까요?';
            controls(['10 받기', cash], ['2배 도전', double]);
        },
        reveal(dice, cups) {
            cancelAnimations();
            cupButtons.forEach((button) => {
                button.disabled = true;
                button.dataset.lifted = 'true';
            });
            drawDice(dice, cups);
        },
        saveFailed(retry) {
            element('shell-status').textContent =
                '결과를 저장하지 못했습니다. 같은 결과로 다시 저장할 수 있습니다.';
            controls(['저장 재시도', retry]);
        },
        done(points, casino, again) {
            element('shell-status').textContent =
                `${points ? '성공!' : '아쉬워요.'} ${casino ? `획득 ${points}골드` : `테스트 점수 ${points}`} · 보유 금화를 걸지 않는 체험입니다.`;
            controls([casino ? '지도로 돌아가기' : '다시 하기', again]);
        },
        exit() {
            version++;
            cancelAnimations();
            resetScreen('shell-game');
            openScreen('title-screen', false);
        },
    };
}
