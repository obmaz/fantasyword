// ============================================
// 뷰포트 높이 고정 (모바일 주소창 대응)
// ============================================
// 모바일 브라우저에서 주소창이 나타나거나 사라질 때 100vh 값이 변하여
// 화면이 동적으로 커지거나 작아지는 문제를 방지합니다.
// 페이지 최초 로드 시 높이를 한 번 측정하여 --app-height CSS 변수에 고정합니다.

// IIFE 캡슐화: _lockedAppHeight(내부 상태)는 숨기고 함수만 window에 노출합니다.
(function () {
    let _lockedAppHeight = 0;
    const TITLE_VARIANTS = ['킹왕짱', '왕짱킹', '킹짱왕', '왕킹짱', '짱킹왕', '짱왕킹'];
    const LOBBY_BACKGROUNDS = [
        'images/theme/quest-lobby-forest.webp',
        'images/theme/quest-lobby-sunset.webp',
        'images/theme/quest-lobby-moonlight.webp',
    ];
    let previousTitleIndex = -1;
    let previousBackgroundIndex = -1;
    let fullscreenPending = false;

    /**
     * 앱 높이를 측정하고 CSS 변수로 설정합니다.
     * 주소창/키보드 높이 변화에는 고정하고 화면 너비 변경(회전) 시 갱신합니다.
     */
    function initAppHeight(force = false) {
        if (_lockedAppHeight > 0 && !force) return;

        // window.innerHeight는 현재 보이는 뷰포트 높이 (주소창 포함/미포함에 따라 다름)
        // 최초 로드 시의 값을 기준으로 고정합니다.
        _lockedAppHeight = window.innerHeight;
        document.documentElement.style.setProperty('--app-height', _lockedAppHeight + 'px');
        dlog('[layout] App height locked:', _lockedAppHeight + 'px');
    }

    /**
     * 고정된 앱 높이를 반환합니다.
     * initAppHeight()가 호출되지 않았으면 window.innerHeight를 반환합니다.
     */
    function getLockedAppHeight() {
        return _lockedAppHeight > 0 ? _lockedAppHeight : window.innerHeight;
    }

    // 제목으로 돌아올 때 세 글자의 순서를 바꾼다. 직전 제목은 반복하지 않는다.
    function rotateGameTitle() {
        const title = document.getElementById('title-header-text');
        if (!title) return;
        const available = TITLE_VARIANTS.map((_, index) => index).filter(
            (index) => index !== previousTitleIndex
        );
        previousTitleIndex = available[Math.floor(Math.random() * available.length)];
        title.textContent = TITLE_VARIANTS[previousTitleIndex];
        const logo = document.getElementById('title-logo');
        if (logo) logo.dataset.variant = String(previousTitleIndex);
        document.title = `${title.textContent} RPG`;
        const background = document.getElementById('title-background');
        if (background) {
            const choices = LOBBY_BACKGROUNDS.filter(
                (_, index) => index !== previousBackgroundIndex
            );
            const next = choices[Math.floor(Math.random() * choices.length)];
            previousBackgroundIndex = LOBBY_BACKGROUNDS.indexOf(next);
            background.src = next;
        }
    }

    // 세로 화면을 유지하며 가로:세로 비율은 최대 3:4로 제한한다.
    function getScreenWidth() {
        return Math.min(window.innerWidth, (getLockedAppHeight() * 3) / 4);
    }
    function syncScreenLayout() {
        const width = getScreenWidth();
        // 키보드로 보이는 영역만 줄어들 때 가로 배치로 전환하지 않는다.
        document.documentElement.dataset.layout =
            width > getLockedAppHeight() ? 'landscape' : 'portrait';
        document.documentElement.dataset.compact = String(getLockedAppHeight() <= 650);
        document.documentElement.style.setProperty('--title-container-width', width + 'px');
        document.documentElement.style.setProperty(
            '--title-container-height',
            getLockedAppHeight() + 'px'
        );
        syncGameScreenSize();
    }
    function syncGameScreenSize() {
        const height = getLockedAppHeight();
        const width = getScreenWidth();
        for (const id of ['battle-mode-game', 'practice-mode-game', 'skyfall-mode-game']) {
            const screen = document.getElementById(id);
            if (screen) {
                screen.style.width = width + 'px';
                screen.style.height = height + 'px';
            }
        }
        // 짧은 화면에서는 음악 선택을 HUD의 둘째 줄에 놓아 골드·문제를 가리지 않는다.
        const arena = document.querySelector('#battle-mode-game .battle-arena');
        const hud = arena?.querySelector('.battle-hud');
        const music = document.getElementById('music-info-overlay');
        const host = height <= 550 ? hud : arena;
        if (music && host && music.parentElement !== host) host.appendChild(music);
    }

    function updateFullscreenButtons() {
        const active = !!document.fullscreenElement;
        for (const button of document.querySelectorAll('[data-action="fullscreen-toggle"]')) {
            button.hidden = false;
            button.disabled = fullscreenPending;
            button.setAttribute('aria-pressed', String(active));
            const label = active ? '전체화면 나가기' : '전체화면';
            button.setAttribute('aria-label', label);
            button.title = label;
        }
    }

    function syncFullscreenHost() {
        const button = document.getElementById('global-fullscreen-btn');
        if (!button) return;
        const dialogs = [...document.querySelectorAll('dialog[open]')];
        const host = dialogs.at(-1) || document.body;
        if (button.parentElement !== host) host.appendChild(button);
    }

    function initFullscreenControls() {
        syncFullscreenHost();
        updateFullscreenButtons();
        document.addEventListener('fullscreenchange', () => {
            // 전체화면은 높이만 달라져도 주소창/키보드와 달리 크기를 갱신한다.
            initAppHeight(true);
            syncScreenLayout();
            updateFullscreenButtons();
        });
    }

    async function toggleFullscreen() {
        if (fullscreenPending) return;
        if (!document.fullscreenEnabled) {
            showToast('이 브라우저는 전체화면을 지원하지 않습니다.', 'info');
            return;
        }
        fullscreenPending = true;
        updateFullscreenButtons();
        // 전체화면 요소가 dialog보다 나중에 top layer에 올라가면 팝업을 가릴 수 있다.
        // 전환 뒤 같은 팝업을 다시 올리되 화면 상태와 navigation 이력은 유지한다.
        const dialogs = [...document.querySelectorAll('dialog[open]:not(.closing)')];
        const focused = document.activeElement;
        dialogs.forEach((dialog) => dialog.close());
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen();
        } catch {
            showToast('전체화면으로 전환할 수 없습니다. 다시 시도해 주세요.', 'info');
        } finally {
            try {
                for (const dialog of dialogs) {
                    if (
                        !dialog.open &&
                        dialog.isConnected !== false &&
                        dialog.style.display !== 'none' &&
                        !dialog.classList.contains('closing')
                    ) {
                        dialog.showModal();
                    }
                }
                syncFullscreenHost();
                if (focused?.isConnected !== false) focused?.focus({ preventScroll: true });
            } finally {
                fullscreenPending = false;
                updateFullscreenButtons();
            }
        }
    }

    // 공개 API 노출 (_lockedAppHeight는 내부 전용)
    window.initAppHeight = initAppHeight;
    window.getLockedAppHeight = getLockedAppHeight;
    window.rotateGameTitle = rotateGameTitle;
    window.syncScreenLayout = syncScreenLayout;
    window.syncGameScreenSize = syncGameScreenSize;
    window.syncFullscreenHost = syncFullscreenHost;
    window.initFullscreenControls = initFullscreenControls;
    window.toggleFullscreen = toggleFullscreen;
})();
