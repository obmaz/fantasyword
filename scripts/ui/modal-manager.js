/** 모달 생명주기. 실제 팝업은 dialog의 top layer, 게임/제목은 일반 화면이다. */
(function () {
    const closeTimers = new Map();
    const GAME_ENTRY_OVERLAYS = Object.freeze([
        'battle-mode-story-modal',
        'practice-mode-modal',
        'battle-mode-modal',
        'skyfall-mode-modal',
    ]);
    function cancelClose(id) {
        clearTimeout(closeTimers.get(id));
        closeTimers.delete(id);
    }
    function openScreenOverlay(id, animated = true) {
        const element = document.getElementById(id);
        if (!element) return;
        cancelClose(id);
        element.classList.remove('closing');
        element.style.display = 'flex';
        const title = document.getElementById('title-screen');
        if (
            id === 'battle-mode-game' ||
            id === 'practice-mode-game' ||
            id === 'skyfall-mode-game' ||
            id === 'shell-game'
        ) {
            title.style.display = 'none';
            title.inert = true;
        } else if (id === 'title-screen') {
            if (title.inert) rotateGameTitle();
            title.inert = false;
        }
        if (element.tagName === 'DIALOG') {
            if (!element.open) element.showModal();
            if (!element.dataset.cancelBound) {
                element.addEventListener('cancel', (event) => {
                    event.preventDefault();
                    navigation.back();
                });
                element.dataset.cancelBound = 'true';
            }
        }
        window.syncFullscreenHost?.();
        navigation.track(id);
    }
    function resetScreenOverlay(id) {
        const element = document.getElementById(id);
        if (!element) return;
        cancelClose(id);
        if (element.tagName === 'DIALOG' && element.open) element.close();
        element.style.display = 'none';
        element.classList.remove('closing');
        window.syncFullscreenHost?.();
    }
    function closeScreenOverlay(id, animated = true) {
        const element = document.getElementById(id);
        if (!element) return;
        cancelClose(id);
        if (id === 'battle-mode-game') game.stop();
        if (id === 'skyfall-mode-game') skyfall.stop();
        if (animated && element.classList.contains('screen-overlay')) {
            element.classList.add('closing');
            closeTimers.set(
                id,
                setTimeout(() => resetScreenOverlay(id), APP_CONFIG.overlayCloseMs)
            );
        } else resetScreenOverlay(id);
    }
    function resetScreenOverlays(ids = GAME_ENTRY_OVERLAYS) {
        ids.forEach(resetScreenOverlay);
    }
    function closePracticeModal(animated = true) {
        closeScreenOverlay('practice-mode-modal', animated);
        closeScreenOverlay('battle-mode-modal', animated);
    }
    Object.assign(window, {
        GAME_ENTRY_OVERLAYS,
        openScreenOverlay,
        closeScreenOverlay,
        resetScreenOverlay,
        resetScreenOverlays,
        closePracticeModal,
    });
})();
