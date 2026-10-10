/** Reusable image keyboard for answer entry and letter guessing. */
function renderEnglishKeyboard(root, { document: doc = document, onKey, withDelete = true }) {
    root.replaceChildren();
    const buttons = [];
    for (const row of ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']) {
        const line = doc.createElement('div');
        line.className = 'english-keyboard-row';
        for (const key of [...row, ...(withDelete && row === 'ZXCVBNM' ? ['Backspace'] : [])]) {
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
                if (!button.disabled) onKey(key, button);
            };
            line.appendChild(button);
            buttons.push(button);
        }
        root.appendChild(line);
    }
    return buttons;
}

/** Standard gameplay header. Fullscreen remains the single global frame control. */
function createGameplayHeader({
    mode,
    title,
    subtitle,
    headingId,
    onExit,
    document: doc = document,
}) {
    const header = doc.createElement('header');
    header.className = 'gameplay-header';
    const heading = doc.createElement('div');
    heading.className = 'gameplay-heading';
    const name = doc.createElement('h2');
    if (headingId) name.id = headingId;
    name.textContent = title;
    heading.appendChild(name);
    if (subtitle) {
        const caption = doc.createElement('p');
        caption.textContent = subtitle;
        heading.appendChild(caption);
    }
    header.appendChild(heading);
    const actions = doc.createElement('div');
    actions.className = 'gameplay-actions';
    const prefix = mode === 'battle' ? '' : `${mode}-`;
    const musicId = `${prefix}music-info-overlay`;
    const selectId = `${prefix}music-select`;
    const music = doc.getElementById(musicId) || doc.createElement('div');
    music.id = musicId;
    music.className = 'music-info-overlay';
    const select = doc.getElementById(selectId) || doc.createElement('select');
    select.id = selectId;
    select.className = 'music-track-select';
    select.setAttribute('aria-label', '배경음악 곡 선택');
    music.appendChild(select);
    actions.appendChild(music);
    const toggle = doc.createElement('button');
    toggle.id = `${mode}-music-toggle-btn`;
    toggle.className = 'music-toggle-btn';
    toggle.type = 'button';
    toggle.dataset.musicState = 'off';
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-label', '배경음악 OFF, 켜기');
    actions.appendChild(toggle);
    const exit = doc.createElement('button');
    exit.id = `${mode}-exit-btn`;
    exit.className = 'practice-nav-btn practice-nav-exit';
    exit.type = 'button';
    exit.textContent = '나가기';
    if (onExit) exit.onclick = onExit;
    actions.appendChild(exit);
    const fullscreenSpace = doc.createElement('span');
    fullscreenSpace.className = 'fullscreen-space';
    fullscreenSpace.setAttribute('aria-hidden', 'true');
    actions.appendChild(fullscreenSpace);
    header.appendChild(actions);
    return header;
}
