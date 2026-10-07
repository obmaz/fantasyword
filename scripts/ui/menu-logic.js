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
