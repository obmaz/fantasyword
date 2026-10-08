/** 브라우저 뒤로 가기와 Escape의 유일한 진입점. DOM 변경 감시로 상태를 추측하지 않는다. */
const navigation = (() => {
    let armed = false;
    let initialized = false;
    const visible = (id) => {
        const element = document.getElementById(id);
        return !!element && element.style.display !== 'none' && element.style.display !== '';
    };

    function track(screen) {
        const state = { fantasyWordGame: true, screen };
        // 전환마다 push하지 않는다. 제목으로 돌아오면 외부 페이지로 나갈 수 있다.
        if (!armed && screen !== 'title-screen') {
            history.pushState(state, '', window.location.href);
            armed = true;
        } else {
            history.replaceState(state, '', window.location.href);
        }
    }

    function back() {
        if (dismissConfirm()) return;
        const wasPending = pendingGameStart !== null;
        cancelPendingGameStart();
        if (visible('setting-modal')) {
            if (visible('password-modal')) secret.close();
            else if (visible('gold-edit-modal')) secret.closeGoldEditModal();
            else if (visible('print-day-select-modal')) secret.closePrintDaySelect();
            else settingsManager.close();
            return;
        }
        if (visible('equipment-route-modal')) {
            game.exit();
            return;
        }
        if (visible('story-map-modal')) {
            storyJourney.close();
            return;
        }
        if (visible('story-market-modal')) {
            storyJourney.leaveMarket();
            return;
        }
        if (
            visible('inventory-modal') &&
            document.getElementById('inventory-modal').dataset.detailOpen === 'true'
        ) {
            inventory.hideDetails();
            return;
        }
        for (const [id, close] of [
            ['revenge-modal', () => revengeQuests.close()],
            ['shop-modal', () => shop.close()],
            ['inventory-modal', () => inventory.close()],
            ['statistics-modal', () => statistics.close()],
            ['result-modal', () => closeResultScreen()],
        ]) {
            if (visible(id)) {
                close();
                return;
            }
        }
        if (visible('battle-mode-story-modal') && !game.active) {
            story.closeIntro();
            return;
        }
        if (game.active || visible('battle-mode-game')) game.exit();
        else if (visible('practice-mode-game')) practiceMemorization.exit();
        else {
            resetScreenOverlays(GAME_ENTRY_OVERLAYS);
            openScreenOverlay('title-screen', false);
        }
        // 예정된 시작을 취소한 경우에도 숨겨진 제목을 반드시 복구한다.
        if (wasPending) openScreenOverlay('title-screen', false);
    }

    function init() {
        if (initialized) return;
        initialized = true;
        history.replaceState(
            { fantasyWordGame: true, screen: 'title-screen' },
            '',
            window.location.href
        );
        window.addEventListener('popstate', () => {
            armed = false;
            back();
            // 하위 설정/스토리에서 돌아온 화면에만 뒤로 가기 한 번을 예약한다.
            const top = document.querySelector('dialog[open]:not(.closing)');
            if (top) track(top.id);
        });
    }
    return { init, track, back };
})();
