/**
 * 전투 DOM만 소유한다. 게임/저장소를 읽지 않고 모델과 이벤트 콜백을 받는다.
 * @param {{document: Document, schedule: (callback: () => void, delay: number) => unknown, escapeHTML: (text: string) => string, openScreen?: (id: string, animated: boolean) => void, closeScreen?: (id: string, animated: boolean) => void}} dependencies
 */
function createBattleView({
    document: doc,
    schedule,
    escapeHTML,
    openScreen,
    closeScreen,
    attacks,
}) {
    const element = (id) => doc.getElementById(id);
    let optionButtons = [];
    let letterButtons = [];
    let spellingResizeObserver;
    let spellingPattern = '';
    let questionVersion = 0;
    let floatVersion = 0;
    let attackVersion = 0;
    let inputPattern = '';
    let keyboardButtons = [];
    function lockKeyboard(locked) {
        keyboardButtons.forEach((button) => {
            button.disabled = locked;
        });
    }
    function typeLetter(key) {
        const input = element('boss-input');
        if (input.disabled) return;
        const letters = input.value.replace(/[^a-z]/gi, '').split('');
        if (key === 'Backspace') letters.pop();
        else if (letters.length < (inputPattern.match(/[a-z]/gi) || []).length)
            letters.push(key.toLowerCase());
        let index = 0;
        let value = '';
        for (const character of inputPattern) {
            if (/[a-z]/i.test(character)) {
                if (!letters[index]) break;
                value += letters[index++];
            } else if (index > 0) value += character;
        }
        input.value = value;
        updateInputSlots();
    }
    function updateInputSlots() {
        const input = element('boss-input');
        const slots = element('boss-letter-slots');
        slots.innerHTML = '';
        const typed = Array.from(input.value);
        const pattern = Array.from(inputPattern);
        for (let index = 0; index < Math.max(pattern.length, typed.length); index++) {
            const slot = doc.createElement('span');
            slot.className = /[a-z]/i.test(pattern[index] || 'a')
                ? 'letter-slot'
                : 'letter-separator';
            slot.textContent =
                typed[index] || (/[^a-z]/i.test(pattern[index] || 'a') ? pattern[index] : '\u00a0');
            slot.classList.toggle(
                'letter-slot-active',
                index === (input.selectionStart ?? typed.length)
            );
            slots.appendChild(slot);
        }
    }
    function questionLater(callback, delay) {
        const version = questionVersion;
        schedule(() => {
            if (version === questionVersion) callback();
        }, delay);
    }
    function effectArt(name) {
        // Reuse the build-versioned preload URL, avoiding a second download on first hit.
        return (
            doc
                .querySelector(
                    `link[rel="preload"][href^="images/theme/parts/combat-${name}.webp"]`
                )
                ?.getAttribute('href') || `images/theme/parts/combat-${name}.webp`
        );
    }
    function clearAttack() {
        attackVersion++;
        element('hero-wrapper').classList.remove('hero-active');
        delete element('hero-wrapper').dataset.strike;
        element('monster-img').classList.remove('mob-active');
        const layer = element('combat-effects');
        layer.className = 'effect-layer';
        layer.dataset.strike = '';
        layer.dataset.element = '';
        layer.dataset.secondary = '';
        layer.dataset.echo = 'false';
        layer.dataset.combo = 'false';
        element('effect-slash').className = 'attack-impact';
        element('attack-particles').innerHTML = '';
        const arena = doc.querySelector('.battle-arena');
        if (arena) delete arena.dataset.strike;
    }
    function positionAttack() {
        const arena = doc.querySelector('.battle-arena');
        const hero = element('hero-wrapper');
        const monster = element('monster-img').parentElement;
        const fallback = { left: 0, top: 0, width: 360, height: 260 };
        const bounds = arena?.getBoundingClientRect?.() || fallback;
        const a = hero.getBoundingClientRect?.() || { left: 30, top: 140, width: 100, height: 100 };
        const b = monster?.getBoundingClientRect?.() || {
            left: 240,
            top: 140,
            width: 100,
            height: 100,
        };
        const size = Math.min(b.width * 1.45, bounds.height * 0.65, bounds.width * 0.44, 180);
        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
        const sourceX = a.left - bounds.left + a.width * 0.6;
        const sourceY = a.top - bounds.top + a.height * 0.55;
        const targetX = clamp(
            b.left - bounds.left + b.width * 0.5,
            size / 2,
            bounds.width - size / 2
        );
        const targetY = clamp(
            b.top - bounds.top + b.height * 0.5,
            size / 2,
            bounds.height - size / 2
        );
        const layer = element('combat-effects');
        for (const [name, value] of Object.entries({
            'source-x': sourceX,
            'source-y': sourceY,
            'target-x': targetX,
            'target-y': targetY,
            'travel-x': targetX - sourceX,
            'travel-y': targetY - sourceY,
            'impact-size': size,
            'weapon-size': Math.min(a.width * 0.5, 58),
            lunge: Math.min(Math.max(0, targetX - sourceX) * 0.18, 32),
        })) {
            layer.style.setProperty(`--${name}`, `${value}px`);
            if (name === 'lunge') hero.style.setProperty('--lunge', `${value}px`);
        }
        return size;
    }
    function resetEffects() {
        clearAttack();
        for (const [id, classes] of [
            ['hero-img', ['hero-hit-anim']],
            ['hero-head', ['hero-hit-anim']],
            ['monster-img', ['mob-attack-anim']],
            ['dmg-txt', ['float-up']],
        ])
            element(id)?.classList.remove(...classes);
        doc.querySelector('.battle-arena')?.classList.remove('screen-shake');
        element('dmg-txt').innerText = '';
    }
    return {
        stop() {
            questionVersion++;
            spellingResizeObserver?.disconnect();
            floatVersion++;
            resetEffects();
            lockKeyboard(true);
            element('boss-box').onkeydown = null;
            element('battle-mode-game').dataset.answerEntry = '';
            closeScreen?.('equipment-route-modal', false);
        },
        chooseRoute(onPick) {
            for (const route of ['safe', 'treasure'])
                element(`route-${route}-btn`).onclick = () => onPick(route);
            openScreen?.('equipment-route-modal', true);
        },
        closeRoute() {
            closeScreen?.('equipment-route-modal', false);
        },
        readCount() {
            return element('count-select')?.value || '10';
        },
        lockTitle() {
            element('title-screen').inert = true;
        },
        exit() {
            const audio = element('background-music');
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
            element('music-info-overlay').style.display = 'none';
        },
        beginQuestion(sprite, progress, encounter = null) {
            questionVersion++;
            spellingResizeObserver?.disconnect();
            floatVersion++;
            resetEffects();
            optionButtons = [];
            letterButtons = [];
            element('monster-img').src = sprite;
            element('monster-img').alt = encounter?.name || '몬스터';
            const screen = element('battle-mode-game');
            screen.dataset.answerEntry = '';
            screen.dataset.monster = encounter?.id || '';
            screen.dataset.questionKind = encounter?.kind || '';
            element('wave-badge').innerText = progress;
            element('equipment-hint').hidden = true;
            element('equipment-hint').innerText = '';
            element('q-label').innerText = '';
            element('q-label').style.display = 'none';
            element('question-instruction').innerText = '';
            element('listening-panel').hidden = true;
            element('spelling-panel').hidden = true;
            element('spelling-panel').onkeydown = null;
            element('spelling-answer').classList.remove('spelling-revealed');
            const quizArea = doc.querySelector('.quiz-area');
            if (quizArea) quizArea.scrollTop = 0;
            element('game-info-badge').style.display = 'block';
            element('skill-display').style.visibility = 'visible';
        },
        objective(prompt, options, onAnswer) {
            const version = questionVersion;
            element('boss-box').style.display = 'none';
            const box = element('options-box');
            box.style.display = 'grid';
            box.innerHTML = '';
            element('q-text').innerText = prompt;
            optionButtons = options.map((option, index) => {
                const button = doc.createElement('button');
                button.className = 'option-btn';
                button.innerText = option.label;
                button.onclick = () => {
                    if (version === questionVersion && !button.disabled) onAnswer(index);
                };
                box.appendChild(button);
                return button;
            });
            optionButtons[0]?.focus({ preventScroll: true });
        },
        subjective(data, title, hint, onSubmit, focusInput = true) {
            const version = questionVersion;
            element('boss-box').style.display = 'flex';
            element('options-box').style.display = 'none';
            element('boss-title').innerText = title;
            element('q-text').innerText = data.meaning;
            element('boss-hint').innerText = hint;
            element('boss-hint').classList.remove('boss-hint-revealed');
            const input = element('boss-input');
            input.value = '';
            inputPattern = data.word || '';
            input.oninput = updateInputSlots;
            input.onclick = updateInputSlots;
            updateInputSlots();
            input.disabled = false;
            input.readOnly = true;
            input.setAttribute('inputmode', 'none');
            element('battle-mode-game').dataset.answerEntry = 'letters';
            const keyboard = element('boss-keyboard');
            keyboard.innerHTML = '';
            keyboardButtons = [];
            for (const row of ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']) {
                const line = doc.createElement('div');
                line.className = 'english-keyboard-row';
                for (const key of [...row, ...(row === 'ZXCVBNM' ? ['Backspace'] : [])]) {
                    const button = doc.createElement('button');
                    button.type = 'button';
                    button.className =
                        key === 'Backspace' ? 'english-key english-key-delete' : 'english-key';
                    button.textContent = key === 'Backspace' ? '⌫' : key;
                    button.setAttribute(
                        'aria-label',
                        key === 'Backspace' ? '한 글자 지우기' : `${key} 입력`
                    );
                    button.onclick = () => {
                        if (version !== questionVersion || button.disabled) return;
                        typeLetter(key);
                        input.focus({ preventScroll: true });
                    };
                    line.appendChild(button);
                    keyboardButtons.push(button);
                }
                keyboard.appendChild(line);
            }
            input.classList.remove('boss-input-correct', 'boss-input-wrong');
            input.onkeydown = (event) => {
                if (
                    event.isComposing ||
                    version !== questionVersion ||
                    input.disabled ||
                    event.ctrlKey ||
                    event.metaKey ||
                    event.altKey
                )
                    return;
                if (event.key === 'Enter') {
                    event.preventDefault?.();
                    onSubmit();
                } else if (/^[a-z]$/i.test(event.key) || event.key === 'Backspace') {
                    event.preventDefault?.();
                    typeLetter(event.key);
                }
            };
            element('boss-box').onkeydown = (event) => {
                if (event.target !== input) input.onkeydown?.(event);
            };
            if (focusInput) input.focus({ preventScroll: true });
            const submit = doc.querySelector('#boss-box .boss-submit');
            if (submit) submit.disabled = false;
        },
        spelling(prompt, pattern, tiles, onPick, onRemove, onSubmit) {
            const version = questionVersion;
            spellingPattern = pattern;
            element('boss-box').style.display = 'none';
            element('options-box').style.display = 'none';
            const panel = element('spelling-panel');
            panel.hidden = false;
            doc.querySelectorAll('#spelling-panel .spelling-tools button').forEach((button) => {
                button.disabled = false;
            });
            element('q-text').innerText = prompt;
            const box = element('spelling-tiles');
            spellingResizeObserver?.disconnect();
            box.style.setProperty(
                '--tile-columns',
                String(Math.max(1, Math.ceil(tiles.length / 2)))
            );
            box.innerHTML = '';
            letterButtons = tiles.map((letter, index) => {
                const button = doc.createElement('button');
                button.type = 'button';
                button.className = 'letter-tile';
                const label = doc.createElement('span');
                label.textContent = letter;
                button.appendChild(label);
                button.setAttribute('aria-label', `${letter} 선택`);
                button.onclick = () => {
                    if (version === questionVersion && !button.disabled) onPick(index);
                };
                box.appendChild(button);
                return button;
            });
            if (typeof ResizeObserver !== 'undefined') {
                spellingResizeObserver = new ResizeObserver(([entry]) => {
                    const style = getComputedStyle(box);
                    const size = Number.parseFloat(style.getPropertyValue('--tile-size')) || 44;
                    const gap = Number.parseFloat(style.columnGap) || 0;
                    const columns =
                        tiles.length * size + Math.max(0, tiles.length - 1) * gap <=
                        entry.contentRect.width
                            ? tiles.length
                            : Math.ceil(tiles.length / 2);
                    box.style.setProperty('--tile-columns', String(Math.max(1, columns)));
                });
                spellingResizeObserver.observe(box);
            }
            panel.onkeydown = (event) => {
                if (
                    version !== questionVersion ||
                    event.isComposing ||
                    event.ctrlKey ||
                    event.metaKey ||
                    event.altKey
                )
                    return;
                if (event.key === 'Backspace') {
                    event.preventDefault();
                    onRemove();
                } else if (event.key === 'Enter' && event.target === element('spelling-submit')) {
                    event.preventDefault();
                    onSubmit();
                } else if (/^[a-z]$/i.test(event.key)) {
                    const index = tiles.findIndex(
                        (letter, i) =>
                            letter.toLowerCase() === event.key.toLowerCase() &&
                            !letterButtons[i].disabled
                    );
                    if (index >= 0) {
                        event.preventDefault();
                        onPick(index);
                    }
                }
            };
            element('spelling-submit').disabled = true;
            letterButtons[0]?.focus({ preventScroll: true });
        },
        spellingProgress(tiles, chosen) {
            const answer = element('spelling-answer');
            answer.innerHTML = '';
            let index = 0;
            for (const character of spellingPattern) {
                const slot = doc.createElement('span');
                slot.className = character === '_' ? 'letter-slot' : 'letter-separator';
                slot.innerText = character === '_' ? tiles[chosen[index++]] || '·' : character;
                answer.appendChild(slot);
            }
            letterButtons.forEach((button, i) => {
                button.disabled = chosen.includes(i) || (index > 0 && chosen.length >= index);
            });
            element('spelling-submit').disabled = chosen.length !== index;
            const next = letterButtons.find((button) => !button.disabled);
            (next || element('spelling-submit')).focus({ preventScroll: true });
        },
        listening() {
            element('listening-panel').hidden = false;
            element('listen-word-btn').disabled = false;
            element('listen-fallback-btn').disabled = false;
            const label = element('listen-word-btn').querySelector('span');
            if (label) label.innerText = '듣고 풀기';
            // 실제 버튼 동작은 공통 이벤트 위임이 소유한다.
            element('listening-status').innerText =
                '발음을 듣고 한국어 뜻을 고르세요. 발음이 끝나면 답을 고를 수 있습니다.';
            optionButtons.forEach((button) => {
                button.disabled = true;
            });
        },
        listeningState(state, options) {
            element('listen-word-btn').disabled = state === 'playing' || state === 'answered';
            const label = element('listen-word-btn').querySelector('span');
            if (label) label.innerText = state === 'playing' ? '듣는 중…' : '다시 듣기';
            element('listening-status').innerText =
                state === 'playing'
                    ? '발음을 재생하고 있습니다.'
                    : '들린 단어의 뜻을 고르세요. 다시 들어도 남은 시간은 유지됩니다.';
            if (state === 'ready')
                optionButtons.forEach((button, i) => {
                    button.disabled = options[i].disabled;
                });
        },
        readAnswer() {
            return element('boss-input').value;
        },
        feedback(correct, selectedIndex, lockInput = false) {
            optionButtons.forEach((button) => {
                button.disabled = true;
            });
            letterButtons.forEach((button) => {
                button.disabled = true;
            });
            element('spelling-panel').onkeydown = null;
            element('spelling-submit').disabled = true;
            doc.querySelectorAll('#spelling-panel .spelling-tools button').forEach((button) => {
                button.disabled = true;
            });
            element('listen-word-btn').disabled = true;
            element('listen-fallback-btn').disabled = true;
            if (selectedIndex !== null && selectedIndex !== undefined) {
                optionButtons[selectedIndex]?.classList.add(
                    correct ? 'option-btn-picked-correct' : 'option-btn-picked-wrong'
                );
            } else if (element('boss-box').style.display !== 'none') {
                element('boss-input').classList.add(
                    correct ? 'boss-input-correct' : 'boss-input-wrong'
                );
            }
            if (lockInput || element('boss-box').style.display !== 'none') {
                lockKeyboard(true);
                element('boss-input').disabled = true;
                element('boss-input').onkeydown = null;
                const submit = doc.querySelector('#boss-box .boss-submit');
                if (submit) submit.disabled = true;
            }
        },
        equipmentHint(text) {
            element('equipment-hint').hidden = false;
            element('equipment-hint').innerText = text;
        },
        shieldBlock(index) {
            clearAttack();
            positionAttack();
            element('combat-effects').classList.add('is-blocking');
            const version = attackVersion;
            questionLater(() => {
                if (version === attackVersion) clearAttack();
            }, 650);
            optionButtons.forEach((button) => {
                button.disabled = true;
            });
            if (index !== null && index !== undefined)
                optionButtons[index]?.classList.add('option-btn-picked-wrong');
            element('boss-input').value = '';
            updateInputSlots();
            element('boss-input').disabled = true;
            lockKeyboard(true);
            const submit = doc.querySelector('#boss-box .boss-submit');
            if (submit) submit.disabled = true;
            letterButtons.forEach((button) => {
                button.disabled = true;
            });
            element('spelling-submit').disabled = true;
            doc.querySelectorAll('#spelling-panel .spelling-tools button').forEach((button) => {
                button.disabled = true;
            });
            element('listen-word-btn').disabled = true;
            element('listen-fallback-btn').disabled = true;
        },
        retry(options) {
            lockKeyboard(false);
            optionButtons.forEach((button, i) => {
                button.disabled = options[i].disabled;
            });
            element('boss-input').disabled = false;
            const submit = doc.querySelector('#boss-box .boss-submit');
            if (submit) submit.disabled = false;
            letterButtons.forEach((button) => {
                button.disabled = false;
            });
            doc.querySelectorAll('#spelling-panel .spelling-tools button').forEach((button) => {
                button.disabled = false;
            });
            element('listen-word-btn').disabled = false;
            element('listen-fallback-btn').disabled = false;
        },
        disableOptions(indices) {
            indices.forEach((index) => {
                const button = optionButtons[index];
                if (!button) return;
                button.classList.add('disabled');
                button.disabled = true;
                button.style.opacity = '0.2';
            });
        },
        reveal(answer, subjective, correctIndex) {
            if (!element('spelling-panel').hidden) {
                element('spelling-answer').innerText = answer;
                element('spelling-answer').classList.add('spelling-revealed');
            } else if (subjective) {
                element('boss-hint').innerText = answer;
                element('boss-hint').classList.add('boss-hint-revealed');
            } else optionButtons[correctIndex]?.classList.add('option-btn-correct');
        },
        attack(input) {
            clearAttack();
            const size = positionAttack();
            const profile = attacks.resolve(input);
            const layer = element('combat-effects');
            layer.dataset.strike = profile.motion;
            layer.dataset.element = profile.element;
            layer.dataset.secondary = profile.secondary || '';
            layer.dataset.echo = String(profile.echo);
            layer.dataset.combo = String(profile.combo);
            layer.style.setProperty('--impact-delay', `${profile.impactMs}ms`);
            layer.style.setProperty('--flight-duration', `${profile.impactMs + 150}ms`);
            element('weapon-flight-art').src = `images/theme/parts/${profile.icon}.webp`;
            element('attack-impact-art').src = effectArt(profile.element);
            element('attack-echo-art').src = effectArt(
                profile.element === 'gold' ? 'basic' : profile.element
            );
            element('attack-secondary-art').src = effectArt(profile.secondary || 'basic');
            element('attack-gold-art').src = effectArt('gold');
            const particles = element('attack-particles');
            for (let i = 0; i < 7; i++) {
                const spark = doc.createElement('i');
                spark.style.setProperty(
                    '--spark-x',
                    `${Math.cos((i * Math.PI * 2) / 7) * size * 0.4}px`
                );
                spark.style.setProperty(
                    '--spark-y',
                    `${Math.sin((i * Math.PI * 2) / 7) * size * 0.4}px`
                );
                spark.style.setProperty('--spark-angle', `${i * 51}deg`);
                particles.appendChild(spark);
            }
            // Clear old animation styles before replaying on the same DOM nodes.
            void layer.offsetWidth;
            element('hero-wrapper').dataset.strike = profile.motion;
            doc.querySelector('.battle-arena').dataset.strike = profile.motion;
            element('hero-wrapper').classList.add('hero-active');
            layer.classList.add('is-attacking');
            const version = attackVersion;
            questionLater(() => {
                if (version !== attackVersion) return;
                element('effect-slash').classList.add(`eff-${profile.element}`);
                if (profile.secondary) layer.classList.add('has-secondary');
                element('monster-img').classList.add('mob-active');
            }, profile.impactMs);
            questionLater(() => {
                if (version === attackVersion) clearAttack();
            }, profile.durationMs);
        },
        goldAttack() {
            // Gold bonus is a separate sparkle layer, preserving elemental attacks.
            if (
                element('combat-effects').classList.contains('is-attacking') &&
                element('combat-effects').dataset.element !== 'gold'
            )
                element('combat-effects').classList.add('has-gold');
        },
        hit() {
            element('monster-img').classList.add('mob-attack-anim');
            element('hero-img').classList.add('hero-hit-anim');
            element('hero-head').classList.add('hero-hit-anim');
            doc.querySelector('.battle-arena')?.classList.add('screen-shake');
            questionLater(() => {
                element('monster-img').classList.remove('mob-attack-anim');
                element('hero-img').classList.remove('hero-hit-anim');
                element('hero-head').classList.remove('hero-hit-anim');
                doc.querySelector('.battle-arena')?.classList.remove('screen-shake');
            }, 400);
        },
        floatText(text, type, detail = '') {
            const version = ++floatVersion;
            const node = element('dmg-txt');
            node.innerText = text;
            node.className = `damage-txt float-up ${type === 'gold' ? 'dmg-gold' : 'dmg-red'}${detail ? ' damage-with-detail' : ''}`;
            if (detail) {
                const label = doc.createElement('span');
                label.className = 'damage-detail';
                label.innerText = detail;
                node.appendChild(label);
            }
            questionLater(() => {
                if (version === floatVersion) {
                    node.classList.remove('float-up');
                    node.innerText = '';
                }
            }, 1000);
        },
        timer(timeLeft, maxTime, timed = true) {
            const overlay = doc.querySelector('.overlay-timer');
            if (overlay)
                overlay.hidden = Boolean(element('battle-mode-game').dataset.monster) && !timed;
            const bar = element('overlay-timer');
            if (!bar) return;
            bar.style.width = `${Math.max(0, Math.min(100, (timeLeft / maxTime) * 100))}%`;
            bar.classList.toggle('timer-danger', timed && timeLeft <= 3);
        },
        results(win, mode, stats, gold, rows, wrongWords, hadRetry = false) {
            element('res-retry-note').hidden = !hadRetry;
            element('res-retry-note').innerText =
                '방패 재도전 사용 · 맞힌 개수는 최종 제출 기준입니다. 처음 틀린 단어는 복수 퀘스트에 남아 있어요.';
            element('result-review-btn').hidden = wrongWords.length === 0;
            element('res-title').innerText = win || mode === 'boss' ? '전투 완료' : '도전 종료';
            element('res-subtitle').innerText =
                mode === 'story' ? '스토리' : mode === 'boss' ? '전체 단어 도전' : '도전';
            const total = rows.find(({ label }) => label === '전체') || rows.at(-1);
            element('res-summary').innerText = total
                ? `정답 ${total.correct}/${total.total} · ${total.total ? Math.round((total.correct / total.total) * 100) : 0}%`
                : '';
            element('res-gain').innerText = stats.gain;
            element('res-lost').innerText = stats.lost;
            element('res-current-total').innerText = gold;
            element('res-record').innerHTML = rows
                .map(({ label, correct, total }) => {
                    const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
                    return `<div class="result-modal-section">${escapeHTML(label)}</div><div class="result-modal-item"><div class="result-stat-row"><span class="stat-metric"><b>맞힌 개수: </b><span class="result-stat-value">${correct}/${total}</span></span><span class="stat-metric"><b class="result-stat-label">정답률: </b><span class="result-stat-value">${rate}%</span></span></div></div>`;
                })
                .join('');
            element('res-wrong-words').innerHTML =
                '<div class="result-modal-section">❌ 틀린 단어</div>' +
                (wrongWords.length
                    ? wrongWords
                          .map(
                              (word) =>
                                  `<div class="result-wrong-word-item"><span class="wrong-word">${escapeHTML(word.word)}</span> <span class="wrong-meaning">${escapeHTML(word.meaning)}</span></div>`
                          )
                          .join('')
                    : '<div class="result-modal-item result-modal-item-empty">없음</div>');
        },
    };
}
