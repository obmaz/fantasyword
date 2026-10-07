function initSelections() {
    const daySelect = document.getElementById('day-select');
    const practiceDaySelect = document.getElementById('practice-mode-modal-day-select');
    const battleDaySelect = document.getElementById('battle-mode-modal-day-select');

    // Gather days from canonical `dayCatalog` and rawData (avoid referencing legacy `dayInfo`)
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

    // Build options
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

    // Initialize both selects
    if (daySelect) {
        daySelect.innerHTML = html;
        const last = db.lastSelectedDay || 'all';
        if (Array.from(daySelect.options).some((o) => o.value === String(last))) {
            daySelect.value = last;
        } else {
            daySelect.value = 'all';
            db.lastSelectedDay = 'all';
            db.save('lastDay');
        }
    }

    for (const select of [practiceDaySelect, battleDaySelect]) {
        if (!select) continue;
        select.innerHTML = html;
        restoreSelectedDay(select);
    }
}
