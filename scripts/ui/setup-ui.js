function initSelections() {
    const daySelect = document.getElementById('day-select');
    const practiceDaySelect = document.getElementById('practice-mode-modal-day-select');
    const battleDaySelect = document.getElementById('battle-mode-modal-day-select');
    const skyfallDaySelect = document.getElementById('skyfall-mode-day-select');

    // 스토리 카탈로그와 실제 단어 데이터의 Day를 합쳐 선택 범위를 만든다.
    const daysFromData = new Set();
    if (typeof rawData !== 'undefined' && Array.isArray(rawData))
        rawData.forEach((r) => {
            if (r && r.day) daysFromData.add(Number(r.day));
        });

    const infoDays =
        typeof dayCatalog !== 'undefined'
            ? Object.keys(dayCatalog)
                  .filter((k) => !isNaN(Number(k)))
                  .map(Number)
            : [];
    const allDays = new Set([...infoDays, ...Array.from(daysFromData)]);

    const sortedDays = Array.from(allDays)
        .filter((day) => Number.isSafeInteger(day) && day > 0)
        .sort((a, b) => a - b);

    // 숫자 Day 다음에 전체 범위를 놓는다.
    let html = '';
    sortedDays.forEach((d) => {
        const label =
            dayCatalog && dayCatalog[d] && dayCatalog[d].label ? dayCatalog[d].label : `Day ${d}`;
        html += `<option value="${d}">${escapeHTML(label)}</option>`;
    });
    const allLabel =
        typeof dayCatalog !== 'undefined' && dayCatalog.all && dayCatalog.all.label
            ? dayCatalog.all.label
            : '전체';
    html += `<option value="all">${escapeHTML(allLabel)}</option>`;

    // 공통 선택과 연습·도전·총공세 선택창에 같은 옵션을 사용한다.
    if (daySelect) {
        daySelect.innerHTML = html;
        const last = db.lastSelectedDay || 'all';
        if (Array.from(daySelect.options).some((o) => o.value === String(last))) {
            daySelect.value = last;
        } else {
            daySelect.value = 'all';
            db.commitChanges({ lastSelectedDay: 'all' });
        }
    }

    for (const select of [practiceDaySelect, battleDaySelect, skyfallDaySelect]) {
        if (!select) continue;
        select.innerHTML = html;
        restoreSelectedDay(select);
    }
}
