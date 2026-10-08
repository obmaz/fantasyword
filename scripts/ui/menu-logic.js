/** 선택값만 복원한다. 배치와 라디오 선택 표시는 HTML/CSS가 소유한다. */
function restoreSelectedDay(select) {
    if (!select) return;
    const value = String(db.lastSelectedDay || 'all');
    select.value = Array.from(select.options).some((option) => option.value === value)
        ? value
        : 'all';
}
function openPracticeModal() {
    restoreSelectedDay(document.getElementById('practice-mode-modal-day-select'));
    openScreenOverlay('practice-mode-modal', false);
}
function openBattleModeModal() {
    restoreSelectedDay(document.getElementById('battle-mode-modal-day-select'));
    const count = document.getElementById('battle-mode-modal-count-select');
    const savedCount = gameStorage.get('v7_last_count', '10');
    if (count)
        count.value = Array.from(count.options).some((option) => option.value === savedCount)
            ? savedCount
            : '10';
    const savedType = gameStorage.get('v7_last_question_type', 'monsters');
    const type = ['monsters', 'objective', 'subjective', 'mixed'].includes(savedType)
        ? savedType
        : 'monsters';
    const group = document.getElementById('battle-mode-modal-question-type-group');
    const radio = group?.querySelector(`input[value="${type}"]`);
    if (radio) radio.checked = true;
    openScreenOverlay('battle-mode-modal', false);
}

/** 로비를 터치하면 현재 오른손 무기의 모션과 속성으로 짧은 이펙트를 그린다. */
function showLobbyWeaponEffect(event) {
    const title = document.getElementById('title-screen');
    if (!title || title.style.display === 'none') return;
    const weaponId = db.equipped['hand-1'] || db.equippedWeapon || 'basic';
    const weapon = weapons.find((item) => item.id === weaponId);
    const secondary = weapons.find((item) => item.id === db.equipped['hand-2']);
    const profile = battleAttackProfiles.resolve({
        weaponId,
        effect: weapon?.effect,
        secondaryEffect: secondary?.effect,
    });
    const frame = title.getBoundingClientRect();
    const burst = document.createElement('div');
    burst.className = 'lobby-weapon-burst';
    burst.dataset.element = profile.element;
    burst.dataset.motion = profile.motion;
    burst.style.left = `${event.clientX - frame.left}px`;
    burst.style.top = `${event.clientY - frame.top}px`;
    const art = document.createElement('img');
    art.src = `images/theme/parts/${profile.icon}.webp`;
    art.alt = '';
    burst.appendChild(art);
    for (let i = 0; i < 5; i++) {
        const particle = document.createElement('span');
        particle.style.setProperty('--i', i);
        burst.appendChild(particle);
    }
    title.appendChild(burst);
    setTimeout(() => burst.remove(), 900);
}
