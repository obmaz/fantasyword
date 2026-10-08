/**
 * UI 관리 시스템
 * 게임 UI 업데이트 및 렌더링 관리
 */

const ui = {
    /**
     * 골드 표시를 업데이트합니다
     */
    updateGold: () => {
        for (const id of ['title-ui-gold', 'overlay-gold']) {
            const amount = document.getElementById(id);
            if (!amount) continue;
            amount.innerText = db.gold;
            amount.title = `${db.gold} G`;
        }
        document.querySelectorAll('[data-menu-gold]').forEach((amount) => {
            amount.innerText = formatMenuNumber(db.gold);
        });
    },

    /**
     * 게임 정보 배지를 업데이트합니다
     * @param {string} mode - 게임 모드
     * @param {string|number} day - Day 값
     */
    updateGameInfo: (mode, day) => {
        document.getElementById('battle-mode-game').dataset.gameMode = mode;
        const title = document.getElementById('battle-screen-title');
        if (title)
            title.textContent =
                mode === 'story'
                    ? '스토리 모드'
                    : mode === 'boss'
                      ? '전체 단어 도전'
                      : mode === 'revenge'
                        ? '복수 퀘스트'
                        : '1일 전투';
        let dayText;
        if (mode === 'boss') {
            dayText = '전체 도전';
        } else if (mode === 'revenge') {
            dayText = '복수 퀘스트';
        } else {
            if (day === 'all') {
                dayText = '전체';
            } else if (day && !isNaN(Number(day))) {
                dayText = `Day ${day}`;
            } else {
                const currentDay = game.currentDay;
                if (currentDay === 'all') {
                    dayText = '전체';
                } else if (currentDay && !isNaN(Number(currentDay))) {
                    dayText = `Day ${currentDay}`;
                } else {
                    dayText = '전체';
                }
            }
        }
        const gameInfoEl = document.getElementById('game-info-badge');
        if (gameInfoEl) {
            gameInfoEl.innerText = dayText;
        }
    },

    /**
     * 히어로 비주얼을 업데이트합니다 (무기, 이펙트 등)
     */
    updateVisuals: () => {
        document.getElementById('hero-img').src = 'images/battle/hero.webp';

        // 무기 -> hand-1 (게임플레이)
        const hand1Id = db.equipped['hand-1'] || db.equippedWeapon || 'basic';
        const wData =
            weapons.find((w) => w.id === hand1Id) ||
            weapons.find((w) => w.id === db.equippedWeapon) ||
            weapons.find((w) => w.id === 'basic');
        const heroWeaponEl = document.getElementById('hero-weapon');
        if (heroWeaponEl) heroWeaponEl.innerHTML = itemIconMarkup(wData);

        // 이펙트 -> hand-2 (시각 효과)
        const hand2Id = db.equipped['hand-2'];
        const effData = weapons.find((w) => w.id === hand2Id);
        const heroEffEl = document.getElementById('hero-effect');
        if (heroEffEl) {
            heroEffEl.innerHTML = effData ? itemIconMarkup(effData) : '';
            heroEffEl.style.display = effData ? 'block' : 'none';
        }

        // 장착 요약 (클릭 없이 표시)
        const summaryEl = document.getElementById('equipped-summary');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="eq" title="무기: ${
                    wData.name
                }"><span class="icon">${wData.icon}</span><div><div style="font-weight:700">${
                    wData.name
                }</div><div style="font-size:12px;color:#aaa">x${
                    wData.multiplier || 1
                }</div></div></div>
                ${
                    effData
                        ? `<div class="eq" title="이펙트: ${effData.name}"><span class="icon">${effData.icon}</span><div><div style="font-weight:700">${effData.name}</div><div style="font-size:12px;color:#aaa">${effData.desc}</div></div></div>`
                        : ''
                }
            `;
        }
    },

    /**
     * 스킬 바를 업데이트합니다
     */
    updateSkills: () => {
        const gear = game.gear;
        const noUsefulHint =
            game.mode !== 'boss' &&
            !game.currentQ?.isBoss &&
            game.options.filter((option) => !option.correct && !option.disabled).length <= 1;
        const equipmentBar = document.getElementById('equipment-display');
        equipmentBar.innerHTML = '';
        if (gear) {
            const append = (id, text, title, action = null, disabled = false) => {
                const node = document.createElement(action ? 'button' : 'span');
                node.className = 'equipment-control';
                node.innerHTML = `${itemIconMarkup({ id })}<span>${text}</span>`;
                node.title = title;
                if (action) {
                    node.onclick = action;
                    node.disabled = disabled;
                }
                equipmentBar.appendChild(node);
            };
            if (gear.weapon)
                append('basic', `연속 ${gear.combo}/3`, '3연속 정답마다 추가 공격 +10 G');
            if (gear.protection)
                append(
                    'shield_item',
                    `방패 ${gear.shield}/1`,
                    '전투당 오답 1회 골드 손실 없이 재도전'
                );
            if (gear.insight)
                append(
                    'helmet',
                    `힌트 ${gear.hint}/1`,
                    '투구 무료 힌트: 보기 제거 또는 일부 철자',
                    game.useEquipmentHint,
                    !gear.hint ||
                        !game.currentQ ||
                        game.isProcessing ||
                        noUsefulHint ||
                        (game.currentQ.questionKind === 'listening' && !game.listeningReady)
                );
            if (gear.boots)
                append(
                    'boots',
                    gear.route === 'safe'
                        ? '시간 +5초'
                        : gear.route === 'treasure'
                          ? '골드 +10%'
                          : '경로 선택',
                    '부츠의 모험 경로 효과'
                );
        }
        equipmentBar.hidden = !gear;
        const container = document.getElementById('skill-display');
        container.innerHTML = '';

        const hintData = relics.find((r) => r.id === 'hint');
        const ultimateData = relics.find((r) => r.id === 'ultimate');

        const isBossQuestion = game.mode === 'boss' || !!game.currentQ?.isBoss;
        const waitingForSound = game.currentQ?.questionKind === 'listening' && !game.listeningReady;

        let hasSkills = false;

        // 황금장갑 (패시브 아이템 - 항상 활성)
        if (db.has('goldGlove')) {
            hasSkills = true;
            const gloveBtn = document.createElement('div');
            gloveBtn.className = 'skill-btn skill-passive';
            gloveBtn.innerHTML = `${itemIconMarkup({ id: 'goldGlove' })} <span class="skill-count">${
                db.durability['goldGlove'] || 0
            }/30</span>`;
            gloveBtn.title = '황금장갑 (패시브): 골드 획득 x1.5배';
            container.appendChild(gloveBtn);
        }

        if (hintData && db.skills.hint > 0) {
            hasSkills = true;
            const hintBtn = document.createElement('button');
            hintBtn.className = isBossQuestion
                ? 'skill-btn skill-active disabled'
                : 'skill-btn skill-active';
            const hintIcon = itemIconMarkup(hintData);
            hintBtn.innerHTML = `<span>${hintIcon}</span> <span class="skill-count">${db.skills.hint}</span>`;
            hintBtn.onclick = game.useHint;
            hintBtn.disabled =
                isBossQuestion || game.isProcessing || waitingForSound || noUsefulHint;
            hintBtn.title = isBossQuestion ? '힌트: 주관식에서는 사용 불가' : '힌트: 클릭하여 사용';
            container.appendChild(hintBtn);
        }

        if (ultimateData && db.skills.ultimate > 0) {
            hasSkills = true;
            const ultimateBtn = document.createElement('button');
            ultimateBtn.className = isBossQuestion
                ? 'skill-btn skill-active disabled'
                : 'skill-btn skill-active';
            const ultimateIcon = itemIconMarkup(ultimateData);
            ultimateBtn.innerHTML = `<span>${ultimateIcon}</span> <span class="skill-count">${db.skills.ultimate}</span>`;
            ultimateBtn.onclick = game.useUltimate;
            ultimateBtn.disabled = isBossQuestion || game.isProcessing || waitingForSound;
            ultimateBtn.title = isBossQuestion
                ? '필살기: 주관식에서는 사용 불가'
                : '필살기: 클릭하여 사용';
            container.appendChild(ultimateBtn);
        }

        // 스킬이 하나도 없으면 placeholder 표시
        if (!hasSkills) {
            const placeholder = document.createElement('div');
            placeholder.className = 'skill-placeholder';
            placeholder.innerText = '장착한 스킬 없음';
            container.appendChild(placeholder);
        }
    },

    /**
     * 음악 선택 드롭다운 옵션을 동적으로 렌더링합니다
     * @param {string} selectId - select 요소의 ID
     * @param {number} currentMusicNum - 현재 선택된 음악 번호
     */
    renderMusicSelectOptions: (selectId, currentMusicNum) => {
        const selectEl = document.getElementById(selectId);
        if (!selectEl) return;

        selectEl.innerHTML = ''; // 기존 옵션 제거

        // 실제 존재하는 파일 수(audio-manager의 MUSIC_TRACK_COUNT)만 노출해야
        // 없는 트랙을 골라 404 → 무음이 되는 일을 막을 수 있음
        const trackCount = window.MUSIC_TRACK_COUNT || currentMusicIndices.max;
        for (let i = 1; i <= trackCount; i++) {
            const option = document.createElement('option');
            option.value = String(i);
            option.innerText = `배경음악 ${i}`;

            if (i === currentMusicNum) {
                option.selected = true;
            }
            selectEl.appendChild(option);
        }
    },
};

// 콘솔/디버깅을 위해 노출하고 다른 스크립트가 덮어쓰지 않도록 보호
try {
    window.ui = window.ui || ui;
} catch (e) {
    /* 무시 */
}
